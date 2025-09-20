from datetime import datetime
import asyncio
import json
from google.genai.models import _GenerateContentParameters_to_vertex, _common
from google.genai.types import ThinkingConfig
import googleapiclient.discovery
from google import genai
from google.genai import types
from google.cloud import storage
import io
import json_stream
from json_stream.base import PersistentStreamingJSONObject, PersistentStreamingJSONList
from ..utils import safety_settings, upload_json_blob

from .models import AnnotationResponse


client = genai.Client(
    vertexai=True, project="videoclub-447210", location="europe-north1"
)

MODEL = "gemini-2.5-flash"
TEMP = 0


def get_title(youtube_id: str):
    API_KEY = "AIzaSyC-8WuhND8YDjvzZLNf0Jw8MGTQ3E1qCXA"

    # Get credentials and create an API client
    youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)
    request = youtube.videos().list(part="snippet", id=youtube_id)
    response = request.execute()
    return response["items"][0]["snippet"]["title"]  # pyright: ignore[reportTypedDictNotRequiredAccess]


def create_request(youtube_video_id: str, context: list[types.Content] | None = None):
    annotation_instruction = """Tu es un agent ContentID. 
Ta tâche : extraire uniquement les films et les séries dont un extrait vidéo apparaît dans l’émission "Vidéo Club" de Konbini. 
⚠️ Ignore les titres seulement cités oralement ou écrits sans extrait.

Pour chaque extrait vidéo :
- Donne le titre.
- Donne l’intervalle début/fin (MM:SS).
- Donne la position du titre affiché à l’écran : top-left, top-right, bottom-left ou bottom-right.
- Année et réalisateur si affichés.

La sortie au format JSON doit être minifiée.
"""

    generation_config = types.GenerateContentConfig(
        max_output_tokens=None,
        temperature=TEMP,
        top_p=0.95,
        response_mime_type="application/json",
        response_schema=AnnotationResponse,
        system_instruction=annotation_instruction,
        safety_settings=safety_settings,
        thinking_config=ThinkingConfig(include_thoughts=True),
    )
    if context:
        context = context + [
            types.Content(role="user", parts=[types.Part.from_text(text="Continue")])
        ]
    else:
        context = []
    params = types._GenerateContentParameters(
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_uri(
                        file_uri=f"https://www.youtube.com/watch?v={youtube_video_id}",
                        mime_type="video/*",
                    ),
                    types.Part.from_text(text="Annote"),
                ],
            ),
            *context,
        ],
        config=generation_config,
    )

    vertex_params = _GenerateContentParameters_to_vertex(client._api_client, params)
    request_dict = _common.convert_to_dict(vertex_params)
    return {"request": request_dict}


def create_batch_prediction_request_file(
    bucket_name: str, video_ids: list[str], request_blob_name: str
) -> str:
    assert request_blob_name.endswith(".jsonl")
    requests = [
        json.dumps(create_request(video_id), ensure_ascii=False)
        for video_id in video_ids
    ]

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(request_blob_name)
    blob.upload_from_string("\n".join(requests), content_type="application/jsonl")
    return blob.name  # type: ignore


def create_batch_prediction_request_file_continue(
    bucket_name: str, requests_to_continue: list[dict], request_blob_name: str
) -> str:
    assert request_blob_name.endswith(".jsonl")
    video_blobs = [
        request["request"]["contents"][0]["parts"][0]["fileData"]["file_uri"]
        for request in requests_to_continue
    ]
    ai_answers = [
        request["response"]["candidates"][0]["content"]["parts"][0]["text"]
        for request in requests_to_continue
    ]
    contexts = [
        [
            types.Content(
                role="model",
                parts=[
                    types.Part.from_text(text=ai_answer),
                ],
            )
        ]
        for ai_answer in ai_answers
    ]
    requests = [
        json.dumps(
            create_request(blob, context=context),
            ensure_ascii=False,
        )
        for blob, context in zip(video_blobs, contexts)
    ]

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(request_blob_name)
    blob.upload_from_string("\n".join(requests), content_type="application/jsonl")
    return blob.name  # type: ignore


def create_batch_prediction_job(
    bucket_name: str,
    video_ids: list[str],
    request_blob_name: str,
    destination_prefix: str,
):
    request_blob_name = create_batch_prediction_request_file(
        bucket_name, video_ids, request_blob_name
    )
    job = client.batches.create(
        model=MODEL,
        src=f"gs://{bucket_name}/{request_blob_name}",
        config=types.CreateBatchJobConfig(
            dest=f"gs://{bucket_name}/{destination_prefix}"
        ),
    )
    return job.name


def create_batch_prediction_job_continue(
    bucket_name: str,
    requests_to_continue: list[dict],
    request_blob_name: str,
    destination_prefix: str,
):
    request_blob_name = create_batch_prediction_request_file_continue(
        bucket_name, requests_to_continue, request_blob_name
    )
    job = client.batches.create(
        model=MODEL,
        src=f"gs://{bucket_name}/{request_blob_name}",
        config=types.CreateBatchJobConfig(
            dest=f"gs://{bucket_name}/{destination_prefix}"
        ),
    )
    return job.name


def persistent_streaming_object_to_python(
    obj: PersistentStreamingJSONObject | PersistentStreamingJSONList,
):
    if isinstance(obj, PersistentStreamingJSONObject):
        return {k: persistent_streaming_object_to_python(v) for k, v in obj.items()}
    elif isinstance(obj, PersistentStreamingJSONList):
        return [persistent_streaming_object_to_python(item) for item in obj]
    else:
        return obj


def get_items(json_payload: str):
    """récupère les items d'un json_payload incomplet avec json_stream"""
    f = io.StringIO(json_payload)
    items: list[PersistentStreamingJSONObject] = []
    data = json_stream.load(f, persistent=True)
    if isinstance(data, int):
        return None
    try:
        for item in data["items"]:
            items.append(item)
    except ValueError:
        pass
    done_items = [
        persistent_streaming_object_to_python(item)
        for item in items
        if not item.streaming
    ]
    return done_items


async def _annotate_videos(
    bucket_name: str,
    video_ids: list[str],
    job_id: int | None = None,
    job_name: str | None = None,
):
    job_id = int(datetime.now().timestamp()) if job_id is None else job_id
    # job_id = 1756792772
    job_prefix = f"work/{job_id}"
    output_folder = f"{job_prefix}/output"
    job_name = (
        create_batch_prediction_job(
            bucket_name,
            video_ids,
            f"{job_prefix}/annotations-request.jsonl",
            output_folder,
        )
        if job_name is None
        else job_name
    )
    # job_name = "projects/957184131556/locations/europe-west9/batchPredictionJobs/8362329087980601344"
    if job_name is None:
        raise Exception("Job creation failed")
    print(f"Job {job_name} created")
    job = client.batches.get(name=job_name)
    completed_states = set(
        [
            "JOB_STATE_SUCCEEDED",
            "JOB_STATE_FAILED",
            "JOB_STATE_CANCELLED",
            "JOB_STATE_PAUSED",
        ]
    )
    while job.state is None or job.state not in completed_states:
        await asyncio.sleep(10)
        job = client.batches.get(name=job_name)
        print(f"{datetime.now().isoformat()}: {job_name} {job.state}")

    success_states = {"JOB_STATE_SUCCEEDED"}
    if job.state not in success_states:
        print(job)
        raise Exception("Job failed")

    bucket = storage.Client().bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=output_folder)
    prediction_blob = next(
        iter([blob for blob in blobs if blob.name.endswith("predictions.jsonl")])
    )
    print(f"Downloading {prediction_blob.name}")
    annotations_done: dict[str, AnnotationResponse] = {}
    with prediction_blob.open("r") as f:
        for line in f:
            response = json.loads(line)
            video_uri = response["request"]["contents"][0]["parts"][0]["fileData"][
                "fileUri"
            ]
            video_id = video_uri.split("?v=")[-1]
            candidate = response["response"]["candidates"][0]
            if candidate["finishReason"] == "MAX_TOKENS":
                print(f"MAX_TOKENS reached for {video_id}, skipping")
                continue
            json_payload = [
                part["text"]
                for part in candidate["content"]["parts"]
                if part.get("thought", False) is False
            ][0]
            annotations_done[video_id] = AnnotationResponse.model_validate_json(
                json_payload
            )

    print(f"Annotated {len(annotations_done)} videos over {len(video_ids)}")
    return annotations_done


async def annotate_videos(
    bucket_name: str, video_ids: list[str], annotation_output_blob_list: list[str]
):
    annotation_responses = await _annotate_videos(bucket_name, video_ids)
    annotations_uploaded = []
    for video_id, annotation_response in annotation_responses.items():
        annotation_output_blob = next(
            iter([blob for blob in annotation_output_blob_list if video_id in blob])
        )
        json_payload = annotation_response.model_dump_json()
        blob_name = upload_json_blob(bucket_name, json_payload, annotation_output_blob)
        annotations_uploaded.append(blob_name)
    return annotations_uploaded


if __name__ == "__main__":
    import asyncio

    ids = ["6Ed83V4qZ_k", "LEkid5zNUBw", "xwpvUjsOAMA"]
    exts = ["mp4", "mp4", "mp4"]

    asyncio.run(
        annotate_videos(
            "videoclub-test",
            ids,
            [f"videos/{id_}/annotations.json" for id_ in ids],
        )
    )

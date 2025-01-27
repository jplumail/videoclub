from datetime import datetime
import asyncio
import json
from typing import List
from google.genai.models import _GenerateContentParameters_to_vertex, _common
import googleapiclient.discovery
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.cloud import storage
import io
import json_stream
from json_stream.base import PersistentStreamingJSONObject, PersistentStreamingJSONList
from ..utils import safety_settings, to_vertexai_compatible_schema, upload_json_blob


client = genai.Client(
    vertexai=True, project="videoclub-447210", location="europe-west9"
)

TEMP = 0


class TimeSegment(BaseModel):
    start_time: str
    end_time: str


class MediaItem(BaseModel):
    title: str
    timecode: TimeSegment
    authors: List[str] = []
    years: List[int] = []


class AnnotationResponse(BaseModel):
    items: List[MediaItem]


def get_title(youtube_id: str):
    API_KEY = "AIzaSyC-8WuhND8YDjvzZLNf0Jw8MGTQ3E1qCXA"

    # Get credentials and create an API client
    youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)
    request = youtube.videos().list(part="snippet", id=youtube_id)
    response = request.execute()
    return response["items"][0]["snippet"]["title"]


def create_request(video_blob_name: str, context: list[types.Content] | None = None):
    annotation_instruction = f"""Tu es un agent ContentID. Tu travailles pour une entreprise dans le domaine de la gestion des droits d'auteur.
Ton rôle est de recenser les films qui passent dans les vidéos de la série Video Club de Konbini pour remplir une base de donnée.
A chaque début d'annotation, il t'est donné une vidéo.

## Description de la tâche
1. Récupère les titres des films (MediaItem) des extraits vidéos de films dans la vidéo.

2. Pour chaque MediaItem, tu récupères les intervalles de début et de fin de l'extrait vidéo du film, sous la forme MM:SS.
L'intervalle va du début à la fin de l'extrait vidéo.
Il ne contient que l'extrait vidéo du film, pas le reste de la vidéo.
Si un film est montré plusieurs fois, tu ajoutes un nouveau MediaItem avec un nouvel extrait.

3. OPTIONNEL: Donne le(s) auteur(s) et l'année de sortie de chaque MediaItem mentionné(e), cela servira à identifier le film en question.
Mais si elles ne sont pas disponibles, tu n'a pas besoin de les mentionner.
Ces informations sont disponibles à l'écran, généralement en haut à gauche ou en bas à gauche.

4. Tu ne dois pas mentionner Vidéo Club dans les MediaItem: il s'agit du nom de l'émission, pas d'un film.

Ta réponse sera au format JSON suivant:
{to_vertexai_compatible_schema(AnnotationResponse.model_json_schema())}"""

    generation_config = types.GenerateContentConfig(
        max_output_tokens=None,
        temperature=TEMP,
        top_p=0.95,
        response_mime_type="application/json",
        response_schema=to_vertexai_compatible_schema(
            AnnotationResponse.model_json_schema()
        ),
        system_instruction=annotation_instruction,
        safety_settings=safety_settings,
    )
    if context:
        context = context + [
            types.Content(role="user", parts=[types.Part.from_text("Continue")])
        ]
    else:
        context = []
    params = types._GenerateContentParameters(
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_uri(video_blob_name, mime_type="video/*"),
                    types.Part.from_text("Annote"),
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
    bucket_name: str, video_blobs: list[str], request_blob_name: str
) -> str:
    assert request_blob_name.endswith(".jsonl")
    requests = [
        json.dumps(create_request(f"gs://{bucket_name}/{blob}"), ensure_ascii=False)
        for blob in video_blobs
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
                    types.Part.from_text(ai_answer),
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
    video_blobs: list[str],
    request_blob_name: str,
    destination_prefix: str,
):
    request_blob_name = create_batch_prediction_request_file(
        bucket_name, video_blobs, request_blob_name
    )
    job = client.batches.create(
        model="gemini-1.5-flash-002",
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
        model="gemini-1.5-flash-002",
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


async def annotate_videos(
    bucket_name: str, video_blob_list: list[str], annotation_output_blob_list: list[str]
):
    job_id = int(datetime.now().timestamp())
    # job_id = 1737716944
    job_prefix = f"work/{job_id}"
    output_folder = f"{job_prefix}/output"
    job_name = create_batch_prediction_job(
        bucket_name,
        video_blob_list,
        f"{job_prefix}/annotations-request.jsonl",
        output_folder,
    )
    # job_name = "projects/957184131556/locations/europe-west9/batchPredictionJobs/3944223086739456000"
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
    annotations_done = []
    with prediction_blob.open("r") as f:
        for line in f:
            try:
                response = json.loads(line)
                video_uri = response["request"]["contents"][0]["parts"][0]["fileData"][
                    "file_uri"
                ]
                video_id = video_uri.split("/")[-2]
                annotation_output_blob = next(
                    iter(
                        [
                            blob
                            for blob in annotation_output_blob_list
                            if video_id in blob
                        ]
                    )
                )
                candidate = response["response"]["candidates"][0]
                if candidate["finishReason"] == "MAX_TOKENS":
                    print(f"MAX_TOKENS reached for {annotation_output_blob}")
                    continue
                json_payload = candidate["content"]["parts"][0]["text"]
                AnnotationResponse.model_validate_json(json_payload)
                annotations_done.append(
                    upload_json_blob(bucket_name, json_payload, annotation_output_blob)
                )
            except Exception as e:
                print(f"Error for {annotation_output_blob}: {e}")

    print(f"Annotated {len(annotations_done)} videos over {len(video_blob_list)}")
    return annotations_done


if __name__ == "__main__":
    import asyncio

    ids = ["6Ed83V4qZ_k", "LEkid5zNUBw", "xwpvUjsOAMA"]
    exts = ["mp4", "mp4", "mp4"]

    asyncio.run(
        annotate_videos(
            "videoclub-test",
            [f"videos/{id_}/video.{ext}" for id_, ext in zip(ids, exts)],
            [f"videos/{id_}/annotations.json" for id_ in ids],
        )
    )

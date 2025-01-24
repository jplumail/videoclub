from datetime import datetime
import asyncio
import json
from typing import Any, List
from google.genai.models import _GenerateContentParameters_to_vertex, _common
from extractor.download import upload_json_blob
import googleapiclient.discovery
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.cloud import storage

import jsonref

client = genai.Client(
    vertexai=True, project="videoclub-447210", location="europe-west9"
)

TEMP = 0


def to_vertexai_compatible_schema(schema: dict[str, Any]):
    d: dict[str, Any] = json.loads(
        jsonref.dumps(jsonref.replace_refs(schema, proxies=False))
    )
    if "$defs" in d:
        del d["$defs"]
    return d


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


safety_settings = [
    types.SafetySetting(
        category="HARM_CATEGORY_HATE_SPEECH",
        threshold="OFF",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold="OFF",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold="OFF",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_HARASSMENT",
        threshold="OFF",
    ),
]


def get_title(youtube_id: str):
    API_KEY = "AIzaSyC-8WuhND8YDjvzZLNf0Jw8MGTQ3E1qCXA"

    # Get credentials and create an API client
    youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)
    request = youtube.videos().list(part="snippet", id=youtube_id)
    response = request.execute()
    return response["items"][0]["snippet"]["title"]


class NamesResponse(BaseModel):
    names: list[str]


async def get_names_from_title(title: str):
    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=[f"Titre: {title}"],
        config=types.GenerateContentConfig(
            max_output_tokens=8192,
            temperature=1,
            top_p=0.95,
            response_mime_type="application/json",
            response_schema=NamesResponse,
            safety_settings=safety_settings,
            system_instruction=(
                "Tu dois récupérer les noms des personnes présentes dans la vidéo d'apès son titre."
                "Un élément par personne."
                "Si le prénom et le nom de la personne sont donnés, tu dois les retourner ensemble."
                "Exemple: si le titre est 'Interview de Quentin Tarantino', tu dois retourner ['Quentin Tarantino']"
                "Exemple: si le titre est 'Interview de Quentin', tu dois retourner ['Quentin']"
            ),
        ),
    )
    if response.text:
        return NamesResponse.model_validate_json(response.text)


def create_request(video_blob_name: str):
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
Ces informations sont disponibles à l'écran, généralement en haut à gauche.

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
    params = types._GenerateContentParameters(
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_uri(video_blob_name, mime_type="video/*"),
                    types.Part.from_text("Annote"),
                ],
            )
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
        json.dumps(create_request(f"gs://{bucket_name}/{blob}"), ensure_ascii=False) for blob in video_blobs
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


async def annotate_videos(
    bucket_name: str, video_blob_list: list[str], annotation_output_blob_list: list[str]
):
    job_id = int(datetime.now().timestamp())
    job_prefix = f"work/{job_id}"
    output_folder = f"{job_prefix}/output"
    job_name = create_batch_prediction_job(
        bucket_name,
        video_blob_list,
        f"{job_prefix}/annotations-request.jsonl",
        output_folder,
    )
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
    prediction_blob = next(iter([
        blob for blob in blobs 
        if blob.name.endswith("predictions.jsonl")
    ]))
    print(f"Downloading {prediction_blob.name}")
    annotations_done = []
    with prediction_blob.open("r") as f:
        for line in f:
            try:
                response = json.loads(line)
                video_uri = response["request"]["contents"][0]["parts"][0]["fileData"]["file_uri"] # "gs://videoclub-test/xDNo7a48uOg/video.webm"
                video_id = video_uri.split("/")[-2]
                annotation_output_blob = next(iter([
                    blob for blob in annotation_output_blob_list
                    if video_id in blob
                ]))
                json_payload = response["response"]["candidates"][0]["content"]["parts"][0]["text"]
                AnnotationResponse.model_validate_json(json_payload)
                annotations_done.append(upload_json_blob(bucket_name, json_payload, annotation_output_blob))
            except Exception as e:
                print(f"Error for {annotation_output_blob}: {e}")
                continue
    return annotations_done
if __name__ == "__main__":
    import asyncio

    asyncio.run(annotate_videos("videoclub-test", ["videos/xDNo7a48uOg/video.webm"], ["videos/xDNo7a48uOg/annotations.json"]))

import json
from typing import Any, List
from extractor.download import upload_json_blob
import googleapiclient.discovery
from pydantic import BaseModel
from google import genai
from google.genai import types

import jsonref

client = genai.Client(
    vertexai=True, project="videoclub-447210", location="us-central1"
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


async def annotate(video_blob_name: str):
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
        max_output_tokens=8192,
        temperature=TEMP,
        top_p=0.95,
        response_mime_type="application/json",
        response_schema=to_vertexai_compatible_schema(AnnotationResponse.model_json_schema()),
        system_instruction=annotation_instruction,
        safety_settings=safety_settings,
    )
    json_payload = ""
    async for chunk in client.aio.models.generate_content_stream(
        model="gemini-2.0-flash-exp",
        contents=[types.Content(
            role="user",
            parts=[
                types.Part.from_uri(video_blob_name, mime_type="video/*"),
                types.Part.from_text("Annote"),
            ],
        )],
        config=generation_config,
    ):
        print(chunk.text, end="")
        if chunk.text:
            json_payload += chunk.text
    
    return AnnotationResponse.model_validate_json(json_payload)


async def annotate_video(bucket_name: str, video_blob_name: str, annotation_blob_name: str):
    assert annotation_blob_name.endswith(".json")
    result = await annotate(f"gs://{bucket_name}/{video_blob_name}")
    blob_name = upload_json_blob(
        bucket_name, result.model_dump_json(), annotation_blob_name
    )
    return blob_name


if __name__ == "__main__":
    import sys
    import asyncio
    asyncio.run(annotate_video(sys.argv[1], sys.argv[2], sys.argv[3]))

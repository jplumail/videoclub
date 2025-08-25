
from pydantic import BaseModel, TypeAdapter
from google import genai
from google.genai import types
from themoviedb.schemas.people import Person

from .models import PlaylistItemPersonnalites
from ..youtube.models import PlaylistItem
from ..utils import safety_settings, to_vertexai_compatible_schema
from ..movies.extract import search_persons


class Personnalite(BaseModel):
    nom: str


class PersonnalitesResponse(BaseModel):
    personnalites: list[Personnalite]


client = genai.Client(
    vertexai=True, project="videoclub-447210", location="europe-west9"
)


async def extract_names(title: str, thumbnail_uri: str | None):
    """
    Extract personnalites from title and description
    """
    parts = [
        types.Part.from_text(f'{{"titre": "{title}"}}'),
    ]
    if thumbnail_uri:
        parts.append(types.Part.from_uri(thumbnail_uri, mime_type="image/jpeg"))
    response = await client.aio.models.generate_content(
        model="gemini-1.5-flash-002",
        contents=[
            types.Content(
                parts=parts,
                role="user",
            )
        ],
        config=types.GenerateContentConfig(
            max_output_tokens=8192,
            temperature=0,
            top_p=0.95,
            response_mime_type="application/json",
            response_schema=to_vertexai_compatible_schema(
                PersonnalitesResponse.model_json_schema()
            ),
            safety_settings=safety_settings,
            system_instruction=(
                "Tu récupère un titre et une description d'une interview. Tu dois donner la liste de la (ou les personnes) interviewés."
            ),
        ),
    )
    if response.text:
        return PersonnalitesResponse.model_validate_json(response.text)


async def get_personnalites(item: PlaylistItem, thumbnail_uri: str | None):
    """
    Extract personnalites from title and description
    """
    personnalites = await extract_names(item.snippet.title, thumbnail_uri)
    if personnalites:
        personalites_names = [
            personnalite.nom for personnalite in personnalites.personnalites
        ]
        potential_persons = await search_persons(personalites_names)
        res = [p[0] if p else None for p in potential_persons]
    else:
        res = [None]
    person_list_adapter = TypeAdapter(list[Person | None])
    personnalites = person_list_adapter.validate_python(res)
    return PlaylistItemPersonnalites(playlist_item=item, personnalites=personnalites)

from typing import List, Union

from pydantic import BaseModel, TypeAdapter
from google import genai
from google.genai import types
from themoviedb.schemas.people import Person

from .utils import safety_settings, to_vertexai_compatible_schema
from .extract.extract import search_persons


class Personnalite(BaseModel):
    prenom: str
    nom: str


class PersonnalitesResponse(BaseModel):
    personnalites: List[Personnalite]


client = genai.Client(
    vertexai=True, project="videoclub-447210", location="europe-west9"
)


async def extract_names(title: str, description: str):
    """
    Extract personnalites from title and description
    """
    response = await client.aio.models.generate_content(
        model="gemini-1.5-flash-002",
        contents=[f'{{"titre": "{title}", "description": "{description}"}}'],
        config=types.GenerateContentConfig(
            max_output_tokens=8192,
            temperature=1,
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


async def get_personnalites(title: str, description: str):
    """
    Extract personnalites from title and description
    """
    personnalites = await extract_names(title, description)
    if personnalites:
        personalites_names = [
            f"{personnalite.prenom} {personnalite.nom}"
            for personnalite in personnalites.personnalites
        ]
        potential_persons = await search_persons(personalites_names)
        res = [p[0] if p else None for p in potential_persons]
    else:
        res = [None]
    person_list_adapter = TypeAdapter(List[Union[Person, None]])
    return person_list_adapter.validate_python(res)

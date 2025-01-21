from google import genai
from google.genai import types
import base64

from pydantic import BaseModel


class Response(BaseModel):
    names: list[str]
    years: list[int]

def get_directors_names_and_years_llm(details: str):
    client = genai.Client(
        vertexai=True, project="videoclub-447210", location="europe-west9"
    )

    textsi_1 = """Ton rôle est de trouver un/des noms de réalisateur(s), et une/des année(s) de sortie.
Si les informations ne sont pas présentes dans le texte, renvoie des listes vides.
Si les noms sont mal orthographiés, corriges les. Exemple: \"Matnieu Kassovitz\" -> \"Mathieu Kassovitz\""""

    model = "gemini-1.5-flash"
    contents = [
        types.Content(
            role="user", parts=[types.Part.from_text("""Mike White - Depuis 2021""")]
        ),
        types.Content(
            role="model",
            parts=[
                types.Part.from_text(
                    """{\"names\": [\"Mike White\"], \"years\": [2021]}"""
                )
            ],
        ),
        types.Content(
            role="user", parts=[types.Part.from_text("""Matnieu Kassovitz - 1995""")]
        ),
        types.Content(
            role="model",
            parts=[
                types.Part.from_text(
                    """{\"names\": [\"Matnieu Kassovitz\"], \"years\": [1995]}"""
                )
            ],
        ),
        types.Content(
            role="user", parts=[types.Part.from_text("""Te Chevalier noir.""")]
        ),
        types.Content(
            role="model",
            parts=[types.Part.from_text("""{\"names\": [], \"years\": []}""")],
        ),
        types.Content(
            role="user", parts=[types.Part.from_text("""Jonathan Nolan & Lisa Joy 2016-2022""")]
        ),
        types.Content(
            role="model",
            parts=[types.Part.from_text("""{\"names\": [\"Jonathan Nolan\", \"Lisa Joy\"], \"years\": [2016, 2022]}""")],
        ),
        types.Content(
            role="user", parts=[types.Part.from_text("""Joel & Ethan Coen 1996""")]
        ),
        types.Content(
            role="model",
            parts=[types.Part.from_text("""{\"names\": [\"Joel Coen\", \"Ethan Coen\"], \"years\": [1996]}""")],
        ),
    ]

    contents.append(
        types.Content(
            role="user", parts=[types.Part.from_text(f"{details}")]
        )
    )
    generate_content_config = types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=8192,
        response_modalities=["TEXT"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(
                category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"
            ),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
        response_mime_type="application/json",
        response_schema=Response.model_json_schema(),
        system_instruction=[types.Part.from_text(textsi_1)],
    )

    json_payload = ""
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        json_payload += chunk.text if chunk.text else ""
    
    res = Response.model_validate_json(json_payload)
    return res.names, res.years
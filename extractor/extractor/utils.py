import json
import re
from typing import Any
from google.genai import types
from google.cloud import storage
import jsonref


year_pattern = re.compile(r"\b\d{4}\b")


def to_vertexai_compatible_schema(schema: dict[str, Any]):
    d: dict[str, Any] = json.loads(
        jsonref.dumps(jsonref.replace_refs(schema, proxies=False))
    )
    if "$defs" in d:
        del d["$defs"]
    return d


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


def download_blob(bucket_name, file_name):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_name)
    return blob.download_as_text()


def upload_blob(bucket_name: str, source_file_name: str, destination_blob_name: str):
    """Uploads a file to the bucket."""

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    blob.upload_from_filename(source_file_name)

    return blob.name


def upload_json_blob(
    bucket_name: str, json_payload: str | Any, destination_blob_name: str
):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    if isinstance(json_payload, str):
        payload = json_payload
    else:
        payload = json.dumps(json_payload)

    blob.upload_from_string(payload, content_type="application/json")

    return blob.name

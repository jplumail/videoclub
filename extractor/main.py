import functions_framework
import typing

from extractor.annotate import annotate_video
from extractor.process_annotations import process_annotations

from google.cloud import storage

if typing.TYPE_CHECKING:
    from flask import Request
    from flask.typing import ResponseReturnValue


@functions_framework.http
def annotate(request: "Request") -> "ResponseReturnValue":
    data = request.get_json()
    bucket_name = data["bucket_name"]
    video_blob_name = data["blob_name"]
    annotation_blob_name = data["output_blob_name"]

    # check if video_blob_name exists
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blobs: list[storage.Blob] = list(bucket.list_blobs())
    for blob in blobs:
        if blob.name.startswith(video_blob_name): # type: ignore
            break
    else:
        return {"error": f"Video {video_blob_name} from bucket {bucket_name} not found"}

    try:
        annotation_blob_name = annotate_video(
            bucket_name,
            video_blob_name,
            annotation_blob_name,
        )
    except Exception as e:
        return {"error": str(e)}
    
    return {"blob_name": annotation_blob_name}


@functions_framework.http
def process_video_annotations(request: "Request") -> "ResponseReturnValue":
    data = request.get_json()
    out_blob_name = process_annotations(
        data["bucket_name"], data["blob_name"], data["output_blob_name"]
    )
    return {"blob_name": out_blob_name}

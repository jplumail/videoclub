import functions_framework
import typing

from extractor.download import download_video
from extractor.annotate import annotate_video
from extractor.process_annotations import process_annotations

if typing.TYPE_CHECKING:
    from flask import Request
    from flask.typing import ResponseReturnValue


@functions_framework.http
def download(request: "Request") -> "ResponseReturnValue":
    data = request.get_json()
    id_ = data["id"]
    bucket_name = data["bucket_name"]
    blob_name = download_video(id_, bucket_name, f"{id_}.mp4")
    return {"blob_name": blob_name}


@functions_framework.http
def annotate(request: "Request") -> "ResponseReturnValue":
    data = request.get_json()
    bucket_name = data["bucket_name"]
    video_blob_name = data["blob_name"]
    annotation_blob_name = data["output_blob_name"]

    annotation_blob_name = annotate_video(bucket_name, video_blob_name, annotation_blob_name)
    return {"blob_name": annotation_blob_name}


@functions_framework.http
def process_video_annotations(request: "Request") -> "ResponseReturnValue":
    data = request.get_json()
    out_blob_name = process_annotations(
        data["bucket_name"], data["blob_name"], data["output_blob_name"]
    )
    return {"blob_name": out_blob_name}
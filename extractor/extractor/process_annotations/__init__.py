import json
from extractor.download import upload_json_blob
from extractor.process_annotations.utils import flatten_video_annotations
from extractor.models import VideoAnnotation
from extractor.process_annotations.filter import filter_annotations
from extractor.process_annotations.group import group_annotations
from extractor.process_annotations.organize import organize_annotations
from extractor.utils import download_blob


def process_video_annotations(video_annotation: VideoAnnotation):
    annotations = flatten_video_annotations(video_annotation)
    annotations = [filter_annotations(ann) for ann in annotations]
    annotations = [group_annotations(ann) for ann in annotations]
    organized_grouped_annotations = [organize_annotations(ann) for ann in annotations]
    return organized_grouped_annotations


def process_annotations(bucket_name: str, annotation_blob_name: str, output_blob_name: str):
    blob_data = download_blob(bucket_name, annotation_blob_name)
    blob_dict = json.loads(blob_data)
    video_annotation = VideoAnnotation(**blob_dict)
    video_annotation_organized = process_video_annotations(video_annotation)

    out = [[x.model_dump(exclude={"segments"}) for x in ann] for ann in video_annotation_organized]
    blob_name = upload_json_blob(bucket_name, out, output_blob_name)
    return blob_name

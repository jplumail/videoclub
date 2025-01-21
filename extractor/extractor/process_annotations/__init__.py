import json
from extractor.process_annotations.utils import flatten_video_annotations
from extractor.models import VideoAnnotation
from extractor.process_annotations.filter import filter_annotations
from extractor.process_annotations.group import group_annotations
from extractor.process_annotations.organize import organize_annotations
from extractor.download import download_blob, upload_json_blob
from pathlib import Path


DEBUG_DIRECTORY = Path("debug")


def process_video_annotations(video_annotation: VideoAnnotation, debug=False):
    if debug:
        DEBUG_DIRECTORY.mkdir(exist_ok=True)
        (DEBUG_DIRECTORY / "0_raw_annotations.json").write_text(
            json.dumps(video_annotation.model_dump(), indent=4, ensure_ascii=False)
        )
    annotations = flatten_video_annotations(video_annotation)
    if debug:
        (DEBUG_DIRECTORY / "1_flattened_annotations.json").write_text(
            json.dumps(
                [
                    [
                        ann.model_dump(exclude={"segment": {"frames": True}})
                        for ann in sorted(
                            anns, key=lambda x: x.segment.segment.start_time_offset
                        )
                    ]
                    for anns in annotations
                ],
                indent=4,
                ensure_ascii=False,
            )
        )
    annotations = [filter_annotations(ann) for ann in annotations]
    if debug:
        (DEBUG_DIRECTORY / "2_filtered_annotations.json").write_text(
            json.dumps(
                [
                    [
                        ann.model_dump(exclude={"segment": {"frames": True}})
                        for ann in sorted(
                            anns, key=lambda x: x.segment.segment.start_time_offset
                        )
                    ]
                    for anns in annotations
                ],
                indent=4,
                ensure_ascii=False,
            )
        )
    annotations = [group_annotations(ann) for ann in annotations]
    if debug:
        (DEBUG_DIRECTORY / "3_grouped_annotations.json").write_text(
            json.dumps(
                [
                    [
                        [
                            x.model_dump(exclude={"segment": {"frames": True}})
                            for x in ann
                        ]
                        for ann in sorted(
                            anns,
                            key=lambda x: min(
                                m.segment.segment.start_time_offset for m in x
                            ),
                        )
                    ]
                    for anns in annotations
                ],
                indent=4,
                ensure_ascii=False,
            )
        )
    organized_grouped_annotations = [organize_annotations(ann) for ann in annotations]
    if debug:
        (DEBUG_DIRECTORY / "4_organized_grouped_annotations.json").write_text(
            json.dumps(
                [
                    [
                        ann.model_dump(
                            exclude={
                                "segments": True,
                                "heading_segments": {
                                    "__all__": {"segment": {"frames": True}}
                                },
                                "details_segments": {
                                    "__all__": {"segment": {"frames": True}}
                                },
                            }
                        )
                        for ann in sorted(anns, key=lambda x: x.get_start_time())
                    ]
                    for anns in organized_grouped_annotations
                ],
                indent=4,
                ensure_ascii=False,
            )
        )
    return organized_grouped_annotations


def process_annotations(
    bucket_name: str, annotation_blob_name: str, output_blob_name: str, debug=False
):
    blob_data = download_blob(bucket_name, annotation_blob_name)
    blob_dict = json.loads(blob_data)
    video_annotation = VideoAnnotation(**blob_dict)
    video_annotation_organized = process_video_annotations(
        video_annotation, debug=debug
    )

    out = [
        [x.model_dump(exclude={"segments"}) for x in ann]
        for ann in video_annotation_organized
    ]
    blob_name = upload_json_blob(bucket_name, out, output_blob_name)
    return blob_name

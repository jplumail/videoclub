import json
from pathlib import Path
from collections.abc import Sequence
from typing import Any, Mapping, Set, TypeAlias, Union
from extractor.process_annotations.utils import flatten_video_annotations
from extractor.models import VideoAnnotation
from extractor.process_annotations.filter import filter_annotations
from extractor.process_annotations.group import group_annotations
from extractor.process_annotations.organize import organize_annotations
from extractor.download import download_blob, upload_json_blob
from pydantic import BaseModel

IncEx: TypeAlias = Union[
    Set[int],
    Set[str],
    Mapping[int, Union["IncEx", bool]],
    Mapping[str, Union["IncEx", bool]],
]
SequenceBaseModel: TypeAlias = Union[Sequence["SequenceBaseModel"], BaseModel]


class DebugLogger:
    def __init__(self, enabled: bool):
        self.enabled = enabled
        self.debug_dir = Path("debug")
        if enabled:
            self.debug_dir.mkdir(exist_ok=True)

    def save_step(
        self, step_name: str, data: SequenceBaseModel, exclude_keys: IncEx | None = None
    ):
        if not self.enabled:
            return

        formatted_data = self._format_data(data, exclude_keys)

        output_file = self.debug_dir / f"{step_name}.json"
        output_file.write_text(json.dumps(formatted_data, indent=4, ensure_ascii=False))

    def _format_data(self, data: SequenceBaseModel, exclude_keys: IncEx | None):
        # checks if data is a Sequence
        if isinstance(data, Sequence):
            return [self._format_data(item, exclude_keys) for item in data]
        return data.model_dump(exclude=exclude_keys)


class AnnotationProcessor:
    def __init__(self, debug: bool = False):
        self.debug = DebugLogger(debug)

    def process_video_annotations(self, video_annotation: VideoAnnotation):
        # Save raw annotations
        self.debug.save_step("0_raw_annotations", video_annotation)

        # Flatten
        annotations = flatten_video_annotations(video_annotation)
        self.debug.save_step(
            "1_flattened_annotations",
            annotations,
            exclude_keys={"segment": {"frames": True}},
        )

        # Filter
        annotations = [filter_annotations(ann) for ann in annotations]
        self.debug.save_step(
            "2_filtered_annotations",
            annotations,
            exclude_keys={"segment": {"frames": True}},
        )

        # Group
        annotations = [group_annotations(ann) for ann in annotations]
        self.debug.save_step(
            "3_grouped_annotations",
            annotations,
            exclude_keys={"segment": {"frames": True}},
        )

        # Organize
        organized_annotations = [organize_annotations(ann) for ann in annotations]
        self.debug.save_step(
            "4_organized_grouped_annotations",
            organized_annotations,
            exclude_keys={
                "segments": True,
                "heading_segments": {"__all__": {"segment": {"frames": True}}},
                "details_segments": {"__all__": {"segment": {"frames": True}}},
            },
        )

        return organized_annotations


def process_annotations(
    bucket_name: str,
    annotation_blob_name: str,
    output_blob_name: str,
    debug: bool = False,
):
    # Download and parse blob
    blob_data = download_blob(bucket_name, annotation_blob_name)
    video_annotation = VideoAnnotation(**json.loads(blob_data))

    # Process annotations
    processor = AnnotationProcessor(debug)
    processed_annotations = processor.process_video_annotations(video_annotation)

    # Format and upload results
    output_data = [
        [x.model_dump(exclude={"segments"}) for x in ann]
        for ann in processed_annotations
    ]
    return upload_json_blob(bucket_name, output_data, output_blob_name)

from extractor.process_annotations.models import TextAnnotationSegment
from extractor.models import RotatedBoundingBox, TimeOffset, Vertex, VideoAnnotation


def average_bboxes(rotated_bboxes: list[RotatedBoundingBox]):
    return RotatedBoundingBox(
        vertices=[
            Vertex(
                x=sum([bbox.vertices[i].x or 0 for bbox in rotated_bboxes])
                / len(rotated_bboxes),
                y=sum([bbox.vertices[i].y or 0 for bbox in rotated_bboxes])
                / len(rotated_bboxes),
            )
            for i in range(4)
        ]
    )


def are_time_offsets_overlapping(
    start_time1: TimeOffset,
    end_time1: TimeOffset,
    start_time2: TimeOffset,
    end_time2: TimeOffset,
):
    return (
        start_time1 <= end_time2
        and start_time1 >= start_time2
        or end_time1 <= end_time2
        and end_time1 >= start_time2
    ) or (
        start_time2 <= end_time1
        and start_time2 >= start_time1
        or end_time2 <= end_time1
        and end_time2 >= start_time1
    )


def flatten_video_annotations(video_annotation: VideoAnnotation):
    return [
        [
            TextAnnotationSegment(segment=segment, text=annotation.text)
            for annotation in annotation_result.text_annotations
            for segment in annotation.segments
        ]
        for annotation_result in video_annotation.annotation_results
    ]
from extractor.process_annotations.models import TextAnnotationSegment
from extractor.process_annotations.utils import are_time_offsets_overlapping



def are_segments_overlapping(
    segment1: TextAnnotationSegment, segment2: TextAnnotationSegment
):
    return are_time_offsets_overlapping(
        segment1.segment.segment.start_time_offset,
        segment1.segment.segment.end_time_offset,
        segment2.segment.segment.start_time_offset,
        segment2.segment.segment.end_time_offset,
    )



def group_segments(segments: list[TextAnnotationSegment]):
    """Overlapping segments are grouped together.
    In a group, all segments overlap with each other.
    If a segment overlaps with multiple groups, it is added to all of them.

    Args:
        segments (list[TextSegment]): List of sorted segments to group.
    """
    grouped_segments: list[list[TextAnnotationSegment]] = []
    for segment in segments:
        if not grouped_segments:
            grouped_segments.append([segment])
            continue

        last_group = grouped_segments[-1]
        if all([are_segments_overlapping(segment, x) for x in last_group]):
            last_group.append(segment)
        else:
            grouped_segments.append(
                [
                    segment,
                    *[x for x in last_group if are_segments_overlapping(segment, x)],
                ]
            )
            last_group = grouped_segments[-1]

    return grouped_segments



def group_annotations(annotations: list[TextAnnotationSegment]):
    sorted_annotations = sorted(
        annotations, key=lambda x: x.segment.segment.start_time_offset
    )
    grouped_annotations = group_segments(sorted_annotations)
    return grouped_annotations
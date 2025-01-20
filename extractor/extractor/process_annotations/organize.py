from difflib import SequenceMatcher
from extractor.process_annotations.models import (
    TextAnnotationSegment,
    TextAnnotationSegmentGroupOrganized,
)
from extractor.process_annotations.utils import (
    are_time_offsets_overlapping,
    average_bboxes,
)
from extractor.models import Frame, Segment, TextSegment, TimeOffset
import numpy as np


def organize_group(group: list[TextAnnotationSegment]):
    if len(group) < 2:
        return None
    mean_y = [
        sum(
            [
                sum([frame.rotated_bounding_box.vertices[i].y or 1 for i in range(4)])
                / 4
                for frame in segment.segment.frames
            ]
        )
        / len(segment.segment.frames)
        for segment in group
    ]
    segments_sorted = sorted(group, key=lambda x: mean_y[group.index(x)])
    details_segment = segments_sorted[-1]
    heading_segments = segments_sorted[:-1]
    return TextAnnotationSegmentGroupOrganized(
        heading_segments=heading_segments, details_segments=[details_segment]
    )


def groups_overlap(organized_annotations: list[TextAnnotationSegmentGroupOrganized]):
    last_group_start_time = None
    last_group_end_time = None
    last_group = None
    groups: list[list[TextAnnotationSegmentGroupOrganized]] = []
    for group in organized_annotations:
        if not (
            last_group and last_group_start_time and last_group_end_time
        ) or not are_time_offsets_overlapping(
            last_group_start_time,
            last_group_end_time,
            group.get_start_time(),
            group.get_end_time(),
        ):
            if last_group:
                groups.append(last_group)
            last_group = [group]
            last_group_start_time = group.get_start_time()
            last_group_end_time = group.get_end_time()
        else:
            last_group.append(group)
            last_group_start_time = min(last_group_start_time, group.get_start_time())
            last_group_end_time = max(last_group_end_time, group.get_end_time())

    if last_group:
        groups.append(last_group)

    return groups


def similarity_ratio(a: str, b: str):
    """Calculates the similarity ratio between two strings.

    Args:
      a: The first string.
      b: The second string.

    Returns:
      The similarity ratio between the two strings.
    """
    return SequenceMatcher(None, a, b).ratio()


def text_annotation_segment_similarity(
    a: list[TextAnnotationSegment], b: list[TextAnnotationSegment]
):
    return similarity_ratio("".join([x.text for x in a]), "".join([x.text for x in b]))


def argmax(a):
    return max(range(len(a)), key=lambda x: a[x])


def make_subgroups(groups: list[TextAnnotationSegmentGroupOrganized]):
    heading_segments = [g.heading_segments for g in groups]
    details_segments = [g.details_segments for g in groups]

    # find the most similar group
    # similarity matrix
    heading_similarity = np.asarray(
        [
            [text_annotation_segment_similarity(x, y) for y in heading_segments]
            for x in heading_segments
        ]
    )
    details_similarity = np.asarray(
        [
            [text_annotation_segment_similarity(x, y) for y in details_segments]
            for x in details_segments
        ]
    )
    similarity = heading_similarity * details_similarity

    similarity_threshold = 0.8
    subgroups_indices: list[list[int]] = []
    for i in range(len(groups)):
        if i == 0:
            subgroups_indices.append([0])
        else:
            max_similarity = max(similarity[i, :i])
            j = argmax(similarity[i, :i])
            if max_similarity > similarity_threshold:
                for subgroup in subgroups_indices:
                    if j in subgroup:
                        subgroup.append(i)
                        break
                else:
                    subgroups_indices.append([i])
            else:
                subgroups_indices.append([i])

    subgroups = [[groups[i] for i in sub] for sub in subgroups_indices]
    return subgroups


def cut_segment(
    segment: TextAnnotationSegment, start_time: TimeOffset, end_time: TimeOffset
):
    new_start_time = max(
        [segment.segment.segment.start_time_offset, start_time],
    )
    new_end_time = min(
        [segment.segment.segment.end_time_offset, end_time],
    )

    return TextAnnotationSegment(
        text=segment.text,
        segment=TextSegment(
            segment=Segment(
                start_time_offset=new_start_time, end_time_offset=new_end_time
            ),
            confidence=segment.segment.confidence,
            frames=[
                f
                for f in segment.segment.frames
                if f.time_offset >= new_start_time and f.time_offset <= new_end_time
            ],
        ),
    )


def merge_segments(segments: list[Segment]):
    smallest_time_offset = min(
        [x for x in segments], key=lambda x: x.start_time_offset
    ).start_time_offset
    largest_time_offset = max(
        [x for x in segments], key=lambda x: x.end_time_offset
    ).end_time_offset
    return Segment(
        start_time_offset=smallest_time_offset, end_time_offset=largest_time_offset
    )


def merge_confidence(confidences: list[float]):
    return sum(confidences) / len(confidences)


def merge_frames(frames: list[list[Frame]]):
    sorted_frames = [sorted(x, key=lambda x: x.time_offset) for x in frames]
    output_frames: list[Frame] = []
    while any([len(x) > 0 for x in sorted_frames]):
        smallest_time_offset = min(
            [x[0] for x in sorted_frames if len(x) > 0], key=lambda x: x.time_offset
        ).time_offset
        output_frames.append(
            Frame(
                rotated_bounding_box=average_bboxes(
                    [
                        x[0].rotated_bounding_box
                        for x in sorted_frames
                        if len(x) > 0 and x[0].time_offset == smallest_time_offset
                    ]
                ),
                time_offset=smallest_time_offset,
            )
        )
        for i, frames_ in enumerate(sorted_frames):
            if len(frames_) > 0 and frames_[0].time_offset == smallest_time_offset:
                sorted_frames[i] = frames_[1:]

    return output_frames


def merge_text_segments(segments: list[TextSegment]):
    return TextSegment(
        segment=merge_segments([x.segment for x in segments]),
        confidence=merge_confidence([x.confidence for x in segments]),
        frames=merge_frames([x.frames for x in segments]),
    )


def merge_annotations(annotations: list[TextAnnotationSegment]):
    best_text = max(annotations, key=lambda x: x.segment.confidence).text
    return TextAnnotationSegment(
        segment=merge_text_segments([x.segment for x in annotations]), text=best_text
    )


def merge_annotations_group_organized(group: list[TextAnnotationSegmentGroupOrganized]):
    heading_segments = [
        merge_annotations(x) for x in zip(*[g.heading_segments for g in group])
    ]
    details_segment = [
        merge_annotations(x) for x in zip(*[g.details_segments for g in group])
    ]

    # heading and details must have the same time range
    heading_start_time = min(
        [x.segment.segment.start_time_offset for x in heading_segments]
    )
    heading_end_time = max(
        [x.segment.segment.end_time_offset for x in heading_segments]
    )

    details_start_time = min(
        [x.segment.segment.start_time_offset for x in details_segment]
    )
    details_end_time = max([x.segment.segment.end_time_offset for x in details_segment])

    # merge time range: intersection
    start_time = max(heading_start_time, details_start_time)
    end_time = min(heading_end_time, details_end_time)

    heading_segments = [cut_segment(x, start_time, end_time) for x in heading_segments]
    details_segment = [cut_segment(x, start_time, end_time) for x in details_segment]

    return TextAnnotationSegmentGroupOrganized(
        heading_segments=heading_segments, details_segments=details_segment
    )


def merge_overlapping_group(group: list[TextAnnotationSegmentGroupOrganized]):
    if len(group) > 1:
        merged_groups: list[TextAnnotationSegmentGroupOrganized] = []
        subgroups = make_subgroups(group)
        for subgroup in subgroups:
            merged_subgroup = merge_annotations_group_organized(subgroup)
            merged_groups.append(merged_subgroup)
        return merged_groups
    else:
        return group


def merge_groups(groups: list[TextAnnotationSegmentGroupOrganized]):
    overlapping_groups = groups_overlap(groups)
    return [g for group in overlapping_groups for g in merge_overlapping_group(group)]


def organize_annotations(annotations_groups: list[list[TextAnnotationSegment]]):
    organized_annotations_groups = [organize_group(g) for g in annotations_groups]
    organized_annotations_groups = [x for x in organized_annotations_groups if x]

    # Merge similar groups
    merged_groups = merge_groups(organized_annotations_groups)

    return merged_groups

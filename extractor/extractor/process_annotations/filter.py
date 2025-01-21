from extractor.process_annotations.models import TextAnnotationSegment
from extractor.models import RotatedBoundingBox

from extractor.process_annotations.utils import average_bboxes


CONFIDENCE_THRESHOLD = 0.90



def is_bbox_top_left(bbox: RotatedBoundingBox):
    xx, yy = list(zip(*[(d.x, d.y) for d in bbox.vertices]))
    xmin, ymin = min(xx), min(yy)

    return xmin < 0.2 and ymin < 0.3


def is_bbox_too_large(bbox: RotatedBoundingBox):
    xx, yy = list(zip(*[(d.x, d.y) for d in bbox.vertices]))
    xmin, ymin = min(xx), min(yy)
    xmax, ymax = max(xx), max(yy)
    surface = (xmax - xmin) * (ymax - ymin)

    return surface > 0.2


def is_bbox_too_small(bbox: RotatedBoundingBox):
    xx, yy = list(zip(*[(d.x, d.y) for d in bbox.vertices]))
    xmin, ymin = min(xx), min(yy)
    xmax, ymax = max(xx), max(yy)

    return (xmax - xmin) < 0.01 or (ymax - ymin) < 0.02


def is_bbox_vertical(bbox: RotatedBoundingBox):
    xx, yy = list(zip(*[(d.x, d.y) for d in bbox.vertices]))
    xmin, ymin = min(xx), min(yy)
    xmax, ymax = max(xx), max(yy)

    return (xmax - xmin) < (ymax - ymin)


def filter_annotation(annotation: TextAnnotationSegment):
    return (
        annotation.segment.confidence >= CONFIDENCE_THRESHOLD
        and is_bbox_top_left(
            average_bboxes([f.rotated_bounding_box for f in annotation.segment.frames])
        )
        and not is_bbox_too_large(
            average_bboxes([f.rotated_bounding_box for f in annotation.segment.frames])
        )
        and not is_bbox_too_small(
            average_bboxes([f.rotated_bounding_box for f in annotation.segment.frames])
        )
        and not is_bbox_vertical(
            average_bboxes([f.rotated_bounding_box for f in annotation.segment.frames])
        )
    )


def filter_annotations(annotations: list[TextAnnotationSegment]):
    return [annotation for annotation in annotations if filter_annotation(annotation)]
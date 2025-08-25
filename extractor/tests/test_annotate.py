import json
from pathlib import Path
from extractor.annotate.models import MediaItem
import jiwer

from extractor.annotate.annotate import AnnotationResponse


def iou_interval(gt_start, gt_end, pred_start, pred_end):
    """Calculate the intersection over union of two intervals."""
    # Calculate intersection
    intersection_start = max(gt_start, pred_start)
    intersection_end = min(gt_end, pred_end)
    intersection = max(0, intersection_end - intersection_start)

    # Calculate union
    union_start = min(gt_start, pred_start)
    union_end = max(gt_end, pred_end)
    union = union_end - union_start

    # Calculate IoU
    iou = intersection / union if union > 0 else 0
    return iou


def timecode_to_seconds(timecode: str):
    """Convert a timecode string to seconds."""
    minutes, seconds = timecode.split(":")
    seconds = int(minutes) * 60 + int(seconds)
    return seconds


def iou_match(gt: AnnotationResponse, pred: AnnotationResponse):
    """Match ground truth annotations with predictions using IoU.
    IoU over 0.5 is considered a match.
    """
    pairs: list[tuple[MediaItem, MediaItem]] = []
    for gt_annotation in gt.items:
        for pred_annotation in pred.items:
            iou = iou_interval(
                timecode_to_seconds(gt_annotation.timecode.start_time),
                timecode_to_seconds(gt_annotation.timecode.end_time),
                timecode_to_seconds(pred_annotation.timecode.start_time),
                timecode_to_seconds(pred_annotation.timecode.end_time),
            )
            if iou > 0.5:
                pairs.append((gt_annotation, pred_annotation))
                break
        else:
            # print(f"No match for {gt_annotation}")
            pass
    return pairs


def cer_score(gt: MediaItem, pred: MediaItem):
    title_score = jiwer.cer(gt.title, pred.title)
    author_score = jiwer.cer(" ".join(gt.authors), " ".join(pred.authors))
    years_score = jiwer.cer(
        " ".join(map(str, gt.years)), " ".join(map(str, pred.years))
    )

    return 1 - (title_score + author_score + years_score) / 3  # type: ignore


def test_annotate():
    gt = AnnotationResponse.model_validate_json(
        (
            Path(__file__).parent / "groundtruth" / "HLUe85q1hNM" / "annotations.json"
        ).read_text()
    )
    pred = AnnotationResponse.model_validate_json(
        json.loads(
            (
                Path(__file__).parent
                / "predictions"
                / "HLUe85q1hNM"
                / "1737987455.json"
            ).read_text()
        )["response"]["candidates"][0]["content"]["parts"][0]["text"]
    )

    # interval matching
    pairs = iou_match(gt, pred)
    precision = len(pairs) / len(pred.items)
    recall = len(pairs) / len(gt.items)
    print(f"Precision: {precision:.2f}, Recall: {recall:.2f}")

    cer_mean = sum(
        [
            cer_score(gt_annotation, pred_annotation)
            for gt_annotation, pred_annotation in pairs
        ]
    ) / len(pairs)
    print(f"CER: {cer_mean:.2f}")


test_annotate()

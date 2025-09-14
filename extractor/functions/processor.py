"""Pub/Sub Cloud Function (Gen2) to process a single video.

Consumes messages of the form:
  {"id": "<youtube_id>", "bucket": "<gcs-bucket>"}

Runs the pipeline steps for that single ID:
  get_infos -> annotate -> extract
"""

from __future__ import annotations

import base64
import json
import asyncio
import logging
import time

import functions_framework
from cloudevents.http.event import CloudEvent  # type: ignore

from scripts.get_infos_videos import get_infos
from scripts.annotate_videos import annotate_all_videos
from scripts.extract_movies_videos import extract_all_videos


def _parse_message_data(cloud_event: CloudEvent) -> tuple[str, str]:
    """Extract (video_id, bucket) from Pub/Sub CloudEvent.

    Accepts data formats:
    - JSON object with keys {"id"|"video_id", "bucket"}
    - Plain string: video id; bucket defaults to videoclub-test
    """
    data_field = cloud_event.data.get("message", {}).get("data")
    if not data_field:
        raise ValueError("Missing message.data in Pub/Sub event")
    try:
        decoded = base64.b64decode(data_field).decode("utf-8")
    except Exception as exc:
        raise ValueError(f"Invalid base64 payload: {exc}")

    bucket = "videoclub-test"
    try:
        obj = json.loads(decoded)
        if isinstance(obj, dict):
            video_id = obj.get("id") or obj.get("video_id")
            if not video_id:
                raise ValueError("Payload missing 'id' or 'video_id'")
            bucket = obj.get("bucket", bucket)
            return str(video_id), str(bucket)
    except json.JSONDecodeError:
        # treat as raw video id string
        pass

    # Fallback: raw string is the video ID
    return decoded.strip(), bucket


@functions_framework.cloud_event
def processor(cloud_event: CloudEvent):
    logger = logging.getLogger(__name__)
    t0 = time.perf_counter()

    video_id, bucket = _parse_message_data(cloud_event)
    logger.info("processor start: id=%s bucket=%s", video_id, bucket)

    try:
        t = time.perf_counter()
        logger.info("step get_infos: start id=%s", video_id)
        asyncio.run(get_infos(bucket, [video_id]))
        logger.info("step get_infos: done id=%s duration=%.3fs", video_id, time.perf_counter() - t)

        t = time.perf_counter()
        logger.info("step annotate: start id=%s", video_id)
        asyncio.run(annotate_all_videos(bucket, [video_id]))
        logger.info("step annotate: done id=%s duration=%.3fs", video_id, time.perf_counter() - t)

        t = time.perf_counter()
        logger.info("step extract: start id=%s", video_id)
        asyncio.run(extract_all_videos(bucket, [video_id]))
        logger.info("step extract: done id=%s duration=%.3fs", video_id, time.perf_counter() - t)
    except Exception:
        logger.exception("processor error: id=%s bucket=%s", video_id, bucket)
        # Re-raise to signal failure so Pub/Sub retries
        raise
    finally:
        logger.info(
            "processor complete: id=%s bucket=%s total_duration=%.3fs",
            video_id,
            bucket,
            time.perf_counter() - t0,
        )

    # No return value required for background events
    return None

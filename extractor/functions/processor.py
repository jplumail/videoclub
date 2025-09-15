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
from google.cloud import firestore
from datetime import datetime, UTC


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

    # Extract attributes (batch context) and payload
    msg = cloud_event.data.get("message", {}) if hasattr(cloud_event, "data") else {}
    attrs = msg.get("attributes", {}) if isinstance(msg, dict) else {}
    batch_id = attrs.get("batch_id")

    video_id, bucket = _parse_message_data(cloud_event)
    prefix = f"batch_id={batch_id} " if batch_id else ""
    logger.info("%sprocessor start: id=%s bucket=%s", prefix, video_id, bucket)

    fs: firestore.Client | None = None
    batch_ref = None
    done_ref = None
    if batch_id:
        fs = firestore.Client()
        batch_ref = fs.collection("batches").document(batch_id)
        done_ref = batch_ref.collection("done").document(video_id)

    try:
        t = time.perf_counter()
        logger.info("step get_infos: start id=%s", video_id)
        asyncio.run(get_infos(bucket, [video_id]))
        logger.info("step get_infos: done id=%s duration=%.3fs", video_id, time.perf_counter() - t)

        t = time.perf_counter()
        logger.info("step annotate: start id=%s", video_id)
        out = asyncio.run(annotate_all_videos(bucket, [video_id]))
        logger.info("step annotate: done id=%s duration=%.3fs", video_id, time.perf_counter() - t)

        try:
            video_blob, = out
            logger.info("step annotate: annotation output for id=%s blob=%s", video_id, video_blob)
        except ValueError:
            logger.warning("step annotate: no annotation output for id=%s", video_id)
            raise

        t = time.perf_counter()
        logger.info("step extract: start id=%s", video_id)
        asyncio.run(extract_all_videos(bucket, [video_id]))
        logger.info("step extract: done id=%s duration=%.3fs", video_id, time.perf_counter() - t)
    except Exception:
        logger.exception("%sprocessor error: id=%s bucket=%s", prefix, video_id, bucket)
        # Best-effort: mark failed once in Firestore for fan-in progress
        if batch_id and fs and batch_ref:
            failed_ref = batch_ref.collection("failed").document(video_id)
            now = datetime.now(UTC)
            @firestore.transactional
            def txn_mark_failed(transaction: firestore.Transaction):
                snapshot = failed_ref.get(transaction=transaction)
                if not snapshot.exists:
                    transaction.set(failed_ref, {"video_id": video_id, "failed_at": now})
                    transaction.update(batch_ref, {"failed": firestore.Increment(1)})

            txn = fs.transaction()
            try:
                txn_mark_failed(txn)
                logger.info("%smarked failed in batch: id=%s", prefix, batch_id)
            except Exception:
                logger.exception("%sfailed to update batch failure id=%s", prefix, batch_id)
        # Re-raise to signal failure so Pub/Sub retries
        raise
    finally:
        logger.info(
            "%sprocessor complete: id=%s bucket=%s total_duration=%.3fs",
            prefix,
            video_id,
            bucket,
            time.perf_counter() - t0,
        )

    # On success: idempotently mark completion in Firestore and increment counter
    if batch_id and fs and batch_ref and done_ref:
        now = datetime.now(UTC)
        @firestore.transactional
        def txn_mark_done(transaction: firestore.Transaction):
            snapshot = done_ref.get(transaction=transaction)
            if not snapshot.exists:
                transaction.set(done_ref, {"video_id": video_id, "completed_at": now})
                transaction.update(batch_ref, {"completed": firestore.Increment(1)})

        txn = fs.transaction()
        try:
            txn_mark_done(txn)
            logger.info("%smarked done in batch: id=%s", prefix, batch_id)
        except Exception:
            logger.exception("%sfailed to update batch completion id=%s", prefix, batch_id)

    # No return value required for background events
    return None

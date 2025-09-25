"""Firestore onUpdate function to fan-in processor completions.

When a batch document in `batches/{batch_id}` reaches completed == total,
and status != 'done', this function marks it done and publishes a message to
the prepare-data Pub/Sub topic so the CloudEvent function can run.
"""

from __future__ import annotations

import logging
import os

import functions_framework
from cloudevents.http.event import CloudEvent  # type: ignore
from google.cloud import firestore
from google.cloud import pubsub
import google.auth


logger = logging.getLogger(__name__)


def _extract_batch_id_from_subject(subject: str | None) -> str | None:
    if not subject:
        return None
    # Expected shape:
    # Cloud Functions subject: "documents/batches/{batch_id}"
    path = subject
    parts = path.strip("/").split("/")
    # If begins with 'documents/batches/{id}'
    if len(parts) == 3 and parts[0] == "documents" and parts[1] == "batches":
        return parts[2]
    return None


def _project_id() -> str:
    _, project_id = google.auth.default()
    return project_id or ""


def _publish_prepare_data(bucket: str, batch_id: str | None, logger: logging.Logger) -> None:
    """Publish a message to trigger prepare_data via Pub/Sub."""

    topic_name = os.environ.get("PREPARE_DATA_TOPIC")
    if not topic_name:
        logger.error("aggregator: PREPARE_DATA_TOPIC not set; skipping publish")
        return

    publisher = pubsub.PublisherClient()
    topic_path = publisher.topic_path(_project_id(), topic_name)
    payload = b""

    attributes: dict[str, str] = {"bucket": bucket}
    if batch_id:
        attributes["batch_id"] = batch_id

    try:
        future = publisher.publish(topic_path, payload, **attributes)
        future.result(timeout=10)
        logger.info(
            "aggregator: published prepare_data message",
            extra={"topic": topic_path, "bucket": bucket, "batch_id": batch_id},
        )
    except Exception:
        logger.exception("aggregator: failed to publish prepare_data message for bucket=%s", bucket)


@functions_framework.cloud_event
def aggregator(event: CloudEvent):
    logger = logging.getLogger(__name__)
    subject = event.get("subject") if hasattr(event, "get") else None
    batch_id = _extract_batch_id_from_subject(subject)
    if not batch_id:
        logger.warning("aggregator: missing batch_id in subject=%s", subject)
        return None

    fs = firestore.Client()
    batch_ref = fs.collection("batches").document(batch_id)
    snap = batch_ref.get()
    if not snap.exists:
        logger.warning("aggregator: batch not found: %s", batch_id)
        return None

    data = snap.to_dict() or {}
    total = int(data.get("total", 0) or 0)
    completed = int(data.get("completed", 0) or 0)
    failed = int(data.get("failed", 0) or 0)
    status = str(data.get("status", ""))
    bucket = str(data.get("bucket", ""))
    logger.info(
        "aggregator: batch_id=%s total=%d completed=%d failed=%d status=%s bucket=%s",
        batch_id,
        total,
        completed,
        failed,
        status,
        bucket,
    )

    if total == 0:
        logger.info("aggregator: empty batch; nothing to do")
        return None

    if (completed + failed) < total or status == "done":
        logger.info("aggregator: not complete or already done")
        return None

    # Transition to done and publish prepare-data exactly once
    def txn_mark_done(transaction: firestore.Transaction):
        current = batch_ref.get(transaction=transaction)
        if not current.exists:
            return
        cur = current.to_dict() or {}
        if (int(cur.get("completed", 0) or 0) + int(cur.get("failed", 0) or 0)) >= int(cur.get("total", 0) or 0) and cur.get("status") != "done":
            transaction.update(batch_ref, {"status": "done"})

    txn = fs.transaction()
    try:
        firestore.transactional(txn_mark_done)(txn)  # type: ignore[arg-type]
    except Exception:
        logger.exception("aggregator: transaction failed for batch %s", batch_id)
        return None

    # After the state change, publish to prepare-data topic
    if not bucket:
        logger.error("aggregator: bucket missing; skipping prepare_data publish")
        return None

    _publish_prepare_data(bucket, batch_id, logger)

    return None

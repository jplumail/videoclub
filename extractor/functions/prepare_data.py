"""Pub/Sub-triggered Cloud Function to run prepare_data for a bucket."""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime

import functions_framework
import google.auth
from google.cloud import pubsub
from cloudevents.http.event import CloudEvent  # type: ignore

from scripts.prepare_data import prepare_data as run_prepare

def _project_id() -> str:
    _, project_id = google.auth.default()
    return project_id or ""

def _extract_bucket(event: CloudEvent, default_bucket: str, logger: logging.Logger) -> str:
    """Return the bucket name from Pub/Sub CloudEvent attributes."""

    envelope = getattr(event, "data", None)
    message = envelope.get("message") if isinstance(envelope, dict) else None
    if not isinstance(message, dict):
        logger.warning("prepare_data: missing Pub/Sub message; using default bucket")
        return default_bucket

    attributes = message.get("attributes") or {}
    if isinstance(attributes, dict):
        bucket = attributes.get("bucket")
        if isinstance(bucket, str) and bucket.strip():
            return bucket.strip()

    logger.warning("prepare_data: bucket attribute missing; using default bucket")
    return default_bucket


@functions_framework.cloud_event
def prepare_data(event: CloudEvent):
    logger = logging.getLogger(__name__)

    default_bucket = os.environ.get("BUCKET", "videoclub-test")
    bucket = _extract_bucket(event, default_bucket, logger)

    logger.info("prepare_data: start bucket=%s", bucket)
    try:
        run_prepare(bucket)
        _publish_rebuild_message(bucket, logger)
    except Exception:
        logger.exception("prepare_data: error bucket=%s", bucket)
        raise


def _publish_rebuild_message(bucket: str, logger: logging.Logger) -> None:
    """Publish a rebuild notification to Pub/Sub, logging and continuing on errors."""

    topic_name = os.environ.get("REBUILD_SITE_TOPIC", "videoclub-rebuild-site")
    publisher = pubsub.PublisherClient()
    project_id = _project_id()
    topic_path = publisher.topic_path(project_id, topic_name)

    payload = {"bucket": bucket, "ts": datetime.now(UTC).isoformat()}

    try:
        future = publisher.publish(topic_path, json.dumps(payload).encode("utf-8"))
        future.result(timeout=10)
        logger.info(
            "prepare_data: published rebuild message", extra={"topic": topic_path}
        )
    except Exception:
        logger.exception("prepare_data: failed to publish rebuild message to %s", topic_path)

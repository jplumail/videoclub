"""HTTP Cloud Function (Gen2) to run prepare_data for a bucket.

Endpoint:
- POST with JSON {"bucket": "<name>"} or GET with ?bucket=...
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime

from flask import Request, jsonify
import functions_framework
import google.auth
from google.cloud import pubsub

from scripts.prepare_data import prepare_data as run_prepare

def _project_id() -> str:
    _, project_id = google.auth.default()
    return project_id or ""


@functions_framework.http
def prepare_data(request: Request):
    logger = logging.getLogger(__name__)

    default_bucket = os.environ.get("BUCKET", "videoclub-test")
    bucket = request.args.get("bucket", None)
    if not bucket:
        try:
            payload = request.get_json(silent=True) or {}
            bucket = payload.get("bucket", default_bucket)
        except Exception:
            bucket = default_bucket

    logger.info("prepare_data: start bucket=%s", bucket)
    try:
        run_prepare(bucket)
        _publish_rebuild_message(bucket, logger)
        return jsonify({"status": "ok", "bucket": bucket})
    except Exception as exc:
        logger.exception("prepare_data: error bucket=%s", bucket)
        return jsonify({"status": "error", "error": str(exc)}), 500


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

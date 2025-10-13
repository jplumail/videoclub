"""HTTP Cloud Function to run prepare_data for a bucket."""

from __future__ import annotations

import logging
import os

import functions_framework
from flask import Request, jsonify

from scripts.prepare_data import prepare_data as run_prepare


def _resolve_bucket(
    request: Request, default_bucket: str, logger: logging.Logger
) -> str:
    """Return the bucket provided via query string or JSON payload."""

    bucket = request.args.get("bucket", type=str)
    if bucket:
        bucket = bucket.strip()
        if bucket:
            return bucket

    try:
        payload = request.get_json(silent=True)
    except Exception:
        logger.warning("prepare_data: invalid JSON payload; using default bucket")
        return default_bucket

    if isinstance(payload, dict):
        candidate = payload.get("bucket")
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    return default_bucket


@functions_framework.http
def prepare_data(request: Request):
    logger = logging.getLogger(__name__)
    if request.method not in {"POST", "PUT"}:
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "method_not_allowed",
                    "allowed_methods": ["POST", "PUT"],
                }
            ),
            405,
        )

    default_bucket = os.environ.get("BUCKET", "videoclub-test")
    bucket = _resolve_bucket(request, default_bucket, logger)

    logger.info("prepare_data: start bucket=%s", bucket)
    try:
        run_prepare(bucket)
    except Exception:
        logger.exception("prepare_data: error bucket=%s", bucket)
        return jsonify({"status": "error", "bucket": bucket}), 500
    logger.info("prepare_data: completed bucket=%s", bucket)

    return jsonify({"status": "ok", "bucket": bucket})

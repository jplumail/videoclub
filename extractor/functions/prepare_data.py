"""HTTP Cloud Function (Gen2) to run prepare_data for a bucket.

Endpoint:
- POST with JSON {"bucket": "<name>"} or GET with ?bucket=...
"""

from __future__ import annotations

import logging
import os
from flask import Request, jsonify
import functions_framework

from scripts.prepare_data import prepare_data as run_prepare


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
        return jsonify({"status": "ok", "bucket": bucket})
    except Exception as exc:
        logger.exception("prepare_data: error bucket=%s", bucket)
        return jsonify({"status": "error", "error": str(exc)}), 500


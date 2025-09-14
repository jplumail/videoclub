"""HTTP Cloud Function (Gen2) to discover unprocessed videos.

This function:
- Lists playlist items via extractor.youtube.get_videos_videoclub
- Checks GCS for required artifacts per video
- Publishes a Pub/Sub message for each video missing artifacts

Environment variables:
- GOOGLE_CLOUD_PROJECT or GCP_PROJECT: GCP project ID used for Pub/Sub topic path
- TOPIC (optional): Pub/Sub topic name (default: "videoclub-new-video")
- BUCKET (optional): default GCS bucket (default: "videoclub-test")

Query parameters:
- bucket: override default bucket
- max: limit number of playlist items processed (for testing)
"""

from __future__ import annotations

import os
import json
from typing import Any
import logging

import functions_framework
from flask import Request, jsonify
from google.cloud import storage
from google.cloud import pubsub

from extractor.youtube import get_videos_videoclub
import google.auth


def _project_id() -> str:
    _, project_id = google.auth.default()
    return project_id or ""


def _blob_exists(storage_client: storage.Client, bucket: str, blob_name: str) -> bool:
    bucket_ref = storage_client.bucket(bucket)
    blob = bucket_ref.blob(blob_name)
    return blob.exists(storage_client)


@functions_framework.http
def discover(request: Request):
    logger = logging.getLogger(__name__)

    # Resolve configuration
    default_bucket = os.environ.get("BUCKET", "videoclub-test")
    topic_name = os.environ.get("TOPIC", "videoclub-new-video")
    project_id = _project_id()

    # Parse inputs
    bucket = request.args.get("bucket", default_bucket)
    max_items_arg = request.args.get("max")
    try:
        max_items = int(max_items_arg) if max_items_arg is not None else None
    except ValueError:
        return jsonify({"error": "invalid max parameter"}), 400

    storage_client = storage.Client()
    publisher = pubsub.PublisherClient()

    # Build topic path
    if not project_id:
        return jsonify({"error": "Missing project ID in env (GCP_PROJECT/GOOGLE_CLOUD_PROJECT)"}), 500
    topic_path = publisher.topic_path(project_id, topic_name)

    logger.info(
        "discover start bucket=%s project=%s topic=%s max=%s",
        bucket,
        project_id,
        topic_name,
        max_items if max_items is not None else "all",
    )

    # Ensure topic exists (idempotent best-effort)
    try:
        publisher.get_topic(request={"topic": topic_path})
        logger.info("topic exists: %s", topic_path)
    except Exception:
        try:
            publisher.create_topic(name=topic_path)
            logger.info("topic created: %s", topic_path)
        except Exception:
            # If creation fails due to permissions or already exists, continue
            logger.warning("topic ensure failed (continuing): %s", topic_path)
            pass

    # Discover videos
    items = get_videos_videoclub()
    logger.info(
        "playlist items fetched: %d; publish limit=%s",
        len(items),
        max_items if max_items is not None else "none",
    )

    published = 0
    total = 0
    skipped = 0
    limited = 0
    for item in items:
        total += 1
        vid = item.snippet.resourceId.videoId
        needs_video = not _blob_exists(storage_client, bucket, f"videos/{vid}/video.json")
        needs_movies = not _blob_exists(storage_client, bucket, f"videos/{vid}/movies.json")
        logger.info(
            "video %s status: missing video.json=%s, movies.json=%s",
            vid,
            needs_video,
            needs_movies,
        )
        if needs_video or needs_movies:
            # Respect publish cap if provided
            if max_items is not None and published >= max_items:
                limited += 1
                logger.info("publish limit reached; skipping %s", vid)
                continue
            payload: dict[str, Any] = {"id": vid, "bucket": bucket}
            data = json.dumps(payload).encode("utf-8")
            try:
                future = publisher.publish(topic_path, data=data)
                # Wait briefly to surface publish failures and log
                try:
                    future.result(timeout=10)
                    published += 1
                    logger.info("publish ok for %s", vid)
                except Exception as exc:
                    logger.exception("publish failed for %s: %s", vid, exc)
            except Exception:
                # Continue processing others; report in response
                logger.exception("publish raised for %s", vid)
                pass
        else:
            skipped += 1

    logger.info(
        "discover done: total=%d published=%d skipped=%d limited=%d",
        total,
        published,
        skipped,
        limited,
    )

    return jsonify({
        "bucket": bucket,
        "topic": topic_name,
        "project": project_id,
        "total": total,
        "published": published,
    })

"""HTTP Cloud Function (Gen2) to discover unprocessed videos.

This function:
- Lists playlist items via extractor.youtube.get_videos_videoclub
- Checks GCS for required artifacts per video
- Publishes a Pub/Sub message for each video missing artifacts

Environment variables:
- GOOGLE_CLOUD_PROJECT or GCP_PROJECT: GCP project ID used for Pub/Sub topic path
- TOPIC (optional): Pub/Sub topic name
- BUCKET (optional): default GCS bucket

Query parameters:
- bucket: override default bucket
- max: limit number of playlist items processed (for testing)
"""

from __future__ import annotations

import os
import json
from typing import Any
import logging
import uuid
from datetime import datetime, timedelta, UTC

import functions_framework
from flask import Request, jsonify
from google.cloud import storage
from google.cloud import pubsub
from google.cloud import firestore

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
    topic_name = os.environ.get("PROCESSOR_TOPIC")
    if not topic_name:
        raise ValueError("Missing PROCESSOR_TOPIC in env")
    project_id = _project_id()

    # Parse inputs
    bucket = request.args.get("bucket")
    if not bucket:
        raise ValueError("Missing bucket parameter in request")
    max_items_arg = request.args.get("max")
    try:
        max_items = int(max_items_arg) if max_items_arg is not None else None
    except ValueError:
        return jsonify({"error": "invalid max parameter"}), 400

    storage_client = storage.Client()
    publisher = pubsub.PublisherClient()
    fs = firestore.Client()

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

    # Load blacklist from Firestore collection and env var
    blacklist: set[str] = set()
    try:
        for snap in fs.collection("blacklist").stream():
            data = snap.to_dict() or {}
            vid = data.get("video_id") or data.get("id")
            if vid:
                blacklist.add(str(vid))
            else:
                logger.warning("blacklist doc without video_id: %s", snap.id)
    except Exception:
        logger.warning("failed to load blacklist collection; continuing")
    env_bl = os.environ.get("BLACKLIST_IDS")
    if env_bl:
        blacklist.update({x.strip() for x in env_bl.split(",") if x.strip()})
    if blacklist:
        logger.info("blacklist loaded: %d ids", len(blacklist))

    # First pass: decide which videos to publish (respecting max)
    to_publish: list[str] = []
    blacklisted = 0
    for item in items:
        total += 1
        vid = item.snippet.resourceId.videoId
        if vid in blacklist:
            blacklisted += 1
            logger.info("video %s is blacklisted; skipping", vid)
            continue
        needs_video = not _blob_exists(storage_client, bucket, f"videos/{vid}/video.json")
        needs_movies = not _blob_exists(storage_client, bucket, f"videos/{vid}/movies.json")
        logger.info(
            "video %s status: missing video.json=%s, movies.json=%s",
            vid,
            needs_video,
            needs_movies,
        )
        if needs_video or needs_movies:
            if max_items is not None and len(to_publish) >= max_items:
                limited += 1
                continue
            to_publish.append(vid)
        else:
            skipped += 1

    # Create a batch document if we have anything to publish
    batch_id: str | None = None
    if to_publish:
        batch_id = str(uuid.uuid4())
        now = datetime.now(UTC)
        ttl = now + timedelta(days=14)
        batch_ref = fs.collection("batches").document(batch_id)
        batch_doc = {
            "bucket": bucket,
            "total": len(to_publish),
            "completed": 0,
            "failed": 0,
            "status": "in_progress",
            "video_ids": to_publish,
            "created_at": now,
            "ttl": ttl,
        }
        batch_ref.set(batch_doc)
        logger.info("batch created: id=%s total=%d", batch_id, len(to_publish))

    # Second pass: publish messages with attributes (if any to publish)
    for vid in to_publish:
        payload: dict[str, Any] = {"id": vid, "bucket": bucket}
        data = json.dumps(payload).encode("utf-8")
        attrs: dict[str, str] = {"video_id": vid, "bucket": bucket}
        if batch_id:
            attrs["batch_id"] = batch_id
        try:
            future = publisher.publish(topic_path, data=data, **attrs)
            try:
                future.result(timeout=10)
                published += 1
                logger.info("publish ok for %s batch_id=%s", vid, batch_id)
            except Exception as exc:
                logger.exception("publish failed for %s: %s", vid, exc)
        except Exception:
            logger.exception("publish raised for %s", vid)
            pass

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
        "batch_id": batch_id,
        "blacklisted": blacklisted,
    })

"""Firestore onUpdate function to fan-in processor completions.

When a batch document in `batches/{batch_id}` reaches completed == total,
and status != 'done', this function marks it done and calls the prepare-data
Cloud Run service (HTTP with OIDC), passing the bucket.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import functions_framework
from cloudevents.http.event import CloudEvent  # type: ignore
from google.cloud import firestore
import requests


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


def _call_prepare_data(url: str, bucket: str) -> None:
    # Call HTTP Cloud Function endpoint directly; function is unauthenticated
    resp = requests.post(url, json={"bucket": bucket}, timeout=300)
    resp.raise_for_status()


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

    # Transition to done and call prepare-data exactly once
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

    # After the state change, call prepare-data
    url = os.environ.get("PREPARE_DATA_URL")
    if not url:
        logger.error("aggregator: PREPARE_DATA_URL not set; skipping call")
        return None

    try:
        _call_prepare_data(url, bucket)
        logger.info("aggregator: prepare-data invoked for bucket=%s", bucket)
    except Exception:
        logger.exception("aggregator: prepare-data call failed for bucket=%s", bucket)
        # Do not revert status; rely on retries/manual intervention
        return None

    return None

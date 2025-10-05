"""Utility to backfill annotation JSON files with the required ``title_position`` field.

The script inspects ``videos/<video_id>/annotations.json`` blobs stored in a Google
Cloud Storage bucket, adds the missing ``title_position`` key (defaulting to
"bottom-left") when necessary, and writes the updated payload back. It supports
processing all known annotation files or a subset provided as positional
arguments.

Example usage::

    python -m scripts.migrate_annotations --bucket videoclub-test
    python -m scripts.migrate_annotations --bucket videoclub-test 1a2B3c 4d5E6f
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from collections.abc import Iterable, Sequence

import typer
from google.api_core.exceptions import NotFound
from google.cloud import storage
from pydantic import ValidationError

from extractor.annotate.models import AnnotationResponse

DEFAULT_TITLE_POSITION = "bottom-left"
ANNOTATION_BLOB_TEMPLATE = "videos/{video_id}/annotations.json"

app = typer.Typer(help="Migrate annotation blobs to ensure title_position is present.")


@dataclass
class MigrationCandidate:
    blob_name: str
    payload: dict


def _resolve_blob_names(
    client: storage.Client, bucket_name: str, ids: Sequence[str] | None
) -> Iterable[str]:
    """Yield blob names that should be inspected for migration."""

    if ids:
        for video_id in ids:
            yield ANNOTATION_BLOB_TEMPLATE.format(video_id=video_id)
        return

    for blob in client.list_blobs(bucket_name, prefix="videos/"):
        if blob.name.endswith("annotations.json"):
            yield blob.name


def _download_payload(bucket: storage.Bucket, blob_name: str) -> dict | None:
    blob = bucket.blob(blob_name)
    try:
        raw = blob.download_as_text()
    except NotFound:
        typer.echo(f"Skipping missing blob: gs://{bucket.name}/{blob_name}")
        return None

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        typer.echo(f"Invalid JSON in gs://{bucket.name}/{blob_name}: {exc}", err=True)
        return None


def _needs_migration(payload: dict) -> bool:
    items = payload.get("items")
    if not isinstance(items, list):
        return False

    for item in items:
        if not isinstance(item, dict):
            return False
        if "title_position" not in item:
            return True
    return False


def _apply_migration(payload: dict) -> dict:
    items = payload.get("items") or []
    for item in items:
        if isinstance(item, dict):
            item.setdefault("title_position", DEFAULT_TITLE_POSITION)
    return payload


@app.command()
def migrate(
    bucket: str = typer.Option(
        "videoclub-test", "--bucket", help="GCS bucket containing annotations."
    ),
    ids: list[str] | None = typer.Argument(
        None,
        help="Optional list of video IDs to migrate; defaults to every annotation.",
    ),
) -> None:
    client = storage.Client()
    bucket_ref = client.bucket(bucket)

    candidates: list[MigrationCandidate] = []
    skipped: list[str] = []

    for blob_name in _resolve_blob_names(client, bucket, ids):
        payload = _download_payload(bucket_ref, blob_name)
        if payload is None:
            continue

        if not _needs_migration(payload):
            skipped.append(blob_name)
            continue

        migrated = _apply_migration(payload)
        try:
            AnnotationResponse.model_validate(migrated)
        except ValidationError as exc:
            typer.echo(
                f"Validation failed for gs://{bucket}/{blob_name}: {exc}",
                err=True,
            )
            continue

        candidates.append(MigrationCandidate(blob_name=blob_name, payload=migrated))

    if not candidates:
        typer.echo("No annotation blobs require migration.")
        return

    typer.echo("The following blobs will be migrated:")
    for candidate in candidates:
        typer.echo(f"  gs://{bucket}/{candidate.blob_name}")

    if not typer.confirm("Continue?", default=True):
        typer.echo("Aborted.")
        return

    for candidate in candidates:
        blob = bucket_ref.blob(candidate.blob_name)
        blob.upload_from_string(
            json.dumps(candidate.payload, ensure_ascii=False, indent=2) + "\n",
            content_type="application/json",
        )
        typer.echo(f"Migrated gs://{bucket}/{candidate.blob_name}")

    if skipped:
        typer.echo("Skipped blobs already in the new format:")
        for blob_name in skipped:
            typer.echo(f"  gs://{bucket}/{blob_name}")


if __name__ == "__main__":
    app()

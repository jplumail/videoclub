from __future__ import annotations

import base64
import json
import os
import subprocess
import sys


def _strip(value: str | None) -> str:
    return value.strip() if isinstance(value, str) else ""


def resolve_bucket() -> str:
    default_bucket = _strip(os.environ.get("DEFAULT_DATA_BUCKET"))
    bucket = default_bucket

    raw_message = os.environ.get("BUILD_TRIGGER_PUBSUB_MESSAGE")
    if raw_message:
        try:
            decoded = base64.b64decode(raw_message).decode("utf-8")
            payload = json.loads(decoded)
            candidate = _strip(payload.get("bucket"))
            if candidate:
                bucket = candidate
        except Exception:
            pass

    raw_attributes = os.environ.get("BUILD_TRIGGER_PUBSUB_ATTRIBUTES")
    if raw_attributes:
        try:
            attributes = json.loads(raw_attributes)
            candidate = _strip(attributes.get("bucket"))
            if candidate:
                bucket = candidate
        except Exception:
            pass

    return bucket or "videoclub-test"


def main() -> None:
    project = _strip(os.environ.get("GCP_PROJECT"))
    region = _strip(os.environ.get("FUNCTION_REGION"))
    if not project or not region:
        raise SystemExit("GCP_PROJECT and FUNCTION_REGION environment variables must be set")

    bucket = resolve_bucket()
    payload = json.dumps({"bucket": bucket})

    print(f"Invoking prepare_data for bucket {bucket}")
    subprocess.run(
        [
            "gcloud",
            "functions",
            "call",
            "prepare_data",
            "--project",
            project,
            "--region",
            region,
            "--gen2",
            "--data",
            payload,
        ],
        check=True,
    )


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(f"prepare_data invocation failed: {exc}\n")
        raise

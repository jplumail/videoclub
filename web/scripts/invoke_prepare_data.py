from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request


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


def _resolve_function_url() -> str:
    explicit = _strip(os.environ.get("PREPARE_DATA_URL"))
    if explicit:
        return explicit

    project = _strip(os.environ.get("GCP_PROJECT"))
    region = _strip(os.environ.get("FUNCTION_REGION"))
    if not project or not region:
        raise SystemExit(
            "GCP_PROJECT and FUNCTION_REGION environment variables must be set"
            " or provide PREPARE_DATA_URL"
        )

    return f"https://{region}-{project}.cloudfunctions.net/prepare_data"


def main() -> None:
    url = _resolve_function_url()
    bucket = resolve_bucket()
    payload = json.dumps({"bucket": bucket})

    print(f"Invoking prepare_data at {url} for bucket {bucket}")
    request = urllib.request.Request(
        url,
        data=payload.encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            status = getattr(response, "status", response.getcode())
            body = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", "replace")
        sys.stderr.write(
            "prepare_data invocation failed with HTTP status "
            f"{exc.code}: {error_body}\n"
        )
        raise SystemExit(1)
    except urllib.error.URLError as exc:
        sys.stderr.write(f"prepare_data invocation failed: {exc}\n")
        raise SystemExit(1)

    if status >= 300:
        sys.stderr.write(
            f"prepare_data invocation returned {status}: {body}\n"
        )
        raise SystemExit(1)

    print(f"prepare_data invocation succeeded with status {status}: {body}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(f"prepare_data invocation failed: {exc}\n")
        raise

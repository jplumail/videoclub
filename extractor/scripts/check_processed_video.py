"""Check if processed artifacts exist for a given video ID.

Checks for the presence of the following blobs in the specified GCS bucket:
- `videos/{video_id}/video.json`
- `videos/{video_id}/movies.json`

Exit codes:
- 0: both blobs exist
- 1: one or both blobs are missing
- 2: unexpected error (e.g., auth/network)
"""

from google.cloud import storage
import argparse
import sys


def blob_exists(bucket_name: str, blob_name: str) -> bool:
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    return blob.exists()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check if video.json and movies.json exist for a video ID in a GCS bucket.",
    )
    parser.add_argument("video_id", help="YouTube video ID")
    parser.add_argument(
        "--bucket",
        default="videoclub-test",
        help="GCS bucket name (default: videoclub-test)",
    )
    args = parser.parse_args()

    video_blob = f"videos/{args.video_id}/video.json"
    movies_blob = f"videos/{args.video_id}/movies.json"

    try:
        has_video = blob_exists(args.bucket, video_blob)
        has_movies = blob_exists(args.bucket, movies_blob)
    except Exception as e:
        print(f"Error while checking blobs: {e}")
        return 2

    missing = []
    if not has_video:
        missing.append(video_blob)
    if not has_movies:
        missing.append(movies_blob)

    if not missing:
        print(
            f"OK: {video_blob} and {movies_blob} exist in bucket {args.bucket}."
        )
        return 0
    else:
        print(
            "MISSING: "
            + ", ".join(missing)
            + f" in bucket {args.bucket}."
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())


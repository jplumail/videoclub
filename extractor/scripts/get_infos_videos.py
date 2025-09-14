"""Extract and store metadata for all Videoclub videos.

Produces:
- `videos/{video_id}/thumbnail.jpg`
- `videos/{video_id}/video.json`

This script:
- Lists YouTube playlist items via `extractor.youtube.get_videos_videoclub`.
- Uploads each video's thumbnail to the provided GCS bucket
  in `videos/{video_id}/thumbnail.jpg`.
- Calls `get_personnalites` to extract people-related infos for the video.
- Writes the resulting JSON to `videos/{video_id}/video.json` in the bucket.
- Retries once on 429 rate limits with a 60s delay.

Run directly to process all videos using the default test bucket, or import
and call `get_infos(bucket_name)` from other modules.
"""

import asyncio
import argparse
import tempfile
from extractor.youtube.models import PlaylistItem
import requests
from tqdm import tqdm
import google.genai.errors

from extractor.utils import upload_json_blob, upload_blob
from extractor.youtube import get_videos_videoclub
from extractor.video.get_infos_video import get_personnalites


def upload_thumbnail(item: PlaylistItem, bucket_name: str):
    id_ = item.snippet.resourceId.videoId
    thumbnail = item.snippet.thumbnails.get("standard") or item.snippet.thumbnails.get(
        "high"
    )
    if thumbnail is not None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as f:
            f.write(requests.get(thumbnail.url).content)
            f.seek(0)
            thumbnail_name = f"videos/{id_}/thumbnail.jpg"
            upload_blob(bucket_name, f.name, thumbnail_name)
    else:
        thumbnail_name = None
    thumbnail_uri = f"gs://{bucket_name}/{thumbnail_name}" if thumbnail_name else None
    return thumbnail_uri


async def get_infos(bucket_name: str, ids: list[str] | None = None):
    # List the playlist and optionally filter to the requested IDs
    items = get_videos_videoclub()
    if ids:
        wanted = set(ids)
        items = [it for it in items if it.snippet.resourceId.videoId in wanted]
    pbar = tqdm(items)
    for item in pbar:
        id_ = item.snippet.resourceId.videoId
        pbar.set_description(f"Processing video {id_}")

        thumbnail_uri = upload_thumbnail(item, bucket_name)
        try:
            item_personnalites = await get_personnalites(item, thumbnail_uri)
        except google.genai.errors.ClientError as e:
            if e.code == 429:
                print("Rate limit exceeded, waiting 60s")
                await asyncio.sleep(60)
                item_personnalites = await get_personnalites(item, thumbnail_uri)
            else:
                raise e

        json_payload = item_personnalites.model_dump_json()
        upload_json_blob(
            bucket_name,
            json_payload,
            f"videos/{id_}/video.json",
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract and store metadata for Videoclub videos."
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all videos (default behavior).",
    )
    parser.add_argument(
        "ids",
        nargs="*",
        help="Specific YouTube video IDs to process.",
    )
    args = parser.parse_args()

    # Require either --all or at least one ID
    if not args.all and not args.ids:
        parser.error("Provide --all or one or more video IDs.")

    selected_ids = args.ids if args.ids else None
    asyncio.run(get_infos("videoclub-test", selected_ids))

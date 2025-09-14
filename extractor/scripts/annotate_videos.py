"""Annotate all Videoclub videos stored in a GCS bucket.

Produces:
- `videos/{video_id}/annotations.json`

This script:
- Lists YouTube playlist videos via `extractor.youtube.get_videos_videoclub`.
- Calls `extractor.annotate.annotate_videos` to generate annotations.
- Writes annotations to `videos/{video_id}/annotations.json` in the bucket.

Run directly to process all videos using the default test bucket, or import
and call `annotate_all_videos(bucket_name)` from other modules.
"""

import asyncio
import argparse

from extractor.annotate import annotate_videos
from extractor.youtube import get_videos_videoclub


async def annotate_all_videos(bucket_name: str, ids: list[str] | None = None):
    # Prepare the list of IDs without unnecessary playlist fetch
    if ids:
        video_ids = list(ids)
        print(f"Annotating {len(video_ids)} requested videos")
    else:
        items = get_videos_videoclub()
        print(f"Found {len(items)} videos in playlist to annotate")
        video_ids = [item.snippet.resourceId.videoId for item in items]

    annotation_blobs = [f"videos/{id_}/annotations.json" for id_ in video_ids]

    annotations_done = await annotate_videos(bucket_name, video_ids, annotation_blobs)
    print(f"Annotated {len(annotations_done)} videos over {len(video_ids)}")
    return annotations_done

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Annotate Videoclub videos stored in GCS."
    )
    parser.add_argument(
        "--bucket",
        default="videoclub-test",
        help="GCS bucket name (default: videoclub-test)",
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

    # If IDs are provided, restrict to those; otherwise, process all
    selected_ids = args.ids if args.ids else None
    asyncio.run(annotate_all_videos(args.bucket, selected_ids))

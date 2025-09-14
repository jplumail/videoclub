"""Extract movie/media items for all Videoclub videos.

Produces:
- `videos/{video_id}/movies.json`

Needs:
- Annotations in `videos/{video_id}/annotations.json` in the given GCS bucket

This script:
- Lists YouTube playlist items via `extractor.youtube.get_videos_videoclub`.
- For each video ID, reads annotations from
  `videos/{video_id}/annotations.json` in the given bucket.
- Calls `extractor.movies.extract_media_items` to compute movie/media items.
- Writes results to `videos/{video_id}/movies.json` in the bucket.

Run directly to process all videos using the default test bucket, or import
and call `extract_all_videos(bucket_name)` from other modules.
"""

from extractor.movies import extract_media_items
from extractor.youtube import get_videos_videoclub
import asyncio
import argparse
from tqdm import tqdm


async def extract_all_videos(bucket_name: str, ids: list[str] | None = None):
    # Build a unified list of video IDs to process
    if ids:
        ids_to_process = list(ids)
    else:
        items = get_videos_videoclub()
        ids_to_process = [it.snippet.resourceId.videoId for it in items]

    pbar = tqdm(ids_to_process)
    for id_ in pbar:
        pbar.set_description(f"Processing video {id_}")
        try:
            await asyncio.sleep(1)
            await extract_media_items(
                bucket_name,
                "videos/" + id_ + "/annotations.json",
                "videos/" + id_ + "/movies.json",
            )
        except Exception as e:
            print(e)
            continue


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract movie/media items for Videoclub videos."
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
    asyncio.run(extract_all_videos("videoclub-test", selected_ids))

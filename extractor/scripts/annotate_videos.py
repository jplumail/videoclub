"""Annotate all Videoclub videos stored in a GCS bucket.

Produces:
- `videos/{video_id}/annotations.json`
- Local debug copies of `annotations-request.jsonl` and `predictions.jsonl`

This script:
- Lists YouTube playlist videos via `extractor.youtube.get_videos_videoclub`.
- Calls `extractor.annotate.annotate_videos` to generate annotations.
- Writes annotations to `videos/{video_id}/annotations.json` in the bucket.

Run directly to process all videos using the default test bucket, or import
and call `annotate_all_videos(bucket_name)` from other modules.
"""

import asyncio
import argparse
import logging

from extractor.annotate import annotate_videos
from extractor.youtube import get_videos_videoclub


logger = logging.getLogger(__name__)


async def annotate_all_videos(
    bucket_name: str,
    ids: list[str] | None = None,
    debug_output_dir: str | None = None,
):
    # Prepare the list of IDs without unnecessary playlist fetch
    if ids:
        video_ids = list(ids)
        logger.info("Annotating %d requested videos", len(video_ids))
    else:
        items = get_videos_videoclub()
        logger.info("Found %d videos in playlist to annotate", len(items))
        video_ids = [item.snippet.resourceId.videoId for item in items]

    annotation_blobs = [f"videos/{id_}/annotations.json" for id_ in video_ids]

    annotations_done = await annotate_videos(
        bucket_name,
        video_ids,
        annotation_blobs,
        debug_output_dir=debug_output_dir,
    )
    logger.info("Annotated %d videos over %d", len(annotations_done), len(video_ids))
    if len(annotations_done) < len(video_ids):
        missing = set(video_ids) - set(annotations_done)
        logger.warning("Missing annotations for videos: %s", ", ".join(missing))
    return annotations_done

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
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
    parser.add_argument(
        "--debug-output-dir",
        default=None,
        help=(
            "Local directory to mirror batch request/prediction payloads "
            "(default: current working directory's work/<job_id>)"
        ),
    )
    args = parser.parse_args()

    # Require either --all or at least one ID
    if not args.all and not args.ids:
        parser.error("Provide --all or one or more video IDs.")

    # If IDs are provided, restrict to those; otherwise, process all
    selected_ids = args.ids if args.ids else None
    asyncio.run(annotate_all_videos(args.bucket, selected_ids, args.debug_output_dir))

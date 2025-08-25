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
from tqdm import tqdm


async def extract_all_videos(bucket_name: str):
    items = get_videos_videoclub()

    pbar = tqdm(items)
    for item in pbar:
        id_ = item.snippet.resourceId.videoId
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
    asyncio.run(extract_all_videos("videoclub-test"))

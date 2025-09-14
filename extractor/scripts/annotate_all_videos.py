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

from extractor.annotate import annotate_videos
from extractor.youtube import get_videos_videoclub


async def annotate_all_videos(bucket_name: str):
    items = get_videos_videoclub()
    print(f"Found {len(items)} videos in playlist")
    video_ids: list[str] = []
    annotation_blobs: list[str] = []
    for item in items:
        id_ = item.snippet.resourceId.videoId
        video_prefix = "videos/" + id_ + "/"
        video_ids.append(id_)
        annotation_blob_name = video_prefix + "annotations.json"
        annotation_blobs.append(annotation_blob_name)

    annotations_done = await annotate_videos(bucket_name, video_ids, annotation_blobs)
    print(f"Annotated {len(annotations_done)} videos over {len(video_ids)}")
    return annotations_done


if __name__ == "__main__":
    asyncio.run(annotate_all_videos("videoclub-test"))

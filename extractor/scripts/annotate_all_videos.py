"""Annotate all Videoclub videos stored in a GCS bucket.

This script:
- Lists YouTube playlist items via `extractor.youtube.get_videos_videoclub`.
- For each video ID, locates the uploaded video file under
  `videos/{video_id}/video.<ext>` in the given bucket.
- Calls `extractor.annotate.annotate_videos` to generate annotations.
- Writes annotations to `videos/{video_id}/annotations.json` in the bucket.

Run directly to process all videos using the default test bucket, or import
and call `annotate_all_videos(bucket_name)` from other modules.
"""

import asyncio
from google.cloud import storage

from extractor.annotate import annotate_videos
from extractor.youtube import get_videos_videoclub


async def annotate_all_videos(bucket_name):
    items = get_videos_videoclub()
    print(f"Found {len(items)} videos in playlist")
    bucket = storage.Client().bucket(bucket_name)
    video_blobs: list[str] = []
    annotation_blobs: list[str] = []
    for item in items:
        id_ = item.snippet.resourceId.videoId
        video_prefix = "videos/" + id_ + "/"
        blobs = bucket.list_blobs(prefix=video_prefix)
        video_extension = None
        for blob in blobs:
            if "mp4" in blob.name or "webm" in blob.name or "mkv" in blob.name:
                video_extension = blob.name.split(".")[-1]
                break
        if video_extension is None:
            print(f"Could not find video for {id_}")
            continue
        video_blob_name = video_prefix + "video." + video_extension
        video_blobs.append(video_blob_name)
        annotation_blob_name = video_prefix + "annotations.json"
        annotation_blobs.append(annotation_blob_name)

    annotations_done = await annotate_videos(bucket_name, video_blobs, annotation_blobs)
    print(f"Annotated {len(annotations_done)} videos over {len(video_blobs)}")
    return annotations_done


if __name__ == "__main__":
    asyncio.run(annotate_all_videos("videoclub-test"))

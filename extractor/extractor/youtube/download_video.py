from pathlib import Path
import sys

from yt_dlp import YoutubeDL
from google.cloud import storage

from ..utils import upload_blob


# CustomLogger is a workaround for the issue with yt-dlp's logger
# on Cloud Functions. See:
# https://github.com/yt-dlp/yt-dlp/issues/10315
class CustomLogger:
    def debug(self, msg):
        # For compatibility with youtube-dl, both debug and info are passed into debug
        # You can distinguish them by the prefix '[debug] '
        if msg.startswith("[debug] "):
            print(msg)
        else:
            self.info(msg)

    def info(self, msg):
        print(msg)

    def warning(self, msg):
        print(msg)

    def error(self, msg):
        print(msg, file=sys.stderr)


def download_video(video_id: str, bucket_name: str, destination_blob_name: str):
    # check if destination_blob_name already exists
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blobs: list[storage.Blob] = list(bucket.list_blobs())
    for blob in blobs:
        if blob.name.startswith(destination_blob_name):  # type: ignore
            return destination_blob_name

    # download video if it doesn't exist
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    with YoutubeDL(
        {
            "format": "bestvideo[height<=720]",
            "cookiesfrombrowser": ("chrome",),
            "logger": CustomLogger(),
        }
    ) as ydl:
        ydl.download([video_url])

    video = list(Path(".").glob(f"*{video_id}*"))[0]
    ext = video.suffix

    # upload video to bucket
    blob_name = upload_blob(bucket_name, str(video), f"{destination_blob_name}{ext}")
    return blob_name

import json
from pathlib import Path
import sys
from yt_dlp import YoutubeDL
from google.cloud import storage


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
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    with YoutubeDL({"format": "bestvideo[height<=720]", "logger": CustomLogger()}) as ydl:
        ydl.download([video_url])

    video = list(Path(".").glob(f"*{video_id}*"))[0]
    ext = video.suffix
    video = video.rename(f"{video_id}{ext}")

    blob_name = upload_blob(bucket_name, str(video), f"{destination_blob_name}{ext}")
    return blob_name


def upload_blob(bucket_name: str, source_file_name: str, destination_blob_name: str):
    """Uploads a file to the bucket."""

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    blob.upload_from_filename(source_file_name)

    return blob.name


def upload_json_blob(bucket_name: str, json_payload, destination_blob_name: str):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    blob.upload_from_string(json.dumps(json_payload), content_type="application/json")

    return blob.name
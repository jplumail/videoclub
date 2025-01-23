from extractor.utils import get_videos_playlist
from tqdm import tqdm

import googleapiclient.discovery
import googleapiclient.errors
import requests
import yt_dlp
from extractor.download import download_video



items = get_videos_playlist("PL6yqY0TQJgwcSGYD6a2P4YgpHIp-HCzZn")

for item in tqdm(items):
    if item["status"]["privacyStatus"] == "public":
        id_ = item["snippet"]["resourceId"]["videoId"]
        try:
            download_video(id_, "videoclub-test", id_+"/"+"video")
        except (requests.exceptions.ConnectionError, yt_dlp.utils.DownloadError) as e:
            print(e)



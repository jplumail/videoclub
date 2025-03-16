from extractor.youtube import get_videos_videoclub
from tqdm import tqdm

import requests
import yt_dlp
from extractor.youtube import download_video


items = get_videos_videoclub()

for item in tqdm(items):
    id_ = item.snippet.resourceId.videoId
    try:
        download_video(id_, "videoclub-test", "videos/" + id_ + "/" + "video")
    except (requests.exceptions.ConnectionError, yt_dlp.utils.DownloadError) as e:
        print(e)

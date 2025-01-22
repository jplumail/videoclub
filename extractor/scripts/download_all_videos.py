from tqdm import tqdm

import googleapiclient.discovery
import googleapiclient.errors
import requests
import yt_dlp
from extractor.download import download_video


API_KEY = "AIzaSyC-8WuhND8YDjvzZLNf0Jw8MGTQ3E1qCXA"

# Get credentials and create an API client
youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)

playlistItems = youtube.playlistItems()
request = playlistItems.list(
    part="id,contentDetails,status,snippet", playlistId="PL6yqY0TQJgwcSGYD6a2P4YgpHIp-HCzZn"
)

items = []
while request is not None:
    items_page = request.execute()
    items.extend(items_page["items"])
    request = playlistItems.list_next(request, items_page)

for item in tqdm(items):
    if item["status"]["privacyStatus"] == "public":
        id_ = item["snippet"]["resourceId"]["videoId"]
        try:
            download_video(id_, "videoclub-test", id_+"/"+"video")
        except (requests.exceptions.ConnectionError, yt_dlp.utils.DownloadError) as e:
            print(e)



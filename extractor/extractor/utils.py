import re
import googleapiclient.discovery
import requests



year_pattern = re.compile(r"\b\d{4}\b")

API_KEY = "AIzaSyC-8WuhND8YDjvzZLNf0Jw8MGTQ3E1qCXA"


def is_video_a_short(video_id: str):
    """One (unofficial) workaround right now is to construct a URL using 'shorts' and the video ID
    (e.g. https://www.youtube.com/shorts/v=B-s71n0dHUk and then see if you get a 303 redirect (not a Short)
    or a 200 HTTP status report (Short)."""
    url = f"https://www.youtube.com/shorts/{video_id}"
    response = requests.head(url)
    return response.status_code == 200

def is_video_public(item):
    return item["status"]["privacyStatus"] == "public"

def get_videos_playlist(playlist_id: str):
    youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)

    playlistItems = youtube.playlistItems()
    request = playlistItems.list(
        part="id,contentDetails,status,snippet", playlistId=playlist_id
    )

    items = []
    while request is not None:
        items_page = request.execute()
        items.extend([
            item for item in items_page["items"]
            if is_video_public(item) and not is_video_a_short(item["snippet"]["resourceId"]["videoId"])
        ])
        request = playlistItems.list_next(request, items_page)

    return items

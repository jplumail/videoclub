from extractor.youtube.models import PlaylistItem
import googleapiclient.discovery
from pydantic import TypeAdapter
import requests

VIDEO_CLUB_PLAYLIST_ID = "PL6yqY0TQJgwcSGYD6a2P4YgpHIp-HCzZn"
API_KEY = "AIzaSyC-8WuhND8YDjvzZLNf0Jw8MGTQ3E1qCXA"

videos_exclude = [
    "PYBNm843pmQ",
]


def is_video_a_short(video_id: str):
    """One (unofficial) workaround right now is to construct a URL using 'shorts' and the video ID
    (e.g. https://www.youtube.com/shorts/v=B-s71n0dHUk and then see if you get a 303 redirect (not a Short)
    or a 200 HTTP status report (Short)."""
    url = f"https://www.youtube.com/shorts/{video_id}"
    response = requests.head(url)
    return response.status_code == 200


def is_video_public(item: PlaylistItem):
    return item.status.privacyStatus == "public"


def filter_video(item: PlaylistItem):
    return (
        item.snippet.resourceId.videoId not in videos_exclude
        and is_video_public(item)
        and not is_video_a_short(item.snippet.resourceId.videoId)
    )


def get_videos_videoclub():
    youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)

    playlistItems = youtube.playlistItems()
    request = playlistItems.list(part="id,status,snippet", playlistId=VIDEO_CLUB_PLAYLIST_ID)

    items: list[PlaylistItem] = []
    while request is not None:
        page = request.execute()
        items_page = TypeAdapter(list[PlaylistItem]).validate_python(
            page["items"], strict=False
        )
        items.extend([item for item in items_page if filter_video(item)])
        request = playlistItems.list_next(request, page)

    return items

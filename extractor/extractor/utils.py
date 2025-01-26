import json
import re
from typing import Any
import googleapiclient.discovery
import requests
from google.genai import types
import jsonref


year_pattern = re.compile(r"\b\d{4}\b")

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


def is_video_public(item):
    return item["status"]["privacyStatus"] == "public"


def filter_video(item):
    return (
        item["snippet"]["resourceId"]["videoId"] not in videos_exclude
        and is_video_public(item)
        and not is_video_a_short(item["snippet"]["resourceId"]["videoId"])
    )


def get_videos_playlist(playlist_id: str) -> list[dict[str, Any]]:
    youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)

    playlistItems = youtube.playlistItems()
    request = playlistItems.list(
        part="id,contentDetails,status,snippet", playlistId=playlist_id
    )

    items = []
    while request is not None:
        items_page = request.execute()
        items.extend([item for item in items_page["items"] if filter_video(item)])
        request = playlistItems.list_next(request, items_page)

    return items


def to_vertexai_compatible_schema(schema: dict[str, Any]):
    d: dict[str, Any] = json.loads(
        jsonref.dumps(jsonref.replace_refs(schema, proxies=False))
    )
    if "$defs" in d:
        del d["$defs"]
    return d


safety_settings = [
    types.SafetySetting(
        category="HARM_CATEGORY_HATE_SPEECH",
        threshold="OFF",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold="OFF",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold="OFF",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_HARASSMENT",
        threshold="OFF",
    ),
]

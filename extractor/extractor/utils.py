import re
import googleapiclient.discovery



year_pattern = re.compile(r"\b\d{4}\b")

API_KEY = "AIzaSyC-8WuhND8YDjvzZLNf0Jw8MGTQ3E1qCXA"

def get_videos_playlist(playlist_id: str):
    # Get credentials and create an API client
    youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)

    playlistItems = youtube.playlistItems()
    request = playlistItems.list(
        part="id,contentDetails,status,snippet", playlistId=playlist_id
    )

    items = []
    while request is not None:
        items_page = request.execute()
        items.extend(items_page["items"])
        request = playlistItems.list_next(request, items_page)

    return items

import logging
from extractor.youtube.models import PlaylistItem
import googleapiclient.discovery
from pydantic import TypeAdapter
import requests

VIDEO_CLUB_PLAYLIST_ID = "PL6yqY0TQJgwcSGYD6a2P4YgpHIp-HCzZn"
API_KEY = "AIzaSyB8iURfuYgKGusxLeeJRziG-fBmqorX5ko"

videos_exclude = [
    "PYBNm843pmQ",
]

logger = logging.getLogger(__name__)


def is_video_a_short(video_id: str):
    """One (unofficial) workaround right now is to construct a URL using 'shorts' and the video ID
    (e.g. https://www.youtube.com/shorts/v=B-s71n0dHUk and then see if you get a 303 redirect (not a Short)
    or a 200 HTTP status report (Short)."""
    url = f"https://www.youtube.com/shorts/{video_id}"
    logger.debug(f"Checking Shorts status for video {video_id}")
    try:
        response = requests.head(url)
    except Exception as exc:
        logger.warning(f"HEAD request failed for {url}: {exc}")
        return False
    logger.debug(
        f"Shorts check for {video_id} returned status {response.status_code}"
    )
    return response.status_code == 200


def is_video_public(item: PlaylistItem):
    public = item.status.privacyStatus == "public"
    if not public:
        logger.debug(
            f"Excluding {item.snippet.resourceId.videoId}: privacy status is {item.status.privacyStatus}"
        )
    return public


def filter_video(item: PlaylistItem):
    video_id = item.snippet.resourceId.videoId
    if video_id in videos_exclude:
        logger.debug(f"Excluding {video_id}: in manual exclude list")
        return False
    if not is_video_public(item):
        return False
    if is_video_a_short(video_id):
        logger.debug(f"Excluding {video_id}: detected as YouTube Short")
        return False
    return True


def get_videos_videoclub():
    logger.info("Building YouTube client")
    youtube = googleapiclient.discovery.build("youtube", "v3", developerKey=API_KEY)

    playlistItems = youtube.playlistItems()
    logger.info(f"Listing playlist items for {VIDEO_CLUB_PLAYLIST_ID}")
    request = playlistItems.list(part="id,status,snippet", playlistId=VIDEO_CLUB_PLAYLIST_ID)

    items: list[PlaylistItem] = []
    page_index = 0
    while request is not None:
        page_index += 1
        logger.debug(f"Fetching page {page_index}")
        try:
            page = request.execute()
        except Exception as exc:
            logger.error(f"YouTube API request failed on page {page_index}: {exc}")
            raise
        if "items" in page:
            try:
                items_page = TypeAdapter(list[PlaylistItem]).validate_python(
                    page["items"], strict=False
                )
            except Exception as exc:
                logger.error(f"Failed to parse page {page_index} items: {exc}")
                raise
            logger.debug(f"Page {page_index} returned {len(items_page)} items")
            filtered = [item for item in items_page if filter_video(item)]
            logger.info(
                f"Page {page_index}: kept {len(filtered)}/{len(items_page)} items after filtering"
            )
            items.extend(filtered)
        else:
            logger.warning(f"Page {page_index} has no 'items' key")
        request = playlistItems.list_next(request, page)

    logger.info(f"Total kept videos: {len(items)}")
    return items

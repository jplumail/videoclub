import json
from extractor.download import upload_json_blob
from extractor.utils import get_videos_playlist
from tqdm import tqdm


items = get_videos_playlist("PL6yqY0TQJgwcSGYD6a2P4YgpHIp-HCzZn")
for item in tqdm(items):
    id_ = item["snippet"]["resourceId"]["videoId"]
    upload_json_blob("videoclub-test", json.dumps(item, ensure_ascii=False), f"videos/{id_}/video.json")
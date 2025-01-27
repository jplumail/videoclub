import asyncio
from tqdm import tqdm
import google.genai.errors

from extractor.utils import upload_json_blob
from extractor.youtube import get_videos_playlist
from extractor.video.get_infos_video import get_personnalites


async def get_infos(bucket_name: str):
    items = get_videos_playlist("PL6yqY0TQJgwcSGYD6a2P4YgpHIp-HCzZn")
    for item in tqdm(items):
        id_ = item.snippet.resourceId.videoId

        try:
            item_personnalites = await get_personnalites(item)
        except google.genai.errors.ClientError as e:
            if e.code == 429:
                print("Rate limit exceeded, waiting 60s")
                await asyncio.sleep(60)
                item_personnalites = await get_personnalites(item)
            else:
                raise e

        json_payload = item_personnalites.model_dump_json()
        upload_json_blob(
            bucket_name,
            json_payload,
            f"videos/{id_}/video.json",
        )


if __name__ == "__main__":
    asyncio.run(get_infos("videoclub-test"))

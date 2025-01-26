import asyncio
import json
from typing import List, Union
from extractor.download import upload_json_blob
from extractor.utils import get_videos_playlist
from extractor.get_infos_video import get_personnalites
from pydantic import TypeAdapter
from tqdm import tqdm
import google.genai.errors
from themoviedb.schemas.people import Person


async def get_personnalites_item(item):
    title = item["snippet"]["title"]
    description = item["snippet"]["description"]
    personnalites = await get_personnalites(title, description)
    person_list_adapter = TypeAdapter(List[Union[Person, None]])
    return {"personnalites": json.loads(person_list_adapter.dump_json(personnalites))}


async def get_infos():
    items = get_videos_playlist("PL6yqY0TQJgwcSGYD6a2P4YgpHIp-HCzZn")
    for item in tqdm(items):
        id_ = item["snippet"]["resourceId"]["videoId"]

        try:
            item.update(await get_personnalites_item(item))
        except google.genai.errors.ClientError as e:
            if e.code == 429:
                print("Rate limit exceeded, waiting 60s")
                await asyncio.sleep(60)
                item.update(await get_personnalites_item(item))
            else:
                raise e

        upload_json_blob(
            "videoclub-test",
            json.dumps(item, ensure_ascii=False),
            f"videos/{id_}/video.json",
        )


if __name__ == "__main__":
    asyncio.run(get_infos())

from extractor.movies import extract_media_items
from extractor.youtube import get_videos_videoclub
import asyncio
from tqdm import tqdm


async def extract_all_videos(bucket_name: str):
    items = get_videos_videoclub()

    pbar = tqdm(items)
    for item in pbar:
        id_ = item.snippet.resourceId.videoId
        pbar.set_description(f"Processing video {id_}")
        try:
            await asyncio.sleep(1)
            await extract_media_items(
                bucket_name,
                "videos/" + id_ + "/annotations.json",
                "videos/" + id_ + "/movies.json",
            )
        except Exception as e:
            print(e)
            continue


if __name__ == "__main__":
    asyncio.run(extract_all_videos("videoclub-test"))

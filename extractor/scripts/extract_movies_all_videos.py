from extractor.extract.extract import extract_media_items
from extractor.utils import get_videos_playlist
import asyncio
from tqdm import tqdm

async def extract_all_videos(bucket_name: str):
    items = get_videos_playlist("PL6yqY0TQJgwcSGYD6a2P4YgpHIp-HCzZn")

    for item in tqdm(items):
        if item["status"]["privacyStatus"] == "public":
            id_ = item["snippet"]["resourceId"]["videoId"]
            try:
                await asyncio.sleep(1)
                output_blob_name = await extract_media_items(
                    bucket_name,
                    "videos/" + id_ + "/annotations.json",
                    "videos/" + id_ + "/movies.json",
                )
            except Exception as e:
                print(e)
                continue
            print(output_blob_name)
            
    


if __name__ == "__main__":
    import sys
    asyncio.run(extract_all_videos(sys.argv[1]))

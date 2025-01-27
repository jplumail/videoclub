import sys
import asyncio

from .extract import extract_media_items

print(asyncio.run(extract_media_items(sys.argv[1], sys.argv[2], sys.argv[3])))

import sys
import asyncio
import warnings

from .extract import extract_media_items

# filter warning PydanticSerializationUnexpectedValue
warnings.filterwarnings("ignore", category=UserWarning)

print(asyncio.run(extract_media_items(sys.argv[1], sys.argv[2], sys.argv[3])))

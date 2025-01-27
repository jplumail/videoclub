from datetime import date
from typing import Literal
from pydantic import BaseModel
from themoviedb import PartialMovie, Person, PartialTV


class TimeOffset(BaseModel):
    seconds: int = 0
    nanos: int = 0


class MediaItem(BaseModel):
    details: PartialMovie | PartialTV
    type: Literal["movie"] | Literal["tv"]
    crew: list[Person] | None
    release_year: date | None


class MediaItemTimestamp(BaseModel):
    media_item: MediaItem
    start_time: TimeOffset
    end_time: TimeOffset
    confidence: float


class MediaItemsTimestamps(BaseModel):
    media_items_timestamps: list[MediaItemTimestamp]

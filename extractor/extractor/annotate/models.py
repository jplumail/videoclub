from typing import List
from pydantic import BaseModel


class TimeSegment(BaseModel):
    start_time: str
    end_time: str


class MediaItem(BaseModel):
    title: str
    timecode: TimeSegment
    authors: List[str] = []
    years: List[int] = []


class AnnotationResponse(BaseModel):
    items: List[MediaItem]

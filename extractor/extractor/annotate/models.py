from typing import Literal
from pydantic import BaseModel


class TimeSegment(BaseModel):
    start_time: str
    end_time: str


class MediaItem(BaseModel):
    title: str
    title_position: Literal["top-left", "top-right", "bottom-left", "bottom-right"]
    timecode: TimeSegment
    authors: list[str] = []
    years: list[int] = []


class AnnotationResponse(BaseModel):
    items: list[MediaItem]

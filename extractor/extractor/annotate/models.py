from pydantic import BaseModel


class TimeSegment(BaseModel):
    start_time: str
    end_time: str


class MediaItem(BaseModel):
    title: str
    timecode: TimeSegment
    authors: list[str] = []
    years: list[int] = []


class AnnotationResponse(BaseModel):
    items: list[MediaItem]

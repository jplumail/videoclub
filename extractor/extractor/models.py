from datetime import date
from typing import Annotated, Any, Literal, Union
from pydantic import BaseModel, Field, Discriminator, Tag
from themoviedb import PartialMovie, Person, PartialTV
from themoviedb.schemas._enums import MediaType


# Video Intelligence API models
class TimeOffset(BaseModel):
    seconds: int = 0
    nanos: int = 0

    def get_offset_nanos(self):
        return self.seconds * 1_000_000_000 + self.nanos

    def __lt__(self, other: "TimeOffset"):
        return self.get_offset_nanos() < other.get_offset_nanos()

    def __gt__(self, other: "TimeOffset"):
        return self.get_offset_nanos() > other.get_offset_nanos()

    def __le__(self, other: "TimeOffset"):
        return self.get_offset_nanos() <= other.get_offset_nanos()

    def __ge__(self, other: "TimeOffset"):
        return self.get_offset_nanos() >= other.get_offset_nanos()

    def __eq__(self, other: "TimeOffset"):
        return self.get_offset_nanos() == other.get_offset_nanos()


class Segment(BaseModel):
    start_time_offset: TimeOffset
    end_time_offset: TimeOffset


class Vertex(BaseModel):
    x: float | None = None
    y: float | None = None


class RotatedBoundingBox(BaseModel):
    vertices: list[Vertex]


class Frame(BaseModel):
    rotated_bounding_box: RotatedBoundingBox
    time_offset: TimeOffset


class TextSegment(BaseModel):
    segment: Segment
    confidence: float
    frames: list[Frame]


class TextAnnotation(BaseModel):
    text: str
    segments: list[TextSegment]


class AnnotationResult(BaseModel):
    input_uri: str
    segment: Segment
    text_annotations: list[TextAnnotation]


class VideoAnnotation(BaseModel):
    annotation_results: list[AnnotationResult]


# Custom models

class MediaItem(BaseModel):
    details: PartialMovie | PartialTV
    crew: list[Person] | None
    release_year: date | None


class MediaItemTimestamp(BaseModel):
    media_item: MediaItem
    start_time: TimeOffset
    end_time: TimeOffset
    confidence: float


class MediaItemsTimestamps(BaseModel):
    media_items_timestamps: list[MediaItemTimestamp]

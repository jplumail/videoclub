from dataclasses import dataclass
from datetime import date
from typing import Literal
from pydantic import BaseModel


@dataclass
class Personnalite:
    name: str | None
    person_id: int | None


@dataclass
class MediaItemWithTime:
    id: int | None
    type: Literal["movie", "tv"]
    title: str | None
    release_year: date | None
    start_time: int
    end_time: int


class VideoDataFull(BaseModel):
    """/data/videos/{video_id}/video.json"""
    video_id: str
    personnalites: list[Personnalite]
    media_data: list[MediaItemWithTime]


class Index(BaseModel):
    """/data/video/index.json"""
    ids: list[str]


@dataclass
class VideoDataShort:
    video_id: str
    name: str
    release_date: date


class VideoFeedData(BaseModel):
    """/data/video.json (feed)"""
    feed: list[VideoDataShort]


@dataclass
class CitationPersonnalite:
    personnalite: Personnalite
    videoIds: list[str]


class MediaIdData(BaseModel):
    """/data/film/{id}.json and /data/serie/{id}.json"""
    id: int | None
    title: str | None
    release_year: date | None
    citations: list[CitationPersonnalite]


@dataclass
class MediaItem:
    id: int | None
    type: Literal["movie", "tv"]
    title: str | None
    release_year: date | None


@dataclass
class Citation:
    videoId: str
    start_time: int
    end_time: int


@dataclass
class CitationMedia:
    media: MediaItem
    citations: list[Citation]


class PersonneIdData(BaseModel):
    """/data/personne/{id}.json"""
    name: str | None
    videos: list[VideoDataShort]
    citations: list[CitationMedia]


@dataclass
class CitationWithName:
    videoId: str
    start_time: int
    end_time: int
    name: str | None


@dataclass
class CitationMediaWithName:
    media: MediaItem
    citations: list[CitationWithName]


class BestMediaData(BaseModel):
    """/data/film/meilleurs.json"""
    media: list[CitationMediaWithName]


__all__ = [
    "VideoDataFull",
    "Index",
    "MediaIdData",
    "BestMediaData",
    "PersonneIdData",
    "VideoFeedData",
]

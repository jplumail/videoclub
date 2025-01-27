from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass
class Thumbnail:
    url: str
    width: int
    height: int


@dataclass
class ResourceId:
    kind: str
    videoId: str


@dataclass
class Snippet:
    publishedAt: datetime
    channelId: str
    title: str
    description: str
    thumbnails: dict[str, Thumbnail]
    channelTitle: str
    playlistId: str
    position: int
    resourceId: ResourceId
    videoOwnerChannelTitle: str | None = None
    videoOwnerChannelId: str | None = None


@dataclass
class Status:
    privacyStatus: str


@dataclass
class PlaylistItem:
    kind: Literal["youtube#playlistItem"]
    etag: str
    id: str
    snippet: Snippet
    status: Status

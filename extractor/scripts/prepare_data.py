from datetime import date
from extractor.movies.models import MediaItemsTimestamps
from extractor.video.models import PlaylistItemPersonnalites
from extractor.youtube.youtube import get_videos_videoclub
from google.cloud import storage
import google.api_core.exceptions
from pathlib import Path
from dataclasses import dataclass
from typing import List, Literal

from pydantic import BaseModel


@dataclass
class Personnalite:
    name: str | None
    person_id: int | None


@dataclass
class MediaItem:
    id: int | None
    type: Literal["movie", "tv"]
    title: str | None
    release_year: date | None
    start_time: int
    end_time: int


class VideoData(BaseModel):
    video_id: str
    personnalites: List[Personnalite]
    media_data: List[MediaItem]


@dataclass
class VideoData2:
    video_id: str
    name: str
    release_date: date


class VideoFeedData(BaseModel):
    feed: List[VideoData2]


bucket = storage.Client().bucket("videoclub-test")
video_raw_data_prefix = Path("videos")
data_prefix = Path("data")
items = get_videos_videoclub()
feed: list[VideoData2] = []
database: list[tuple[VideoData2, MediaItem, Personnalite]] = []
for item in items:
    id_ = item.snippet.resourceId.videoId
    try:
        playlist_item_personnalites = PlaylistItemPersonnalites.model_validate_json(
            bucket.blob(
                str(video_raw_data_prefix / id_ / "video.json")
            ).download_as_bytes()
        )
    except google.api_core.exceptions.NotFound:
        print(f"{str(video_raw_data_prefix / id_ / 'video.json')} not found")
        continue

    try:
        media_items_timestamps = MediaItemsTimestamps.model_validate_json(
            bucket.blob(
                str(video_raw_data_prefix / id_ / "movies.json")
            ).download_as_bytes()
        )
    except google.api_core.exceptions.NotFound:
        print(f"{str(video_raw_data_prefix / id_ / 'movies.json')} not found")
        continue

    media_data = [
        MediaItem(
            id=m.media_item.details.id,
            type=m.media_item.type,
            title=m.media_item.details.title
            if m.media_item.type == "movie"
            else m.media_item.details.name,
            release_year=m.media_item.release_year,
            start_time=m.start_time.seconds,
            end_time=m.end_time.seconds,
        )
        for m in media_items_timestamps.media_items_timestamps
    ]

    video_id = playlist_item_personnalites.playlist_item.snippet.resourceId.videoId
    data = VideoData(
        video_id=video_id,
        personnalites=[
            Personnalite(name=p.name, person_id=p.id)
            for p in playlist_item_personnalites.personnalites
            if p
        ],
        media_data=media_data,
    )
    data2 = VideoData2(
        video_id=id_,
        release_date=playlist_item_personnalites.playlist_item.snippet.publishedAt.date(),
        name=playlist_item_personnalites.playlist_item.snippet.title,
    )

    database.extend(
        [
            (data2, m, Personnalite(name=p.name, person_id=p.id))
            for m in media_data
            for p in playlist_item_personnalites.personnalites
            if p
        ]
    )

    feed.append(data2)

    blob_name = str(data_prefix / "video" / f"{id_}.json")
    bucket.blob(blob_name).upload_from_string(
        data.model_dump_json(), content_type="application/json"
    )


@dataclass
class CitationPersonnalite:
    personnalite: Personnalite
    videoIds: list[str]


class MediaIdData(BaseModel):
    id: int | None
    title: str | None
    release_year: date | None
    citations: List[CitationPersonnalite]


# /film/id
for movie_id in set([m.id for _, m, _ in database if m.type == "movie"]):
    movie_data = [
        (video_id, m, p)
        for video_id, m, p in database
        if m.id == movie_id and m.type == "movie"
    ]
    personnalites = set([p.person_id for _, _, p in movie_data])
    citations = [
        CitationPersonnalite(
            personnalite=next(p for _, _, p in movie_data if p.person_id == person_id),
            videoIds=list(
                set(
                    [
                        video_data.video_id
                        for video_data, _, p in movie_data
                        if p.person_id == person_id
                    ]
                )
            ),
        )
        for person_id in personnalites
    ]
    film_data = MediaIdData(
        id=movie_id,
        title=movie_data[0][1].title,
        release_year=movie_data[0][1].release_year,
        citations=citations,
    )
    bucket.blob(str(data_prefix / "film" / f"{movie_id}.json")).upload_from_string(
        film_data.model_dump_json(), content_type="application/json"
    )


# /serie/id
for serie_id in set([m.id for _, m, _ in database if m.type == "tv"]):
    serie_data = [
        (video_id, m, p)
        for video_id, m, p in database
        if m.id == serie_id and m.type == "tv"
    ]
    personnalites = set([p.person_id for _, _, p in serie_data])
    citations = [
        CitationPersonnalite(
            personnalite=next(p for _, _, p in serie_data if p.person_id == person_id),
            videoIds=list(
                set(
                    [
                        video_data.video_id
                        for video_data, _, p in serie_data
                        if p.person_id == person_id
                    ]
                )
            ),
        )
        for person_id in personnalites
    ]
    film_data = MediaIdData(
        id=serie_id,
        title=serie_data[0][1].title,
        release_year=serie_data[0][1].release_year,
        citations=citations,
    )
    bucket.blob(str(data_prefix / "serie" / f"{serie_id}.json")).upload_from_string(
        film_data.model_dump_json(), content_type="application/json"
    )


@dataclass
class MediaItem2:
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
    media: MediaItem2
    citations: List[Citation]


class PersonneIdData(BaseModel):
    name: str | None
    videos: List[VideoData2]
    citations: List[CitationMedia]


# /person/id
for person_id in set([p.person_id for _, _, p in database]):
    person_data = [
        (video_id, m, p) for video_id, m, p in database if p.person_id == person_id
    ]
    media_items = set(
        [(m.id, m.type, m.title, m.release_year) for _, m, _ in person_data]
    )
    citations = [
        CitationMedia(
            media=MediaItem2(
                id=media_id,
                type=media_type,  # type: ignore
                title=media_title,
                release_year=media_release_year,
            ),
            citations=[
                Citation(
                    videoId=video_data.video_id,
                    start_time=m.start_time,
                    end_time=m.end_time,
                )
                for video_data, m, _ in person_data
                if m.id == media_id
            ],
        )
        for media_id, media_type, media_title, media_release_year in media_items
    ]
    # Get unique video IDs for this person
    unique_video_ids = {
        video_data.video_id
        for video_data, _, p in person_data
        if p.person_id == person_id
    }

    # Map video IDs to their corresponding VideoData2 objects
    videos = [
        next(
            video_data
            for video_data, _, _ in person_data
            if video_data.video_id == video_id
        )
        for video_id in unique_video_ids
    ]

    person_data = PersonneIdData(
        name=person_data[0][2].name,
        videos=videos,
        citations=citations,
    )
    bucket.blob(str(data_prefix / "personne" / f"{person_id}.json")).upload_from_string(
        person_data.model_dump_json(), content_type="application/json"
    )

# /meilleurs/films
@dataclass
class Citation2:
    videoId: str
    start_time: int
    end_time: int
    name: str | None

@dataclass
class CitationMedia2:
    media: MediaItem2
    citations: List[Citation2]

class BestMediaData(BaseModel):
    media: list[CitationMedia2]

best_movie_data: dict[int, CitationMedia2] = {}
for video_data, m, p in database:
    if m.type == "movie":
        key = m.id
        if key and key not in best_movie_data:
            best_movie_data[key] = CitationMedia2(
                media=MediaItem2(
                    id=m.id,
                    type=m.type,
                    title=m.title,
                    release_year=m.release_year,
                ),
                citations=[],
            )
        if key:
            if video_data.video_id not in [c.videoId for c in best_movie_data[key].citations]:
                best_movie_data[key].citations.append(
                    Citation2(
                        videoId=video_data.video_id,
                        start_time=m.start_time,
                        end_time=m.end_time,
                        name=p.name,
                    )
                )

best_movies = BestMediaData(media=list(best_movie_data.values()))
bucket.blob(str(data_prefix / "meilleurs" / "films.json")).upload_from_string(
    best_movies.model_dump_json(), content_type="application/json"
)

# /meilleurs/series
best_serie_data: dict[int, CitationMedia2] = {}
for video_data, m, p in database:
    if m.type == "tv":
        key = m.id
        if key and key not in best_serie_data:
            best_serie_data[key] = CitationMedia2(
                media=MediaItem2(
                    id=m.id,
                    type=m.type,
                    title=m.title,
                    release_year=m.release_year,
                ),
                citations=[],
            )
        if key:
            if video_data.video_id not in [c.videoId for c in best_serie_data[key].citations]:
                best_serie_data[key].citations.append(
                    Citation2(
                        videoId=video_data.video_id,
                        start_time=m.start_time,
                        end_time=m.end_time,
                        name=p.name,
                    )
                )

best_series = BestMediaData(media=list(best_serie_data.values()))
bucket.blob(str(data_prefix / "meilleurs" / "series.json")).upload_from_string(
    best_series.model_dump_json(), content_type="application/json"
)

bucket.blob(str(data_prefix / "video.json")).upload_from_string(
    VideoFeedData(feed=feed).model_dump_json(), content_type="application/json"
)

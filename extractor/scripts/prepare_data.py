"""Prepare and publish structured data to GCS for the API.

Inputs expected in the bucket under the raw prefix (default: ``videos/``):
- /videos/{video_id}/video.json (PlaylistItemPersonnalites)
- /videos/{video_id}/movies.json (MediaItemsTimestamps)

Outputs produced under the data prefix (default: ``data/``), mirroring
the website structure:
- /data/video/{video_id}.json (VideoDataFull)
- /data/video/index.json (Index)
- /data/film/{movie_id}.json (MediaIdData)
- /data/film/meilleurs.json (BestMediaData)
- /data/film/index.json (Index)
- /data/serie/{serie_id}.json (MediaIdData)
- /data/serie/meilleures.json (BestMediaData)
- /data/serie/index.json (Index)
- /data/personne/{person_id}.json (PersonneIdData)
- /data/personne/index.json (Index)
- /data/video.json (feed) (VideoFeedData)
"""

from __future__ import annotations

import asyncio
import json
import logging
from functools import partial
from pathlib import Path
from collections.abc import Awaitable

from extractor.models import (
    VideoDataFull,
    Index,
    Personnalite,
    MediaItemWithTime,
    VideoDataShort,
    VideoFeedData,
    CitationPersonnalite,
    MediaIdData,
    MediaItem,
    Citation,
    CitationMedia,
    PersonneIdData,
    CitationWithName,
    CitationMediaWithName,
    BestMediaData,
)
from extractor.movies.models import MediaItemsTimestamps
from extractor.video.models import PlaylistItemPersonnalites

import google.api_core.exceptions
from google.cloud import storage


logger = logging.getLogger(__name__)


def get_bucket(bucket_name: str) -> storage.Bucket:
    """Return a GCS bucket handle for ``bucket_name``.

    The client uses default credentials in the environment.
    """
    logger.debug(f"Creating storage client and accessing bucket: {bucket_name}")
    return storage.Client().bucket(bucket_name)


async def load_playlist_item_personnalites(
    bucket: storage.Bucket, raw_prefix: Path, video_id: str
) -> PlaylistItemPersonnalites | None:
    """Load playlist item/personnalites JSON for a video from GCS.

    Returns None if the expected blob is missing.
    """
    blob_path = str(raw_prefix / video_id / "video.json")
    try:
        blob = bucket.blob(blob_path)
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(None, blob.download_as_bytes)
        return PlaylistItemPersonnalites.model_validate_json(data)
    except google.api_core.exceptions.NotFound:
        logger.warning(f"Missing raw file: {blob_path}")
        return None


async def load_media_items_timestamps(
    bucket: storage.Bucket, raw_prefix: Path, video_id: str
) -> MediaItemsTimestamps | None:
    """Load media items timestamps JSON for a video from GCS.

    Returns None if the expected blob is missing.
    """
    blob_path = str(raw_prefix / video_id / "movies.json")
    try:
        blob = bucket.blob(blob_path)
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(None, blob.download_as_bytes)
        return MediaItemsTimestamps.model_validate_json(data)
    except google.api_core.exceptions.NotFound:
        logger.warning(f"Missing raw file: {blob_path}")
        return None


async def build_media_data(media_items: MediaItemsTimestamps) -> list[MediaItemWithTime]:
    """Convert ``MediaItemsTimestamps`` into a list of ``MediaItem`` records."""
    return [
        MediaItemWithTime(
            id=m.media_item.details.id,
            type=m.media_item.type,
            title=(
                m.media_item.details.title
                if m.media_item.type == "movie"
                else m.media_item.details.name
            ),
            release_year=m.media_item.release_year,
            start_time=m.start_time.seconds,
            end_time=m.end_time.seconds,
        )
        for m in media_items.media_items_timestamps
    ]


async def write_video_json(
    bucket: storage.Bucket, data_prefix: Path, video_id: str, data: VideoDataFull
) -> None:
    """Write the per-video JSON document under ``/data/video/{video_id}.json``."""
    blob_name = str(data_prefix / "video" / f"{video_id}.json")
    payload = data.model_dump_json()
    await upload_json_blob(bucket, blob_name, payload)


async def upload_json_blob(
    bucket: storage.Bucket, blob_name: str, payload: str
) -> None:
    """Upload ``payload`` JSON to ``blob_name`` asynchronously."""
    blob = bucket.blob(blob_name)
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None, partial(blob.upload_from_string, payload, content_type="application/json")
    )
    logger.info(f"Wrote {blob_name}")


def discover_video_ids(
    bucket: storage.Bucket, raw_prefix: Path
) -> list[str]:
    """Return sorted video IDs that have the expected raw inputs available."""
    prefix = str(raw_prefix).strip("/")
    if prefix:
        prefix = f"{prefix}/"

    videos_with_metadata: set[str] = set()
    videos_with_media: set[str] = set()

    for blob in bucket.list_blobs(prefix=prefix):
        if not blob.name.startswith(prefix):
            continue

        remainder = blob.name[len(prefix) :]
        parts = remainder.split("/")
        if len(parts) != 2:
            continue

        video_id, filename = parts
        if filename == "video.json":
            videos_with_metadata.add(video_id)
        elif filename == "movies.json":
            videos_with_media.add(video_id)

    available = sorted(videos_with_metadata & videos_with_media)
    logger.info(
        "Discovered %d videos with both video.json and movies.json", len(available)
    )
    return available


async def process_video(
    bucket: storage.Bucket,
    raw_prefix: Path,
    data_prefix: Path,
    video_id: str,
) -> tuple[VideoDataShort, list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]]] | None:
    ppl = await load_playlist_item_personnalites(bucket, raw_prefix, video_id)
    if not ppl:
        return None

    media_items_ts = await load_media_items_timestamps(bucket, raw_prefix, video_id)
    if not media_items_ts:
        return None

    media_data = await build_media_data(media_items_ts)

    detailed_video_id = ppl.playlist_item.snippet.resourceId.videoId
    data = VideoDataFull(
        video_id=detailed_video_id,
        personnalites=[
            Personnalite(name=p.name, person_id=p.id) for p in ppl.personnalites if p
        ],
        media_data=media_data,
    )
    feed_entry = VideoDataShort(
        video_id=video_id,
        release_date=ppl.playlist_item.snippet.publishedAt.date(),
        name=ppl.playlist_item.snippet.title,
    )
    await write_video_json(bucket, data_prefix, video_id, data)

    db_entries = [
        (feed_entry, m, Personnalite(name=p.name, person_id=p.id))
        for m in media_data
        for p in ppl.personnalites
        if p
    ]

    return feed_entry, db_entries


async def collect_feed_and_database(
    bucket: storage.Bucket,
    raw_prefix: Path,
    data_prefix: Path,
) -> tuple[
    list[VideoDataShort],
    list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]],
]:
    """Build the feed and the working database from available videos.

    Also writes ``/data/video/{video_id}.json`` for each processed video.
    """
    video_ids = discover_video_ids(bucket, raw_prefix)
    feed: list[VideoDataShort] = []
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]] = []

    results = await asyncio.gather(
        *(process_video(bucket, raw_prefix, data_prefix, id_) for id_ in video_ids)
    )

    for result in results:
        if not result:
            continue
        feed_entry, db_entries = result
        feed.append(feed_entry)
        database.extend(db_entries)

    logger.info(f"Prepared feed for {len(feed)} videos; database rows: {len(database)}")
    return feed, database


async def export_media_by_id(
    bucket: storage.Bucket,
    data_prefix: Path,
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]],
) -> None:
    """Export per-media JSON by ID for movies and series
    under /data/(serie|film)/{id}.json."""
    tasks: list[Awaitable[None]] = []
    # Movies
    for movie_id in set([m.id for _, m, _ in database if m.type == "movie"]):
        movie_data = [
            (video_id, m, p)
            for video_id, m, p in database
            if m.id == movie_id and m.type == "movie"
        ]
        personnalites = set([p.person_id for _, _, p in movie_data])
        citations = [
            CitationPersonnalite(
                personnalite=next(
                    p for _, _, p in movie_data if p.person_id == person_id
                ),
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
        blob = str(data_prefix / "film" / f"{movie_id}.json")
        tasks.append(upload_json_blob(bucket, blob, film_data.model_dump_json()))

    # Series
    for serie_id in set([m.id for _, m, _ in database if m.type == "tv"]):
        serie_data = [
            (video_id, m, p)
            for video_id, m, p in database
            if m.id == serie_id and m.type == "tv"
        ]
        personnalites = set([p.person_id for _, _, p in serie_data])
        citations = [
            CitationPersonnalite(
                personnalite=next(
                    p for _, _, p in serie_data if p.person_id == person_id
                ),
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
        blob = str(data_prefix / "serie" / f"{serie_id}.json")
        tasks.append(upload_json_blob(bucket, blob, film_data.model_dump_json()))

    if tasks:
        await asyncio.gather(*tasks)


async def export_person_by_id(
    bucket: storage.Bucket,
    data_prefix: Path,
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]],
) -> None:
    """Export per-person JSON documents under ``/data/personne/{id}.json``."""
    tasks: list[Awaitable[None]] = []
    for person_id in set([p.person_id for _, _, p in database]):
        person_rows = [
            (video_id, m, p) for video_id, m, p in database if p.person_id == person_id
        ]
        media_items = set(
            [(m.id, m.type, m.title, m.release_year) for _, m, _ in person_rows]
        )
        citations = [
            CitationMedia(
                media=MediaItem(
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
                    for video_data, m, _ in person_rows
                    if m.id == media_id
                ],
            )
            for media_id, media_type, media_title, media_release_year in media_items
        ]
        unique_video_ids = {
            video_data.video_id
            for video_data, _, p in person_rows
            if p.person_id == person_id
        }
        videos = [
            next(
                video_data
                for video_data, _, _ in person_rows
                if video_data.video_id == video_id
            )
            for video_id in unique_video_ids
        ]

        person_doc = PersonneIdData(
            name=person_rows[0][2].name,
            videos=videos,
            citations=citations,
        )
        blob = str(data_prefix / "personne" / f"{person_id}.json")
        tasks.append(upload_json_blob(bucket, blob, person_doc.model_dump_json()))

    if tasks:
        await asyncio.gather(*tasks)


async def export_best_media(
    bucket: storage.Bucket,
    data_prefix: Path,
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]],
) -> None:
    """Export best-of lists for movies and series
    under /data/(serie|film)/meilleurs.json."""
    tasks: list[Awaitable[None]] = []
    # Movies best-of
    best_movie_data: dict[int, CitationMediaWithName] = {}
    for video_data, m, p in database:
        if m.type == "movie":
            key = m.id
            if key and key not in best_movie_data:
                best_movie_data[key] = CitationMediaWithName(
                    media=MediaItem(
                        id=m.id,
                        type=m.type,
                        title=m.title,
                        release_year=m.release_year,
                    ),
                    citations=[],
                )
            if key:
                if video_data.video_id not in [
                    c.videoId for c in best_movie_data[key].citations
                ]:
                    best_movie_data[key].citations.append(
                        CitationWithName(
                            videoId=video_data.video_id,
                            start_time=m.start_time,
                            end_time=m.end_time,
                            name=p.name,
                        )
                    )

    best_movies = BestMediaData(media=list(best_movie_data.values()))
    blob = str(data_prefix / "film" / "meilleurs.json")
    tasks.append(upload_json_blob(bucket, blob, best_movies.model_dump_json()))

    # Series best-of
    best_serie_data: dict[int, CitationMediaWithName] = {}
    for video_data, m, p in database:
        if m.type == "tv":
            key = m.id
            if key and key not in best_serie_data:
                best_serie_data[key] = CitationMediaWithName(
                    media=MediaItem(
                        id=m.id,
                        type=m.type,
                        title=m.title,
                        release_year=m.release_year,
                    ),
                    citations=[],
                )
            if key:
                if video_data.video_id not in [
                    c.videoId for c in best_serie_data[key].citations
                ]:
                    best_serie_data[key].citations.append(
                        CitationWithName(
                            videoId=video_data.video_id,
                            start_time=m.start_time,
                            end_time=m.end_time,
                            name=p.name,
                        )
                    )

    best_series = BestMediaData(media=list(best_serie_data.values()))
    blob = str(data_prefix / "serie" / "meilleures.json")
    tasks.append(upload_json_blob(bucket, blob, best_series.model_dump_json()))

    if tasks:
        await asyncio.gather(*tasks)


async def export_feed(
    bucket: storage.Bucket, data_prefix: Path, feed: list[VideoDataShort]
) -> None:
    """Export the global feed under ``/data/video.json``."""
    blob = str(data_prefix / "video.json")
    await upload_json_blob(bucket, blob, VideoFeedData(feed=feed).model_dump_json())


async def export_indices(
    bucket: storage.Bucket,
    data_prefix: Path,
    feed: list[VideoDataShort],
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]],
) -> None:
    """Export index.json files for video, film, serie and personne."""
    tasks: list[Awaitable[None]] = []
    # /data/video/index.json
    video_ids = [v.video_id for v in feed]
    blob = str(data_prefix / "video" / "index.json")
    tasks.append(upload_json_blob(bucket, blob, Index(ids=video_ids).model_dump_json()))

    # /data/film/index.json
    movie_ids = sorted(
        {m.id for _, m, _ in database if m.type == "movie" and m.id is not None}
    )
    blob = str(data_prefix / "film" / "index.json")
    tasks.append(upload_json_blob(bucket, blob, json.dumps({"ids": movie_ids})))

    # /data/serie/index.json
    serie_ids = sorted(
        {m.id for _, m, _ in database if m.type == "tv" and m.id is not None}
    )
    blob = str(data_prefix / "serie" / "index.json")
    tasks.append(upload_json_blob(bucket, blob, json.dumps({"ids": serie_ids})))

    # /data/personne/index.json
    person_ids = sorted(
        {p.person_id for _, _, p in database if p.person_id is not None}
    )
    blob = str(data_prefix / "personne" / "index.json")
    tasks.append(upload_json_blob(bucket, blob, json.dumps({"ids": person_ids})))

    if tasks:
        await asyncio.gather(*tasks)


async def _prepare_data_async(
    bucket: storage.Bucket,
    video_raw_data_prefix: Path,
    data_prefix: Path,
) -> None:
    feed, database = await collect_feed_and_database(
        bucket,
        video_raw_data_prefix,
        data_prefix,
    )

    await asyncio.gather(
        export_media_by_id(bucket, data_prefix, database),
        export_person_by_id(bucket, data_prefix, database),
        export_best_media(bucket, data_prefix, database),
        export_feed(bucket, data_prefix, feed),
        export_indices(bucket, data_prefix, feed, database),
    )


def prepare_data(
    bucket_name: str = "videoclub-test",
    video_raw_data_prefix: Path = Path("videos"),
    data_prefix: Path = Path("data"),
) -> None:
    """Orchestrate the data preparation pipeline.

    - Reads raw inputs under ``video_raw_data_prefix``
    - Writes structured documents under ``data_prefix``
    """
    bucket = get_bucket(bucket_name)
    logger.info(
        f"Preparing data using bucket={bucket_name} "
        f"raw_prefix={video_raw_data_prefix} data_prefix={data_prefix}"
    )
    asyncio.run(
        _prepare_data_async(
            bucket,
            video_raw_data_prefix,
            data_prefix,
        )
    )


if __name__ == "__main__":
    prepare_data()

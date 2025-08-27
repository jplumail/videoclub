"""Prepare and publish structured data to GCS for the API.

Inputs expected in the bucket under the raw prefix (default: ``videos/``):
- /videos/{video_id}/video.json (PlaylistItemPersonnalites)
- /videos/{video_id}/movies.json (MediaItemsTimestamps)

Outputs produced under the data prefix (default: ``data/``), mirroring
the website structure:
- /data/video/{video_id}.json (VideoDataFull)
- /data/film/{movie_id}.json (MediaIdData)
- /data/film/meilleurs.json (BestMediaData)
- /data/serie/{serie_id}.json (MediaIdData)
- /data/serie/meilleures.json (BestMediaData)
- /data/personne/{person_id}.json (PersonneIdData)
- /data/video.json (feed) (VideoFeedData)
"""

from __future__ import annotations

import logging
from pathlib import Path

from extractor.models import (
    VideoDataFull,
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
from extractor.youtube.youtube import get_videos_videoclub

import google.api_core.exceptions
from google.cloud import storage


logger = logging.getLogger(__name__)


def get_bucket(bucket_name: str) -> storage.Bucket:
    """Return a GCS bucket handle for ``bucket_name``.

    The client uses default credentials in the environment.
    """
    logger.debug(f"Creating storage client and accessing bucket: {bucket_name}")
    return storage.Client().bucket(bucket_name)


def load_playlist_item_personnalites(
    bucket: storage.Bucket, raw_prefix: Path, video_id: str
) -> PlaylistItemPersonnalites | None:
    """Load playlist item/personnalites JSON for a video from GCS.

    Returns None if the expected blob is missing.
    """
    blob_path = str(raw_prefix / video_id / "video.json")
    try:
        data = bucket.blob(blob_path).download_as_bytes()
        return PlaylistItemPersonnalites.model_validate_json(data)
    except google.api_core.exceptions.NotFound:
        logger.warning(f"Missing raw file: {blob_path}")
        return None


def load_media_items_timestamps(
    bucket: storage.Bucket, raw_prefix: Path, video_id: str
) -> MediaItemsTimestamps | None:
    """Load media items timestamps JSON for a video from GCS.

    Returns None if the expected blob is missing.
    """
    blob_path = str(raw_prefix / video_id / "movies.json")
    try:
        data = bucket.blob(blob_path).download_as_bytes()
        return MediaItemsTimestamps.model_validate_json(data)
    except google.api_core.exceptions.NotFound:
        logger.warning(f"Missing raw file: {blob_path}")
        return None


def build_media_data(media_items: MediaItemsTimestamps) -> list[MediaItemWithTime]:
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


def write_video_json(
    bucket: storage.Bucket, data_prefix: Path, video_id: str, data: VideoDataFull
) -> None:
    """Write the per-video JSON document under ``/data/video/{video_id}.json``."""
    blob_name = str(data_prefix / "video" / f"{video_id}.json")
    bucket.blob(blob_name).upload_from_string(
        data.model_dump_json(), content_type="application/json"
    )
    logger.info(f"Wrote {blob_name}")


def collect_feed_and_database(
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
    items = get_videos_videoclub()
    feed: list[VideoDataShort] = []
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]] = []

    logger.info(f"Discovered {len(items)} playlist items")

    for item in items:
        id_ = item.snippet.resourceId.videoId
        ppl = load_playlist_item_personnalites(bucket, raw_prefix, id_)
        if not ppl:
            continue

        media_items_ts = load_media_items_timestamps(bucket, raw_prefix, id_)
        if not media_items_ts:
            continue

        media_data = build_media_data(media_items_ts)

        video_id = ppl.playlist_item.snippet.resourceId.videoId
        data = VideoDataFull(
            video_id=video_id,
            personnalites=[
                Personnalite(name=p.name, person_id=p.id)
                for p in ppl.personnalites
                if p
            ],
            media_data=media_data,
        )
        data2 = VideoDataShort(
            video_id=id_,
            release_date=ppl.playlist_item.snippet.publishedAt.date(),
            name=ppl.playlist_item.snippet.title,
        )

        database.extend(
            [
                (data2, m, Personnalite(name=p.name, person_id=p.id))
                for m in media_data
                for p in ppl.personnalites
                if p
            ]
        )

        feed.append(data2)
        write_video_json(bucket, data_prefix, id_, data)

    logger.info(f"Prepared feed for {len(feed)} videos; database rows: {len(database)}")
    return feed, database


def export_media_by_id(
    bucket: storage.Bucket,
    data_prefix: Path,
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]],
) -> None:
    """Export per-media JSON by ID for movies and series
    under /data/(serie|film)/{id}.json."""
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
        bucket.blob(blob).upload_from_string(
            film_data.model_dump_json(), content_type="application/json"
        )
        logger.info(f"Wrote {blob}")

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
        bucket.blob(blob).upload_from_string(
            film_data.model_dump_json(), content_type="application/json"
        )
        logger.info(f"Wrote {blob}")


def export_person_by_id(
    bucket: storage.Bucket,
    data_prefix: Path,
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]],
) -> None:
    """Export per-person JSON documents under ``/data/personne/{id}.json``."""
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
        bucket.blob(blob).upload_from_string(
            person_doc.model_dump_json(), content_type="application/json"
        )
        logger.info(f"Wrote {blob}")


def export_best_media(
    bucket: storage.Bucket,
    data_prefix: Path,
    database: list[tuple[VideoDataShort, MediaItemWithTime, Personnalite]],
) -> None:
    """Export best-of lists for movies and series
    under /data/(serie|film)/meilleurs.json."""
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
    bucket.blob(blob).upload_from_string(
        best_movies.model_dump_json(), content_type="application/json"
    )
    logger.info(f"Wrote {blob}")

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
    bucket.blob(blob).upload_from_string(
        best_series.model_dump_json(), content_type="application/json"
    )
    logger.info(f"Wrote {blob}")


def export_feed(
    bucket: storage.Bucket, data_prefix: Path, feed: list[VideoDataShort]
) -> None:
    """Export the global feed under ``/data/video.json``."""
    blob = str(data_prefix / "video.json")
    bucket.blob(blob).upload_from_string(
        VideoFeedData(feed=feed).model_dump_json(), content_type="application/json"
    )
    logger.info(f"Wrote {blob}")


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
    feed, database = collect_feed_and_database(
        bucket,
        video_raw_data_prefix,
        data_prefix,
    )
    export_media_by_id(bucket, data_prefix, database)
    export_person_by_id(bucket, data_prefix, database)
    export_best_media(bucket, data_prefix, database)
    export_feed(bucket, data_prefix, feed)


if __name__ == "__main__":
    prepare_data()

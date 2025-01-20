import json
from pathlib import Path
from typing import Any, Coroutine
from extractor.download import upload_json_blob
from extractor.models import (
    MediaItem,
    TextAnnotationSegmentGroupOrganized,
    MediaItemTimestamp,
    MediaItemsTimestamps,
)
from extractor.utils import download_blob
import asyncio
from itertools import zip_longest

from themoviedb import aioTMDb, PartialMovie, PartialTV


tmdb = aioTMDb(key="664bdab2fb8644acc4be2cff2bb52414", language="fr-FR", region="FR")


def get_director(details: str):
    director = details.split("-")[0].strip()
    print(f"Director of details {details} is:", director)
    return director


def get_year(details: str):
    try:
        year = int(details.split("-")[1].strip())
    except (ValueError, IndexError):
        year = None
    print(f"Year of details {details} is:", year)
    return year


async def is_director_in_movie(director_id: int, movie_id: int):
    director_credits = await tmdb.person(director_id).combined_credits()
    director_jobs_in_movie = (
        [x for x in director_credits.crew if x.id == movie_id]
        if director_credits.crew
        else []
    )
    is_director = len(director_jobs_in_movie) > 0
    print(f"Director of ID: {director_id}, is director in {movie_id}: {is_director}")
    return is_director


def mean(lst: list[float]):
    return sum(lst) / len(lst) if lst else 0.0


async def get_media_details(segment_group: TextAnnotationSegmentGroupOrganized):
    movies_query = tmdb.search().movies(query=segment_group.get_heading_text())
    tv_series_query = tmdb.search().tv(query=segment_group.get_heading_text())
    directors_query = tmdb.search().people(
        query=get_director(segment_group.get_details_text())
    )

    movies, tv_series, directors = await asyncio.gather(
        movies_query, tv_series_query, directors_query
    )
    movies_or_tv_series_interleaved = [
        movie
        for pair in zip_longest(
            movies.results if movies.results else [],
            tv_series.results if tv_series.results else [],
            fillvalue=None,
        )
        for movie in pair
        if movie
    ]

    if len(movies_or_tv_series_interleaved) == 0:
        print(f"ERROR: No movie or TV series found for {segment_group.get_heading_text()}")
        if movies.results:
            print(f"INFO: {len(movies.results)=}")
        else:
            print("INFO: No movie found")
        if tv_series.results:
            print(f"INFO: {len(tv_series.results)=}")
        else:
            print("INFO: No TV series found")
        return None

    if directors.total_results == 0:
        print(f"ERROR: No director found for {get_director(segment_group.get_details_text())}")
        return None
    directors.results = directors.results or []

    async def dummy_false():
        return False
    # Movie or TV Serie - director matching
    movie_director_match: list[list[Coroutine[Any, Any, bool]]] = (
        [[dummy_false()] for _ in range(len(movies_or_tv_series_interleaved))] if movies_or_tv_series_interleaved else []
    )
    results_limit = 3  # Limit the number of results to check
    for i, media_item in enumerate(movies_or_tv_series_interleaved[:results_limit]):
        movie_director_match[i] = [
            is_director_in_movie(director.id, media_item.id)
            if director.id and media_item.id and director.known_for_department == "Directing"
            else dummy_false()
            for director in directors.results[:results_limit]
        ]

    # Movie - year matching
    year = get_year(segment_group.get_details_text())
    if year is None:
        print(f"INFO: No year found for {segment_group.get_details_text()}")
    year_confidence = (
        [0.0 for _ in range(len(movies_or_tv_series_interleaved))]
        if movies_or_tv_series_interleaved
        else []
    )
    if year:
        for i, media_item in enumerate(movies_or_tv_series_interleaved):
            release_date = (
                media_item.release_date
                if isinstance(media_item, PartialMovie)
                else media_item.first_air_date
            )
            if release_date:
                diff = abs(release_date.year - year)
                year_confidence[i] = max(1.0 - diff / 10, 0.0)

    # Combine confidence scores
    movie_director_match = await asyncio.gather(*[asyncio.gather(*x) for x in movie_director_match])
    movie_director_match_confidence = [[float(y) for y in x] for x in movie_director_match]
    confidence_scores = [
        0.5 * mean(movie_director_match_confidence[i]) + 0.5 * year_confidence[i]
        for i in range(len(movies_or_tv_series_interleaved))
    ]

    # Get the best media item index
    best_media_item_index = (
        confidence_scores.index(max(confidence_scores)) if confidence_scores else None
    )
    if best_media_item_index is not None:
        # Get the media item
        media_item = (
            movies_or_tv_series_interleaved[best_media_item_index]
            if movies_or_tv_series_interleaved
            else None
        )

        # Get the director
        best_director_index = movie_director_match[best_media_item_index].index(
            max(movie_director_match[best_media_item_index])
        )
        director = directors.results[best_director_index] if directors.results else None

        # Get the release year
        release_date = (
            (
                media_item.release_date
                if isinstance(media_item, PartialMovie)
                else media_item.first_air_date
            )
            if media_item
            else None
        )

        # Compute final confidence
        final_confidence = max(confidence_scores) * segment_group.get_confidence()
    else:
        media_item = None
        director = None
        release_date = None
        final_confidence = 0.0

    if media_item:
        return MediaItemTimestamp(
            media_item=MediaItem(details=media_item, director=director, release_year=release_date),
            confidence=final_confidence,
            start_time=segment_group.get_start_time(),
            end_time=segment_group.get_end_time(),
        )
    else:
        return None


async def _extract_media_items(annotations: list[TextAnnotationSegmentGroupOrganized]):
    tasks = [get_media_details(x) for x in annotations]
    details = await asyncio.gather(*tasks)
    return MediaItemsTimestamps(media_items_timestamps=[media_timestamp for media_timestamp in details if media_timestamp])


async def extract_media_items(
    bucket_name: str, annotation_blob_name: str, output_blob_name: str
):
    blob_data = download_blob(bucket_name, annotation_blob_name)
    blob_list = json.loads(blob_data)
    annotations = [TextAnnotationSegmentGroupOrganized(**d) for d in blob_list]

    items = await _extract_media_items(annotations)
    blob_name = upload_json_blob(bucket_name, items.model_dump(), output_blob_name)
    return blob_name


if __name__ == "__main__":
    import sys

    annotations = [
        TextAnnotationSegmentGroupOrganized(**d)
        for d in json.loads(Path(sys.argv[1]).read_text())
    ]
    items = asyncio.run(_extract_media_items(annotations))
    # sort movies by start time
    items.media_items_timestamps.sort(key=lambda x: x.start_time)
    Path(sys.argv[2]).write_text(
        items.model_dump_json(
            include={
                "media_items_timestamps": {
                    "__all__": {
                        "media_item": {
                            "details": {"id", "title", "name"},
                            "director": {"id", "name"},
                            "release_year": True,
                        },
                        "start_time": True,
                        "end_time": True,
                        "confidence": True,
                    }
                }
            }
        )
    )

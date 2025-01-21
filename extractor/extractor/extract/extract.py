import json
import re
from typing import Any, Coroutine
from extractor.download import upload_json_blob
from extractor.extract.llm import get_directors_names_and_years_llm
from extractor.models import (
    MediaItem,
    MediaItemTimestamp,
    MediaItemsTimestamps,
)
from extractor.utils import year_pattern
from extractor.download import download_blob
import asyncio
from itertools import zip_longest

from extractor.process_annotations.models import TextAnnotationSegmentGroupOrganized
from themoviedb import aioTMDb, PartialMovie, PartialTV, Person


tmdb = aioTMDb(key="664bdab2fb8644acc4be2cff2bb52414", language="fr-FR", region="FR")


def recursive_strip(s: str, char: str) -> str:
    if s.strip() == s and not s.startswith(char) and not s.endswith(char):
        return s
    else:
        return recursive_strip(s.strip().strip(char), char)


def get_directors_names(details: str, years: list[int]):
    s = details
    if years:
        for year in years:
            s = s.replace(str(year), "")
    s = recursive_strip(s, "-")
    directors = s.split("&")
    directors = [director.strip() for director in directors]
    return directors


def get_years(details: str):
    years = re.findall(year_pattern, details)
    if not years:
        print(f"INFO: No year found for details: {details}")
    return [int(year) for year in years]


def get_directors_names_and_years(details: str):
    years = get_years(details)
    directors_names = get_directors_names(details, years)
    return directors_names, years
    

async def is_person_in_movie(person_id: int, movie_id: int):
    director_credits = await tmdb.person(person_id).combined_credits()
    director_jobs_in_movie = (
        [x for x in director_credits.crew if x.id == movie_id]
        if director_credits.crew
        else []
    )
    is_director = len(director_jobs_in_movie) > 0
    return is_director


def mean(lst: list[float]):
    return sum(lst) / len(lst) if lst else 0.0


async def search_media_items(title: str):
    movies_query = tmdb.search().movies(query=title)
    tv_series_query = tmdb.search().tv(query=title)
    movies, tv_series = await asyncio.gather(movies_query, tv_series_query)
    movies_tv_series_interleaved = [
        item
        for pair in zip_longest(
            movies.results if movies.results else [],
            tv_series.results if tv_series.results else [],
            fillvalue=None,
        )
        for item in pair
        if item
    ]
    if len(movies_tv_series_interleaved) == 0:
        print(f"ERROR: No movie or TV series found for title: {title}")

    return movies_tv_series_interleaved


async def search_person(person: str):
    people = await tmdb.search().people(query=person)
    return people.results or []


async def search_persons(crew_names: list[str]):
    return await asyncio.gather(*[search_person(person) for person in crew_names])


async def get_media_crew(
    media_item: PartialMovie | PartialTV, persons: list[list[Person]], limit: int
):
    media_confidence = 0.0
    media_crew: list[Person] = []
    for person in persons:
        for j, homonym in enumerate(person):
            if (
                j < limit
                and media_item.id
                and homonym.id
                and await is_person_in_movie(homonym.id, media_item.id)
            ):
                media_confidence += 1 / len(persons)
                media_crew.append(homonym)
                break
    return media_crew, media_confidence


async def get_movie_director_match_confidence_matrix(
    media_items: list[PartialMovie | PartialTV], persons: list[list[Person]], limit: int
):
    return [
        (media, crew, conf)
        for media, (crew, conf) in zip(
            media_items,
            await asyncio.gather(
                *[get_media_crew(media, persons, limit) for media in media_items]
            ),
        )
    ]


def get_movie_year_confidence(
    media_items: list[PartialMovie | PartialTV], year: int | None
):
    if year is None:
        return [0.0 for _ in media_items]
    release_dates = [
        media_item.release_date
        if isinstance(media_item, PartialMovie)
        else media_item.first_air_date
        for media_item in media_items
    ]
    return [1.0 - abs(date.year - year) / 10 if date else 0.0 for date in release_dates]

async def get_persons_and_years(details: str):
    directors_names, years = get_directors_names_and_years(details)
    directors = await search_persons(directors_names)
    if any(len(persons) == 0 for persons in directors):
        print(f"INFO: No director(s) found for names: {directors_names}. Falling back to LLM.")
        directors_names, years = get_directors_names_and_years_llm(details)
        directors = await search_persons(directors_names)
        if any(len(persons) == 0 for persons in directors):
            print(f"ERROR: LLM failed. No director(s) found for names: {directors_names}.")
        else:
            print(f"INFO: LLM succeeded. Found director(s) for names: {directors_names}.")
    return directors, years


async def get_best_media_item_director(title: str, details: str):
    media_items = await search_media_items(title)
    if len(media_items) == 0:
        return None, None, 0
    directors, years = await get_persons_and_years(details)

    # Movie or TV Serie - director matching
    results_limit = 3  # Limit the number of results to avoid too many API calls
    media_items = media_items[:results_limit]
    directors = [persons[:results_limit] for persons in directors]
    data = await get_movie_director_match_confidence_matrix(
        media_items, directors, limit=results_limit
    )

    # Movie - year matching
    years = get_years(details)
    year_confidence = get_movie_year_confidence(
        [media_item for (media_item, _, _) in data], years[0] if years else None
    )

    # Merge
    data = [
        (media_item, crew, 0.8 * conf + 0.2 * year_confidence[i])
        for i, (media_item, crew, conf) in enumerate(data)
    ]

    # Get the best confidence argmax
    best_confidence = max([conf for (_, _, conf) in data])
    media_item, crew, _ = next(
        (media_item, crew, conf)
        for (media_item, crew, conf) in data
        if conf == best_confidence
    )

    return media_item, crew, best_confidence


async def get_media_details(segment_group: TextAnnotationSegmentGroupOrganized):
    media_item, crew, confidence = await get_best_media_item_director(
        segment_group.get_heading_text(),
        segment_group.get_details_text(),
    )
    if media_item is None:
        return None

    # Combine the confidence scores
    final_confidence = confidence * segment_group.get_confidence()
    # print(f"INFO: Confidence score for {segment_group.get_heading_text()}: {final_confidence:.2f} = {confidence:.2f} * {segment_group.get_confidence():.2f}")

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

    if media_item:
        return MediaItemTimestamp(
            media_item=MediaItem(
                details=media_item, crew=crew, release_year=release_date
            ),
            confidence=final_confidence,
            start_time=segment_group.get_start_time(),
            end_time=segment_group.get_end_time(),
        )
    else:
        return None


async def _extract_media_items(annotations: list[TextAnnotationSegmentGroupOrganized]):
    tasks = [get_media_details(x) for x in annotations]
    details = await asyncio.gather(*tasks)
    return MediaItemsTimestamps(
        media_items_timestamps=[
            media_timestamp for media_timestamp in details if media_timestamp
        ]
    )


async def extract_media_items(
    bucket_name: str, annotation_blob_name: str, output_blob_name: str
):
    blob_data = download_blob(bucket_name, annotation_blob_name)
    blob_list = json.loads(blob_data)
    assert len(blob_list) == 1
    blob_list = blob_list[0]
    annotations = [TextAnnotationSegmentGroupOrganized(**d) for d in blob_list]

    items = await _extract_media_items(annotations)
    blob_name = upload_json_blob(
        bucket_name,
        items.model_dump_json(
            include={
                "media_items_timestamps": {
                    "__all__": {
                        "media_item": {
                            "details": {
                                "id",
                                "title",
                                "name",
                                "poster_path",
                            },
                            "crew": {"__all__": {"id", "name"}},
                            "release_year": True,
                        },
                        "start_time": True,
                        "end_time": True,
                        "confidence": True,
                    }
                }
            }
        ),
        output_blob_name,
    )
    return blob_name

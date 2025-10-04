import asyncio
from collections.abc import Awaitable, Callable, Sequence
import re
import warnings
from itertools import zip_longest

from extractor.utils import upload_json_blob, download_blob, year_pattern
from .models import (
    MediaItem,
    MediaItemTimestamp,
    TimeOffset,
    MediaItemsTimestamps,
)

from themoviedb import aioTMDb, PartialMovie, PartialTV, Person, PartialMedia
from extractor.annotate.models import MediaItem as MediaItemLLM, AnnotationResponse
import jiwer


# filter warning PydanticSerializationUnexpectedValue
warnings.filterwarnings("ignore", category=UserWarning)


tmdb = aioTMDb(key="664bdab2fb8644acc4be2cff2bb52414", language="fr-FR", region="FR")


class PaginatedResponse[T]:
    results: Sequence[T] | None
    total_pages: int | None


async def _collect_paginated_results[T](
    first_page: PaginatedResponse[T],
    fetch_page: Callable[[int], Awaitable[PaginatedResponse[T]]],
) -> list[T]:
    """Collect every page from a TMDB search endpoint concurrently."""

    collected: list[T] = list(first_page.results or [])
    total_pages = first_page.total_pages or 1

    if total_pages <= 1:
        return collected

    tasks = [fetch_page(page) for page in range(2, total_pages + 1)]
    for response in await asyncio.gather(*tasks):
        collected.extend(response.results or [])

    return collected


def recursive_strip(s: str, char: str) -> str:
    if s.strip() == s and not s.startswith(char) and not s.endswith(char):
        return s
    else:
        return recursive_strip(s.strip().strip(char), char)


def get_directors_names(details: str, years: list[int]):
    director = details
    if years:
        for year in years:
            director = director.replace(str(year), "")
    director = recursive_strip(director, "-")
    return director


def get_years(details: str):
    years = re.findall(year_pattern, details)
    if not years:
        print(f"INFO: No year found for details: {details}")
    return [int(year) for year in years]


def get_directors_names_and_years(details: str):
    years = get_years(details)
    director_name = get_directors_names(details, years)
    return [director_name], years


async def is_person_in_movie(person_id: int, movie_id: int):
    director_credits = await tmdb.person(person_id).combined_credits()
    director_jobs_in_movie = (
        [x for x in director_credits.crew if x.id == movie_id]
        if director_credits.crew
        else []
    )
    is_director = len(director_jobs_in_movie) > 0
    return is_director


def mean(lst: Sequence[float | int]):
    return sum(lst) / len(lst) if lst else 0.0


async def _search_movies(title: str) -> list[PartialMovie]:
    first_page: PaginatedResponse[PartialMovie] = await tmdb.search().movies(
        query=title, page=1
    )  # type: ignore

    async def fetch(page: int) -> PaginatedResponse[PartialMovie]:
        return await tmdb.search().movies(query=title, page=page)  # type: ignore

    return await _collect_paginated_results(first_page, fetch)


async def _search_tv_series(title: str) -> list[PartialTV]:
    first_page: PaginatedResponse[PartialTV] = await tmdb.search().tv(
        query=title, page=1
    )  # type: ignore

    async def fetch(page: int) -> PaginatedResponse[PartialTV]:
        return await tmdb.search().tv(query=title, page=page)  # type: ignore

    return await _collect_paginated_results(first_page, fetch)


async def _search_people(title: str) -> list[Person]:
    first_page: PaginatedResponse[Person] = await tmdb.search().people(
        query=title, page=1
    )  # type: ignore

    async def fetch(page: int) -> PaginatedResponse[Person]:
        return await tmdb.search().people(query=title, page=page)  # type: ignore

    return await _collect_paginated_results(first_page, fetch)


async def search_media_items(title: str) -> list[PartialMovie | PartialTV]:
    movies, tv_series = await asyncio.gather(
        _search_movies(title),
        _search_tv_series(title),
    )
    movies_tv_series_interleaved = [
        item
        for pair in zip_longest(
            movies,
            tv_series,
            fillvalue=None,
        )
        for item in pair
        if item
    ]
    if len(movies_tv_series_interleaved) == 0:
        print(f"ERROR: No movie or TV series found for title: {title}")

    return movies_tv_series_interleaved


async def search_person(person: str):
    return await _search_people(person)


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


async def get_best_media_item_director(
    title: str, authors_str: list[str], years: list[int]
):
    media_items = await search_media_items(title)
    if len(media_items) == 0:
        return None, None, 0
    mean_year = mean(years) if years else None
    # rank by year distance to mean year
    media_items = sorted(
        media_items,
        key=lambda x: abs(
            (
                x.release_date.year
                if isinstance(x, PartialMovie) and x.release_date
                else x.first_air_date.year
                if isinstance(x, PartialTV) and x.first_air_date
                else 0
            )
            - (mean_year if mean_year else 0)
        ),
    )

    authors = await search_persons(authors_str)

    # Movie or TV Serie - director matching
    results_limit = 3  # Limit the number of results to avoid too many API calls
    media_items = media_items[:results_limit]
    directors = [persons[:results_limit] for persons in authors]
    data = await get_movie_director_match_confidence_matrix(
        media_items, directors, limit=results_limit
    )

    # Movie - title matching via cer score
    title_confidences = [
        1.0
        - jiwer.cer(
            title.lower(),
            (
                (
                    media_item.title
                    if isinstance(media_item, PartialMovie)
                    else media_item.name
                )
                or ""
            ).lower(),
        )
        for media_item in media_items
    ]

    # Movie - year matching
    year_confidence = get_movie_year_confidence(
        [media_item for (media_item, _, _) in data], years[0] if years else None
    )

    # Merge
    data = [
        (
            media_item,
            crew,
            0.5 * conf + 0.2 * year_confidence[i] + 0.3 * title_confidences[i],
        )
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


def get_timeoffset_from_timecode(timecode: str):
    minutes, seconds = timecode.split(":")
    seconds = int(minutes) * 60 + int(seconds)
    return TimeOffset(seconds=seconds)


def to_partial_media(media_item: PartialMovie | PartialTV):
    return PartialMedia(
        id=media_item.id,
        poster_path=media_item.poster_path,
        adult=media_item.adult,
        popularity=media_item.popularity,
        backdrop_path=media_item.backdrop_path,
        vote_average=media_item.vote_average,
        overview=media_item.overview,
        first_air_date=media_item.first_air_date
        if isinstance(media_item, PartialTV)
        else None,
        origin_country=media_item.origin_country
        if isinstance(media_item, PartialTV)
        else None,
        genre_ids=media_item.genre_ids,
        original_language=media_item.original_language,
        vote_count=media_item.vote_count,
        name=media_item.name if isinstance(media_item, PartialTV) else None,
        original_name=media_item.original_name
        if isinstance(media_item, PartialTV)
        else None,
        media_type=media_item.media_type,
        release_date=media_item.release_date
        if isinstance(media_item, PartialMovie)
        else None,
        original_title=media_item.original_title
        if isinstance(media_item, PartialMovie)
        else None,
        title=media_item.title if isinstance(media_item, PartialMovie) else None,
        video=media_item.video if isinstance(media_item, PartialMovie) else None,
    )


async def get_media_details(media_item_llm: MediaItemLLM):
    media_item, crew, confidence = await get_best_media_item_director(
        media_item_llm.title, media_item_llm.authors, media_item_llm.years
    )
    if media_item is None:
        return None

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
                details=to_partial_media(media_item),
                crew=crew,
                release_year=release_date,
                type="movie" if isinstance(media_item, PartialMovie) else "tv",
            ),
            confidence=confidence,
            start_time=get_timeoffset_from_timecode(media_item_llm.timecode.start_time),
            end_time=get_timeoffset_from_timecode(media_item_llm.timecode.end_time),
        )
    else:
        return None


async def _extract_media_items(media_items: list[MediaItemLLM]):
    tasks = [get_media_details(x) for x in media_items]
    details = await asyncio.gather(*tasks)
    return MediaItemsTimestamps(
        media_items_timestamps=[
            media_timestamp for media_timestamp in details if media_timestamp
        ]
    )


async def extract_media_items(
    bucket_name: str, annotation_blob_name: str, output_blob_name: str
) -> str:
    blob_data = download_blob(bucket_name, annotation_blob_name)
    annotations = AnnotationResponse.model_validate_json(blob_data)
    items = await _extract_media_items(annotations.items)
    blob_name = upload_json_blob(
        bucket_name,
        items.model_dump_json(),
        output_blob_name,
    )
    return blob_name  # type: ignore

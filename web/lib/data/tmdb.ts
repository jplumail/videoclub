export interface ConfigurationDetails {
  images: {
    base_url: string;
    secure_base_url: string;
    backdrop_sizes: string[];
    logo_sizes: string[];
    poster_sizes: string[];
    profile_sizes: string[];
    still_sizes: string[];
  };
  change_keys: string[];
}
export interface ImageUrl {
  url: string;
  width: number;
  height: number;
}

export interface TmdbMediaDetails {
  directors: string[];
  tmdbUrl: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  episodeRuntimeMinutes: number | null;
  genres: string[];
  voteAverage: number | null;
  voteCount: number | null;
  originCountries: string[];
  originalTitle: string | null;
  tagline: string | null;
  homepage: string | null;
  overview: string | null;
}

interface TmdbCreditsResponse {
  credits?: {
    crew?: Array<{
      job?: string | null;
      name?: string | null;
    }>;
  };
  created_by?: Array<{
    name?: string | null;
  }>;
  release_date?: string | null;
  first_air_date?: string | null;
  runtime?: number | null;
  episode_run_time?: number[];
  genres?: Array<{
    name?: string | null;
  }>;
  vote_average?: number | null;
  vote_count?: number | null;
  origin_country?: string[];
  production_countries?: Array<{
    iso_3166_1?: string | null;
    name?: string | null;
  }>;
  original_title?: string | null;
  original_name?: string | null;
  tagline?: string | null;
  homepage?: string | null;
  overview?: string | null;
}

import { createLimiter, fetchWithRetry, type RetryOptions } from "../utils/http";

export class ConfigurationManager {
  private static configurationDetails: ConfigurationDetails | null = null;
  private static readonly baseUrl = "https://api.themoviedb.org/3";
  private static posterPathCache = new Map<string, string | null>();
  private static profilePathCache = new Map<string, string | null>();
  private static mediaDetailsCache = new Map<string, TmdbMediaDetails | null>();
  private static readonly MAX_CONCURRENT_REQUESTS = 4;
  private static limiter = createLimiter(this.MAX_CONCURRENT_REQUESTS);
  private static configPromise: Promise<ConfigurationDetails> | null = null;

  // Retry/backoff constants
  private static readonly RETRY: RetryOptions = {
    maxAttempts: 5,
    baseBackoffMs: 500,
    maxBackoffMs: 8000,
    jitterMs: 250,
    honorRetryAfter: true,
    retryable: (status: number) => status === 429 || (status >= 500 && status < 600),
  };

  private constructor() {}

  private static async getConfigurationDetails(): Promise<ConfigurationDetails> {
    if (this.configurationDetails) return this.configurationDetails;
    if (this.configPromise) return this.configPromise;
    this.configPromise = this.getTheMovieDBConfig()
      .then((cfg) => {
        this.configurationDetails = cfg;
        this.configPromise = null;
        return cfg;
      })
      .catch((e) => {
        this.configPromise = null;
        throw e;
      });
    return this.configPromise;
  }

  private static authHeaders() {
    return {
      accept: "application/json",
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NjRiZGFiMmZiODY0NGFjYzRiZTJjZmYyYmI1MjQxNCIsIm5iZiI6MTczNjQxNTQzNi4xMzMsInN1YiI6IjY3N2Y5OGNjMDQ0YjZjYTY3NjRlODgwYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.200sno32bOBgHhi_Jv1pCrDWJaal8tClKsHUFf2TZIQ",
    } as const;
  }

  private static async getTheMovieDBConfig(): Promise<ConfigurationDetails> {
    try {
      const data = await this.tmdbJson<ConfigurationDetails>(`/configuration`, true);
      return data;
    } catch (err) {
      console.error("TMDB configuration retrieval error", err);
      throw err;
    }
  }

  private static async getSecureBaseUrl() {
    const cfg = await this.getConfigurationDetails();
    const url = cfg?.images?.secure_base_url;
    if (!url) {
      const msg = "TMDB secure_base_url missing in configuration";
      console.error(msg);
      throw new Error(msg);
    }
    return url;
  }

  private static async getPosterSize(width: number) {
    const sizes = (await this.getConfigurationDetails()).images.poster_sizes;
    const match = sizes.find((size) => parseInt(size.substring(1)) === width);
    if (!match) {
      const msg = `TMDB poster size for width ${width} not found`;
      console.error(msg, sizes);
      throw new Error(msg);
    }
    return match;
  }

  public static async getPosterUrl(posterPath: string) {
    const width = 500;
    const height = 750;
    const secureBaseUrl = await this.getSecureBaseUrl();
    const posterSize = await this.getPosterSize(width);
    return {
      width: width,
      height: height,
      url: `${secureBaseUrl}${posterSize}${posterPath}`,
    };
  }

  private static async getProfileSize(height: number) {
    const sizes = (await this.getConfigurationDetails()).images.profile_sizes;
    const match = sizes.find((size) => parseInt(size.substring(1)) === height);
    if (!match) {
      const msg = `TMDB profile size for height ${height} not found`;
      console.error(msg, sizes);
      throw new Error(msg);
    }
    return match;
  }
  public static async getProfileUrl(profilePath: string) {
    const height = 632;
    const width = 400;
    const secureBaseUrl = await this.getSecureBaseUrl();
    const profileSize = await this.getProfileSize(height);
    return {
      width: width,
      height: height,
      url: `${secureBaseUrl}${profileSize}${profilePath}`,
    };
  }

  private static async tmdbJson<T>(path: string, throwOnError: true): Promise<T>;
  private static async tmdbJson<T>(path: string, throwOnError?: false): Promise<T | null>;
  private static async tmdbJson<T>(path: string, throwOnError = false) {
    const res = await fetchWithRetry<T>(
      `${this.baseUrl}${path}`,
      { method: "GET", headers: this.authHeaders(), cache: "force-cache" },
      this.RETRY,
      this.limiter,
    );
    if (res.ok) return res.data as T;
    if (res.status !== null && this.RETRY.retryable(res.status)) {
      // Log only after retries exhausted
      console.warn("TMDB fetch failed", path, res.status, res.bodyPreview ?? res.error, res.meta);
    }
    if (throwOnError) throw new Error(`TMDB fetch failed: ${res.status}`);
    return null;
  }

  public static async getPosterUrlById(
    type: "movie" | "tv",
    id: number | null,
    language: string = "fr-FR",
  ) {
    if (!id) return undefined;
    const key = `${type}:${id}:${language}`;
    if (!this.posterPathCache.has(key)) {
      const query = new URLSearchParams({ language });
      const data = await this.tmdbJson<{ poster_path: string | null }>(`/${type}/${id}?${query.toString()}`);
      const val: string | null = data?.poster_path ?? null;
      this.posterPathCache.set(key, val);
    }
    const posterPath = this.posterPathCache.get(key) ?? null; // string | null
    if (!posterPath) return undefined;
    return this.getPosterUrl(posterPath);
  }

  public static async getProfileUrlById(personId: number | null, language: string = "fr-FR") {
    if (!personId) return undefined;
    const key = `${personId}:${language}`;
    if (!this.profilePathCache.has(key)) {
      const query = new URLSearchParams({ language });
      const data = await this.tmdbJson<{ profile_path: string | null }>(`/person/${personId}?${query.toString()}`);
      const val: string | null = data?.profile_path ?? null;
      this.profilePathCache.set(key, val);
    }
    const profilePath = this.profilePathCache.get(key) ?? null; // string | null
    if (!profilePath) return undefined;
    return this.getProfileUrl(profilePath);
  }

  public static async getMediaDetailsById(
    type: "movie" | "tv",
    id: number | null,
    language: string = "fr-FR",
  ): Promise<TmdbMediaDetails | null> {
    if (!id) return null;
    const key = `${type}:${id}:${language}`;
    if (this.mediaDetailsCache.has(key)) return this.mediaDetailsCache.get(key) ?? null;
    const query = new URLSearchParams({ language, append_to_response: "credits" });
    const data = await this.tmdbJson<TmdbCreditsResponse>(`/${type}/${id}?${query.toString()}`);
    if (!data) {
      this.mediaDetailsCache.set(key, null);
      return null;
    }

    const crew = data.credits?.crew ?? [];
    let directorCandidates = crew
      .filter((member) => (member.job ?? "").toLowerCase() === "director")
      .map((member) => member.name)
      .filter((name): name is string => !!name && name.trim().length > 0);

    if (type === "tv" && directorCandidates.length === 0 && Array.isArray(data.created_by)) {
      directorCandidates = data.created_by
        .map((creator) => creator?.name)
        .filter((name): name is string => !!name && name.trim().length > 0);
    }

    const directors = Array.from(new Set(directorCandidates.map((name) => name.trim())));
    const tmdbUrl = `https://www.themoviedb.org/${type}/${id}`;

    const releaseDate = (type === "movie" ? data.release_date : data.first_air_date) ?? null;
    const releaseYear = (() => {
      if (!releaseDate) return null;
      const parsed = new Date(releaseDate);
      return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
    })();
    const runtimeMinutes =
      type === "movie" && typeof data.runtime === "number" && data.runtime > 0
        ? data.runtime
        : null;
    const episodeRuntimeMinutes =
      type === "tv"
        ? data.episode_run_time?.find((value) => typeof value === "number" && value > 0) ?? null
        : null;
    const genres = Array.isArray(data.genres)
      ? data.genres
          .map((genre) => genre?.name?.trim())
          .filter((name): name is string => Boolean(name && name.length > 0))
      : [];
    const voteAverage =
      typeof data.vote_average === "number" && !Number.isNaN(data.vote_average)
        ? data.vote_average
        : null;
    const voteCount =
      typeof data.vote_count === "number" && Number.isFinite(data.vote_count)
        ? data.vote_count
        : null;
    const originCountries = (() => {
      const productionCountries = Array.isArray(data.production_countries)
        ? data.production_countries
            .map((country) => country?.name?.trim() || country?.iso_3166_1?.trim())
            .filter((name): name is string => Boolean(name && name.length > 0))
        : [];
      if (productionCountries.length > 0) return Array.from(new Set(productionCountries));
      if (Array.isArray(data.origin_country)) {
        const fromOrigin = data.origin_country
          .map((code) => code?.trim())
          .filter((code): code is string => Boolean(code && code.length > 0));
        return Array.from(new Set(fromOrigin));
      }
      return [];
    })();
    const originalTitle =
      type === "movie"
        ? data.original_title?.trim() ?? null
        : data.original_name?.trim() ?? null;
    const tagline = data.tagline?.trim() ? data.tagline.trim() : null;
    const homepage = data.homepage?.trim() || null;
    const overview = data.overview?.trim() || null;

    const result: TmdbMediaDetails = {
      directors,
      tmdbUrl,
      releaseYear,
      runtimeMinutes,
      episodeRuntimeMinutes,
      genres,
      voteAverage,
      voteCount,
      originCountries,
      originalTitle,
      tagline,
      homepage,
      overview
    };
    this.mediaDetailsCache.set(key, result);
    return result;
  }
}

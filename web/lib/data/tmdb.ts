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

import { createLimiter, fetchWithRetry, type RetryOptions } from "../utils/http";

export class ConfigurationManager {
  private static configurationDetails: ConfigurationDetails | null = null;
  private static readonly baseUrl = "https://api.themoviedb.org/3";
  private static posterPathCache = new Map<string, string | null>();
  private static profilePathCache = new Map<string, string | null>();
  private static overviewCache = new Map<string, string | null>();
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

  public static async getOverviewById(
    type: "movie" | "tv",
    id: number | null,
    language: string = "fr-FR",
  ): Promise<string | null> {
    if (!id) return null;
    const key = `${type}:${id}:${language}`;
    if (this.overviewCache.has(key)) return this.overviewCache.get(key) ?? null;
    const query = new URLSearchParams({ language });
    const data = await this.tmdbJson<{ overview?: string | null }>(`/${type}/${id}?${query.toString()}`);
    let overview: string | null = data?.overview ?? null;
    if (!overview || overview.trim() === "") {
      const dataEn = await this.tmdbJson<{ overview?: string | null }>(`/${type}/${id}?language=en-US`);
      overview = dataEn?.overview ?? null;
    }
    const normalized = overview && overview.trim() !== "" ? overview : null;
    this.overviewCache.set(key, normalized);
    return normalized;
  }

}

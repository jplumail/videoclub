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

export class ConfigurationManager {
  private static configurationDetails: ConfigurationDetails | null = null;
  private static readonly baseUrl = "https://api.themoviedb.org/3";
  private static posterPathCache = new Map<string, string | null>();
  private static profilePathCache = new Map<number, string | null>();
  private static overviewCache = new Map<string, string | null>();

  private constructor() {}

  private static async getConfigurationDetails(): Promise<ConfigurationDetails> {
    if (this.configurationDetails) {
      return this.configurationDetails;
    }
    this.configurationDetails = await this.getTheMovieDBConfig();
    return this.configurationDetails;
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
      const res = await fetch(`${this.baseUrl}/configuration`, {
        method: "GET",
        headers: this.authHeaders(),
        cache: "force-cache",
      });
      if (!res.ok) {
        const body = await res.text();
        console.warn("TMDB config fetch failed", res.status, body.slice(0, 160));
        throw new Error(`TMDB config failed: ${res.status}`);
      }
      return (await res.json()) as ConfigurationDetails;
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
    const width = 780;
    const height = 1170;
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
  
  private static async fetchTMDB(path: string) {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: this.authHeaders(),
        cache: "force-cache",
      });
      if (!res.ok) {
        const body = await res.text();
        console.warn("TMDB fetch failed", path, res.status, body.slice(0, 160));
        return null;
      }
      try {
        return await res.json();
      } catch {
        return null;
      }
    } catch (e) {
      console.warn("TMDB fetch error", path, e);
      return null;
    }
  }

  public static async getPosterUrlById(
    type: "movie" | "tv",
    id: number | null,
  ) {
    if (!id) return undefined;
    const key = `${type}:${id}`;
    if (!this.posterPathCache.has(key)) {
      const data = await this.fetchTMDB(`/${type}/${id}`);
      const val: string | null = data?.poster_path ?? null;
      this.posterPathCache.set(key, val);
    }
    const posterPath = this.posterPathCache.get(key) ?? null; // string | null
    if (!posterPath) return undefined;
    return this.getPosterUrl(posterPath);
  }

  public static async getProfileUrlById(personId: number | null) {
    if (!personId) return undefined;
    if (!this.profilePathCache.has(personId)) {
      const data = await this.fetchTMDB(`/person/${personId}`);
      const val: string | null = data?.profile_path ?? null;
      this.profilePathCache.set(personId, val);
    }
    const profilePath = this.profilePathCache.get(personId) ?? null; // string | null
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
    const data = await this.fetchTMDB(`/${type}/${id}?${query.toString()}`);
    let overview: string | null = data?.overview ?? null;
    if (!overview || overview.trim() === "") {
      const dataEn = await this.fetchTMDB(`/${type}/${id}?language=en-US`);
      overview = dataEn?.overview ?? null;
    }
    const normalized = overview && overview.trim() !== "" ? overview : null;
    this.overviewCache.set(key, normalized);
    return normalized;
  }
}

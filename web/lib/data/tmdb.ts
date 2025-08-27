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
    return fetch(`${this.baseUrl}/configuration`, {
      method: "GET",
      headers: this.authHeaders(),
      cache: "force-cache",
    })
      .then((res) => res.json())
      .then((data) => {
        return data;
      });
  }

  private static async getSecureBaseUrl() {
    return (await this.getConfigurationDetails()).images.secure_base_url;
  }

  private static async getPosterSize(width: number) {
    return (await this.getConfigurationDetails()).images.poster_sizes.filter(
      (size) => {
        return parseInt(size.substring(1)) == width;
      },
    )[0];
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
    return (await this.getConfigurationDetails()).images.profile_sizes.filter(
      (size) => {
        return parseInt(size.substring(1)) == height;
      },
    )[0];
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
      if (!res.ok) return null;
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
    const data = await this.fetchTMDB(`/${type}/${id}`);
    const posterPath: string | undefined = data?.poster_path;
    if (!posterPath) return undefined;
    return this.getPosterUrl(posterPath);
  }

  public static async getProfileUrlById(personId: number | null) {
    if (!personId) return undefined;
    const data = await this.fetchTMDB(`/person/${personId}`);
    const profilePath: string | undefined = data?.profile_path;
    if (!profilePath) return undefined;
    return this.getProfileUrl(profilePath);
  }

  public static async getOverviewById(
    type: "movie" | "tv",
    id: number | null,
    language: string = "fr-FR",
  ): Promise<string | null> {
    if (!id) return null;
    const query = new URLSearchParams({ language });
    const data = await this.fetchTMDB(`/${type}/${id}?${query.toString()}`);
    let overview: string | undefined = data?.overview;
    if (!overview || overview.trim() === "") {
      // Fallback to English if no localized overview
      const dataEn = await this.fetchTMDB(`/${type}/${id}?language=en-US`);
      overview = dataEn?.overview;
    }
    return overview && overview.trim() !== "" ? overview : null;
  }
}

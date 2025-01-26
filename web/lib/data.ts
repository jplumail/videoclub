import { Bucket, Storage } from "@google-cloud/storage";

export interface MoviesData {
  media_items_timestamps: MovieData[];
}

interface MovieData {
  media_item: {
    details: {
      id: number;
      poster_path: string;
      title: string;
    };
    crew: {
      id: number;
      name: string;
    }[];
    release_year: string;
  };
  start_time: Timecode;
  end_time: Timecode;
  confidence: number;
}

interface Timecode {
  seconds: number;
  nanos: number;
}

interface VideoData {
  snippet: {
    publishedAt: string;
    title: string;
    videoId: string;
    thumbnails: {
      standard: {
        url: string;
        width: number;
        height: number;
      };
    };
    resourceId: {
      videoId: string;
    };
  };
}

export class BucketManager {
  private static bucket: Bucket | null = null;
  private constructor() {}
  private static getBucket() {
    if (this.bucket) {
      return this.bucket;
    }
    this.bucket = new Storage().bucket("videoclub-test");
    return this.bucket;
  }
  private static async getFiles(prefix: string) {
    return (await this.getBucket()).getFiles({ prefix });
  }
  public static async getMovies(videoId: string): Promise<MoviesData> {
    const [files] = await this.getFiles(`videos/${videoId}`);
    const moviesFiles = files.filter((file) =>
      file.name.endsWith("movies.json"),
    );
    if (moviesFiles.length === 0) {
      throw new Error(`No movies file found for video ${videoId}`);
    } else if (moviesFiles.length > 1) {
      throw new Error("Multiple movies files found for video ${videoId}");
    } else {
      const moviesFile = moviesFiles[0];
      const [content] = await moviesFile.download();
      return JSON.parse(content.toString());
    }
  }

  public static async getVideos() {
    const [files] = await this.getFiles("videos/");
    const jsonFiles = files.filter((file) => file.name.endsWith("video.json"));
    const downloadPromises = jsonFiles.map(async (file) => {
      const [content] = await file.download();
      return JSON.parse(content.toString()) as VideoData;
    });
    return Promise.all(downloadPromises);
  }

  public static async getVideosSorted() {
    const videos = await this.getVideos();
    videos.sort(
      (a, b) =>
        new Date(b.snippet.publishedAt).getTime() -
        new Date(a.snippet.publishedAt).getTime(),
    );
    return videos;
  }
}

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

  private constructor() {}

  private static async getConfigurationDetails(): Promise<ConfigurationDetails> {
    if (this.configurationDetails) {
      return this.configurationDetails;
    }
    this.configurationDetails = await this.getTheMovieDBConfig();
    return this.configurationDetails;
  }

  private static async getTheMovieDBConfig(): Promise<ConfigurationDetails> {
    return fetch("https://api.themoviedb.org/3/configuration", {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NjRiZGFiMmZiODY0NGFjYzRiZTJjZmYyYmI1MjQxNCIsIm5iZiI6MTczNjQxNTQzNi4xMzMsInN1YiI6IjY3N2Y5OGNjMDQ0YjZjYTY3NjRlODgwYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.200sno32bOBgHhi_Jv1pCrDWJaal8tClKsHUFf2TZIQ",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        return data;
      });
  }

  private static async getSecureBaseUrl() {
    return (await this.getConfigurationDetails()).images.secure_base_url;
  }

  private static async getPosterSize() {
    return (await this.getConfigurationDetails()).images.poster_sizes.filter(
      (size) => size === "w185",
    )[0];
  }

  public static async getPosterUrl(posterPath: string) {
    const secureBaseUrl = await this.getSecureBaseUrl();
    const posterSize = await this.getPosterSize();
    return `${secureBaseUrl}${posterSize}${posterPath}`;
  }
}

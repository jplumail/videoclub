import { Bucket, Storage } from "@google-cloud/storage";
import {
  MediaItemsTimestamps,
  MediaItemTimestamp,
  PartialMedia,
  Person,
  PlaylistItemPersonnalites,
} from "./backend/types";

export class MoviesSet {
  private moviesMap: Map<string, PartialMedia>;
  private keysSet: Set<string>;
  constructor(movies?: PartialMedia[]) {
    this.moviesMap = new Map();
    this.keysSet = new Set();
    if (movies) {
      movies.forEach((movie) => {
        this.add(movie);
      });
    }
  }
  private getKey(movie: PartialMedia) {
    return JSON.stringify({ id: movie.id, type: movie.type });
  }
  add(movie: PartialMedia) {
    const key = this.getKey(movie);
    if (!this.keysSet.has(key)) {
      this.keysSet.add(key);
      this.moviesMap.set(key, movie);
    }
  }
  clear() {
    this.moviesMap.clear();
    this.keysSet.clear();
  }
  delete(movie: PartialMedia) {
    const key = this.getKey(movie);
    this.keysSet.delete(key);
    return this.moviesMap.delete(key);
  }
  has(movie: PartialMedia) {
    return this.keysSet.has(this.getKey(movie));
  }
  values() {
    return Array.from(this.moviesMap.values());
  }
  forEach(
    callbackfn: (
      value: PartialMedia,
      key: PartialMedia,
      set: MoviesSet,
    ) => void,
  ) {
    this.moviesMap.forEach((value) => {
      callbackfn(value, value, this);
    });
  }
}

function mergePersonnalitesMovies(
  personnalitesMovies: {
    personnalite: { person: Person; video: string };
    movies: MoviesSet;
  }[],
) {
  return personnalitesMovies.reduce(
    (acc, item) => {
      const existingPersonnalite = acc.find(
        (accItem) =>
          accItem.personnalite.person.id === item.personnalite.person.id,
      );
      if (existingPersonnalite) {
        existingPersonnalite.movies = new MoviesSet([
          ...existingPersonnalite.movies.values(),
          ...item.movies.values(),
        ]);
        existingPersonnalite.personnalite.videos.add(item.personnalite.video);
      } else {
        acc.push({
          personnalite: {
            person: item.personnalite.person,
            videos: new Set([item.personnalite.video]),
          },
          movies: item.movies,
        });
      }
      return acc;
    },
    [] as {
      personnalite: { person: Person; videos: Set<string> };
      movies: MoviesSet;
    }[],
  );
}

function createMoviesPersonnalitesMap(
  personnalitesMovies: {
    personnalite: { person: Person; videos: Set<string> };
    movies: MoviesSet;
  }[],
) {
  const allMovies = new MoviesSet();
  personnalitesMovies.forEach((item) => {
    item.movies.forEach((movie) => {
      allMovies.add(movie);
    });
  });

  const moviesPersonnalites: {
    movie: PartialMedia;
    personnalites: { person: Person; videos: Set<string> }[];
  }[] = [];
  allMovies.forEach((movie) => {
    const personnalites = personnalitesMovies
      .filter((item) => item.movies.has(movie))
      .map((item) => item.personnalite);
    moviesPersonnalites.push({ movie, personnalites });
  });

  return moviesPersonnalites;
}

export class BucketManager {
  private static bucket: Bucket | null = null;
  private constructor() {}
  static getBucket() {
    if (this.bucket) {
      return this.bucket;
    }
    this.bucket = new Storage().bucket("videoclub-test");
    return this.bucket;
  }
  private static async getFiles(prefix: string) {
    return (await this.getBucket()).getFiles({ prefix });
  }
  public static async getMovies(videoId: string) {
    const [files] = await this.getFiles(`videos/${videoId}`);
    const moviesFiles = files.filter((file) =>
      file.name.endsWith("movies.json"),
    );
    let mediaItems: MediaItemTimestamp[] | null;
    if (moviesFiles.length === 0) {
      console.log(`No movies file found for video ${videoId}`);
      mediaItems = null;
    } else if (moviesFiles.length > 1) {
      throw new Error("Multiple movies files found for video ${videoId}");
    } else {
      const moviesFile = moviesFiles[0];
      const [content] = await moviesFile.download();
      mediaItems = (JSON.parse(content.toString()) as MediaItemsTimestamps)
        .media_items_timestamps;
    }
    if (mediaItems) {
      mediaItems = mediaItems.filter((item) => item.confidence > 0.5);
    }
    return mediaItems;
  }

  private static async processVideoPersonnalites(
    video: PlaylistItemPersonnalites,
  ) {
    if (video.personnalites == null) {
      return null;
    }
    const moviesData = await this.getMovies(
      video.playlist_item.snippet.resourceId.videoId,
    );
    if (moviesData == null) {
      return null;
    }

    const uniqueMoviesData = new MoviesSet();
    moviesData.forEach((item) => {
      if (!uniqueMoviesData.has(item.media_item.details)) {
        uniqueMoviesData.add(item.media_item.details);
      }
    });

    return video.personnalites
      .filter((personnalite) => personnalite != null)
      .map((personnalite) => ({
        personnalite: {
          person: personnalite,
          video: video.playlist_item.snippet.resourceId.videoId,
        },
        movies: uniqueMoviesData,
      }));
  }

  static async createPersonnalitesByMovies() {
    const videos = await this.getVideos();
    const personnalitesMovies = await Promise.all(
      videos.map((video) => this.processVideoPersonnalites(video)),
    );

    const personnalitesMoviesNonNull = personnalitesMovies
      .filter((item) => item !== null)
      .flat();

    return mergePersonnalitesMovies(personnalitesMoviesNonNull);
  }

  static async createMediaByPersonnalites() {
    return createMoviesPersonnalitesMap(
      await this.createPersonnalitesByMovies(),
    );
  }

  static async getPersonnalitesByMedia(): Promise<
    {
      personnalite: { person: Person; videos: Set<string> };
      movies: MoviesSet;
    }[]
  >;
  static async getPersonnalitesByMedia(params: { id: string }): Promise<{
    personnalite: { person: Person; videos: Set<string> };
    movies: MoviesSet;
  }>;
  static async getPersonnalitesByMedia(params?: { id?: string }) {
    function convertJSONToItem(json: {
      personnalite: { person: Person; videos: string[] };
      movies: PartialMedia[];
    }) {
      return {
        personnalite: {
          person: json.personnalite.person,
          videos: new Set(json.personnalite.videos),
        },
        movies: new MoviesSet(json.movies),
      };
    }
    if (params?.id) {
      const [files] = await this.getFiles(
        `personnalitesByMedia/${params.id}.json`,
      );
      const jsonFile = files[0];
      const [content] = await jsonFile.download();
      const data = JSON.parse(content.toString()) as {
        personnalite: { person: Person; videos: string[] };
        movies: PartialMedia[];
      };
      return convertJSONToItem(data);
    } else {
      const [files] = await this.getFiles("personnalitesByMedia.json");
      const jsonFile = files[0];
      const [content] = await jsonFile.download();
      const data = JSON.parse(content.toString()) as {
        personnalite: { person: Person; videos: string[] };
        movies: PartialMedia[];
      }[];
      return data.map(convertJSONToItem);
    }
  }

  static async getMediaByPersonnalites(): Promise<
    {
      movie: PartialMedia;
      personnalites: { person: Person; videos: Set<string> }[];
    }[]
  >;
  static async getMediaByPersonnalites(params: { media_type: string }): Promise<
    {
      movie: PartialMedia;
      personnalites: { person: Person; videos: Set<string> }[];
    }[]
  >;
  static async getMediaByPersonnalites(params: {
    media_type: string;
    id: string;
  }): Promise<{
    movie: PartialMedia;
    personnalites: { person: Person; videos: Set<string> }[];
  }>;
  static async getMediaByPersonnalites(params?: {
    media_type?: string;
    id?: string;
  }) {
    function convertJSONToItem(json: {
      movie: PartialMedia;
      personnalites: { person: Person; videos: string[] }[];
    }) {
      return {
        movie: json.movie,
        personnalites: json.personnalites.map((x) => {
          return { person: x.person, videos: new Set(x.videos) };
        }),
      };
    }

    if (params?.id) {
      if (!params.media_type) {
        throw new Error("media_type must be provided when id is provided");
      }
      const [files] = await this.getFiles(
        `mediaByPersonnalites/${params.media_type}/${params.id}.json`,
      );
      const [content] = await files[0].download();
      const data = JSON.parse(content.toString()) as {
        movie: PartialMedia;
        personnalites: { person: Person; videos: string[] }[];
      };
      return convertJSONToItem(data);
    } else {
      const [files] = await this.getFiles("mediaByPersonnalites.json");
      const [content] = await files[0].download();
      const data = JSON.parse(content.toString()) as {
        movie: PartialMedia;
        personnalites: { person: Person; videos: string[] }[];
      }[];
      let dataFiltered = data;
      if (params?.media_type) {
        dataFiltered = data.filter(
          (item) => item.movie.media_type === params.media_type,
        );
      }
      return dataFiltered.map(convertJSONToItem);
    }
  }

  public static async getVideos() {
    const [files] = await this.getFiles("videos/");
    const jsonFiles = files.filter((file) => file.name.endsWith("video.json"));
    const downloadPromises = jsonFiles.map(async (file) => {
      const [content] = await file.download();
      return JSON.parse(content.toString()) as PlaylistItemPersonnalites;
    });
    return Promise.all(downloadPromises);
  }

  public static async getVideosSorted() {
    const videos = await this.getVideos();
    videos.sort(
      (a, b) =>
        new Date(b.playlist_item.snippet.publishedAt).getTime() -
        new Date(a.playlist_item.snippet.publishedAt).getTime(),
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

  private static async getPosterSize(width: number) {
    return (await this.getConfigurationDetails()).images.poster_sizes.filter(
      (size) => {
        return parseInt(size.substring(1)) == width;
      },
    )[0];
  }

  public static async getPosterUrl(posterPath: string) {
    const width = 185;
    const height = 278;
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
}

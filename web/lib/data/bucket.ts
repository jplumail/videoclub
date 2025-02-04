import { Bucket, Storage } from "@google-cloud/storage";
import {
  MediaItemsTimestamps,
  MediaItemTimestamp,
  PartialMedia,
  Person,
  PlaylistItemPersonnalites,
  TimeOffset,
} from "../backend/types";

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
  public static mediaPersonTimestampsSortedPath =
    "mediaPersonTimestampsSorted.json";
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
  static async getPersonnalitesByMedia(params: { personId: string }): Promise<{
    personnalite: { person: Person; videos: Set<string> };
    movies: MoviesSet;
  }>;
  static async getPersonnalitesByMedia(params?: { personId?: string }) {
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
    if (params?.personId) {
      const [files] = await this.getFiles(
        `personnalitesByMedia/${params.personId}.json`,
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

  public static async getVideos(): Promise<PlaylistItemPersonnalites[]>;
  public static async getVideos(params: { videoId: string }): Promise<PlaylistItemPersonnalites>;
  public static async getVideos(params?: { videoId?: string }) {
    const [files] = await this.getFiles("videos/");
    const jsonFiles = files.filter((file) => file.name.endsWith("video.json"));
    if (params?.videoId !== undefined) {
      const videoFile = jsonFiles.find(file => file.name.includes(params.videoId!));
      if (!videoFile) {
        throw new Error(`Video not found with id ${params.videoId}`);
      }
      const [content] = await videoFile.download();
      return JSON.parse(content.toString()) as PlaylistItemPersonnalites;
    }
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

  public static async createMediaTimestampsSorted() {
    const medias = await BucketManager.getMediaByPersonnalites();
    medias.sort((a, b) => b.personnalites.length - a.personnalites.length);
    return await Promise.all(
      medias.map(async (media) => {
        return {
          movie: media.movie,
          personnalites: await Promise.all(
            media.personnalites.map(async (person) => {
              return {
                person: person.person,
                videos: await Promise.all(
                  Array.from(person.videos).map(async (videoId) => {
                    let timestamps = (
                      await BucketManager.getMovies(videoId)
                    )?.filter(
                      (timestamp) =>
                        timestamp.media_item.details.media_type ==
                          media.movie.media_type &&
                        timestamp.media_item.details.id == media.movie.id,
                    );
                    if (!timestamps) {
                      timestamps = [];
                    }
                    return {
                      videoId: videoId,
                      timestamps: timestamps.map((t) => {
                        return {
                          start_time: t.start_time,
                          end_time: t.end_time,
                          confidence: t.confidence,
                        };
                      }),
                    };
                  }),
                ),
              };
            }),
          ),
        };
      }),
    );
  }

  public static async getMediaTimestampsSorted(params?: {
    media_type: string;
  }) {
    const [files] = await this.getFiles(this.mediaPersonTimestampsSortedPath);
    const [content] = await files[0].download();
    const medias = JSON.parse(content.toString()) as {
      movie: PartialMedia;
      personnalites: {
        person: Person;
        videos: {
          videoId: string;
          timestamps: {
            start_time: TimeOffset;
            end_time: TimeOffset;
            confidence: number;
          }[];
        }[];
      }[];
    }[];
    if (params?.media_type) {
      return medias.filter(
        (media) => media.movie.media_type == params.media_type,
      );
    }
    return medias;
  }
}

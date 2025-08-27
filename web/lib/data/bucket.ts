import { Bucket, Storage } from "@google-cloud/storage";
import {
  BestMediaData,
  Index,
  MediaIdData,
  PersonneIdData,
  VideoDataFull,
  VideoFeedData,
} from "../backend/types";

export class BucketManager {
  private static bucket: Bucket | null = null;
  private constructor() {}
  static getBucket() {
    if (this.bucket) return this.bucket;
    this.bucket = new Storage().bucket("videoclub-test");
    return this.bucket;
  }
  private static async readJSON(path: string) {
    const file = this.getBucket().file(path);
    const [exists] = await file.exists();
    if (!exists) throw new Error(`Missing JSON at ${path}`);
    const [content] = await file.download();
    return JSON.parse(content.toString());
  }

  // /data/{kind}/index.json
  static async getIndex(kind: "film" | "serie" | "personne"): Promise<Index> {
    const data = (await this.readJSON(`data/${kind}/index.json`)) as {
      ids: Array<string | number>;
    };
    return { ids: (data.ids ?? []).map((x) => String(x)) };
  }

  // /data/film/meilleurs.json and /data/serie/meilleures.json
  static async getBestMedia(kind: "film" | "serie"): Promise<BestMediaData> {
    const filename = kind === "film" ? "meilleurs.json" : "meilleures.json";
    return (await this.readJSON(`data/${kind}/${filename}`)) as BestMediaData;
  }

  // /data/(film|serie)/{id}.json
  static async getMediaById(
    kind: "film" | "serie",
    id: string,
  ): Promise<MediaIdData> {
    return (await this.readJSON(`data/${kind}/${id}.json`)) as MediaIdData;
  }

  // /data/personne/{id}.json
  static async getPersonById(id: string): Promise<PersonneIdData> {
    return (await this.readJSON(`data/personne/${id}.json`)) as PersonneIdData;
  }

  // /data/video/{video_id}.json
  static async getVideo(videoId: string): Promise<VideoDataFull> {
    return (await this.readJSON(`data/video/${videoId}.json`)) as VideoDataFull;
  }

  // /data/video.json
  static async getVideoFeed(): Promise<VideoFeedData> {
    return (await this.readJSON("data/video.json")) as VideoFeedData;
  }
}

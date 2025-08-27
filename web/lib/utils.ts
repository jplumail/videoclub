import { MediaItem } from "./backend/types";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getYoutubeUrl(videoId: string, timecode: number | null) {
  if (timecode === null) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return `https://www.youtube.com/watch?v=${videoId}&t=${timecode}s`;
}

export function getTitle(media: MediaItem) {
  return media.title || null;
}

/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

/**
 * /data/film/meilleurs.json
 */
export interface BestMediaData {
  media: CitationMediaWithName[];
}
export interface CitationMediaWithName {
  media: MediaItem;
  citations: CitationWithName[];
}
export interface MediaItem {
  id: number | null;
  type: "movie" | "tv";
  title: string | null;
  release_year: string | null;
}
export interface CitationWithName {
  videoId: string;
  start_time: number;
  end_time: number;
  name: string | null;
}
/**
 * Présence d'un index des IDs dans /data/{type}/index.json
 */
export interface Index {
  ids: string[];
}
/**
 * /data/film/{id}.json and /data/serie/{id}.json
 */
export interface MediaIdData {
  id: number | null;
  title: string | null;
  release_year: string | null;
  citations: CitationPersonnalite[];
}
export interface CitationPersonnalite {
  personnalite: Personnalite;
  videoIds: string[];
}
export interface Personnalite {
  name: string | null;
  person_id: number | null;
}
/**
 * /data/personne/{id}.json
 */
export interface PersonneIdData {
  name: string | null;
  videos: VideoDataShort[];
  citations: CitationMedia[];
}
export interface VideoDataShort {
  video_id: string;
  name: string;
  release_date: string;
}
export interface CitationMedia {
  media: MediaItem;
  citations: Citation[];
}
export interface Citation {
  videoId: string;
  start_time: number;
  end_time: number;
}
/**
 * /data/videos/{video_id}/video.json
 */
export interface VideoDataFull {
  video_id: string;
  personnalites: Personnalite[];
  media_data: MediaItemWithTime[];
}
export interface MediaItemWithTime {
  id: number | null;
  type: "movie" | "tv";
  title: string | null;
  release_year: string | null;
  start_time: number;
  end_time: number;
}
/**
 * /data/video.json (feed)
 */
export interface VideoFeedData {
  feed: VideoDataShort[];
}

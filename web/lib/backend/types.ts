/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

export type MediaType = "movie" | "person" | "tv";
export type MediaType1 = "movie" | "person" | "tv";
export type MediaType2 = "movie" | "person" | "tv";
export type ImageType = "backdrop" | "logo" | "poster" | "profile" | "still";

export interface MediaItemsTimestamps {
  media_items_timestamps: MediaItemTimestamp[];
}
export interface MediaItemTimestamp {
  media_item: MediaItem;
  start_time: TimeOffset;
  end_time: TimeOffset;
  confidence: number;
  [k: string]: unknown;
}
export interface MediaItem {
  details: PartialMedia;
  type: "movie" | "tv";
  crew: Person[] | null;
  release_year: string | null;
  [k: string]: unknown;
}
export interface PartialMedia {
  id?: number | null;
  poster_path?: string | null;
  adult?: boolean | null;
  popularity?: number | null;
  backdrop_path?: string | null;
  vote_average?: number | null;
  overview?: string | null;
  first_air_date?: string | null;
  origin_country?: string[] | null;
  genre_ids?: number[] | null;
  original_language?: string | null;
  vote_count?: number | null;
  name?: string | null;
  original_name?: string | null;
  media_type?: MediaType;
  release_date?: string | null;
  original_title?: string | null;
  title?: string | null;
  video?: boolean | null;
  _id?: string | null;
  [k: string]: unknown;
}
export interface Person {
  id?: number | null;
  profile_path?: string | null;
  adult?: boolean | null;
  known_for?: PartialMedia[] | null;
  known_for_department?: string | null;
  gender?: number | null;
  name?: string | null;
  original_name?: string | null;
  popularity?: number | null;
  media_type?: MediaType1;
  birthday?: string | null;
  deathday?: string | null;
  also_known_as?: string[] | null;
  biography?: string | null;
  place_of_birth?: string | null;
  imdb_id?: string | null;
  homepage?: string | null;
  external_ids?: ExternalIDs | null;
  images?: Images | null;
  combined_credits?: CreditsCombined | null;
  movie_credits?: CreditsMovie | null;
  tv_credits?: CreditsTV | null;
  tagged_images?: TaggedImages | null;
  translations?: Translations | null;
  [k: string]: unknown;
}
export interface ExternalIDs {
  id?: number | null;
  facebook_id?: string | null;
  freebase_id?: string | null;
  freebase_mid?: string | null;
  imdb_id?: string | null;
  instagram_id?: string | null;
  tvdb_id?: number | null;
  tvrage_id?: number | null;
  twitter_id?: string | null;
  tiktok_id?: string | null;
  youtube_id?: string | null;
  wikidata_id?: string | null;
  [k: string]: unknown;
}
export interface Images {
  id?: number | null;
  backdrops?: Image[] | null;
  logos?: Image[] | null;
  posters?: Image[] | null;
  profiles?: Image[] | null;
  stills?: Image[] | null;
  [k: string]: unknown;
}
export interface Image {
  id?: string | null;
  aspect_ratio?: number | null;
  file_path?: string | null;
  height?: number | null;
  file_type?: string | null;
  iso_639_1?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  width?: number | null;
  [k: string]: unknown;
}
export interface CreditsCombined {
  id?: number | null;
  cast?: CastCombined[] | null;
  crew?: CrewCombined[] | null;
  [k: string]: unknown;
}
export interface CastCombined {
  id?: number | null;
  credit_id?: string | null;
  original_name?: string | null;
  genre_ids?: number[] | null;
  character?: string | null;
  name?: string | null;
  poster_path?: string | null;
  vote_count?: number | null;
  vote_average?: number | null;
  popularity?: number | null;
  episode_count?: number | null;
  original_language?: string | null;
  adult?: boolean | null;
  first_air_date?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  origin_country?: string[] | null;
  order?: number | null;
  release_date?: string | null;
  video?: boolean | null;
  title?: string | null;
  original_title?: string | null;
  media_type?: MediaType2 | null;
  [k: string]: unknown;
}
export interface CrewCombined {
  id?: number | null;
  department?: string | null;
  original_language?: string | null;
  episode_count?: number | null;
  job?: string | null;
  overview?: string | null;
  origin_country?: string[] | null;
  original_name?: string | null;
  genre_ids?: number[] | null;
  name?: string | null;
  first_air_date?: string | null;
  backdrop_path?: string | null;
  popularity?: number | null;
  adult?: boolean | null;
  vote_count?: number | null;
  vote_average?: number | null;
  poster_path?: string | null;
  credit_id?: string | null;
  order?: number | null;
  original_title?: string | null;
  video?: boolean | null;
  title?: string | null;
  release_date?: string | null;
  media_type?: MediaType2 | null;
  [k: string]: unknown;
}
export interface CreditsMovie {
  id?: number | null;
  cast?: CastMovie[] | null;
  crew?: CrewMovie[] | null;
  [k: string]: unknown;
}
export interface CastMovie {
  id?: number | null;
  character?: string | null;
  credit_id?: string | null;
  release_date?: string | null;
  vote_count?: number | null;
  video?: boolean | null;
  adult?: boolean | null;
  vote_average?: number | null;
  title?: string | null;
  genre_ids?: number[] | null;
  original_language?: string | null;
  original_title?: string | null;
  popularity?: number | null;
  backdrop_path?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  order?: number | null;
  [k: string]: unknown;
}
export interface CrewMovie {
  id?: number | null;
  department?: string | null;
  original_language?: string | null;
  original_title?: string | null;
  job?: string | null;
  overview?: string | null;
  vote_count?: number | null;
  video?: boolean | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  title?: string | null;
  popularity?: number | null;
  genre_ids?: number[] | null;
  vote_average?: number | null;
  adult?: boolean | null;
  release_date?: string | null;
  credit_id?: string | null;
  order?: number | null;
  [k: string]: unknown;
}
export interface CreditsTV {
  id?: number | null;
  cast?: CastTV[] | null;
  crew?: CrewTV[] | null;
  [k: string]: unknown;
}
export interface CastTV {
  id?: number | null;
  credit_id?: string | null;
  original_name?: string | null;
  genre_ids?: number[] | null;
  character?: string | null;
  name?: string | null;
  poster_path?: string | null;
  vote_count?: number | null;
  vote_average?: number | null;
  popularity?: number | null;
  episode_count?: number | null;
  original_language?: string | null;
  adult?: boolean | null;
  first_air_date?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  origin_country?: string[] | null;
  order?: number | null;
  [k: string]: unknown;
}
export interface CrewTV {
  id?: number | null;
  department?: string | null;
  original_language?: string | null;
  episode_count?: number | null;
  job?: string | null;
  overview?: string | null;
  origin_country?: string[] | null;
  original_name?: string | null;
  genre_ids?: number[] | null;
  name?: string | null;
  first_air_date?: string | null;
  backdrop_path?: string | null;
  popularity?: number | null;
  adult?: boolean | null;
  vote_count?: number | null;
  vote_average?: number | null;
  poster_path?: string | null;
  credit_id?: string | null;
  order?: number | null;
  [k: string]: unknown;
}
export interface TaggedImages {
  results?: TaggedImage[] | null;
  id?: number | null;
  page?: number | null;
  dates?: Dates | null;
  total_pages?: number | null;
  total_results?: number | null;
  [k: string]: unknown;
}
export interface TaggedImage {
  id?: string | null;
  aspect_ratio?: number | null;
  file_path?: string | null;
  height?: number | null;
  file_type?: string | null;
  iso_639_1?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  width?: number | null;
  image_type?: ImageType | null;
  media?: PartialMedia | null;
  media_type?: MediaType2 | null;
  [k: string]: unknown;
}
export interface Dates {
  maximum?: string | null;
  minimum?: string | null;
  [k: string]: unknown;
}
export interface Translations {
  results?: unknown;
  id?: number | null;
  translations?: Translation[] | null;
  [k: string]: unknown;
}
export interface Translation {
  iso_3166_1?: string | null;
  iso_639_1?: string | null;
  english_name?: string | null;
  name?: string | null;
  data?: Data | null;
  [k: string]: unknown;
}
export interface Data {
  name?: string | null;
  title?: string | null;
  overview?: string | null;
  homepage?: string | null;
  tagline?: string | null;
  biography?: string | null;
  [k: string]: unknown;
}
export interface TimeOffset {
  seconds?: number;
  nanos?: number;
  [k: string]: unknown;
}
export interface PlaylistItemPersonnalites {
  playlist_item: PlaylistItem;
  personnalites: (Person | null)[];
}
export interface PlaylistItem {
  kind: "youtube#playlistItem";
  etag: string;
  id: string;
  snippet: Snippet;
  status: Status;
  [k: string]: unknown;
}
export interface Snippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: {
    [k: string]: Thumbnail;
  };
  channelTitle: string;
  playlistId: string;
  position: number;
  resourceId: ResourceId;
  videoOwnerChannelTitle?: string | null;
  videoOwnerChannelId?: string | null;
  [k: string]: unknown;
}
export interface Thumbnail {
  url: string;
  width: number;
  height: number;
  [k: string]: unknown;
}
export interface ResourceId {
  kind: string;
  videoId: string;
  [k: string]: unknown;
}
export interface Status {
  privacyStatus: string;
  [k: string]: unknown;
}

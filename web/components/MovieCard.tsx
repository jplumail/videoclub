import { PartialMedia } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import Image from "next/image";
import Link from "next/link";
import styles from "./Card.module.css";
import { Card } from "./Card";

export interface PosterProps {
  media: PartialMedia;
}

export async function Poster({ media }: PosterProps) {
  const poster = media.poster_path
    ? await ConfigurationManager.getPosterUrl(media.poster_path)
    : undefined;
  const title = media.title || media.name || "";
  const id = media.id || 0;
  const mediaType = media.media_type == "movie" ? "movie" : "tv";
  const href = mediaType === "movie" ? `/film/${id}` : `/serie/${id}`;
  return (
    <div className={styles.link}>
      {poster && (
        <Image
          src={poster.url}
          alt={`Poster du film ${title}`}
          width={poster.width}
          height={poster.height}
        />
      )}
    </div>
  );
}


interface MovieCardProps {
  media: PartialMedia;
  poster?: React.ReactElement<PosterProps>;
  children?: React.ReactNode;
  hasDetails?: boolean;
}

export function MovieCardSync({
  media,
  children,
  poster,
  hasDetails = true,
}: MovieCardProps) {
  const defaultPoster = <Poster media={media} />;
  const title = media.title || media.name || "";
  const commonDate = media.release_date || media.first_air_date;
  const date = commonDate ? new Date(commonDate) : null;
  const year = date?.getFullYear();
  const id = media.id || 0;
  const mediaType = media.media_type == "movie" ? "movie" : "tv";
  const href = mediaType === "movie" ? `/film/${id}` : `/serie/${id}`;

  return (
    <Card
      item={media}
      href={href}
      title={title}
      media={poster || defaultPoster}
      hasDetails={hasDetails}
      year={year}
    >
      {children}
    </Card>
  );
}


interface MovieCardProps {
  media: PartialMedia;
  poster?: React.ReactElement<PosterProps>;
  children?: React.ReactNode;
  hasDetails?: boolean;
}

export async function MovieCard({
  media,
  children,
  poster,
  hasDetails = true,
}: MovieCardProps) {
  const defaultPoster = <Poster media={media} />;
  const title = media.title || media.name || "";
  const commonDate = media.release_date || media.first_air_date;
  const date = commonDate ? new Date(commonDate) : null;
  const year = date?.getFullYear();
  const id = media.id || 0;
  const mediaType = media.media_type == "movie" ? "movie" : "tv";
  const href = mediaType === "movie" ? `/film/${id}` : `/serie/${id}`;

  return (
    <Card
      item={media}
      href={href}
      title={title}
      media={poster || defaultPoster}
      hasDetails={hasDetails}
      year={year}
    >
      {children}
    </Card>
  );
}

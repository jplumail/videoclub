import { PartialMedia } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import Image from "next/image";
import Link from "next/link";
import styles from "./MovieCard.module.css";

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
    <Link href={href} className={styles.link}>
      {poster && (
        <Image
          src={poster.url}
          alt={`Poster du film ${title}`}
          width={poster.width}
          height={poster.height}
        />
      )}
    </Link>
  );
}

interface MovieCardBaseProps {
  media: PartialMedia;
  poster?: React.ReactElement<PosterProps>;
  children?: React.ReactNode;
  hasDetails?: boolean;
}

function MovieCardBase({
  media,
  poster,
  children,
  hasDetails = true,
}: MovieCardBaseProps) {
  const title = media.title || media.name || "";
  const commonDate = media.release_date || media.first_air_date;
  const date = commonDate ? new Date(commonDate) : null;
  const year = date?.getFullYear();
  const id = media.id || 0;
  const mediaType = media.media_type == "movie" ? "movie" : "tv";
  const href = mediaType === "movie" ? `/film/${id}` : `/serie/${id}`;

  return (
    <div className={styles.container}>
      {poster}
      {hasDetails && (
        <div className={styles.children}>
          {children}
          <p className={styles.movieDetails}>
            <Link href={href} className={styles.details}>
              <span className={styles.title}>{title}</span>
            </Link>
            {year && <span> - {year}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

interface MovieCardSyncProps {
  media: PartialMedia;
  poster?: React.ReactElement<PosterProps>;
  children?: React.ReactNode;
  hasDetails?: boolean;
}

export function MovieCardSync({
  media,
  poster,
  children,
  hasDetails = true,
}: MovieCardSyncProps) {
  return (
    <MovieCardBase media={media} poster={poster} hasDetails={hasDetails}>
      {children}
    </MovieCardBase>
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
  return (
    <MovieCardBase
      media={media}
      poster={poster || defaultPoster}
      hasDetails={hasDetails}
    >
      {children}
    </MovieCardBase>
  );
}

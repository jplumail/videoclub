import { PartialMedia } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import Image from "next/image";
import styles from "./styles/Card.module.css";
import { Card } from "./Card";

export interface PosterProps {
  media: PartialMedia;
}

export async function Poster({ media }: PosterProps) {
  const poster = media.poster_path
    ? await ConfigurationManager.getPosterUrl(media.poster_path)
    : undefined;
  const title = media.title || media.name || "";
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
  return (
    <Card
      item={media}
      media={poster || defaultPoster}
      hasDetails={hasDetails}
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
  return (
    <Card
      item={media}
      media={poster || defaultPoster}
      hasDetails={hasDetails}
    >
      {children}
    </Card>
  );
}

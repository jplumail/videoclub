import { MediaItem } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import styles from "./styles/Card.module.css";
import { Card } from "./Card";
import Image from "next/image";

export interface PosterProps {
  media: MediaItem;
}

export async function Poster({ media }: PosterProps) {
  const poster = await ConfigurationManager.getPosterUrlById(
    media.type,
    media.id ?? null,
  );
  const title = media.title || "";
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
  media: MediaItem;
  poster?: React.ReactElement<PosterProps>;
  children?: React.ReactNode;
  hasDetails?: boolean;
  hrefOverride?: string;
}

export async function MovieCard({
  media,
  children,
  poster,
  hasDetails = true,
  hrefOverride,
}: MovieCardProps) {
  const defaultPoster = <Poster media={media} />;
  return (
    <Card
      item={media}
      media={poster || defaultPoster}
      hasDetails={hasDetails}
      hrefOverride={hrefOverride}
    >
      {children}
    </Card>
  );
}

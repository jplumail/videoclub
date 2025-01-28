import { MediaItemTimestamp, PartialMedia } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data";
import Image from "next/image";

function getYoutubeUrl(videoId: string, timecode: number | null) {
  if (timecode === null) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return `https://www.youtube.com/watch?v=${videoId}&t=${timecode}s`;
}

function getMinutes(seconds: number) {
  return Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
}

function getSeconds(seconds: number) {
  return (seconds % 60).toString().padStart(2, "0");
}

export async function MovieCard({
  media,
  children,
}: {
  media: PartialMedia;
  children?: React.ReactNode;
}) {
  const poster = media.poster_path
    ? await ConfigurationManager.getPosterUrl(media.poster_path)
    : null;
  return (
    <div>
      <a
        href={
          media.media_type == "movie"
            ? `/film/${media.id}`
            : `/serie/${media.id}`
        }
      >
        {poster && (
          <Image
            src={poster.url}
            alt={`Poster du film ${media.title}`}
            width={poster.width}
            height={poster.height}
          />
        )}
      </a>
      {children}
    </div>
  );
}

export async function MovieCardTimestamps({
  ytVideoId,
  items,
}: {
  ytVideoId: string;
  items: MediaItemTimestamp[];
}) {
  const item = items[0];
  const id = item.media_item.details.id;
  for (const item of items) {
    if (item.media_item.details.id !== id) {
      throw new Error("All items must have the same id");
    }
  }
  return (
    <MovieCard media={item.media_item.details}>
      {items.map((item, key) => (
        <a
          href={getYoutubeUrl(ytVideoId, item.start_time.seconds || null)}
          target="_blank"
          key={key}
        >
          <p>
            {getMinutes(item.start_time.seconds || 0)}:
            {getSeconds(item.start_time.seconds || 0)}
          </p>
        </a>
      ))}
    </MovieCard>
  );
}

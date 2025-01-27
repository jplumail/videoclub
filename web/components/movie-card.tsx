import { ConfigurationManager, MovieData } from "@/lib/data";
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
  ytVideoId,
  items,
}: {
  ytVideoId: string;
  items: MovieData[];
}) {
  const item = items[0];
  const id = item.media_item.details.id;
  // assert that all items have the same id
  for (const item of items) {
    if (item.media_item.details.id !== id) {
      throw new Error("All items must have the same id");
    }
  }
  const poster = await ConfigurationManager.getPosterUrl(
    item.media_item.details.poster_path,
  );
  return (
    <div>
      <Image
        src={poster.url}
        alt={`Poster du film ${item.media_item.details.title}`}
        width={poster.width}
        height={poster.height}
      />
      {items.map((item, key) => (
        <a
          href={getYoutubeUrl(ytVideoId, item.start_time.seconds)}
          target="_blank"
          key={key}
        >
          <p>
            {getMinutes(item.start_time.seconds)}:
            {getSeconds(item.start_time.seconds)}
          </p>
        </a>
      ))}
    </div>
  );
}

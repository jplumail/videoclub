import { MovieCard } from "@/components/movie-card";
import { MediaItemTimestamp } from "@/lib/backend/types";
import { BucketManager } from "@/lib/data";
import { slugify } from "@/lib/utils";

function getVideoId(slug: string): string {
  const videoId = slug.slice(-11);
  return videoId;
}

function getUniqueMoviesData(moviesData: MediaItemTimestamp[]) {
  const moviesSet = new Set();
  return moviesData.filter((item) => {
    if (moviesSet.has(item.media_item.details.id)) {
      return false;
    }
    moviesSet.add(item.media_item.details.id);
    return true;
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug;
  const videoId = getVideoId(slug);
  const moviesData = await BucketManager.getMovies(videoId);
  if (moviesData == null) {
    return <div>No data available</div>;
  }

  const uniqueMoviesData = getUniqueMoviesData(moviesData);
  moviesData.sort((a, b) => {
    if (!a.start_time.seconds || !b.start_time.seconds) {
      return 0;
    }
    return a.start_time.seconds - b.start_time.seconds;
  });
  return (
    <div>
      {uniqueMoviesData.map(async (item, key) => {
        const sameMovies = moviesData.filter(
          (item2) => item2.media_item.details.id === item.media_item.details.id,
        );
        return (
          <div
            id={slugify(
              sameMovies[0].media_item.details.name ||
                sameMovies[0].media_item.details.title ||
                "",
            )}
          >
            <MovieCard key={key} ytVideoId={videoId} items={sameMovies} />
          </div>
        );
      })}
    </div>
  );
}

import { MovieCard } from "@/components/movie-card";
import { BucketManager, MovieData } from "@/lib/data";

function getVideoId(slug: string): string {
  const videoIdArray: string[] = [];
  slug.split("_").map((item, key) => {
    if (key > 0) {
      videoIdArray.push(item);
    }
  });
  const videoId = videoIdArray.join("_");
  return videoId;
}

function getUniqueMoviesData(moviesData: MovieData[]) {
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
  console.log(moviesData.length);

  const uniqueMoviesData = getUniqueMoviesData(moviesData);
  moviesData.sort((a, b) => a.start_time.seconds - b.start_time.seconds);
  return (
    <div>
      {uniqueMoviesData.map(async (item, key) => {
        const sameMovies = moviesData.filter(
          (item2) => item2.media_item.details.id === item.media_item.details.id,
        );
        return <MovieCard key={key} ytVideoId={videoId} items={sameMovies} />;
      })}
    </div>
  );
}

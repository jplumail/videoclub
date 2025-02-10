import { MediaItemTimestamp } from "@/lib/backend/types";
import { BucketManager } from "@/lib/data/bucket";
import VideoPlayer from "./videoPlayer";
import { Poster } from "@/components/MovieCard";

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

export async function generateStaticParams() {
  const allVideos = await BucketManager.getVideos();
  return allVideos.map((video) => ({
    id: video.playlist_item.snippet.resourceId.videoId,
  }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const videoId = (await params).id;
  const moviesData = await BucketManager.getMovies(videoId);
  const videoData = await BucketManager.getVideos({videoId: videoId});
  if (moviesData == null) {
    return <div>Pas de données disponibles</div>;
  }

  // Remove duplicates
  const uniqueMoviesData = getUniqueMoviesData(moviesData);

  // Aggregate Timestamps
  const aggregatedMoviesData = uniqueMoviesData.map((item) => {
    const timestamps = moviesData
      .filter(
        (timestamp) =>
          timestamp.media_item.details.id === item.media_item.details.id,
      )
      .map((timestamp) => ({
        start_time: timestamp.start_time,
        end_time: timestamp.end_time,
        confidence: timestamp.confidence,
      }))
      .filter((timestamp) => timestamp.confidence > 0.5);
    return {
      ...item.media_item,
      timestamps,
    };
  });

  const movies = await Promise.all(
    aggregatedMoviesData.map(async (item) => ({
      item: item,
      poster: <Poster media={item.details} />,
    })),
  );

  return <VideoPlayer video={videoData} movies={movies} />;
}

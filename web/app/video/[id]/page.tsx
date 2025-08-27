import { MediaItemWithTime } from "@/lib/backend/types";
import { BucketManager } from "@/lib/data/bucket";
import VideoPlayer from "./videoPlayer";
import { Poster } from "@/components/MovieCard";

function getUniqueMoviesData(moviesData: MediaItemWithTime[]) {
  const moviesSet = new Set();
  return moviesData.filter((item) => {
    if (moviesSet.has(item.id)) {
      return false;
    }
    moviesSet.add(item.id);
    return true;
  });
}

export async function generateStaticParams() {
  const feed = await BucketManager.getVideoFeed();
  return feed.feed.map((v) => ({ id: v.video_id }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const videoId = (await params).id;
  const videoData = await BucketManager.getVideo(videoId);
  const moviesData = videoData.media_data;
  if (!moviesData?.length) {
    return <div>Pas de données disponibles</div>;
  }

  // Remove duplicates
  const uniqueMoviesData = getUniqueMoviesData(moviesData);

  // Aggregate Timestamps
  const aggregatedMoviesData = uniqueMoviesData.map((item) => {
    const timestamps = moviesData
      .filter(
        (timestamp) => timestamp.id === item.id,
      )
      .map((timestamp) => ({
        start_time: timestamp.start_time,
        end_time: timestamp.end_time,
      }));
    return {
      item: {
        timestamps,
        details: {
          id: item.id,
          type: item.type,
          title: item.title,
          release_year: item.release_year,
        },
        type: item.type,
        release_year: item.release_year,
      },
    };
  });

  const movies = await Promise.all(
    aggregatedMoviesData.map(async (item) => ({
      item: item.item,
      poster: <Poster media={item.item.details} />,
    })),
  );

  return <VideoPlayer video={videoData} movies={movies} />;
}

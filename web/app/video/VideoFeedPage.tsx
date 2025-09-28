import { notFound } from "next/navigation";
import styles from "./page.module.css";
import VideoThumbnail from "@/components/videoThumbnail";
import PaginationNav from "@/components/PaginationNav";
import { DEFAULT_PAGE_SIZE, paginate } from "@/lib/pagination";
import { VideoFeedData, VideoDataShort } from "@/lib/backend/types";

type VideoFeedPageProps = {
  feed: VideoFeedData;
  currentPage: number;
  basePath: string;
  pageSize?: number;
};

function sortVideos(feed: VideoFeedData): VideoDataShort[] {
  return [...feed.feed].sort(
    (a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime(),
  );
}

export default function VideoFeedPage({
  feed,
  currentPage,
  basePath,
  pageSize = DEFAULT_PAGE_SIZE,
}: VideoFeedPageProps) {
  const sortedVideos = sortVideos(feed);
  const { items, totalPages, isValid } = paginate(sortedVideos, currentPage, pageSize);

  if (!isValid) {
    notFound();
  }

  return (
    <>
      <main className={styles.videoContainer}>
        {items.map((video) => (
          <VideoThumbnail key={video.video_id} video={video} />
        ))}
      </main>
      {totalPages > 1 && (
        <PaginationNav
          basePath={basePath}
          currentPage={currentPage}
          totalPages={totalPages}
        />
      )}
    </>
  );
}

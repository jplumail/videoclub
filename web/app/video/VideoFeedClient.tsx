"use client";

import Image from "next/image";
import Link from "next/link";
import layoutStyles from "./page.module.css";
import cardStyles from "@/components/styles/videoThumbnail.module.css";
import type { VideoDataShort } from "@/lib/backend/types";
import { useInfiniteBatch } from "@/lib/hooks/useInfiniteBatch";

const DEFAULT_BATCH = 24;

type VideoFeedClientProps = {
  videos: VideoDataShort[];
  batchSize?: number;
};

function VideoCard({
  video,
  isLcpCandidate,
}: {
  video: VideoDataShort;
  isLcpCandidate: boolean;
}) {
  const videoUrl = `/video/${video.video_id}`;
  return (
    <div className={cardStyles.video}>
      <Link href={videoUrl}>
        <div className={cardStyles.thumbnail}>
          <Image
            src={`https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`}
            width={480}
            height={270}
            alt={`Miniature de ${video.name}`}
            priority={isLcpCandidate}
            fetchPriority={isLcpCandidate ? "high" : undefined}
            loading={isLcpCandidate ? "eager" : undefined}
          />
        </div>
      </Link>
      <h2>
        <Link href={videoUrl}>{video.name}</Link>
      </h2>
    </div>
  );
}

export default function VideoFeedClient({
  videos,
  batchSize = DEFAULT_BATCH,
}: VideoFeedClientProps) {
  const { visibleCount, sentinelRef } = useInfiniteBatch({
    total: videos.length,
    batchSize,
  });
  const visibleVideos = videos.slice(0, visibleCount);

  return (
    <>
      <main className={layoutStyles.videoContainer}>
        {visibleVideos.map((video, index) => {
          const isLcpCandidate = index === 0;
          return (
            <VideoCard
              key={video.video_id}
              video={video}
              isLcpCandidate={isLcpCandidate}
            />
          );
        })}
      </main>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
    </>
  );
}

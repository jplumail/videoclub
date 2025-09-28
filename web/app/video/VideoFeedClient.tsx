"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import type { VideoDataShort } from "@/lib/backend/types";

const DEFAULT_BATCH = 24;

type VideoFeedClientProps = {
  videos: VideoDataShort[];
  batchSize?: number;
};

function VideoCard({ video }: { video: VideoDataShort }) {
  const videoUrl = `/video/${video.video_id}`;
  return (
    <div className={styles.video}>
      <Link href={videoUrl}>
        <div className={styles.thumbnail}>
          <Image
            src={`https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`}
            width={480}
            height={270}
            alt={`Miniature de ${video.name}`}
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
  const [visibleCount, setVisibleCount] = useState(
    Math.min(batchSize, videos.length),
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((prev) => {
          if (prev >= videos.length) {
            observerRef.current?.disconnect();
            return prev;
          }
          const next = Math.min(prev + batchSize, videos.length);
          return next;
        });
      }
    });

    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [batchSize, videos.length]);

  useEffect(() => {
    if (visibleCount >= videos.length) {
      observerRef.current?.disconnect();
    }
  }, [visibleCount, videos.length]);

  const visibleVideos = videos.slice(0, visibleCount);

  return (
    <>
      <main className={styles.videoContainer}>
        {visibleVideos.map((video) => (
          <VideoCard key={video.video_id} video={video} />
        ))}
      </main>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
    </>
  );
}

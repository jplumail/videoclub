"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/Card";
import MovieCardDetails from "@/components/MovieCardDetails";
import { getTitle, slugify } from "@/lib/utils";
import utilsStyles from "@/components/styles/utils.module.css";
import styles from "./meilleurs.module.css";
import type { BestMediaSerializableItem } from "./meilleurs";

const DEFAULT_BATCH = 24;

function buildCitationItems(item: BestMediaSerializableItem["citations"], mediaTitle: string) {
  const slug = slugify(mediaTitle || "");
  return item.map((c) => ({
    main: {
      title: c.name || "",
      href: `/video/${c.videoId}#${slug}`,
    },
    youtubeUrls: [
      {
        videoId: c.videoId,
        timestamp: c.start_time,
      },
    ],
  }));
}

type BestMediaClientProps = {
  items: BestMediaSerializableItem[];
  batchSize?: number;
};

export default function BestMediaClient({
  items,
  batchSize = DEFAULT_BATCH,
}: BestMediaClientProps) {
  const [visibleCount, setVisibleCount] = useState(
    Math.min(batchSize, items.length),
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
          if (prev >= items.length) {
            observerRef.current?.disconnect();
            return prev;
          }
          const next = Math.min(prev + batchSize, items.length);
          return next;
        });
      }
    });

    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [batchSize, items.length]);

  useEffect(() => {
    if (visibleCount >= items.length) {
      observerRef.current?.disconnect();
    }
  }, [visibleCount, items.length]);

  const visibleItems = items.slice(0, visibleCount);

  return (
    <>
      <ol className={styles.liste}>
        {visibleItems.map((item, index) => {
          const title = getTitle(item.media) || "";
          const citations = buildCitationItems(item.citations, title);
          const rank = index < 9 ? index + 1 : null;

          return (
            <li key={item.id}>
              <div className={styles.itemContainer}>
                <div className={styles.imageContainer}>
                  <Card
                    item={item.media}
                    media={
                      item.poster ? (
                        <Image
                          src={item.poster.url}
                          width={item.poster.width}
                          height={item.poster.height}
                          alt={`Poster du média ${title}`}
                        />
                      ) : undefined
                    }
                  >
                    <MovieCardDetails items={citations} />
                  </Card>
                  {rank && (
                    <span className={`${styles.rank} ${styles.bottom}`}>{rank}</span>
                  )}
                  <span
                    className={`${styles.citationCount} ${styles.bottom} ${utilsStyles.textShadow}`}
                  >
                    Cité {item.citations.length} fois
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
    </>
  );
}

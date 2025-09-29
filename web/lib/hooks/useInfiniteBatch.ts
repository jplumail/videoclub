"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const DEFAULT_BATCH = 24;

type UseInfiniteBatchOptions = {
  total: number;
  batchSize?: number;
};

type UseInfiniteBatchResult = {
  visibleCount: number;
  sentinelRef: RefObject<HTMLDivElement | null>;
};

export function useInfiniteBatch({
  total,
  batchSize = DEFAULT_BATCH,
}: UseInfiniteBatchOptions): UseInfiniteBatchResult {
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(batchSize, total),
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((prev) => {
          if (prev >= total) {
            observerRef.current?.disconnect();
            return prev;
          }

          return Math.min(prev + batchSize, total);
        });
      }
    });

    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [batchSize, total]);

  useEffect(() => {
    if (visibleCount >= total) {
      observerRef.current?.disconnect();
    }
  }, [visibleCount, total]);

  return { visibleCount, sentinelRef };
}

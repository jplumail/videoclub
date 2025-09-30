"use client";

import styles from "./styles/MovieCardDetails.module.css";
import ytIconStyle from "./styles/yt-icon.module.css";
import Link from "next/link";
import { getYoutubeUrl } from "@/lib/utils";

function getYoutubeLinkLabel(title: string, timestamp: number | null | undefined) {
  if (timestamp === null || typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    return `Watch ${title} on YouTube`;
  }

  const totalSeconds = Math.max(0, Math.trunc(timestamp));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const durationParts: string[] = [];

  if (hours > 0) {
    durationParts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }

  if (minutes > 0) {
    durationParts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }

  if (seconds > 0 || durationParts.length === 0) {
    durationParts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  }

  const timecode = durationParts.join(", ");
  return `Watch ${title} on YouTube at ${timecode}`;
}

interface MovieCardDetailsProps {
  items: {
    main: {
      title: string;
      href: string;
    };
    youtubeUrls: {
      videoId: string;
      timestamp: number;
    }[];
  }[];
}

export default function MovieCardDetails({ items }: MovieCardDetailsProps) {
  return (
    <ul className={styles.citeList}>
      {items.map(({ main, youtubeUrls }, key) => {
        return (
          <li key={key} className={styles.citeItem}>
            <p>
              <Link href={main.href}>{main.title}</Link>
            </p>
            <div>
              {youtubeUrls.map((video) => {
                const linkLabel = getYoutubeLinkLabel(
                  main.title,
                  video.timestamp ?? null,
                );

                return (
                  <Link
                    key={video.videoId}
                    href={getYoutubeUrl(
                      video.videoId,
                      video.timestamp ?? null,
                    )}
                    className={`${styles.link} ${ytIconStyle.ytIcon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={linkLabel}
                    title={linkLabel}
                  />
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

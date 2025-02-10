import { TimeOffset } from "@/lib/backend/types";
import styles from "./styles/MovieCardDetails.module.css";
import ytIconStyle from "./styles/yt-icon.module.css";
import Link from "next/link";
import { getYoutubeUrl } from "@/lib/utils";

interface MovieCardDetailsProps {
  items: {
    main: {
      title: string;
      href: string;
    };
    youtubeUrls: {
      videoId: string;
      timestamp: TimeOffset;
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
            <ul>
              {youtubeUrls.map((video) => {
                return (
                  <Link
                    key={video.videoId}
                    href={getYoutubeUrl(
                      video.videoId,
                      video.timestamp.seconds || null,
                    )}
                    className={`${styles.link} ${ytIconStyle.ytIcon}`}
                    target="_blank"
                  />
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

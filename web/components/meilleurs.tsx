import { PartialMedia, Person, TimeOffset } from "@/lib/backend/types";
import { getYoutubeUrl, slugify } from "@/lib/utils";
import styles from "./meilleurs.module.css";
import ytIconStyle from "./yt-icon.module.css";
import utilsStyles from "./utils.module.css";
import Link from "next/link";
import { MovieCard } from "./MovieCard";

function getTitle(media: PartialMedia) {
  return media.title || media.name || null;
}

async function LeaderBoardItem({
  item,
  rank,
}: {
  item: {
    movie: PartialMedia;
    personnalites: {
      person: Person;
      videos: {
        videoId: string;
        timestamps: {
          start_time: TimeOffset;
          end_time: TimeOffset;
          confidence: number;
        }[];
      }[];
    }[];
  };
  rank: number | null;
}) {
  return (
    <div className={styles.itemContainer}>
      <div className={styles.imageContainer}>
        <MovieCard media={item.movie}>
          <ul className={styles.citeList}>
            {Array.from(item.personnalites).map((p, k) => (
              <li key={k} className={styles.citeItem}>
                <p>
                  <Link
                    href={`/video/${Array.from(p.videos)[0].videoId}#${slugify(getTitle(item.movie) || "")}`}
                  >
                    {p.person.name}
                  </Link>
                </p>
                <ul>
                  {Array.from(p.videos).map((video) => (
                    <Link
                      key={video.videoId}
                      href={getYoutubeUrl(
                        video.videoId,
                        video.timestamps[0]?.start_time?.seconds || null,
                      )}
                      className={`${styles.link} ${ytIconStyle.ytIcon}`}
                      target="_blank"
                    ></Link>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </MovieCard>
        {rank && (
          <span className={`${styles.rank} ${styles.bottom}`}>{rank}</span>
        )}
        <span
          className={`${styles.citationCount} ${styles.bottom} ${utilsStyles.textShadow}`}
        >
          Cité {item.personnalites.length} fois
        </span>
      </div>
    </div>
  );
}

export default async function Meilleurs({
  medias,
}: {
  medias: {
    movie: PartialMedia;
    personnalites: {
      person: Person;
      videos: {
        videoId: string;
        timestamps: {
          start_time: TimeOffset;
          end_time: TimeOffset;
          confidence: number;
        }[];
      }[];
    }[];
  }[];
}) {
  return (
    <ol className={styles.liste}>
      {medias.map((item, key) => {
        return (
          <li key={key}>
            <LeaderBoardItem item={item} rank={key < 9 ? key + 1 : null} />
          </li>
        );
      })}
    </ol>
  );
}

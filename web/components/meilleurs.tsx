import { PartialMedia, Person, TimeOffset } from "@/lib/backend/types";
import { getTitle, slugify } from "@/lib/utils";
import styles from "./meilleurs.module.css";
import utilsStyles from "./utils.module.css";
import { MovieCard } from "./MovieCard";
import MovieCardDetails from "./MovieCardDetails";

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
            <MovieCardDetails items={Array.from(item.personnalites).map(p => ({
              main: {
                title: p.person.name || "",
                href: `/video/${p.videos[0].videoId}#${slugify(getTitle(item.movie) || "")}`
              },
              youtubeUrls: p.videos.map(v => ({
                videoId: v.videoId,
                timestamp: v.timestamps[0]?.start_time || { seconds: 0 }
              }))
            }))}/>
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

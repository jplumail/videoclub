import { BestMediaData } from "@/lib/backend/types";
import { getTitle, slugify } from "@/lib/utils";
import styles from "./meilleurs.module.css";
import utilsStyles from "@/components/styles/utils.module.css";
import { MovieCard } from "@/components/MovieCard";
import MovieCardDetails from "@/components/MovieCardDetails";

async function LeaderBoardItem({ item, rank }: { item: BestMediaData["media"][number]; rank: number | null; }) {
  return (
    <div className={styles.itemContainer}>
      <div className={styles.imageContainer}>
        <MovieCard media={item.media}>
          <ul className={styles.citeList}>
            <MovieCardDetails items={item.citations.map(c => ({
              main: {
                title: c.name || "",
                href: `/video/${c.videoId}#${slugify(getTitle(item.media) || "")}`
              },
              youtubeUrls: [{ videoId: c.videoId, timestamp: c.start_time }]
            }))}/>
          </ul>
        </MovieCard>
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
  );
}

export default async function Meilleurs({
  medias,
}: {
  medias: BestMediaData;
}) {
  // Sort by number of citations (desc) without mutating the input
  const sorted = [...medias.media].sort(
    (a, b) => b.citations.length - a.citations.length
  );
  return (
    <ol className={styles.liste}>
      {sorted.map((item, key) => {
        return (
          <li key={key}>
            <LeaderBoardItem item={item} rank={key < 9 ? key + 1 : null} />
          </li>
        );
      })}
    </ol>
  );
}

import { BestMediaData } from "@/lib/backend/types";
import { getTitle, slugify } from "@/lib/utils";
import styles from "./meilleurs.module.css";
import utilsStyles from "@/components/styles/utils.module.css";
import { MovieCard } from "@/components/MovieCard";
import MovieCardDetails from "@/components/MovieCardDetails";
import PaginationNav from "@/components/PaginationNav";
import { DEFAULT_PAGE_SIZE, paginate } from "@/lib/pagination";
import { notFound } from "next/navigation";

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
  basePath,
  currentPage = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  medias: BestMediaData;
  basePath: string;
  currentPage?: number;
  pageSize?: number;
}) {
  // Sort by number of citations (desc) without mutating the input
  const sorted = [...medias.media].sort(
    (a, b) => b.citations.length - a.citations.length
  );
  const { items, totalPages, isValid } = paginate(sorted, currentPage, pageSize);

  if (!isValid) {
    notFound();
  }

  return (
    <>
      <ol className={styles.liste}>
        {items.map((item, index) => {
          const absoluteIndex = (currentPage - 1) * pageSize + index;
          const rank = absoluteIndex < 9 ? absoluteIndex + 1 : null;
          return (
            <li key={absoluteIndex}>
              <LeaderBoardItem item={item} rank={rank} />
            </li>
          );
        })}
      </ol>
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

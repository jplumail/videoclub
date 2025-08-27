import { MediaItem } from "@/lib/backend/types";
import styles from "./Timeline.module.css";
import { slugify } from "@/lib/utils";
import { Card } from "@/components/Card";

function getMinutes(seconds: number) {
  return Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
}

function getSeconds(seconds: number) {
  return (seconds % 60).toString().padStart(2, "0");
}

export function Timecode({ time_offset, setTimecode }: { time_offset: number; setTimecode: (timecode: number) => void; }) {
  return (
    <a
      href={"#"}
      onClick={() => setTimecode(time_offset)}
      className={styles.timecode}
    >
      <p>
        {getMinutes(time_offset || 0)}:{getSeconds(time_offset || 0)}
      </p>
    </a>
  );
}

export interface Timestamp {
  start_time: number;
  end_time: number;
}

export interface MovieDataTimestamps {
  item: {
    timestamps: Timestamp[];
    details: MediaItem;
    type: "movie" | "tv";
    release_year: string | null;
  };
  poster: React.ReactElement;
}

export function Timeline({
  movies,
  setTimecode,
}: {
  movies: MovieDataTimestamps[];
  setTimecode: (timecode: number) => void;
}) {
  // sort movies
  movies.sort((a, b) => {
    return (
      Math.min(...a.item.timestamps.map((t) => t.start_time || 3600)) -
      Math.min(...b.item.timestamps.map((t) => t.start_time || 3600))
    );
  });
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {movies.map((movie, key) => {
          const title = movie.item.details.title || "";
          return (
            <div
              key={key}
              id={slugify(title || "")}
              className={styles.movieCard}
              tabIndex={-1}
            >
              <Card item={movie.item.details} media={movie.poster}>
                <div className={styles.timecodesContainer}>
                  {movie.item.timestamps.map((timestamp, i) => {
                    return (
                      <Timecode
                        key={i}
                        time_offset={timestamp.start_time}
                        setTimecode={setTimecode}
                      />
                    );
                  })}
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { PartialMedia, Person, TimeOffset } from "@/lib/backend/types";
import styles from "./Timeline.module.css";
import { slugify } from "@/lib/utils";
import { MovieCardSync, PosterProps } from "./MovieCard";

function getMinutes(seconds: number) {
  return Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
}

function getSeconds(seconds: number) {
  return (seconds % 60).toString().padStart(2, "0");
}

export function Timecode({
  time_offset,
  setTimecode,
}: {
  time_offset: TimeOffset;
  setTimecode: (timecode: TimeOffset) => void;
}) {
  return (
    <a
      href={"#"}
      onClick={(e) => setTimecode(time_offset)}
      className={styles.timecode}
    >
      <p>
        {getMinutes(time_offset.seconds || 0)}:
        {getSeconds(time_offset.seconds || 0)}
      </p>
    </a>
  );
}

export interface Timestamp {
  start_time: TimeOffset;
  end_time: TimeOffset;
  confidence: number;
}

export interface MovieDataTimestamps {
  item: {
    timestamps: Timestamp[];
    details: PartialMedia;
    type: "movie" | "tv";
    crew: Person[] | null;
    release_year: string | null;
  };
  poster: React.ReactElement<PosterProps>;
}

export function Timeline({
  movies,
  setTimecode,
}: {
  movies: MovieDataTimestamps[];
  setTimecode: (timecode: TimeOffset) => void;
}) {
  // sort movies
  movies.sort((a, b) => {
    return (
      Math.min(...a.item.timestamps.map((t) => t.start_time.seconds || 3600)) -
      Math.min(...b.item.timestamps.map((t) => t.start_time.seconds || 3600))
    );
  });
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {movies.map((movie, key) => {
          const title =
            movie.item.details.title || movie.item.details.name || "";
          return (
            <div key={key} id={slugify(title || "")}>
              <MovieCardSync media={movie.item.details} poster={movie.poster}>
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
              </MovieCardSync>
            </div>
          );
        })}
      </div>
    </div>
  );
}

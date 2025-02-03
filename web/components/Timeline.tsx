import {
  MediaItemTimestamp,
  PartialMedia,
  Person,
  TimeOffset,
} from "@/lib/backend/types";
import styles from "./Timeline.module.css";
import { slugify } from "@/lib/utils";
import { MovieCard, MovieCardSync, PosterProps } from "./MovieCard";

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
    <a href={"#"} onClick={(e) => setTimecode(time_offset)}>
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

export interface MovieDataTimestamp {
  item: {
    timestamp: Timestamp;
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
  movies: MovieDataTimestamp[];
  setTimecode: (timecode: TimeOffset) => void;
}) {
  // sort movies
  movies.sort((a, b) => {
    return (
      (a.item.timestamp.start_time.seconds || 0) -
      (b.item.timestamp.start_time.seconds || 0)
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
                <Timecode
                  key={key}
                  time_offset={movie.item.timestamp.start_time}
                  setTimecode={setTimecode}
                />
              </MovieCardSync>
            </div>
          );
        })}
      </div>
    </div>
  );
}

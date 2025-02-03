"use client";

import type { PartialMedia, Person, TimeOffset } from "@/lib/backend/types";
import { useState, useEffect } from "react";
import { MovieDataTimestamp, Timeline, Timestamp } from "./Timeline";
import { PosterProps } from "./MovieCard";
import { useYoutubePlayer } from "@/lib/hooks/useYoutubePlayer";
import styles from "./VideoPlayer.module.css";

interface MovieDataTimestamps {
  item: {
    timestamps: Timestamp[];
    details: PartialMedia;
    type: "movie" | "tv";
    crew: Person[] | null;
    release_year: string | null;
  };
  poster: React.ReactElement<PosterProps>;
}

function sortAndOrganizeMovies(movies: MovieDataTimestamps[]) {
  let flatTimestampsMovies: MovieDataTimestamp[] = [];
  movies.forEach((movie) => {
    movie.item.timestamps.sort((a, b) => {
      return (a.start_time.seconds || 0) - (b.start_time.seconds || 0);
    });
    // filter out timestamps with that are less than 30s apart
    let filteredTimestamps = [movie.item.timestamps[0]];
    for (let i = 1; i < movie.item.timestamps.length; i++) {
      if (
        (movie.item.timestamps[i].start_time?.seconds || 0) -
          (movie.item.timestamps[i - 1].end_time?.seconds || 0) >
        30
      ) {
        filteredTimestamps.push(movie.item.timestamps[i]);
      }
    }
    filteredTimestamps.forEach((timestamp) => {
      flatTimestampsMovies.push({
        item: {
          timestamp: timestamp,
          details: movie.item.details,
          type: movie.item.type,
          crew: movie.item.crew,
          release_year: movie.item.release_year,
        },
        poster: movie.poster,
      });
    });
  });

  return flatTimestampsMovies;
}

function YoutubeIframePlayer({
  videoId,
  timecode,
}: {
  videoId: string;
  timecode: TimeOffset;
}) {
  console.log("YoutubeIframePlayer videoId", videoId);
  const youtubePlayer = useYoutubePlayer(
    videoId,
    () => {
      console.log("YouTube player ready");
      if (timecode.seconds) {
        console.log("playerRef", youtubePlayer.player);
        youtubePlayer.player?.seekTo(timecode.seconds, true);
      }
    },
    "player",
  );

  useEffect(() => {
    if (youtubePlayer.isAPIReady && youtubePlayer.player && timecode.seconds) {
      youtubePlayer.player.seekTo(timecode.seconds, true);
    }
  }, [timecode.seconds]);

  return <div id="player"></div>;
}

interface VideoPlayerProps {
  videoId: string;
  movies: MovieDataTimestamps[];
}

export default function VideoPlayer({ videoId, movies }: VideoPlayerProps) {
  const [timecode, setTimecode] = useState<TimeOffset>({ seconds: 0 });
  const moviesGroupedByTimestamp = sortAndOrganizeMovies(movies);
  return (
    <div className={styles.videoPlayer}>
      <YoutubeIframePlayer videoId={videoId} timecode={timecode} />
      <Timeline movies={moviesGroupedByTimestamp} setTimecode={setTimecode} />
    </div>
  );
}

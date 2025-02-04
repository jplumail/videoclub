"use client";

import type { TimeOffset } from "@/lib/backend/types";
import { useState, useEffect } from "react";
import { MovieDataTimestamps, Timeline, Timestamp } from "./Timeline";
import { useYoutubePlayer } from "@/lib/hooks/useYoutubePlayer";
import styles from "./VideoPlayer.module.css";



function YoutubeIframePlayer({
  videoId,
  timecode,
}: {
  videoId: string;
  timecode: TimeOffset;
}) {
  const youtubePlayer = useYoutubePlayer(
    videoId,
    () => {
      if (timecode.seconds) {
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
  return (
    <div className={styles.videoPlayer}>
      <YoutubeIframePlayer videoId={videoId} timecode={timecode} />
      <Timeline movies={movies} setTimecode={setTimecode} />
    </div>
  );
}

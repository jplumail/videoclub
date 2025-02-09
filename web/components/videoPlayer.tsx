"use client";

import type { TimeOffset } from "@/lib/backend/types";
import { useState, useEffect } from "react";
import { MovieDataTimestamps, Timeline } from "./Timeline";
import { useYoutubePlayer } from "@/lib/hooks/useYoutubePlayer";
import styles from "./videoPlayer.module.css";

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
  }, [timecode.seconds, youtubePlayer.isAPIReady, youtubePlayer.player]);

  return <div id="player" className={styles.playerIframe}></div>;
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
      <div className={styles.timelineWrapper}>
        <Timeline movies={movies} setTimecode={setTimecode} />
      </div>
    </div>
  );
}

"use client";

import type { Person, PlaylistItemPersonnalites, TimeOffset } from "@/lib/backend/types";
import { useState, useEffect } from "react";
import { MovieDataTimestamps, Timeline } from "./Timeline";
import { useYoutubePlayer } from "@/lib/hooks/useYoutubePlayer";
import styles from "./videoPlayer.module.css";
import Link from "next/link";

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

function formatPersonnalites(personnalites: Person[]) {
  if (!personnalites || personnalites.length === 0) return '';
  
  if (personnalites.length === 1) {
    return (
      <>
        avec <Link className={styles.personnaliteLink} href={`/personne/${personnalites[0].id}`}>{personnalites[0].name}</Link>
      </>
    );
  }
  
  const lastPersonnalite = personnalites[personnalites.length - 1];
  const otherPersonnalites = personnalites.slice(0, -1);
  
  return (
    <>
      avec {otherPersonnalites.map((p, index) => (
        <>
          <Link className={styles.personnaliteLink} key={p.id} href={`/personne/${p.id}`}>{p.name}</Link>
          {index < otherPersonnalites.length - 1 ? ', ' : ''}
        </>
      ))} et <Link className={styles.personnaliteLink} href={`/personne/${lastPersonnalite.id}`}>{lastPersonnalite.name}</Link>
    </>
  );
}

interface VideoPlayerProps {
  video: PlaylistItemPersonnalites;
  movies: MovieDataTimestamps[];
}

export default function VideoPlayer({ video, movies }: VideoPlayerProps) {
  const [timecode, setTimecode] = useState<TimeOffset>({ seconds: 0 });
  const videoId = video.playlist_item.snippet.resourceId.videoId;
  const personnalites = video.personnalites.filter(p => p !== null);

  return (
    <div className={styles.videoPlayer}>
      <YoutubeIframePlayer videoId={videoId} timecode={timecode} />
      <p className={styles.personnalites}>{formatPersonnalites(personnalites)}</p>
      <div className={styles.timelineWrapper}>
        <Timeline movies={movies} setTimecode={setTimecode} />
      </div>
    </div>
  );
}

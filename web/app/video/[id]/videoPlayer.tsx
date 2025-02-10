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

const PersonLink = ({ person }: { person: Person }) => (
  <Link className={styles.personnaliteLink} href={`/personne/${person.id}`}>
    {person.name}
  </Link>
);

function formatPersonnalites(personnalites: Person[]) {
  if (!personnalites?.length) return '';
  
  return (
    <>
      avec{' '}
      {personnalites.map((person, index) => (
        <span key={person.id}>
          <PersonLink person={person} />
          {index === personnalites.length - 2 ? ' et ' : index < personnalites.length - 1 ? ', ' : ''}
        </span>
      ))}
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

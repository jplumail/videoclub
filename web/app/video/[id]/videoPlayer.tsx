"use client";

import type { Person, PlaylistItemPersonnalites, TimeOffset } from "@/lib/backend/types";
import { useState, useEffect } from "react";
import { MovieDataTimestamps, Timeline } from "./Timeline";
import { useYoutubePlayer } from "@/lib/hooks/useYoutubePlayer";
import styles from "./videoPlayer.module.css";
import Link from "next/link";
import { getTitle, slugify } from "@/lib/utils";

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
      if (window.location.hash) {
        youtubePlayer.player.mute();
        youtubePlayer.player.playVideo();
      }
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
  const videoId = video.playlist_item.snippet.resourceId.videoId;
  const personnalites = video.personnalites.filter(p => p !== null);

  // states pour gérer dynamiquement le hash et timecode
  const [movieSlug, setMovieSlug] = useState<string>("");
  const [timecode, setTimecode] = useState<TimeOffset>({ seconds: 0 });

  // Récupérer le hash une fois le composant monté
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    setMovieSlug(hash);
  }, []);

  // Mettre à jour le timecode dès que le movieSlug ou movies changent
  useEffect(() => {
    const foundMovie = movies.find((m) => slugify(getTitle(m.item.details) || "") === movieSlug);
    if (foundMovie && foundMovie.item.timestamps && foundMovie.item.timestamps[0]?.start_time) {
      setTimecode({ seconds: foundMovie.item.timestamps[0].start_time.seconds });
    }
  }, [movieSlug, movies]);

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

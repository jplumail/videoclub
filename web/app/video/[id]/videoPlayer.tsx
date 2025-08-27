"use client";

import type { Personnalite, VideoDataFull } from "@/lib/backend/types";
import { useState, useEffect } from "react";
import { MovieDataTimestamps, Timeline } from "./Timeline";
import { useYoutubePlayer } from "@/lib/hooks/useYoutubePlayer";
import styles from "./videoPlayer.module.css";
import Link from "next/link";
import { getTitle, slugify } from "@/lib/utils";

function YoutubeIframePlayer({ videoId, timecode }: { videoId: string; timecode: number; }) {
  const youtubePlayer = useYoutubePlayer(
    videoId,
    () => {
      if (timecode) {
        youtubePlayer.player?.seekTo(timecode, true);
      }
    },
    "player",
  );

  useEffect(() => {
    if (youtubePlayer.isAPIReady && youtubePlayer.player && timecode) {
      youtubePlayer.player.seekTo(timecode, true);
      if (window.location.hash) {
        youtubePlayer.player.mute();
        youtubePlayer.player.playVideo();
      }
    }
  }, [timecode, youtubePlayer.isAPIReady, youtubePlayer.player]);

  return <div id="player" className={styles.playerIframe}></div>;
}

const PersonLink = ({ person }: { person: Personnalite }) => (
  <Link className={styles.personnaliteLink} href={`/personne/${person.person_id}`}>
    {person.name}
  </Link>
);

function formatPersonnalites(personnalites: Personnalite[]) {
  if (!personnalites?.length) return '';
  
  return (
    <>
      avec{' '}
      {personnalites.map((person, index) => (
        <span key={person.person_id ?? index}>
          <PersonLink person={person} />
          {index === personnalites.length - 2 ? ' et ' : index < personnalites.length - 1 ? ', ' : ''}
        </span>
      ))}
    </>
  );
}

interface VideoPlayerProps {
  video: VideoDataFull;
  movies: MovieDataTimestamps[];
}

export default function VideoPlayer({ video, movies }: VideoPlayerProps) {
  const videoId = video.video_id;
  const personnalites = video.personnalites || [];

  // states pour gérer dynamiquement le hash et timecode
  const [movieSlug, setMovieSlug] = useState<string>("");
  const [timecode, setTimecode] = useState<number>(0);

  // Récupérer le hash une fois le composant monté
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    setMovieSlug(hash);
  }, []);

  // Mettre à jour le timecode dès que le movieSlug ou movies changent
  useEffect(() => {
    const foundMovie = movies.find((m) => slugify(getTitle(m.item.details) || "") === movieSlug);
    if (foundMovie && foundMovie.item.timestamps && foundMovie.item.timestamps[0]?.start_time) {
      setTimecode(foundMovie.item.timestamps[0].start_time);
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

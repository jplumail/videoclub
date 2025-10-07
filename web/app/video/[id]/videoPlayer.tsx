"use client";

import type { CSSProperties } from "react";
import type { Personnalite, VideoDataFull } from "@/lib/backend/types";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { MovieDataTimestamps, Timeline } from "./Timeline";
import { useYoutubePlayer } from "@/lib/hooks/useYoutubePlayer";
import styles from "./videoPlayer.module.css";
import Link from "next/link";
import { getTitle, slugify } from "@/lib/utils";

function YoutubeIframePlayer({
  videoId,
  timecode,
  maxHeight,
}: {
  videoId: string;
  timecode: number;
  maxHeight?: number | null;
}) {
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

  const style: CSSProperties | undefined =
    typeof maxHeight === "number"
      ? {
          maxHeight,
          maxWidth: maxHeight * (16 / 9),
        }
      : undefined;

  return <div id="player" className={styles.playerIframe} style={style}></div>;
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
  const videoSectionRef = useRef<HTMLDivElement | null>(null);
  const [playerMaxHeight, setPlayerMaxHeight] = useState<number | null>(null);

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

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const updateAvailableHeight = () => {
      const section = videoSectionRef.current;
      if (!section) return;
      if (!mediaQuery.matches) {
        setPlayerMaxHeight(null);
        return;
      }
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const bottomSpacing = 32; // keep breathing room below the player
      const topOffset = Math.max(rect.top, 0);
      const available = Math.max(viewportHeight - topOffset - bottomSpacing, 320);
      setPlayerMaxHeight(available);
    };

    updateAvailableHeight();
    requestAnimationFrame(updateAvailableHeight);

    window.addEventListener("resize", updateAvailableHeight);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateAvailableHeight);
    } else {
      mediaQuery.addListener(updateAvailableHeight);
    }
    return () => {
      window.removeEventListener("resize", updateAvailableHeight);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", updateAvailableHeight);
      } else {
        mediaQuery.removeListener(updateAvailableHeight);
      }
    };
  }, []);

  return (
    <div className={styles.videoPlayer}>
      <section className={styles.videoSection} ref={videoSectionRef}>
        <YoutubeIframePlayer videoId={videoId} timecode={timecode} maxHeight={playerMaxHeight} />
        <p className={styles.personnalites}>{formatPersonnalites(personnalites)}</p>
      </section>
      <aside className={styles.timelineWrapper}>
        <Timeline movies={movies} setTimecode={setTimecode} />
      </aside>
    </div>
  );
}

"use client";

import type { CSSProperties } from "react";
import type { Personnalite, VideoDataFull } from "@/lib/backend/types";
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import Link from "next/link";
import { getTitle, slugify } from "@/lib/utils";
import { MovieDataTimestamps, Timeline } from "./Timeline";
import { useYoutubePlayer } from "@/lib/hooks/useYoutubePlayer";
import styles from "./videoPlayer.module.css";
import personnaliteStyles from "@/components/styles/Personnalites.module.css";

function YoutubeIframePlayer({
  videoId,
  timecode,
  seekVersion,
  maxHeight,
}: {
  videoId: string;
  timecode: number;
  seekVersion: number;
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
  }, [timecode, seekVersion, youtubePlayer.isAPIReady, youtubePlayer.player]);

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
  <Link className={personnaliteStyles.link} href={`/personne/${person.person_id}`}>
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
  const [timecodeRequest, setTimecodeRequest] = useState<{ timecode: number; nonce: number }>({
    timecode: 0,
    nonce: 0,
  });
  const videoSectionRef = useRef<HTMLDivElement | null>(null);
  const [playerMaxHeight, setPlayerMaxHeight] = useState<number | null>(null);

  const requestTimecode = useCallback((time: number) => {
    setTimecodeRequest((prev) => ({
      timecode: time,
      nonce: prev.nonce + 1,
    }));
  }, []);

  // Récupérer le hash une fois le composant monté
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    setMovieSlug(hash);
  }, []);

  // Mettre à jour le timecode dès que le movieSlug ou movies changent
  useEffect(() => {
    const foundMovie = movies.find((m) => slugify(getTitle(m.item.details) || "") === movieSlug);
    if (foundMovie && foundMovie.item.timestamps && foundMovie.item.timestamps[0]?.start_time) {
      requestTimecode(foundMovie.item.timestamps[0].start_time);
    }
  }, [movieSlug, movies, requestTimecode]);

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
    mediaQuery.addEventListener("change", updateAvailableHeight);
    return () => {
      window.removeEventListener("resize", updateAvailableHeight);
      mediaQuery.removeEventListener("change", updateAvailableHeight);
    };
  }, []);

  return (
    <div className={styles.videoPlayer}>
      <section className={styles.videoSection} ref={videoSectionRef}>
        <YoutubeIframePlayer
          videoId={videoId}
          timecode={timecodeRequest.timecode}
          seekVersion={timecodeRequest.nonce}
          maxHeight={playerMaxHeight}
        />
        <p className={personnaliteStyles.container}>{formatPersonnalites(personnalites)}</p>
      </section>
      <aside className={styles.timelineWrapper}>
        <Timeline movies={movies} setTimecode={requestTimecode} />
      </aside>
    </div>
  );
}

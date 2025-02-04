import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
  }
}

export function useYoutubePlayer(
  videoId: string,
  onReady?: () => void,
  containerId: string = "player",
) {
  const playerRef = useRef<YT.Player | null>(null);
  const [isAPIReady, setIsAPIReady] = useState(false);

  useEffect(() => {
    function initPlayer() {
      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        events: {
          onReady: onReady,
        },
        playerVars: {
          controls: 2,
          loop: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
        }
      });
    }
    if (window.YT && window.YT.Player) {
      setIsAPIReady(true);
      initPlayer();
    } else {
      // Charge l'API si nécessaire
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      // Définit le callback global
      window.onYouTubeIframeAPIReady = () => {
        setIsAPIReady(true);
        initPlayer();
      };
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  return { player: playerRef.current, isAPIReady };
}

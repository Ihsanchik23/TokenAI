"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Player = {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
};

type PlayerEvent = { data: number; target: Player };

declare global {
  interface Window {
    YT?: { Player: new (elementId: string, options: Record<string, unknown>) => Player };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

export function YouTubeLearningPlayer({ lessonId, videoId, savedPosition }: { lessonId: string; videoId: string; savedPosition: number }) {
  const router = useRouter();
  const playerRef = useRef<Player | null>(null);
  const playingRef = useRef(false);
  const lastClockRef = useRef(0);
  const watchedRef = useRef(0);
  const savingRef = useRef(false);
  const [message, setMessage] = useState("Позиция сохраняется автоматически.");
  const elementId = `youtube-player-${lessonId}`;

  const accrueWatchTime = useCallback(() => {
    if (!playingRef.current) return;
    const now = performance.now();
    if (lastClockRef.current) watchedRef.current += Math.max(0, (now - lastClockRef.current) / 1000);
    lastClockRef.current = now;
  }, []);

  const persist = useCallback(async (keepalive = false) => {
    const player = playerRef.current;
    if (!player || savingRef.current) return;
    accrueWatchTime();
    const watchedDelta = Math.floor(watchedRef.current);
    watchedRef.current -= watchedDelta;
    savingRef.current = true;
    try {
      const response = await fetch("/api/learning/video-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, position: player.getCurrentTime(), duration: player.getDuration(), watchedDelta }),
        keepalive,
      });
      const result = await response.json();
      if (!response.ok) throw new Error("SAVE_FAILED");
      setMessage(result.status === "completed" ? "Видео просмотрено — урок завершён." : `Прогресс сохранён: ${Math.round(Number(result.progressPercent))}%`);
      if (result.status === "completed") router.refresh();
    } catch {
      watchedRef.current += watchedDelta;
      if (!keepalive) setMessage("Не удалось сохранить прогресс. Повторим автоматически.");
    } finally {
      savingRef.current = false;
    }
  }, [accrueWatchTime, lessonId, router]);

  useEffect(() => {
    let disposed = false;
    void loadYouTubeApi().then(() => {
      if (disposed || !window.YT) return;
      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        playerVars: { playsinline: 1, origin: window.location.origin },
        events: {
          onReady: (event: PlayerEvent) => { if (savedPosition > 0) event.target.seekTo(savedPosition, true); },
          onStateChange: (event: PlayerEvent) => {
            accrueWatchTime();
            playingRef.current = event.data === 1;
            lastClockRef.current = performance.now();
            if (event.data === 0 || event.data === 2) void persist();
          },
        },
      });
    });
    const timer = window.setInterval(() => { accrueWatchTime(); if (watchedRef.current >= 15) void persist(); }, 1000);
    const saveBeforeLeaving = () => { void persist(true); };
    window.addEventListener("pagehide", saveBeforeLeaving);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("pagehide", saveBeforeLeaving);
      void persist(true);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [accrueWatchTime, elementId, persist, savedPosition, videoId]);

  return <div className="stack compact"><div className="video-frame"><div id={elementId} /></div><p className="field-help" aria-live="polite">{message}</p></div>;
}

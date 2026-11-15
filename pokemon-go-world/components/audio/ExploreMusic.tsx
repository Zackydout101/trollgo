"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/lib/store";

/** Bag Raiders — Shooting Stars. Loops across the map and catching; the arena and reels have their own audio. */
const TRACK = "/audio/shooting-stars.mp3";

function shouldPlay() {
  const g = useGame.getState();
  return !g.musicMuted && g.screen !== "arena" && g.screen !== "training";
}

export default function ExploreMusic() {
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = 0.45;

    const sync = () => {
      if (!shouldPlay()) {
        el.pause();
        return;
      }
      if (el.paused) void el.play().catch(() => {});
    };

    sync();
    const unsub = useGame.subscribe((s, prev) => {
      if (s.screen === prev.screen && s.musicMuted === prev.musicMuted) return;
      sync();
    });
    // Browsers block audio until the first click or key press.
    window.addEventListener("pointerdown", sync);
    window.addEventListener("keydown", sync);
    return () => {
      unsub();
      el.pause();
      window.removeEventListener("pointerdown", sync);
      window.removeEventListener("keydown", sync);
    };
  }, []);

  return (
    <audio
      ref={audio}
      src={TRACK}
      loop
      preload="auto"
      aria-hidden
      style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
    />
  );
}

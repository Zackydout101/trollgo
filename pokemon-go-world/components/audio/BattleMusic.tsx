"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/lib/store";

/** Elektronomia — Sky High. Loops for the whole Subway Surfers run. */
const TRACK = "/audio/sky-high.mp3";

export default function BattleMusic({ active }: { active: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const muted = useGame((s) => s.musicMuted);
  const on = active && !muted;

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = 0.5;

    if (!on) {
      el.pause();
      return;
    }

    const play = () => {
      if (el.paused) void el.play().catch(() => {});
    };
    play();

    // Browsers block audio until the first click or key press.
    window.addEventListener("pointerdown", play);
    window.addEventListener("keydown", play);
    return () => {
      el.pause();
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
    };
  }, [on]);

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

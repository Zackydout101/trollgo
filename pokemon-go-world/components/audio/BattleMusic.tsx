"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/lib/store";

/** Elektronomia — Sky High. Battle cue is the 30s–50s slice only. */
const TRACK = "/audio/sky-high.mp3";
const START = 30;
const END = 50;

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

    let alive = true;
    let armed = false;
    let timer = 0;
    let onSeeked = () => {};

    const cut = () => {
      if (el.currentTime >= END) el.pause();
    };

    const scheduleStop = () => {
      window.clearTimeout(timer);
      const left = (END - el.currentTime) * 1000;
      if (left <= 0) {
        el.pause();
        return;
      }
      timer = window.setTimeout(() => {
        if (!alive) return;
        if (el.currentTime >= END - 0.05) el.pause();
        else scheduleStop();
      }, Math.max(40, left));
    };

    const playFromMark = () => {
      if (!alive || el.currentTime < START - 0.05 || el.currentTime >= END) return;
      if (!el.paused) {
        scheduleStop();
        return;
      }
      void el.play().then(scheduleStop).catch(() => {});
    };

    const begin = () => {
      if (!alive || el.readyState < 1) return;
      if (armed && el.currentTime >= END) return;

      if (!armed) {
        armed = true;
        onSeeked = () => {
          el.removeEventListener("seeked", onSeeked);
          playFromMark();
        };
        el.addEventListener("seeked", onSeeked);
        try {
          el.currentTime = START;
        } catch {
          el.removeEventListener("seeked", onSeeked);
        }
        return;
      }

      playFromMark();
    };

    el.addEventListener("loadedmetadata", begin);
    el.addEventListener("timeupdate", cut);
    begin();

    // Browsers block audio until the first click or key press.
    window.addEventListener("pointerdown", begin);
    window.addEventListener("keydown", begin);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      el.pause();
      el.removeEventListener("seeked", onSeeked);
      el.removeEventListener("loadedmetadata", begin);
      el.removeEventListener("timeupdate", cut);
      window.removeEventListener("pointerdown", begin);
      window.removeEventListener("keydown", begin);
    };
  }, [on]);

  return (
    <audio
      ref={audio}
      src={TRACK}
      preload="auto"
      aria-hidden
      style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
    />
  );
}

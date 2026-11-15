"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/lib/store";

/** Bag Raiders — Shooting Stars. Only while SpongeBob is walking on the map. */
const TRACK = "/audio/shooting-stars.mp3";

function spongebobWalking() {
  const g = useGame.getState();
  return g.screen === "map" && !g.encounter && !g.spinStopId && !g.musicMuted && g.moving;
}

export default function ExploreMusic() {
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = 0.45;

    const sync = () => {
      if (!spongebobWalking()) {
        el.pause();
        return;
      }
      if (el.paused) void el.play().catch(() => {});
    };

    // The first tap or key has to happen while this scene is up, or the browser blocks playback.
    const unlock = () => {
      if (spongebobWalking()) {
        if (el.paused) void el.play().catch(() => {});
        return;
      }
      const g = useGame.getState();
      const onMap = g.screen === "map" && !g.encounter && !g.spinStopId && !g.musicMuted;
      if (!onMap || !el.paused) return;
      el.volume = 0;
      void el.play().then(() => {
        el.pause();
        el.volume = 0.45;
        sync();
      }).catch(() => {
        el.volume = 0.45;
      });
    };

    sync();
    const unsub = useGame.subscribe((s, prev) => {
      if (
        s.moving === prev.moving &&
        s.screen === prev.screen &&
        s.encounter === prev.encounter &&
        s.spinStopId === prev.spinStopId &&
        s.musicMuted === prev.musicMuted
      ) {
        return;
      }
      sync();
    });
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      unsub();
      el.pause();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
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

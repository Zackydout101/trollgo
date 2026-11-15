"use client";

import { useEffect, useRef, useState } from "react";
import { SubwayGame } from "@/lib/subway/game";

interface Props {
  /** The runner only advances while this is true (i.e. the battle is live). */
  active: boolean;
  /** Collected a coin. Argument is the current grab streak. */
  onCoin: (damage: number) => void;
  /** Stumbled (recoverable) -> small chip + feedback. */
  onDodge?: () => void;
  /** Crashed -> the trainer goes down instantly. */
  onCrash: () => void;
  /** Progress feedback (coins, metres) for the HUD. */
  onProgress?: (coins: number, meters: number) => void;
}

/**
 * The real SUBWAY-SURFERS engine (DanielLin0516/SUBWAY-SURFERS), vendored under lib/subway and
 * driven here inside the arena's bottom half. Coins fuel your Pokémon's attacks; one crash is death.
 */
export default function SubwayRunner({ active, onCoin, onDodge, onCrash, onProgress }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SubwayGame | null>(null);
  const [loading, setLoading] = useState(true);

  // keep callbacks fresh without re-creating the engine
  const cbs = useRef({ onCoin, onDodge, onCrash, onProgress });
  cbs.current = { onCoin, onDodge, onCrash, onProgress };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let cancelled = false;

    const game = new SubwayGame(canvas, wrap, {
      onReady: () => !cancelled && setLoading(false),
      onCoin: (streak) => cbs.current.onCoin(streak),
      onStumble: () => cbs.current.onDodge?.(),
      onCrash: () => cbs.current.onCrash(),
      onProgress: (coins, meters) => cbs.current.onProgress?.(coins, meters),
    });
    gameRef.current = game;
    game.setActive(active);
    game.load().catch((e) => {
      console.error("subway engine failed to load", e);
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      game.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // start / pause the run as the fight goes live or ends
  useEffect(() => {
    gameRef.current?.setActive(active);
  }, [active]);

  return (
    <div className="runner-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="runner-canvas" />
      {loading && <div className="runner-loading">Loading subway…</div>}
      <div className="runner-controls">
        <button aria-label="Move left" onPointerDown={() => gameRef.current?.input("left")}>◀</button>
        <button aria-label="Jump" onPointerDown={() => gameRef.current?.input("up")}>⤒</button>
        <button aria-label="Roll" onPointerDown={() => gameRef.current?.input("down")}>⤓</button>
        <button aria-label="Move right" onPointerDown={() => gameRef.current?.input("right")}>▶</button>
      </div>
    </div>
  );
}

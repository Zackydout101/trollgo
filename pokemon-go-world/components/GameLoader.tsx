"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <Splash />,
});

export function Splash({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="splash">
      <div className="splash-ball" />
      <div className="splash-title">Pokémon GO World</div>
      <div className="splash-sub">{text}</div>
    </div>
  );
}

export default function GameLoader() {
  return <Game />;
}

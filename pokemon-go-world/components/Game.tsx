"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";
import { useGameLoop } from "@/lib/useGameLoop";
import WorldMap from "./map/WorldMap";
import Encounter from "./encounter/Encounter";
import Arena from "./arena/Arena";
import Hud from "./ui/Hud";
import { Bag, MainMenu, SpinStop, Toast } from "./ui/Panels";
import TrainingGrounds from "./ui/TrainingGrounds";
import ExploreMusic from "./audio/ExploreMusic";
import { Splash } from "./GameLoader";

export default function Game() {
  useGameLoop();
  const ready = useGame((s) => s.pokedex.length > 0);
  const encounter = useGame((s) => s.encounter);
  const screen = useGame((s) => s.screen);
  const spinStopId = useGame((s) => s.spinStopId);
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSplashGone(true), 700);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <div className="app">
      <ExploreMusic />
      <WorldMap />
      {!encounter && screen === "map" && !spinStopId && <Hud />}
      {screen === "menu" && <MainMenu />}
      {screen === "bag" && <Bag />}
      {screen === "training" && <TrainingGrounds />}
      {screen === "arena" && <Arena />}
      {spinStopId && <SpinStop />}
      {encounter && <Encounter key={encounter.id} spawn={encounter} />}
      <Toast />
      {!splashGone && (
        <div className={`splash-wrap ${ready ? "fade" : ""}`}>
          <Splash text={ready ? "Ready!" : "Loading SkibidiGo…"} />
        </div>
      )}
    </div>
  );
}

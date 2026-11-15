"use client";

import { Suspense } from "react";
import { CLIP_CRITTERS, type CritterClip } from "@/lib/critters";
import { isSmurf } from "@/lib/smurf";
import { isWatchman } from "@/lib/watchman";
import type { Pokemon } from "@/lib/types";
import type { ModelInfo } from "./PokemonModel";
import WoodenWatchman, { WatchmanPlaceholder } from "./WoodenWatchman";
import Smurf, { SmurfPlaceholder } from "./Smurf";
import ClipCharacter, { ClipPlaceholder } from "./ClipCharacter";

interface Props {
  pokemon: Pokemon;
  height: number;
  castShadow?: boolean;
  /** Walking on the map, dancing while you catch, attacking in the arena. */
  clip?: CritterClip;
  onReady?: (info: ModelInfo) => void;
}

export function CritterPlaceholder({ pokemon, height }: { pokemon: Pokemon; height: number }) {
  if (isWatchman(pokemon)) return <WatchmanPlaceholder height={height} />;
  if (isSmurf(pokemon)) return <SmurfPlaceholder height={height} />;
  const spec = CLIP_CRITTERS[pokemon.dex];
  return <ClipPlaceholder height={height} color={spec?.color ?? "#888"} />;
}

/** Renders whichever animated character this is, using that character's clip set. */
export default function CritterModel({ pokemon, height, castShadow = false, clip = "walking", onReady }: Props) {
  const fallback = <CritterPlaceholder pokemon={pokemon} height={height} />;
  if (isWatchman(pokemon)) {
    return (
      <Suspense fallback={fallback}>
        <WoodenWatchman height={height} castShadow={castShadow} clip={clip} onReady={onReady} />
      </Suspense>
    );
  }
  if (isSmurf(pokemon)) {
    return (
      <Suspense fallback={fallback}>
        <Smurf height={height} castShadow={castShadow} clip={clip} onReady={onReady} />
      </Suspense>
    );
  }
  const spec = CLIP_CRITTERS[pokemon.dex];
  if (!spec) return fallback;
  return (
    <Suspense fallback={fallback}>
      <ClipCharacter spec={spec} height={height} castShadow={castShadow} clip={clip} onReady={onReady} />
    </Suspense>
  );
}

# Pokémon GO World

A Pokémon GO–style game in the browser. Walk the real world on a tilted 3D map,
find 3D Pokémon around you, and when you walk close to one you are taken into a
3D catch environment where you swipe Poké Balls at it.

## Features

- **3D overworld** – MapLibre vector map styled like Pokémon GO (green land,
  pale roads, bright water, low pastel 3D buildings, sky + fog, automatic night
  palette) with a three.js layer on top: a chibi trainer avatar with walk
  animation, 3D Pokémon standing on the map, spinning PokéStops and Gym towers.
- **Real-world PokéStops & Gyms** – built from the named points of interest in
  the map tiles (cafés, museums, monuments, …).
- **Auto encounters** – walk within 25 m of a wild Pokémon and the catch screen
  opens by itself (or tap one within 45 m).
- **3D catch environment** – biome picked from the Pokémon's type (meadow,
  forest, lake, desert, snow, volcano, haunted dusk, flower field, sky), swaying
  instanced grass, trees, rocks, water, clouds, particles and real shadows.
  Swipe to throw, hit inside the shrinking ring for Nice / Great / Excellent,
  watch the red capture beam, the ball shakes, Gotcha! or it breaks out / flees.
- Razz Berries, Great/Ultra Balls, Incense, XP and levels, Stardust & Candy,
  power-up and transfer, a Pokémon page with a rotating 3D model, PokéStop
  spinning, and a persistent save in `localStorage`.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **MapLibre GL** (OpenFreeMap tiles, no API key) via `react-map-gl`
- **three.js** via `@react-three/fiber` / `drei`, bridged into the map with
  `react-three-map`
- **zustand** for game state

## Run it

```bash
cd pokemon-go-world
npm install
npm run dev
```

Open http://localhost:3000. Walk with the on-screen joystick or `WASD` / arrow
keys, drag the map to rotate the camera, scroll / pinch to zoom. The arrow
button (top right) switches back to your real GPS position.

> Browsers only allow geolocation on `https` or `localhost`. From another
> device on your LAN, location is blocked, so use the joystick.

## Assets

- Pokémon data and 2D sprites come from
  [GoBattleSim](https://github.com/biowpn/GoBattleSim).
- 3D Pokémon models are loaded on demand from the community
  [Pokemon-3D-api](https://github.com/Sudhanshu-Ambastha/Pokemon-3D-api)
  repository through `app/api/model/[dex]`, which caches each model in
  `.cache/models/`. 870 of the 890 Pokémon have a model; the rest fall back to
  their sprite. These models are fan-extracted assets owned by Nintendo /
  Game Freak / The Pokémon Company — **personal, non-commercial use only**.

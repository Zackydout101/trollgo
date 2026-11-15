import type { StyleSpecification } from "maplibre-gl";

interface Palette {
  land: string;
  landAlt: string;
  park: string;
  wood: string;
  sand: string;
  water: string;
  waterEdge: string;
  road: string;
  roadEdge: string;
  roadMajor: string;
  path: string;
  building: string;
  buildingTop: string;
  sky: string;
  horizon: string;
  fog: string;
}

const DAY: Palette = {
  land: "#a6eba0",
  landAlt: "#97e294",
  park: "#5fd27c",
  wood: "#4cc06c",
  sand: "#f4e7a8",
  water: "#4fc8f2",
  waterEdge: "#8fe3ff",
  road: "#fdfbe3",
  roadEdge: "#c9e9b8",
  roadMajor: "#fff7c2",
  path: "#e8f5c8",
  building: "#d9f3e4",
  buildingTop: "#eafaf1",
  sky: "#4aa8f0",
  horizon: "#cfefff",
  fog: "#d6f4ff",
};

const NIGHT: Palette = {
  land: "#1f5a6e",
  landAlt: "#1c5266",
  park: "#1b6e63",
  wood: "#16645a",
  sand: "#5d6a72",
  water: "#1a3a8a",
  waterEdge: "#2d56b5",
  road: "#7ca8c7",
  roadEdge: "#244f63",
  roadMajor: "#9cc2dc",
  path: "#3e7a8a",
  building: "#2c6b80",
  buildingTop: "#3a7f95",
  sky: "#0b1645",
  horizon: "#3b4fa0",
  fog: "#2a3c7f",
};

export function isNight(d = new Date()): boolean {
  const h = d.getHours();
  return h >= 19 || h < 6;
}

export function pogoStyle(night = isNight()): StyleSpecification {
  const c = night ? NIGHT : DAY;
  const roadWidth = (base: number) =>
    [
      "interpolate",
      ["exponential", 1.6],
      ["zoom"],
      14,
      base * 0.6,
      17,
      base * 3,
      20,
      base * 16,
      22,
      base * 50,
      ] as unknown as number;
  /** zoom interpolation must be the outermost expression, so the class lookup goes inside each stop */
  const widthByClass = (groups: [string[], number][], fallback: number) => {
    const at = (k: number) => [
      "match",
      ["get", "class"],
      ...groups.flatMap(([classes, base]) => [classes, base * k]),
      fallback * k,
    ];
    return [
      "interpolate",
      ["exponential", 1.6],
      ["zoom"],
      14,
      at(0.8),
      17,
      at(4),
      20,
      at(24),
      22,
      at(70),
    ] as unknown as number;
  };

  return {
    version: 8,
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    },
    sky: {
      "sky-color": c.sky,
      "horizon-color": c.horizon,
      "fog-color": c.fog,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.35,
      "atmosphere-blend": 0,
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": c.land } },
      {
        id: "landuse",
        type: "fill",
        source: "omt",
        "source-layer": "landuse",
        filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood", "commercial", "retail", "industrial"]]],
        paint: { "fill-color": c.landAlt, "fill-opacity": 0.7 },
      },
      {
        id: "landcover-grass",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "farmland", "wetland"]]],
        paint: { "fill-color": c.park, "fill-opacity": 0.6 },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        paint: { "fill-color": c.wood, "fill-opacity": 0.85 },
      },
      {
        id: "landcover-sand",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "sand"],
        paint: { "fill-color": c.sand },
      },
      {
        id: "park",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-color": c.park, "fill-opacity": 0.85 },
      },
      {
        id: "pitch",
        type: "fill",
        source: "omt",
        "source-layer": "landuse",
        filter: ["in", ["get", "class"], ["literal", ["pitch", "playground", "stadium", "school", "cemetery"]]],
        paint: { "fill-color": c.park, "fill-opacity": 0.9 },
      },
      {
        id: "water-edge",
        type: "line",
        source: "omt",
        "source-layer": "water",
        paint: { "line-color": c.waterEdge, "line-width": roadWidth(1.2), "line-blur": 2 },
      },
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": c.water },
      },
      {
        id: "waterway",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        paint: { "line-color": c.water, "line-width": roadWidth(1) },
      },
      {
        id: "path",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["path", "track"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.path, "line-width": roadWidth(0.35), "line-opacity": 0.9 },
      },
      {
        id: "road-edge",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "street"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c.roadEdge,
          "line-width": widthByClass(
            [
              [["motorway", "trunk", "primary"], 1.5],
              [["secondary", "tertiary"], 1.25],
              [["service"], 0.65],
            ],
            0.95
          ),
        },
      },
      {
        id: "road",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["minor", "service", "street", "tertiary", "secondary"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c.road,
          "line-width": widthByClass(
            [
              [["secondary", "tertiary"], 1.0],
              [["service"], 0.45],
            ],
            0.7
          ),
        },
      },
      {
        id: "road-major",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.roadMajor, "line-width": roadWidth(1.2) },
      },
      {
        // invisible: only here so POI features get parsed and can become PokéStops / Gyms
        id: "poi-source",
        type: "circle",
        source: "omt",
        "source-layer": "poi",
        minzoom: 14,
        paint: { "circle-radius": 1, "circle-opacity": 0, "circle-stroke-opacity": 0 },
      },
      {
        id: "building-3d",
        type: "fill-extrusion",
        source: "omt",
        "source-layer": "building",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], 6],
            0,
            c.building,
            60,
            c.buildingTop,
          ] as unknown as string,
          "fill-extrusion-height": [
            "*",
            0.55,
            ["min", 80, ["coalesce", ["get", "render_height"], 6]],
          ] as unknown as number,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.82,
          "fill-extrusion-vertical-gradient": true,
        },
      },
    ],
  };
}

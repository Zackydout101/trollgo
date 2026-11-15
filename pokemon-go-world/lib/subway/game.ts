// Container-based driver for the vendored SUBWAY-SURFERS engine (DanielLin0516/SUBWAY-SURFERS).
// This mirrors the orchestration in the repo's src/main.ts (states, frame loop, event handling,
// moving-train horn/rumble) but renders into a supplied canvas/container instead of the whole
// window, and forwards gameplay events to callbacks so the arena can react (coins = attacks,
// crash = death). Gameplay itself (sim, track, view) is the engine unchanged.
import * as THREE from "three";
import { Sim } from "./sim/sim";
import { World } from "./view/world";
import { parseGLB, fetchBuffer } from "./view/assets";
import { Audio } from "./audio";
import { SPEED } from "./config";
import type { Action } from "./input";
import type { SimEvent } from "./sim/types";

export interface SubwayCallbacks {
  onCoin?(streak: number): void;
  onStumble?(): void;
  onCrash?(): void;
  onProgress?(coins: number, distance: number): void;
  onReady?(): void;
}

type State = "loading" | "menu" | "play" | "dead";

export class SubwayGame {
  private renderer: THREE.WebGLRenderer;
  private world!: World;
  private sim!: Sim;
  private audio = new Audio();
  private state: State = "loading";
  private wantActive = false;
  private seed = (Date.now() % 100000) + 1;
  private overTimer = 0;
  private horned = new Set<number>();
  private raf = 0;
  private last = 0;
  private maxPR: number;
  private ro: ResizeObserver;
  private disposed = false;
  private keyHandler: (e: KeyboardEvent) => void;
  private pointerId = -1;
  private sx = 0;
  private sy = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private container: HTMLElement,
    private cbs: SubwayCallbacks = {},
    muted = false,
  ) {
    const mobile = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxPR = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(mobile ? Math.min(this.maxPR, 1.5) : this.maxPR);
    this.audio.setMuted(muted);

    this.ro = new ResizeObserver(() => this.resize());

    // input: keyboard on the window (gated so it only drives a live run), swipe on the container
    this.keyHandler = (e: KeyboardEvent) => {
      const map: Record<string, Action> = {
        ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
        ArrowUp: "up", KeyW: "up", Space: "up", ArrowDown: "down", KeyS: "down",
      };
      const a = map[e.code];
      if (!a) return;
      if (this.state !== "play") return;
      e.preventDefault();
      if (e.repeat && a !== "left" && a !== "right") return;
      this.action(a);
    };
  }

  async load() {
    const mobile = matchMedia("(pointer: coarse)").matches;
    const core = await parseGLB(await fetchBuffer("/subway/core.glb"));
    if (this.disposed) return;
    this.world = new World(core, { shadowSize: mobile ? 1024 : 2048 });
    this.sim = new Sim(1);
    this.resize();
    this.toMenu();
    this.world.sync(this.sim, 0, true);
    this.world.warm(this.renderer);
    this.state = "menu";

    window.addEventListener("keydown", this.keyHandler);
    this.container.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
    this.ro.observe(this.container);

    this.cbs.onReady?.();
    if (this.wantActive) this.startRun();

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);

    // houses load in the background, like the original
    fetchBuffer("/subway/scenery.glb")
      .then(parseGLB)
      .then((g) => {
        if (this.disposed) return;
        this.world.addScenery(g);
        this.world.warmScenery(this.renderer);
      })
      .catch(() => {});
  }

  /** Arena tells us whether the battle is live. */
  setActive(active: boolean) {
    this.wantActive = active;
    if (this.state === "loading") return;
    if (active) {
      // A finished run stays in "dead" until the arena asks to go again.
      if (this.state !== "play") this.startRun();
    } else if (this.state === "play" || this.state === "dead") {
      this.toMenu();
    }
  }

  setMuted(m: boolean) {
    this.audio.setMuted(m);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("keydown", this.keyHandler);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    this.audio.stopMusic();
    this.audio.rumble(0);
    try { this.renderer.dispose(); } catch { /* ignore */ }
  }

  /** On-screen control buttons call this. */
  input(a: Action) {
    this.audio.unlock();
    if (this.state === "play") this.action(a);
    else if (a !== "pause" && a !== "confirm" && a !== "mute") this.setActive(true);
  }

  private action(a: Action) {
    this.audio.unlock();
    if (a === "left") this.sim.left();
    else if (a === "right") this.sim.right();
    else if (a === "up") this.sim.jump();
    else if (a === "down") this.sim.down();
  }

  private startRun() {
    this.audio.unlock();
    this.seed = (this.seed * 48271) % 2147483647;
    this.sim.reset(this.seed, false);
    this.world.resetScenery();
    this.world.fx.clear();
    this.horned.clear();
    this.overTimer = 0;
    this.sim.start();
    // Sky High (30s–50s) is the battle track. Leave the synth beat off so they don't stack.
    this.audio.stopMusic();
    this.state = "play";
  }

  private toMenu() {
    this.seed = (this.seed * 48271) % 2147483647;
    this.sim.reset(this.seed, false);
    this.world.resetScenery();
    this.world.fx.clear();
    this.audio.stopMusic();
    this.audio.rumble(0);
    this.overTimer = 0;
    this.state = "menu";
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.world?.resize(w, h);
  }

  private handle(ev: SimEvent) {
    this.world.event(ev);
    const a = this.audio;
    switch (ev.type) {
      case "jump": a.jump(ev.super); break;
      case "slide": a.slide(); break;
      case "lane": a.lane(); break;
      case "bump": a.bump(); break;
      case "land": if (ev.fall > 0.5) a.land(); break;
      case "coin": a.coin(ev.streak); this.cbs.onCoin?.(ev.streak); break;
      case "power": a.power(); break;
      case "powerEnd": a.powerEnd(); break;
      case "level": a.level(); break;
      case "stumble": a.stumble(); this.cbs.onStumble?.(); break;
      case "crash":
        a.crash();
        a.stopMusic();
        this.cbs.onCrash?.();
        break;
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const sim = this.sim;

    if (this.state === "play") sim.update(dt);
    for (const ev of sim.drainEvents()) this.handle(ev);
    if (this.state === "play" && !sim.alive) {
      this.overTimer += dt;
      if (this.overTimer > 1.2) this.state = "dead";
    }

    const menu = this.state === "menu";
    if (!menu) this.world.player.update(sim, dt, []);
    this.world.sync(sim, dt, menu);
    this.audio.tempo = 108 + (sim.speed - SPEED.start) * 6;

    // moving trains: horn once when ~90 m out, rumble that grows as they close in
    let rumble = 0;
    if (this.state === "play" && sim.alive) {
      for (const o of sim.obs) {
        if (o.kind !== "mtrain" || o.d1 < sim.d) continue;
        const gap = Math.max(0, o.d0 - sim.d);
        if (gap < 130) rumble = Math.max(rumble, 1 - gap / 130);
        if (gap < 90 && !this.horned.has(o.id)) { this.horned.add(o.id); this.audio.horn(); }
      }
      if (this.horned.size > 50) this.horned.clear();
    }
    this.audio.rumble(rumble);

    if (this.state === "play" || this.state === "dead") {
      this.cbs.onProgress?.(sim.coins, Math.floor(sim.d));
    }
    this.renderer.render(this.world.scene, this.world.camera);
  };

  // swipe handling scoped to the container
  private onPointerDown = (e: PointerEvent) => {
    if (this.state !== "play") { this.input("up"); return; }
    this.pointerId = e.pointerId;
    this.sx = e.clientX;
    this.sy = e.clientY;
    try { this.container.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    const dx = e.clientX - this.sx;
    const dy = e.clientY - this.sy;
    const D = Math.max(24, Math.min(window.innerWidth, window.innerHeight) * 0.05);
    if (Math.abs(dx) < D && Math.abs(dy) < D) { this.action("up"); return; } // tap = jump
    if (Math.abs(dx) > Math.abs(dy)) this.action(dx > 0 ? "right" : "left");
    else this.action(dy > 0 ? "down" : "up");
  };
  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId === this.pointerId) this.pointerId = -1;
  };
}

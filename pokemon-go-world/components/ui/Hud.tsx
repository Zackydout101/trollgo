"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { distanceMeters, xpForLevel } from "@/lib/game";
import { spriteUrl } from "@/lib/models";
import { input, useGame, view } from "@/lib/store";
import { applyGpsFix, gpsMode } from "@/lib/useGameLoop";
import { capturePointer } from "@/lib/pointer";

export default function Hud() {
  return (
    <>
      <TopBar />
      <Joystick />
      <TrainerBadge />
      <MenuButton />
      <Nearby />
    </>
  );
}

function TopBar() {
  const geo = useGame((s) => s.geoStatus);
  const incenseUntil = useGame((s) => s.incenseUntil);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const incenseLeft = Math.max(0, Math.ceil((incenseUntil - Date.now()) / 1000));

  return (
    <div className="top-right">
      <Compass />
      <button
        className={`round-btn gps ${geo}`}
        title={geo === "gps" ? "Following your GPS location" : "Use my real GPS location"}
        onClick={() => {
          gpsMode.follow = true;
          if (!("geolocation" in navigator)) return;
          navigator.geolocation.getCurrentPosition(
            (p) => {
              applyGpsFix(p.coords, { force: true });
            },
            () => useGame.getState().flash("Location is unavailable. Walk with the joystick or WASD keys."),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
          );
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7L12 2Z" />
        </svg>
      </button>
      {incenseLeft > 0 && (
        <div className="incense-pill">
          Incense {Math.floor(incenseLeft / 60)}:{String(incenseLeft % 60).padStart(2, "0")}
        </div>
      )}
    </div>
  );
}

function Compass() {
  const needle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (needle.current) needle.current.style.transform = `rotate(${-view.bearing}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <button
      className="round-btn compass"
      title="Face north"
      onClick={() => window.dispatchEvent(new CustomEvent("pogo:north"))}
    >
      <div ref={needle} className="needle">
        <span className="n" />
        <span className="s" />
      </div>
    </button>
  );
}

function TrainerBadge() {
  const level = useGame((s) => s.save.trainer.level);
  const xp = useGame((s) => s.save.trainer.xp);
  const setScreen = useGame((s) => s.setScreen);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = Math.min(1, (xp - base) / (next - base));
  const C = 2 * Math.PI * 30;
  return (
    <button className="trainer-badge" onClick={() => setScreen("bag")} title="Trainer profile">
      <svg viewBox="0 0 68 68" className="xp-ring">
        <circle cx="34" cy="34" r="30" className="track" />
        <circle cx="34" cy="34" r="30" className="fill" strokeDasharray={`${C * pct} ${C}`} />
      </svg>
      <div className="trainer-face">
        <div className="cap" />
        <div className="face" />
      </div>
      <div className="lvl-tag">{level}</div>
    </button>
  );
}

function MenuButton() {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <button className="menu-ball" onClick={() => setScreen("menu")} aria-label="Main menu">
      <span className="mb-top" />
      <span className="mb-band" />
      <span className="mb-btn" />
    </button>
  );
}

function Nearby() {
  const spawns = useGame((s) => s.spawns);
  const pos = useGame((s) => s.pos);
  const [open, setOpen] = useState(false);
  const list = useMemo(
    () =>
      spawns
        .map((s) => ({ s, d: distanceMeters(s.pos, pos) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, open ? 9 : 3),
    [spawns, pos, open]
  );
  return (
    <button className={`nearby ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)}>
      <div className="nearby-title">Nearby</div>
      <div className="nearby-list">
        {list.map(({ s, d }) => (
          <div key={s.id} className="nearby-item">
            <img src={spriteUrl(s.pokemon.sprite)} alt={s.pokemon.name} draggable={false} />
            {open && <span>{Math.round(d)}m</span>}
          </div>
        ))}
        {list.length === 0 && <div className="nearby-empty">…</div>}
      </div>
    </button>
  );
}

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const pid = useRef<number | null>(null);
  const R = 46;

  const update = (cx: number, cy: number) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = cx - (rect.left + rect.width / 2);
    let dy = cy - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy, active: true });
    const m = Math.hypot(dx, dy) / R;
    if (m < 0.15) {
      input.x = 0;
      input.y = 0;
    } else {
      input.x = dx / R;
      input.y = -dy / R;
    }
  };
  const end = () => {
    pid.current = null;
    input.x = 0;
    input.y = 0;
    setKnob({ x: 0, y: 0, active: false });
  };

  return (
    <div
      ref={base}
      className={`joystick ${knob.active ? "active" : ""}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        pid.current = e.pointerId;
        capturePointer(e);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pid.current === e.pointerId) update(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

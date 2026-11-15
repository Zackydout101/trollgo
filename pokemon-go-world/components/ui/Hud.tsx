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
  const muted = useGame((s) => s.musicMuted);
  const toggleMusic = useGame((s) => s.toggleMusic);
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
        className={`round-btn music ${muted ? "muted" : ""}`}
        title={muted ? "Unmute music" : "Mute music"}
        aria-label={muted ? "Unmute music" : "Mute music"}
        aria-pressed={muted}
        onClick={toggleMusic}
      >
        {muted ? <SpeakerOff /> : <SpeakerOn />}
      </button>
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

function SpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.2 8.8a4.5 4.5 0 0 1 0 6.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.6 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 9.5 22 14.5M22 9.5 17 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
    <button className="trainer-badge" onClick={() => setScreen("bag")} title="SpongeBob" aria-label="SpongeBob">
      <svg viewBox="0 0 68 68" className="xp-ring">
        <circle cx="34" cy="34" r="30" className="track" />
        <circle cx="34" cy="34" r="30" className="fill" strokeDasharray={`${C * pct} ${C}`} />
      </svg>
      <div className="trainer-face">
        <SpongeBobEmoji />
      </div>
      <div className="lvl-tag">{level}</div>
    </button>
  );
}

function SpongeBobEmoji() {
  return (
    <svg viewBox="0 0 64 64" className="sb-emoji" aria-hidden>
      <rect x="8" y="44" width="48" height="16" rx="3" fill="#6b3a12" />
      <rect x="8" y="44" width="48" height="4" fill="#fff" />
      <path d="M32 44 l3.2 2.2 -3.2 7 -3.2-7 z" fill="#e23b3b" />
      <rect x="11" y="6" width="42" height="40" rx="9" fill="#ffe14a" />
      <circle cx="18" cy="16" r="1.3" fill="#c9a227" />
      <circle cx="46" cy="14" r="1.2" fill="#c9a227" />
      <circle cx="20" cy="38" r="1.15" fill="#c9a227" />
      <circle cx="45" cy="36" r="1.25" fill="#c9a227" />
      <ellipse cx="24" cy="22" rx="8" ry="9" fill="#fff" />
      <ellipse cx="40" cy="22" rx="8" ry="9" fill="#fff" />
      <circle cx="26" cy="23" r="3.1" fill="#3aa0ff" />
      <circle cx="42" cy="23" r="3.1" fill="#3aa0ff" />
      <circle cx="26.7" cy="23.2" r="1.45" fill="#1a1a1a" />
      <circle cx="42.7" cy="23.2" r="1.45" fill="#1a1a1a" />
      <path d="M17 15.5 15.2 11.5M24 14.2 V10.2M31 15.5 32.8 11.5" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32.2 15.5 30.4 11.5M40 14.2 V10.2M47 15.5 48.8 11.5" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 34 q8 8 16 0" fill="none" stroke="#1a1a1a" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="28.2" y="33.2" width="3.3" height="5.2" rx="0.6" fill="#fff" stroke="#1a1a1a" strokeWidth="0.7" />
      <rect x="32.5" y="33.2" width="3.3" height="5.2" rx="0.6" fill="#fff" stroke="#1a1a1a" strokeWidth="0.7" />
    </svg>
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

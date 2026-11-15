"use client";

import { useEffect, useRef, useState } from "react";
import { spriteUrl } from "@/lib/models";
import { TRAINING_PER_LEVEL, useGame } from "@/lib/store";
import type { CaughtMon } from "@/lib/types";

interface Reel {
  id: string;
  index: number;
  title: string;
  hue: number;
  videoUrl: string;
}

interface Tick {
  sessionId: string;
  monId: string;
  elapsedSec: number;
  points: number;
  pointsPerSec: number;
  nextRateIn: number;
  error?: string;
}

async function postSession(body: Record<string, string>): Promise<Tick> {
  const res = await fetch("/api/training/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Tick;
  if (!res.ok) throw new Error(data.error || "Training grounds are closed");
  return data;
}

async function fetchReels(): Promise<Reel[]> {
  const res = await fetch("/api/training/reels");
  const data = (await res.json()) as { reels?: Reel[] };
  return data.reels ?? [];
}

export default function TrainingGrounds() {
  const caught = useGame((s) => s.save.caught);
  const setScreen = useGame((s) => s.setScreen);
  const [monId, setMonId] = useState<string | null>(() => useGame.getState().trainMonId);
  const mon = caught.find((c) => c.id === monId) ?? null;

  return (
    <div className="panel train">
      {mon ? (
        <Session mon={mon} onBack={() => setMonId(null)} />
      ) : (
        <Picker caught={caught} onPick={setMonId} onClose={() => setScreen("map")} />
      )}
    </div>
  );
}

function Picker({
  caught,
  onPick,
  onClose,
}: {
  caught: CaughtMon[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [reels, setReels] = useState<Reel[]>([]);

  useEffect(() => {
    let cancel = false;
    fetchReels()
      .then((r) => {
        if (!cancel) setReels(r);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <>
      <div className="panel-head">
        <h2>Training Grounds</h2>
        <div className="panel-stats">
          Pick a Pokémon. {reels.length} brainrot reels play on loop, and staying longer earns points faster.
        </div>
      </div>
      {reels.length > 0 && (
        <div className="reel-strip">
          {reels.map((reel) => (
            <span key={reel.id}>🎬 {reel.title}</span>
          ))}
        </div>
      )}
      {caught.length === 0 ? (
        <p className="panel-empty">Catch a Pokémon first. Then bring it here to train.</p>
      ) : (
        <div className="mon-grid">
          {caught.map((c) => {
            const into = (c.trainingPoints ?? 0) % TRAINING_PER_LEVEL;
            return (
              <button className="mon-cell" key={c.id} onClick={() => onPick(c.id)}>
                <div className="mon-cp">
                  <small>Lv</small>
                  {c.level}
                </div>
                <img src={spriteUrl(c.sprite)} alt={c.name} draggable={false} />
                <div className="mon-name">{c.name}</div>
                <div className="train-sub">
                  {into}/{TRAINING_PER_LEVEL}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <button className="close-round" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </>
  );
}

/** One independently-cycling reel pane. Loops to the next video on end. */
function ReelLane({ reels, start, muted }: { reels: Reel[]; start: number; muted: boolean }) {
  const [cur, setCur] = useState(() => (reels.length ? start % reels.length : 0));
  const advance = () => setCur((c) => (reels.length ? (c + 1) % reels.length : 0));
  const reel = reels[cur];
  if (!reel) return <div className="reel-lane" />;
  return (
    <div className="reel-lane" style={{ background: `linear-gradient(160deg, hsl(${reel.hue} 70% 28%), #060608)` }}>
      <video
        key={reel.id}
        className="reel-lane-video"
        src={reel.videoUrl}
        autoPlay
        playsInline
        muted={muted}
        controls={false}
        onEnded={advance}
        onError={advance}
      />
      <span className="reel-lane-tag">{reel.title}</span>
    </div>
  );
}

function Session({ mon, onBack }: { mon: CaughtMon; onBack: () => void }) {
  const [tick, setTick] = useState<Tick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [reels, setReels] = useState<Reel[]>([]);
  const [lanes, setLanes] = useState(1);
  const sidRef = useRef<string | null>(null);
  const settled = useRef(false);

  // reels list (one per mp4)
  useEffect(() => {
    let cancel = false;
    fetchReels()
      .then((r) => {
        if (!cancel) setReels(r);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  // session: start, poll points, bank on unmount
  useEffect(() => {
    let cancel = false;
    const monId = mon.id;
    settled.current = false;
    sidRef.current = null;

    const claim = (sessionId: string) => {
      if (settled.current) return Promise.resolve();
      settled.current = true;
      return postSession({ action: "claim", sessionId })
        .then((snap) => {
          useGame.getState().grantTraining(monId, snap.points);
        })
        .catch(() => {});
    };

    postSession({ action: "start", monId })
      .then((started) => {
        sidRef.current = started.sessionId;
        if (cancel) {
          void claim(started.sessionId);
          return;
        }
        setTick(started);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "Couldn't open the grounds");
      });

    const poll = setInterval(() => {
      const sid = sidRef.current;
      if (!sid || cancel) return;
      postSession({ action: "tick", sessionId: sid })
        .then((next) => {
          if (!cancel) setTick(next);
        })
        .catch(() => {});
    }, 1000);

    return () => {
      cancel = true;
      clearInterval(poll);
      const sid = sidRef.current;
      if (sid) void claim(sid);
    };
  }, [mon.id]);

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    const sid = sidRef.current;
    if (sid && !settled.current) {
      settled.current = true;
      try {
        const snap = await postSession({ action: "claim", sessionId: sid });
        useGame.getState().grantTraining(mon.id, snap.points);
      } catch {
        /* session already closed */
      }
    }
    onBack();
  };

  const banked = mon.trainingPoints ?? 0;
  const live = tick?.points ?? 0;
  const total = banked + live;
  const toward = total % TRAINING_PER_LEVEL;
  const levelsReady = Math.floor(total / TRAINING_PER_LEVEL) - Math.floor(banked / TRAINING_PER_LEVEL);
  const maxLanes = Math.max(1, Math.min(4, reels.length || 1));
  const shown = Math.min(lanes, maxLanes);
  const cols = shown <= 1 ? 1 : 2;

  return (
    <div className="train-reel-full">
      <div className="reel-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {reels.length > 0 &&
          Array.from({ length: shown }, (_, i) => (
            <ReelLane key={i} reels={reels} start={i} muted={i > 0} />
          ))}
      </div>

      <div className="reel-top">
        <img src={spriteUrl(mon.sprite)} alt="" />
        <div className="reel-top-info">
          <b>{mon.name}</b>
          <span>
            Lv {mon.level} · CP {mon.cp}
          </span>
        </div>
        <div className="reel-lanes-ctrl">
          <button onClick={() => setLanes((n) => Math.max(1, n - 1))} disabled={shown <= 1} aria-label="Fewer reels">
            −
          </button>
          <span>{shown}</span>
          <button onClick={() => setLanes((n) => Math.min(maxLanes, n + 1))} disabled={shown >= maxLanes} aria-label="Add a reel">
            ＋
          </button>
        </div>
        <button className="pill-btn" onClick={leave} disabled={leaving}>
          {leaving ? "Saving…" : "Leave"}
        </button>
      </div>

      {error && <div className="reel-note">{error}</div>}
      {!error && reels.length === 0 && <div className="reel-note">Loading reels…</div>}

      <div className="reel-bottom">
        <div className="reel-caption">
          <span className="reel-badge">
            {shown === 1 ? "1 reel" : `${shown} reels`}
          </span>
          <b>Tap ＋ to stack more reels on screen</b>
        </div>

        {tick && (
          <>
            <div className="train-score dark">
              <div>
                <b>{formatStay(tick.elapsedSec)}</b>
                <span>stayed</span>
              </div>
              <div>
                <b>{tick.points}</b>
                <span>points</span>
              </div>
              <div>
                <b>{tick.pointsPerSec}/s</b>
                <span>faster in {tick.nextRateIn}s</span>
              </div>
            </div>
            <div className="train-bar">
              <i style={{ width: `${(toward / TRAINING_PER_LEVEL) * 100}%` }} />
            </div>
            <p className="reel-progress">
              {toward}/{TRAINING_PER_LEVEL} to the next level.
              {levelsReady > 0 ? ` ${levelsReady} level${levelsReady === 1 ? "" : "s"} ready when you leave.` : ""} Keep watching — each
              second is worth more.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function formatStay(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

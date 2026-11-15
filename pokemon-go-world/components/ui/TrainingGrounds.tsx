"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCritter } from "@/lib/critters";
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
  watched: number;
  points: number;
  nextVideoWorth: number;
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
  const allCaught = useGame((s) => s.save.caught);
  const caught = useMemo(() => allCaught.filter((c) => isCritter(c)), [allCaught]);
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
          Pick a Pokémon, then doom-scroll {reels.length} brainrot reels. Every reel you scroll to is worth more points than the
          last — the feed loops forever.
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

/** One full-screen reel in the vertical feed. Only the active page plays. */
function ReelPage({ reel, active, near, muted }: { reel: Reel; active: boolean; near: boolean; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active]);

  return (
    <div className="reel-page" style={{ background: `linear-gradient(160deg, hsl(${reel.hue} 70% 20%), #060608)` }}>
      <video
        ref={ref}
        className="reel-page-video"
        src={reel.videoUrl}
        loop
        playsInline
        muted={muted}
        controls={false}
        preload={near ? "auto" : "none"}
      />
    </div>
  );
}

function Session({ mon, onBack }: { mon: CaughtMon; onBack: () => void }) {
  const [tick, setTick] = useState<Tick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reels, setReels] = useState<Reel[]>([]);
  // How many pages exist in the (infinitely looping) feed, and which is on screen.
  const [pages, setPages] = useState(0);
  const [active, setActive] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const sidRef = useRef<string | null>(null);
  const settled = useRef(false);
  // Highest page index already counted as "watched", so scrolling back up is free.
  const seenMax = useRef(-1);

  // reels list (one per mp4); seed the looping feed once they load
  useEffect(() => {
    let cancel = false;
    fetchReels()
      .then((r) => {
        if (!cancel) {
          setReels(r);
          setPages(r.length ? r.length * 3 : 0);
        }
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  // session: start, bank on unmount
  useEffect(() => {
    let cancel = false;
    const monId = mon.id;
    settled.current = false;
    sidRef.current = null;
    seenMax.current = -1;

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

    return () => {
      cancel = true;
      const sid = sidRef.current;
      if (sid) void claim(sid);
    };
  }, [mon.id]);

  // Each new reel scrolled to (a new high-water page) banks another watch.
  const sessionId = tick?.sessionId;
  useEffect(() => {
    const sid = sessionId;
    if (!sid || reels.length === 0) return;
    if (active <= seenMax.current) return;
    const fresh = active - seenMax.current;
    seenMax.current = active;
    let last: Tick | null = null;
    const run = async () => {
      for (let i = 0; i < fresh; i++) {
        try {
          last = await postSession({ action: "watch", sessionId: sid });
        } catch {
          return;
        }
      }
      if (last) setTick(last);
    };
    void run();
  }, [active, reels.length, sessionId]);

  const goTo = useCallback((idx: number) => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTo({ top: Math.max(0, idx) * el.clientHeight, behavior: "smooth" });
  }, []);

  // Arrow keys / PageUp / PageDown flip reels (the map's key handler swallows native arrow scrolling).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goTo(active + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(active - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  // Track which page is on screen; keep the loop stocked with more pages below.
  const onScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el || el.clientHeight === 0) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    setActive((cur) => (idx === cur ? cur : idx));
    if (reels.length && idx >= pages - 2) setPages((p) => p + reels.length);
  }, [pages, reels.length]);

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

  return (
    <div className="train-reel-full">
      <div className="reel-feed" ref={feedRef} onScroll={onScroll}>
        {reels.length > 0 &&
          Array.from({ length: pages }, (_, p) => {
            const reel = reels[p % reels.length];
            return (
              <ReelPage key={p} reel={reel} active={p === active} near={Math.abs(p - active) <= 1} muted={muted} />
            );
          })}
      </div>

      {reels.length > 0 && (
        <div className="reel-nav">
          <button onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous reel">
            ▲
          </button>
          <button onClick={() => goTo(active + 1)} aria-label="Next reel">
            ▼
          </button>
        </div>
      )}

      <div className="reel-top">
        <img src={spriteUrl(mon.sprite)} alt="" />
        <div className="reel-top-info">
          <b>{mon.name}</b>
          <span>
            Lv {mon.level} · CP {mon.cp}
          </span>
        </div>
        <button className="reel-mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="pill-btn" onClick={leave} disabled={leaving}>
          {leaving ? "Saving…" : "Leave"}
        </button>
      </div>

      {error && <div className="reel-note">{error}</div>}
      {!error && reels.length === 0 && <div className="reel-note">Loading reels…</div>}

      <div className="reel-bottom">
        <div className="reel-caption">
          <span className="reel-badge">Reel {active + 1}</span>
          <b>🎬 {reels.length ? reels[active % reels.length].title : ""}</b>
        </div>

        {tick && (
          <>
            <div className="train-score dark">
              <div>
                <b>{tick.watched}</b>
                <span>reels watched</span>
              </div>
              <div>
                <b>{tick.points}</b>
                <span>points</span>
              </div>
              <div>
                <b>+{tick.nextVideoWorth}</b>
                <span>next scroll</span>
              </div>
            </div>
            <div className="train-bar">
              <i style={{ width: `${(toward / TRAINING_PER_LEVEL) * 100}%` }} />
            </div>
            <p className="reel-progress">
              {toward}/{TRAINING_PER_LEVEL} to the next level.
              {levelsReady > 0 ? ` ${levelsReady} level${levelsReady === 1 ? "" : "s"} ready when you leave.` : ""} Scroll, swipe, or
              press ▼ for the next reel — every one is worth more than the last.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

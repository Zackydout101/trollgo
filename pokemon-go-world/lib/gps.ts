import { distanceMeters } from "./game";
import type { LatLng } from "./types";

/** Readings vaguer than this are a cell/Wi-Fi guess, not a place to stand. */
export const GPS_MAX_ACCURACY = 80;
/** The recenter button may use a slightly fuzzier fix. */
export const GPS_FORCE_MAX_ACCURACY = 150;
/** Faster than this between ticks is a glitch, not travel. */
const MAX_SPEED = 40;
/** A single tick may never leap farther than this unless the player asked to recenter. */
const MAX_STEP = 120;
/** A far reading is only trusted after it repeats this many times. */
const CONFIRM_COUNT = 3;
const CONFIRM_RADIUS = 40;

export interface GpsSample {
  lat: number;
  lng: number;
  /** meters; 0 or missing means unknown */
  accuracy: number;
  at: number;
}

export interface GpsGate {
  last: GpsSample | null;
  /** A far reading we are waiting to see again before believing it. */
  pending: { sample: GpsSample; count: number } | null;
}

export const emptyGpsGate = (): GpsGate => ({ last: null, pending: null });

export interface GpsDecision {
  accept: boolean;
  /** Updated filter state. Always replace the previous gate with this. */
  gate: GpsGate;
  pos: LatLng;
  /** True when this is the first fix we are willing to trust. */
  first: boolean;
}

/**
 * Decide whether a GPS reading may move the player.
 * One wild jump is dropped. A new place is accepted only when it stays put.
 */
export function gateGpsFix(
  gate: GpsGate,
  sample: GpsSample,
  current: LatLng,
  opts?: { force?: boolean }
): GpsDecision {
  const force = opts?.force === true;
  const pos = { lat: sample.lat, lng: sample.lng };
  const reject = (next: GpsGate = gate): GpsDecision => ({
    accept: false,
    gate: next,
    pos,
    first: false,
  });

  if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lng)) return reject();
  if (Math.abs(sample.lat) > 90 || Math.abs(sample.lng) > 180) return reject();

  const accuracy = sample.accuracy > 0 ? sample.accuracy : Number.POSITIVE_INFINITY;
  const limit = force ? GPS_FORCE_MAX_ACCURACY : GPS_MAX_ACCURACY;
  if (accuracy > limit) return reject();

  const last = gate.last;
  const first = last == null;
  const d = distanceMeters(current, pos);
  if (first || force || d <= 8) {
    return { accept: true, gate: { last: sample, pending: null }, pos, first };
  }

  const dt = Math.max(1, (sample.at - last.at) / 1000);
  const plausible = d <= MAX_STEP && d / dt <= MAX_SPEED;
  if (plausible) {
    return { accept: true, gate: { last: sample, pending: null }, pos, first: false };
  }

  const pending = gate.pending;
  const same =
    pending != null && distanceMeters(pending.sample, pos) <= CONFIRM_RADIUS;
  const count = same ? pending.count + 1 : 1;
  if (count >= CONFIRM_COUNT) {
    return { accept: true, gate: { last: sample, pending: null }, pos, first: false };
  }
  return reject({ last, pending: { sample, count } });
}

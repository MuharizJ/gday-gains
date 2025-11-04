// backend/src/model/helpers.ts
import type { Inputs } from './types';

export const pct = (x: number) => x / 100;

/** Parse ISO (YYYY-MM-DD) and D/M/Y (or D-M-Y) into a UTC date. */
export function parseBirthdate(s: string): Date {
  if (!s) return new Date(NaN);

  // ISO: 1981-08-18
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const mIso = s.match(iso);
  if (mIso) {
    const y = +mIso[1], m = +mIso[2], d = +mIso[3];
    return new Date(Date.UTC(y, m - 1, d));
  }

  // D/M/Y or D-M-Y
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
  const mDmy = s.match(dmy);
  if (mDmy) {
    const d = +mDmy[1], m = +mDmy[2], y = +mDmy[3];
    return new Date(Date.UTC(y, m - 1, d));
  }

  const t = Date.parse(s);
  return new Date(isNaN(t) ? NaN : t);
}

export function getAge(birthdate: string): number {
  const dob = parseBirthdate(birthdate);
  if (isNaN(dob.getTime())) {
    throw new Error(`Invalid birthdate: "${birthdate}"`);
  }
  const now = new Date();
  const yNow = now.getUTCFullYear(), mNow = now.getUTCMonth(), dNow = now.getUTCDate();
  const yDob = dob.getUTCFullYear(), mDob = dob.getUTCMonth(), dDob = dob.getUTCDate();

  let age = yNow - yDob;
  if (mNow < mDob || (mNow === mDob && dNow < dDob)) age--;
  return age;
}

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal01(rng: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Lognormal transform: convert arithmetic mu/sigma + shock z to annual return */
export function annualReturn(mu: number, sigma: number, z: number) {
  const m = Math.log(1 + mu) - 0.5 * sigma * sigma;
  return Math.exp(m + sigma * z) - 1;
}

/** Linear percentile interpolation */
export function percentile(sorted: number[], p: number) {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

/** Z for common percentiles (normal approx) */
export function zOf(p: number) {
  if (Math.abs(p - 0.2) < 1e-6) return -0.841621233;
  if (Math.abs(p - 0.5) < 1e-6) return 0;
  if (Math.abs(p - 0.8) < 1e-6) return +0.841621233;
  return 0;
}

/** ROI clamp bands derived from long-run history (see engine notes) */
export const ROI_CLAMPS = {
  global: { min: -0.35, max: 0.35 },
  p20:    { min: -0.12, max: 0.18 },
  p50:    { min: -0.10, max: 0.25 },
  p80:    { min: -0.05, max: 0.35 },
} as const;

export type ScenarioBand = keyof typeof ROI_CLAMPS;

export const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(max, x));

/** Clamp a raw ROI according to scenario; falls back to global clamp */
export function clampROI(raw: number, scenario?: ScenarioBand) {
  const band = scenario ? ROI_CLAMPS[scenario] : ROI_CLAMPS.global;
  return clamp(raw, band.min, band.max);
}

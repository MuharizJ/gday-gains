// backend/src/model/helpers.ts
import type { Inputs } from './types';

export const pct = (x: number) => x / 100;

export function getAge(birthdate: string): number {
  const d = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
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

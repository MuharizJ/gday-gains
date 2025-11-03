// backend/src/model/montecarlo.ts
import type { Inputs, Results, AdviceTrack, AdviceRow, PolicyEvent } from './types';
import { getAge, percentile, zOf } from './helpers';
import { simulatePathCore, simulatePath, YearRow } from './path';
import { mulberry32, normal01 } from './helpers';

export function simulateMonteCarlo(inputs: Inputs, runs = 10000, seed = 1234): Results {
  const startAge = getAge(inputs.birthdate);
  const endAge   = Math.max(startAge, Math.round(inputs.lifeExpectancy));
  const ages = Array.from({ length: endAge - startAge + 1 }, (_, i) => startAge + i);
  const years = ages.length;

  // Per-age distributions (for percentiles)
  const perAgeCombined: number[][] = ages.map(() => []);

  // Draw one macro regime per run, then simulate with that tilt
  const regimeRng = mulberry32(seed * 97 + 7);

  for (let k = 0; k < runs; k++) {
    const regimeZ = normal01(regimeRng); // persistent macro bias for the run
    const rows = simulatePath(inputs, seed + k, false, { regimeZ });
    for (let i = 0; i < years; i++) {
      perAgeCombined[i].push(rows[i].endPortfolio + rows[i].endSuper);
    }
  }

  // Build graph series
  const graph = ages.map((age, idx) => {
    const arr = perAgeCombined[idx].slice().sort((a, b) => a - b);
    return {
      age,
      p20: Math.round(percentile(arr, 0.20)),
      p50: Math.round(percentile(arr, 0.50)),
      p80: Math.round(percentile(arr, 0.80)),
    };
  });

  const last = graph[graph.length - 1];
  const endAgeFinal = last.age;

  // Simple QA breakdown (derived directly from distributions)
  const startBal = perAgeCombined[0]?.[0] ?? 1;
  const breakdown = ages.map((age, idx) => {
    const arr = perAgeCombined[idx].slice().sort((a, b) => a - b);
    const yrs = Math.max(1, age - ages[0]);
    const imp = (end: number, start: number) => (Math.pow(Math.max(end, 1) / Math.max(start, 1), 1 / yrs) - 1) * 100;
    const p20 = percentile(arr, 0.20), p50 = percentile(arr, 0.50), p80 = percentile(arr, 0.80);
    return {
      age,
      ret20: +imp(p20, startBal).toFixed(2),
      ret50: +imp(p50, startBal).toFixed(2),
      ret80: +imp(p80, startBal).toFixed(2),
      bal20: Math.round(p20),
      bal50: Math.round(p50),
      bal80: Math.round(p80),
    };
  });

  // Advice tracks: use regime anchors so the multi-decade blend sits in the bucket
  const unlucky = simulatePathCore(inputs, { regimeZ: zOf(0.20), scenario: 'p20' });
  const median  = simulatePathCore(inputs, { regimeZ: zOf(0.50), scenario: 'p50' });
  const lucky   = simulatePathCore(inputs, { regimeZ: zOf(0.80), scenario: 'p80' });

  const SUPER_DRAW_AGE = (inputs as any).superMergeAge ?? 63;

  const buildAdvice = (rows: YearRow[]): AdviceRow[] =>
    rows.map(r => ({
      age: r.age,
      policy: r.policy,
      targetSpend: r.wantSpend, // yearly
      actualSpend: r.withdrawFromPortfolio + r.withdrawFromSuper, // yearly
      endBalance: r.endPortfolio + r.endSuper,
      endPortfolio: r.endPortfolio,
      endSuper: r.endSuper,
      rPortfolio: r.rPortfolio,
      rSuper: r.age < SUPER_DRAW_AGE ? r.rSuper : undefined,
    }));

  const adviceByPath: AdviceTrack = {
    p20: buildAdvice(unlucky.rows),
    p50: buildAdvice(median.rows),
    p80: buildAdvice(lucky.rows),
  };

  return {
    graph,
    atEnd: { p20: last.p20, p50: last.p50, p80: last.p80, endAge: endAgeFinal },
    breakdown,
    events: unlucky.events,
    advice: adviceByPath.p20,
    adviceByPath,
  };
}

export function simulateDeterministic(inputs: Inputs): { rows: YearRow[]; events: PolicyEvent[] } {
  // Mean-only path for QA/export use
  return simulatePathCore(inputs, { removeVol: true });
}

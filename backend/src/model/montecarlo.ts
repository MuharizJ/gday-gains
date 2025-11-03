// backend/src/model/montecarlo.ts
import type { Inputs, Results, AdviceTrack, AdviceRow, PolicyEvent } from './types';
import { getAge, percentile, zOf } from './helpers';
import { simulatePathCore, simulatePath, YearRow } from './path';
import { mulberry32, normal01 } from './helpers';

type RunSnap = {
  seed: number;
  regimeZ: number;
  combined: number[]; // endPortfolio + endSuper per age
};

export function simulateMonteCarlo(inputs: Inputs, runs = 10000, seed = 1234): Results {
  const startAge = getAge(inputs.birthdate);
  const endAge   = Math.max(startAge, Math.round(inputs.lifeExpectancy));
  const ages = Array.from({ length: endAge - startAge + 1 }, (_, i) => startAge + i);
  const years = ages.length;

  // Per-age distributions (for percentiles)
  const perAgeCombined: number[][] = ages.map(() => []);

  // Keep per-run vectors so we can pick a representative path later
  const snaps: RunSnap[] = [];

  // Draw one macro regime per run, then simulate with that tilt
  const regimeRng = mulberry32(seed * 97 + 7);

  for (let k = 0; k < runs; k++) {
    const regimeZ = normal01(regimeRng); // persistent macro bias for the run
    const rows = simulatePath(inputs, seed + k, false, { regimeZ });
    const combined: number[] = new Array(years);
    for (let i = 0; i < years; i++) {
      const c = rows[i].endPortfolio + rows[i].endSuper;
      perAgeCombined[i].push(c);
      combined[i] = c;
    }
    snaps.push({ seed: seed + k, regimeZ, combined });
  }

  // Build graph series (true MC percentiles)
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

  // Helper: choose the run that is closest to the percentile SERIES,
  // with a tie-breaker that prefers the correct side at the final age.
  const pickRun = (
    targetSeries: number[],
    side: 'le' | 'ge' | 'any'
  ): RunSnap => {
    let best: RunSnap = snaps[0];
    let bestErr = Number.POSITIVE_INFINITY;

    for (const s of snaps) {
      let err = 0;
      for (let i = 0; i < years; i++) {
        const d = s.combined[i] - targetSeries[i];
        err += d * d;
      }

      // Final-age side constraint penalty
      const dfinal = s.combined[years - 1] - targetSeries[years - 1];
      const violates =
        (side === 'le' && dfinal > 0) ||
        (side === 'ge' && dfinal < 0);
      if (violates) err *= 4; // heavy penalty if on the wrong side

      if (err < bestErr) {
        bestErr = err;
        best = s;
      }
    }
    return best;
  };

  const series20 = graph.map(g => g.p20);
  const series50 = graph.map(g => g.p50);
  const series80 = graph.map(g => g.p80);

  const r20 = pickRun(series20, 'le');
  const r50 = pickRun(series50, 'any');
  const r80 = pickRun(series80, 'ge');

  // Re-simulate those exact runs to extract rich advice rows + events
  const unlucky = simulatePathCore(inputs, { rngSeed: r20.seed, regimeZ: r20.regimeZ, scenario: 'p20' });
  const median  = simulatePathCore(inputs, { rngSeed: r50.seed, regimeZ: r50.regimeZ, scenario: 'p50' });
  const lucky   = simulatePathCore(inputs, { rngSeed: r80.seed, regimeZ: r80.regimeZ, scenario: 'p80' });

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

  // Cards: show the same representative path we used for the table,
  // so the numbers always match what the user sees below.
  const endOf = (rows: YearRow[]) => Math.round((rows[rows.length - 1].endPortfolio + rows[rows.length - 1].endSuper));

  return {
    graph,
    atEnd: {
      p20: endOf(unlucky.rows),
      p50: endOf(median.rows),
      p80: endOf(lucky.rows),
      endAge: endAgeFinal
    },
    breakdown: [],                 // optional: keep/elide your prior QA block
    events: unlucky.events,        // conservative markers
    advice: adviceByPath.p20,      // legacy field (kept)
    adviceByPath,
  };
}

export function simulateDeterministic(inputs: Inputs): { rows: YearRow[]; events: PolicyEvent[] } {
  // Mean-only path for QA/export use
  return simulatePathCore(inputs, { removeVol: true });
}

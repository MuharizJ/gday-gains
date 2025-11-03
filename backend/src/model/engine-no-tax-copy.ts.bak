// backend/src/model/engine.ts
import type {
  Inputs, Results, Guardrail, BlackSwanRecovery,
  PolicyEvent, AdviceRow, AdviceTrack
} from './types';

/* ===== helpers ===== */
const pct = (x: number) => x / 100;

/** TEMP: will become a UI input later */
const SUPER_DRAW_AGE = 63;

function getAge(birthdate: string): number {
  const d = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normal01(rng: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function annualReturn(mu: number, sigma: number, z: number) {
  const m = Math.log(1 + mu) - 0.5 * sigma * sigma;
  return Math.exp(m + sigma * z) - 1;
}

function percentile(sorted: number[], p: number) {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

/* ===== one-path rows ===== */
type YearRow = {
  age: number;
  beginPortfolio: number; beginSuper: number;
  irregular: number;
  contribPortfolio: number; contribSuper: number;
  wantSpend: number; floorSpend: number; allowedSpend: number;
  policy: 'normal' | 'cut' | 'floor';
  withdrawFromPortfolio: number; withdrawFromSuper: number;
  blackSwanDrop: number;
  rPortfolio: number; rSuper: number;
  endPortfolio: number; endSuper: number;
};
export type DeterministicTable = YearRow[];

type PolicyCfg = Guardrail & { enabled: boolean };
const defaultPolicy: PolicyCfg = { enabled: true, softYears: 30, hardYears: 20, cutPct: 20 };
const defaultRecovery: BlackSwanRecovery = { years: 3, muDragPct: 3, volMultiplier: 1.2 };

function extraShockHaircutPct(inputs: Inputs, age: number): number {
  const yrs = inputs.shockRecoveryYears ?? 0;
  const extra = inputs.shockExtraHaircutPct ?? 0;
  if (!inputs.blackSwanAge || yrs <= 0 || extra <= 0) return 0;
  const dist = age - Math.round(inputs.blackSwanAge);
  if (dist <= 0 || dist > yrs) return 0;
  const remainFrac = (yrs - dist) / yrs;
  return extra * remainFrac;
}

/** Guardrail decision based on drawable (pre-63 portfolio only; after 63 combined). */
function decideGuardrail(params: {
  want: number; floor: number; drawable: number; guard: PolicyCfg;
}): { allowed: number; policy: YearRow['policy'] } {
  const { want, floor, drawable, guard } = params;
  if (!guard.enabled) return { allowed: want, policy: 'normal' };

  const fundedYears = Math.max(0, drawable) / Math.max(1, want);
  if (fundedYears < guard.hardYears) {
    return { allowed: floor, policy: 'floor' };
  }
  if (fundedYears < guard.softYears) {
    const cut = Math.max(floor, want * (1 - pct(guard.cutPct)));
    return { allowed: cut, policy: 'cut' };
  }
  return { allowed: want, policy: 'normal' };
}

function simulatePathCore(
  inputs: Inputs,
  opts: { rngSeed?: number; zFixed?: number; removeVol?: boolean } = {}
): { rows: YearRow[]; events: PolicyEvent[] } {

  const startAge = getAge(inputs.birthdate);
  const endAge = Math.max(startAge, Math.round(inputs.lifeExpectancy));
  const retAge = Math.round(inputs.retirementAge);

  const guard: PolicyCfg = {
    ...defaultPolicy,
    ...(inputs.guardrail ? { enabled: true, ...inputs.guardrail } : {})
  };

  // irregulars per bucket
  const irregP = new Map<number, number>();
  const irregS = new Map<number, number>();
  for (const r of inputs.specialContributions || []) {
    const bucket = r.bucket === 'super' ? 'super' : 'portfolio';
    const map = bucket === 'super' ? irregS : irregP;
    map.set(r.age, (map.get(r.age) || 0) + (r.amount || 0));
  }

  const muP0 = pct(inputs.portfolioExpectedReturn);
  const muS0 = pct(inputs.superBlendedReturn);
  const sd0  = pct(inputs.portfolioSD);

  const muPHaircut = pct(inputs.portfolioRecalibrationPercent);
  const muSHaircut = pct(inputs.superRecalibrationPercent);

  const infl = pct(inputs.inflation);
  const want0  = inputs.livingExpenses * 12;
  const floor0 = inputs.floorWithdrawal * 12;

  const c0P = inputs.monthlyContribution * 12;
  const c0S = inputs.monthlySuperContribution * 12;
  const gP = pct(inputs.contributionGrowth);
  const gS = pct(inputs.superGrowth);

  let balP = Math.max(0, inputs.portfolioBalance);
  let balS = Math.max(0, inputs.superBalance);

  const rng = opts.rngSeed != null ? mulberry32(opts.rngSeed) : Math.random;

  const rows: YearRow[] = [];
  const events: PolicyEvent[] = [];

  let shockYear = Number.POSITIVE_INFINITY;
  const swanAge  = Math.round(inputs.blackSwanAge ?? -1);
  const swanDrop = pct(inputs.blackSwanDropPct || 0);
  const superShockMul = Math.max(0, inputs.blackSwanSuperMultiplier ?? 0.6);

  /** Merge happens once. */
  let mergedSuper = false;

  for (let age = startAge; age <= endAge; age++) {
    const beginP = balP, beginS = balS;

    // irregulars upfront
    const irrP = irregP.get(age) || 0;
    const irrS = irregS.get(age) || 0;
    const irr = irrP + irrS;
    balP += irrP; balS += irrS;

    // contributions
    const allowPostRet = inputs.contributeAfterRetirement ?? false;
    const activeContrib = age < retAge || allowPostRet;
    const yrsFromStart = age - startAge;

    const cP = activeContrib ? c0P * Math.pow(1 + gP, Math.max(0, yrsFromStart)) : 0;
    const cS = activeContrib ? c0S * Math.pow(1 + gS, Math.max(0, yrsFromStart)) : 0;
    balP += cP; balS += cS;

    // merge super at SUPER_DRAW_AGE
    if (!mergedSuper && age >= SUPER_DRAW_AGE) {
      balP += balS; balS = 0; mergedSuper = true;
    }

    // black swan (before growth)
    let swanAmt = 0;
    if (swanDrop > 0 && age === swanAge) {
      const dropP = balP * swanDrop;
      const dropS = balS * swanDrop * superShockMul;
      swanAmt = dropP + dropS;
      balP -= dropP; balS -= dropS;
      shockYear = age;
      events.push({ age, type: 'black-swan' });
    }

    // withdrawals (post-ret)
    let policy: YearRow['policy'] = 'normal';
    let want = 0, floor = 0, allowed = 0;
    let wP = 0, wS = 0;

    if (age >= retAge) {
      const yrsFromRet = age - retAge;
      want  = want0  * Math.pow(1 + infl, Math.max(0, yrsFromRet));
      floor = floor0 * Math.pow(1 + infl, Math.max(0, yrsFromRet));

      const drawable = balP + (mergedSuper ? balS : 0); // after merge, super is 0
      const g = decideGuardrail({ want, floor, drawable, guard });
      allowed = g.allowed;
      policy  = g.policy;

      if (policy === 'floor') events.push({ age, type: 'floor' });
      else if (policy === 'cut') events.push({ age, type: 'cut' });

      let remaining = Math.max(0, Math.min(allowed, drawable));

      const drawP = Math.min(balP, remaining); balP -= drawP; wP = drawP; remaining -= drawP;
      if (remaining > 0 && !mergedSuper) { const drawS = Math.min(balS, remaining); balS -= drawS; wS = drawS; remaining -= drawS; }
    }

    // returns
    let muP = muP0 - (age >= inputs.portfolioRecalibrationAge ? muPHaircut : 0);
    let muS = muS0 - (age >= inputs.superRecalibrationAge ? muSHaircut : 0);
    let sd  = sd0;

    const extraCut = (extraShockHaircutPct(inputs, age) / 100);
    if (extraCut > 0) { muP -= extraCut; muS -= extraCut; }

    if (age > shockYear && age <= shockYear + defaultRecovery.years) {
      muP = Math.max(-0.99, muP - pct(defaultRecovery.muDragPct));
      muS = Math.max(-0.99, muS - pct(defaultRecovery.muDragPct));
      sd  = sd0 * (defaultRecovery.volMultiplier ?? 1.0);
    }

    const z = opts.removeVol ? 0 : normal01(rng);
    const rP = annualReturn(muP, sd, z);
    const rS = annualReturn(muS, sd, z);

    balP *= (1 + rP);
    balS *= (1 + rS);

    rows.push({
      age,
      beginPortfolio: beginP, beginSuper: beginS,
      irregular: irr,
      contribPortfolio: cP, contribSuper: cS,
      wantSpend: want,
      floorSpend: floor,
      allowedSpend: allowed,
      policy,
      withdrawFromPortfolio: wP, withdrawFromSuper: wS,
      blackSwanDrop: swanAmt,
      rPortfolio: rP, rSuper: rS,
      endPortfolio: balP, endSuper: balS,
    });
  }

  return { rows, events };
}

/* public single-path used elsewhere */
export function simulatePath(inputs: Inputs, rngSeed?: number, removeVolOverride?: boolean) {
  const { rows } = simulatePathCore(inputs, { rngSeed, removeVol: !!removeVolOverride });
  return rows;
}

/* ===== Monte Carlo with quantile-matching advice paths ===== */
export function simulateMonteCarlo(inputs: Inputs, runs = 10000, seed = 1234): Results {
  const startAge = getAge(inputs.birthdate);
  const endAge   = Math.max(startAge, Math.round(inputs.lifeExpectancy));
  const ages = Array.from({ length: endAge - startAge + 1 }, (_, i) => startAge + i);

  const perAge: number[][] = ages.map(() => []);
  const rng = mulberry32(seed);

  // Keep a subset of realized paths so we can pick a representative for the table.
  const sampleCap = Math.min(runs, 2048);
  const sampleRows: YearRow[][] = [];

  for (let k = 0; k < runs; k++) {
    const { rows } = simulatePathCore(inputs, { rngSeed: rng() * 1e9 });
    rows.forEach((row, i) => perAge[i].push(row.endPortfolio + row.endSuper));
    if (k < sampleCap) sampleRows.push(rows);
  }

  const graph = ages.map((age, idx) => {
    const arr = perAge[idx].sort((a, b) => a - b);
    return {
      age,
      p20: Math.round(percentile(arr, 0.20)),
      p50: Math.round(percentile(arr, 0.50)),
      p80: Math.round(percentile(arr, 0.80)),
    };
  });

  const last = graph[graph.length - 1];
  const endAgeFinal = last.age;

  // checkpoints (unchanged)
  const lookup = new Map(graph.map(g => [g.age, g]));
  const startBal = perAge[0][0];
  const checkpoints = [inputs.retirementAge, inputs.retirementAge + 5, inputs.retirementAge + 10, endAgeFinal]
    .filter(a => a >= ages[0] && a <= endAgeFinal);
  const breakdown = checkpoints.map(age => {
    const g = lookup.get(age)!;
    const yrs = Math.max(1, age - ages[0]);
    const imp = (end: number, start: number) => (Math.pow(end / Math.max(1, start), 1 / yrs) - 1) * 100;
    return {
      age,
      ret20: +imp(g.p20, startBal).toFixed(2),
      ret50: +imp(g.p50, startBal).toFixed(2),
      ret80: +imp(g.p80, startBal).toFixed(2),
      bal20: g.p20, bal50: g.p50, bal80: g.p80
    };
  });

  // Build quantile curves for matching
  const curve = new Map<number, { p20: number; p50: number; p80: number }>();
  graph.forEach(g => curve.set(g.age, { p20: g.p20, p50: g.p50, p80: g.p80 }));

  const rmse = (rows: YearRow[], key: 'p20' | 'p50' | 'p80') => {
    let se = 0, n = 0;
    for (const r of rows) {
      const q = curve.get(r.age)![key];
      const a = Math.max(1, r.endPortfolio + r.endSuper);
      const b = Math.max(1, q);
      const d = Math.log(a) - Math.log(b);
      se += d * d; n++;
    }
    return Math.sqrt(se / Math.max(1, n));
  };

  const pickRep = (key: 'p20' | 'p50' | 'p80') =>
    sampleRows.reduce((best, rows) => {
      const e = rmse(rows, key);
      return (!best || e < best.err) ? { rows, err: e } : best;
    }, null as null | { rows: YearRow[]; err: number })!.rows;

  const unlucky = pickRep('p20');
  const median  = pickRep('p50');
  const lucky   = pickRep('p80');

  const toAdvice = (rows: YearRow[]): AdviceRow[] =>
    rows.map(r => {
      // At/after merge, super is 0; before merge drawable=endPortfolio
      const merged = r.beginSuper === 0 && r.withdrawFromSuper === 0 && r.endSuper === 0;
      const drawableEnd = merged ? r.endPortfolio + r.endSuper : r.endPortfolio;
      const superEnd    = merged ? 0 : r.endSuper;
      return {
        age: r.age,
        policy: r.policy,
        targetSpend: r.wantSpend,
        actualSpend: r.withdrawFromPortfolio + r.withdrawFromSuper,
        endBalance: r.endPortfolio + r.endSuper,
        drawableEndBalance: drawableEnd,
        superEndBalance: superEnd,
      };
    });

  const adviceByPath: AdviceTrack = {
    p20: toAdvice(unlucky),
    p50: toAdvice(median),
    p80: toAdvice(lucky),
  };

  // For markers on the post-ret chart, use the p20 rep path (conservative)
  const events: PolicyEvent[] = [];
  // Build events by re-scanning unlucky rows for policy transitions
  for (const r of unlucky) {
    if (r.policy === 'floor') events.push({ age: r.age, type: 'floor' });
    else if (r.policy === 'cut') events.push({ age: r.age, type: 'cut' });
  }

  return {
    graph,
    atEnd: { p20: last.p20, p50: last.p50, p80: last.p80, endAge: endAgeFinal },
    breakdown,
    events,
    advice: adviceByPath.p20,   // legacy (kept)
    adviceByPath,
  };
}

/* deterministic table */
export function simulateDeterministic(inputs: Inputs): DeterministicTable {
  return simulatePath({ ...inputs, removeVolatility: true }, 42, true);
}

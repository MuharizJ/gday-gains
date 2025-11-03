// backend/src/model/engine.ts
import type {
  Inputs, Results, Guardrail, BlackSwanRecovery,
  PolicyEvent, AdviceRow, AdviceTrack
} from './types';

/* ============ helpers ============ */
const pct = (x: number) => x / 100;

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

/* fixed z for representative paths */
function zOf(p: number) {
  if (Math.abs(p - 0.2) < 1e-6) return -0.841621233;
  if (Math.abs(p - 0.5) < 1e-6) return 0;
  if (Math.abs(p - 0.8) < 1e-6) return +0.841621233;
  return 0;
}

/* ============ one-path rows ============ */
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

function simulatePathCore(
  inputs: Inputs,
  opts: { rngSeed?: number; zFixed?: number; removeVol?: boolean } = {}
): { rows: YearRow[]; events: PolicyEvent[] } {

  // Widen locally so we can read optional fields without changing types.ts
  const ex = inputs as Inputs & { guardrail?: Guardrail; livingExpenses?: number };

  const startAge = getAge(inputs.birthdate);
  const endAge = Math.max(startAge, Math.round(inputs.lifeExpectancy));
  const retAge = Math.round(inputs.retirementAge);

  const guard: PolicyCfg = {
    ...defaultPolicy,
    ...(ex.guardrail ? { enabled: true, ...ex.guardrail } : {})
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

  // If livingExpenses (monthly) isn't provided, fall back to floorWithdrawal (monthly)
  const want0  = (ex.livingExpenses ?? inputs.floorWithdrawal) * 12; // annual baseline
  const floor0 = inputs.floorWithdrawal * 12;                        // annual baseline

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
  const swanAge: number = inputs.blackSwanAge == null ? Number.NaN : Math.round(inputs.blackSwanAge);
  const swanDrop = pct(inputs.blackSwanDropPct || 0);

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

    // shock before growth
    let swanAmt = 0;
    if (swanDrop > 0 && age === swanAge) {
      const dropAmt = (balP + balS) * swanDrop;
      swanAmt = dropAmt;
      const tot = balP + balS || 1;
      balP -= dropAmt * (balP / tot);
      balS -= dropAmt * (balS / tot);
      shockYear = age;
      events.push({ age, type: 'black-swan' });
    }

    // spending / withdrawals
    let policy: YearRow['policy'] = 'normal';
    let want = 0, floor = 0, allowed = 0;
    let wP = 0, wS = 0;

    if (age >= retAge) {
      const yrsFromRet = age - retAge;
      want  = want0  * Math.pow(1 + infl, Math.max(0, yrsFromRet));
      floor = floor0 * Math.pow(1 + infl, Math.max(0, yrsFromRet));

      const fundedYears = (balP + balS) / Math.max(1, want);
      allowed = want; // default: target (desired) spend

      if (guard.enabled) {
        if (fundedYears < guard.hardYears) {
          allowed = floor;
          policy = 'floor';
          events.push({ age, type: 'floor' });
        } else if (fundedYears < guard.softYears) {
          allowed = Math.max(floor, want * (1 - pct(guard.cutPct)));
          policy = 'cut';
          events.push({ age, type: 'cut' });
        }
      }

      let remaining = allowed;
      const drawP = Math.min(balP, remaining); balP -= drawP; wP = drawP; remaining -= drawP;
      if (remaining > 0) { const drawS = Math.min(balS, remaining); balS -= drawS; wS = drawS; remaining -= drawS; }
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

    const z = opts.removeVol ? 0 : (opts.zFixed ?? normal01(rng));
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

/* ============ Monte Carlo ============ */
export function simulateMonteCarlo(inputs: Inputs, runs = 10000, seed = 1234): Results {
  const startAge = getAge(inputs.birthdate);
  const endAge   = Math.max(startAge, Math.round(inputs.lifeExpectancy));
  const ages = Array.from({ length: endAge - startAge + 1 }, (_, i) => startAge + i);

  const perAge: number[][] = ages.map(() => []);
  for (let k = 0; k < runs; k++) {
    const rows = simulatePath(inputs, seed + k);
    rows.forEach((row, i) => perAge[i].push(row.endPortfolio + row.endSuper));
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

  // simple checkpoint
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

  /* --- Advice/markers per path --- */
  const unlucky = simulatePathCore(inputs, { zFixed: zOf(0.20) }); // p20 track
  const median  = simulatePathCore(inputs, { zFixed: zOf(0.50) }); // p50 track
  const lucky   = simulatePathCore(inputs, { zFixed: zOf(0.80) }); // p80 track

  const buildAdvice = (rows: YearRow[]): AdviceRow[] =>
    rows.map(r => ({
      age: r.age,
      policy: r.policy,
      targetSpend: r.wantSpend, // yearly
      actualSpend: r.withdrawFromPortfolio + r.withdrawFromSuper, // yearly
      endBalance: r.endPortfolio + r.endSuper, // legacy
      // Expose richer fields for UI
      endPortfolio: r.endPortfolio,
      endSuper: r.endSuper,
      rPortfolio: r.rPortfolio,   // decimal (e.g., 0.12)
      rSuper: r.rSuper,           // decimal
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
    events: unlucky.events,        // markers from unlucky path (most conservative)
    advice: adviceByPath.p20,      // legacy field (kept)
    adviceByPath,
  };
}

/* deterministic table */
export function simulateDeterministic(inputs: Inputs): DeterministicTable {
  return simulatePath({ ...inputs, removeVolatility: true }, 42, true);
}

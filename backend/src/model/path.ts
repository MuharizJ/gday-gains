// backend/src/model/path.ts
import type { Inputs, PolicyEvent, Guardrail, BlackSwanRecovery } from './types';
import {
  pct, getAge, normal01, mulberry32, annualReturn,
  clampROI, ScenarioBand
} from './helpers';

export type YearRow = {
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

type PolicyCfg = Guardrail & { enabled: boolean };
const defaultPolicy: PolicyCfg = { enabled: true, softYears: 30, hardYears: 20, cutPct: 20 };

const defaultRecovery: BlackSwanRecovery & { volMultiplier?: number } = {
  years: 3,
  muDragPct: 3,
  volMultiplier: 1.2,
};

/** Optional extra haircut (tapers linearly during recovery window) */
export function extraShockHaircutPct(inputs: Inputs, age: number): number {
  const yrs = (inputs as any).shockRecoveryYears ?? 0;
  const extra = (inputs as any).shockExtraHaircutPct ?? 0;
  if (!(inputs as any).blackSwanAge || yrs <= 0 || extra <= 0) return 0;
  const dist = age - Math.round((inputs as any).blackSwanAge);
  if (dist <= 0 || dist > yrs) return 0;
  const remainFrac = (yrs - dist) / yrs;
  return extra * remainFrac;
}

type CoreOpts = {
  rngSeed?: number;
  zFixed?: number;          // legacy (unused now)
  removeVol?: boolean;
  scenario?: ScenarioBand;  // p20/p50/p80 for advice tracks (for ROI clamps)
  regimeZ?: number;         // persistent macro tilt for the whole run
  regimeWeight?: number;    // 0..1, default 0.6
};

export function simulatePathCore(
  inputs: Inputs,
  opts: CoreOpts = {}
): { rows: YearRow[]; events: PolicyEvent[] } {
  // widen locally to read optional or legacy fields
  const ex = inputs as Inputs & {
    guardrail?: Guardrail;
    livingExpenses?: number;
    superSD?: number;
  };

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
  for (const r of (inputs as any).specialContributions || []) {
    const bucket = (r as any).bucket === 'super' ? 'super' : 'portfolio';
    const map = bucket === 'super' ? irregS : irregP;
    map.set(r.age, (map.get(r.age) || 0) + (r.amount || 0));
  }

  // Return/vol params
  const muP0 = pct((inputs as any).portfolioExpectedReturn ?? 12);
  const muS0 = pct((inputs as any).superBlendedReturn ?? 10);
  const sdP  = pct((inputs as any).portfolioSD ?? 15);
  const sdS  = pct(ex.superSD ?? (inputs as any).portfolioSD ?? 12);

  // Correlation (0..100 slider)
  const rho = Math.max(-0.99, Math.min(0.99, pct((inputs as any).correlation ?? 0)));

  const infl = pct((inputs as any).inflation ?? 3);

  // Spending (monthly → yearly), start indexing from retirement age ONLY
  const livingMo = ex.livingExpenses ?? (inputs as any).retiredMonthlySpend ?? 17500;
  const wantSpendStartYr = livingMo * 12;
  const floorMo = (inputs as any).floorWithdrawal ?? 10000;
  const floorStartYr = floorMo * 12;

  // Contribution growth
  const contribGrowth = pct((inputs as any).contributionGrowth ?? 0);
  const superGrowth   = pct((inputs as any).superGrowth ?? 0);

  // Post-ret haircut support
  const portHaircutPct = (inputs as any).portfolioPostRetHaircutPct ?? (inputs as any).portfolioRecalibrationPercent ?? 0;
  const portHaircutAge = (inputs as any).portfolioHaircutAge ?? (inputs as any).portfolioRecalibrationAge ?? retAge;
  const superHaircutPct = (inputs as any).superPostRetHaircutPct ?? (inputs as any).superRecalibrationPercent ?? 0;
  const superHaircutAge = (inputs as any).superHaircutAge ?? (inputs as any).superRecalibrationAge ?? retAge;

  // Black swan config
  const swanAge = Math.round(((inputs as any).blackSwanAge ?? -1));
  const swanPct = pct(((inputs as any).blackSwanDropPct ?? 0));
  const superImpactMult = (process.env.BLACK_SWAN_SUPER_MULTIPLIER
    ? Number(process.env.BLACK_SWAN_SUPER_MULTIPLIER)
    : 0.6);

  const rng = mulberry32(opts.rngSeed ?? 42);

  let balP = (inputs as any).portfolioBalance ?? 0;
  let balS = (inputs as any).superBalance ?? 0;

  const rows: YearRow[] = [];
  const events: PolicyEvent[] = [];

  let contribPyr = ((inputs as any).monthlyContribution ?? 0) * 12;
  let contribSyr = ((inputs as any).monthlySuperContribution ?? 0) * 12;

  // spend targets that begin at retirement and index thereafter
  let wantSpendYr = 0;
  let floorYr = 0;

  const SUPER_DRAW_AGE = ((inputs as any).superMergeAge ?? 63);

  // --- Macro regime (persistent tilt per run) ---
  const alpha = Math.max(0, Math.min(1, opts.regimeWeight ?? 0.6)); // persistence
  const regimeZ = typeof opts.regimeZ === 'number' ? opts.regimeZ : (opts.removeVol ? 0 : normal01(rng));

  for (let age = startAge; age <= endAge; age++) {
    const beginP = balP;
    const beginS = balS;

    // Start or index spending from retirement age
    if (age === retAge) {
      wantSpendYr = wantSpendStartYr;
      floorYr = floorStartYr;
    } else if (age > retAge) {
      wantSpendYr *= (1 + infl);
      floorYr *= (1 + infl);
    }

    const irrP = irregP.get(age) ?? 0;
    const irrS = irregS.get(age) ?? 0;
    const irr = irrP + irrS;

    balP += irrP;
    balS += irrS;

    const isRetired = age >= retAge;
    const canDrawSuper = age >= SUPER_DRAW_AGE;

    // Contributions
    let cP = 0, cS = 0;
    if (!isRetired || !!(inputs as any).contributeAfterRetirement) {
      cP = contribPyr;
      cS = contribSyr;
      balP += cP;
      balS += cS;
      contribPyr *= (1 + contribGrowth);
      contribSyr *= (1 + superGrowth);
    }

    const want = isRetired ? wantSpendYr : 0;
    const floor = isRetired ? floorYr : 0;

    // Guardrails
    let allowed = 0;
    let policy: 'normal' | 'cut' | 'floor' = 'normal';

    if (isRetired) {
      const drawable = canDrawSuper ? balP + balS : balP;
      const fundedYears = want > 0 ? drawable / want : Infinity;

      if (guard.enabled) {
        if (fundedYears < guard.hardYears) {
          policy = 'floor';
          allowed = floor;
          events.push({ age, type: 'floor' });
        } else if (fundedYears < guard.softYears) {
          policy = 'cut';
          allowed = want * (1 - pct(guard.cutPct));
          events.push({ age, type: 'cut' });
        } else {
          allowed = want;
        }
      } else {
        allowed = want;
      }

      // cap by drawable (portfolio pre-merge; combined post-merge)
      allowed = Math.max(0, Math.min(allowed, canDrawSuper ? balP + balS : balP));
    }

    // Withdrawals (portfolio-first after merge)
    let wP = 0, wS = 0;
    if (isRetired && allowed > 0) {
      if (canDrawSuper) {
        const takeP = Math.min(allowed, balP);
        wP = takeP;
        const remain = allowed - takeP;
        wS = Math.min(remain, balS);
      } else {
        wP = Math.min(allowed, balP);
      }
      balP -= wP;
      balS -= wS;
    }

    // Black swan drop BEFORE returns
    let swanAmt = 0;
    if (swanAge === age && swanPct > 0) {
      const dropP = balP * swanPct;
      const dropS = balS * (swanPct * superImpactMult);
      balP -= dropP;
      balS -= dropS;
      swanAmt = -(dropP + dropS);
      events.push({ age, type: 'black-swan' });
    }

    // Mean returns with haircuts and recovery drag
    const extraHair = pct(extraShockHaircutPct(inputs, age));
    let muP = muP0 - extraHair;
    let muS = muS0 - extraHair;

    if (age >= portHaircutAge) muP = Math.max(-0.99, muP - pct(portHaircutPct));
    if (age >= superHaircutAge) muS = Math.max(-0.99, muS - pct(superHaircutPct));

    if (swanAge > 0 && age > swanAge && age <= swanAge + (defaultRecovery.years ?? 0)) {
      muP = Math.max(-0.99, muP - pct(defaultRecovery.muDragPct));
      muS = Math.max(-0.99, muS - pct(defaultRecovery.muDragPct));
    }

    // --- Build correlated, regime-tilted shocks ---
    const eps1 = opts.removeVol ? 0 : normal01(rng);
    const eps2 = opts.removeVol ? 0 : normal01(rng);
    const baseZP = alpha * regimeZ + Math.sqrt(1 - alpha * alpha) * eps1;
    const baseZS = alpha * regimeZ + Math.sqrt(1 - alpha * alpha) * eps2;
    const zP = baseZP;
    const zS = rho * baseZP + Math.sqrt(1 - rho * rho) * baseZS;

    // Raw returns then clamp to historically sane bands (scenario-aware for advice)
    const rP = clampROI(annualReturn(muP, sdP, zP), opts.scenario);
    const rS = clampROI(annualReturn(muS, sdS, zS), opts.scenario);

    balP *= (1 + rP);
    balS *= (1 + rS);

    // No negative balances
    balP = Math.max(0, balP);
    balS = Math.max(0, balS);

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

// Backwards-compatible wrapper used by Monte Carlo
export function simulatePath(
  inputs: Inputs,
  rngSeed?: number,
  removeVolOverride?: boolean,
  extra?: { regimeZ?: number; regimeWeight?: number }
) {
  const { rows } = simulatePathCore(inputs, {
    rngSeed,
    removeVol: !!removeVolOverride,
    regimeZ: extra?.regimeZ,
    regimeWeight: extra?.regimeWeight,
  });
  return rows;
}

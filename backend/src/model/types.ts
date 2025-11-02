/* Basic shared model types for the simulator */

export type Bucket = 'portfolio' | 'super';

export type SpecialContribution = {
  age: number;
  amount: number;
  bucket?: Bucket;            // default: 'portfolio'
  description?: string;
};

export type Guardrail = {
  /** When liquid years-of-funding falls below this, we apply a soft cut */
  softYears: number;          // e.g., 30  => ~3.33% WR
  /** When liquid years-of-funding falls below this, clamp to floor */
  hardYears: number;          // e.g., 20  => ~5.00% WR
  /** Size of the soft cut (percent of the target spend to cut) */
  cutPct: number;             // e.g., 20
};

export type BlackSwanRecovery = {
  years: number;
  muDragPct: number;          // extra expected-return drag during recovery
  volMultiplier: number;      // extra volatility during recovery
};

export type PolicyEvent = {
  age: number;
  type: 'black-swan' | 'cut' | 'floor';
};

export type AdviceDetail = {
  /** Yearly numbers (not monthly) */
  want: number;
  floor: number;
  allowed: number;

  /** Split of actual spend by bucket */
  fromPortfolio: number;
  fromSuper: number;

  /** Diagnostics */
  fundedYears: number;      // (drawable at begin) / want
  wrWanted: number;         // want / drawable
  wrAllowed: number;        // allowed / drawable
  reason: string;

  /** Balances */
  beginPortfolio: number;
  beginSuper: number;
  endPortfolio: number;
  endSuper: number;

  /** For table view */
  endDrawableBalance: number; // what the customer can draw from after this year
};

export type AdviceRow = {
  age: number;
  policy: 'normal' | 'cut' | 'floor';
  /** Desired plan (yearly) */
  targetSpend: number;
  /** Actual withdrawals executed (yearly) */
  actualSpend: number;
  /** Total end-of-year wealth (portfolio + super) */
  endBalance: number;

  /** Table balances */
  drawableEndBalance: number; // equals endPortfolio pre-63; equals combined at/after 63
  superEndBalance: number;    // equals endSuper pre-63; 0 at/after 63

  /** Optional rich details for UI (safe to ignore) */
  detail?: AdviceDetail;
};

export type AdviceTrack = {
  p20: AdviceRow[];
  p50: AdviceRow[];
  p80: AdviceRow[];
};

export type Results = {
  graph: { age: number; p20: number; p50: number; p80: number }[];
  atEnd: { p20: number; p50: number; p80: number; endAge: number };
  breakdown: {
    age: number;
    ret20: number; ret50: number; ret80: number;
    bal20: number; bal50: number; bal80: number;
  }[];
  /** Markers derived from the unlucky path */
  events?: PolicyEvent[];
  /** Legacy single track (kept for backward compat) */
  advice?: AdviceRow[];
  /** New advice: one track per percentile */
  adviceByPath: AdviceTrack;
};

export type Inputs = {
  /* Person */
  birthdate: string;
  retirementAge: number;
  lifeExpectancy: number;

  /* Spending (monthly in UI) */
  livingExpenses: number;         // target $/mo
  floorWithdrawal: number;        // floor $/mo
  inflation: number;              // %/yr

  /* Portfolio (taxable) */
  portfolioBalance: number;
  monthlyContribution: number;
  contributionGrowth: number;     // %/yr
  portfolioExpectedReturn: number;// % nominal
  portfolioSD: number;            // % stdev
  portfolioRecalibrationPercent: number; // post-ret haircut (%)
  portfolioRecalibrationAge: number;

  /* Super (retirement account) */
  superBalance: number;
  monthlySuperContribution: number;
  superGrowth: number;            // %/yr
  superBlendedReturn: number;     // % nominal
  superRecalibrationPercent: number; // post-ret haircut (%)
  superRecalibrationAge: number;

  /* Options */
  contributeAfterRetirement?: boolean;

  /* Guardrails */
  guardrail?: Guardrail;

  /* Black swan */
  blackSwanAge?: number;
  blackSwanDropPct?: number;        // portfolio drop %
  /** Multiplier to scale the shock applied to super vs portfolio (default 0.6). */
  blackSwanSuperMultiplier?: number;
  shockRecoveryYears?: number;      // extra years for alpha haircut after the shock
  shockExtraHaircutPct?: number;    // extra haircut that decays to 0 across shockRecoveryYears

  /* Special cash-in events */
  specialContributions?: SpecialContribution[];

  /* Simulation switches */
  removeVolatility?: boolean;
};

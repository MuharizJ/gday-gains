// backend/src/model/types.ts

/* ===== Inputs ===== */
export type SpecialContribution = {
  age: number;
  amount: number;
  description?: string;
  bucket?: 'portfolio' | 'super';
};

export type Guardrail = {
  softYears: number;   // if fundedYears < softYears -> cut
  hardYears: number;   // if fundedYears < hardYears -> floor
  cutPct: number;      // % cut when in soft zone
};

export type BlackSwanRecovery = {
  years: number;         // recovery years after the shock year
  muDragPct: number;     // additional drag on expected return
  volMultiplier?: number;
};

export type Inputs = {
  birthdate: string;           // yyyy-mm-dd
  lifeExpectancy: number;
  retirementAge: number;

  portfolioBalance: number;
  superBalance: number;

  monthlyContribution: number;
  monthlySuperContribution: number;
  contributionGrowth: number;  // %/yr
  superGrowth: number;         // %/yr

  portfolioExpectedReturn: number; // % nominal
  portfolioSD: number;             // % stdev
  superBlendedReturn: number;      // % nominal blended

  inflation: number;            // %/yr
  floorWithdrawal: number;      // $/mo floor

  portfolioRecalibrationPercent: number; // % haircut post-ret
  superRecalibrationPercent: number;     // % haircut post-ret
  portfolioRecalibrationAge: number;
  superRecalibrationAge: number;

  contributeAfterRetirement?: boolean;
  specialContributions?: SpecialContribution[];

  // Shock
  blackSwanAge?: number;        // optional
  blackSwanDropPct?: number;    // optional
  shockRecoveryYears?: number;  // optional
  shockExtraHaircutPct?: number;// optional

  removeVolatility?: boolean;
};

/* ===== Results/Advice ===== */
export type PolicyEvent = { age: number; type: 'black-swan' | 'cut' | 'floor' };

/** Advice row sent to the UI table. */
export type AdviceRow = {
  age: number;
  policy: 'normal' | 'cut' | 'floor';
  /** desired annual spend */
  targetSpend: number;
  /** actual annual spend after policy */
  actualSpend: number;
  /** legacy combined end balance (kept for compatibility) */
  endBalance: number;

  /** NEW: explicit balances and the per-year returns used (decimals, e.g., 0.12) */
  endPortfolio?: number;
  endSuper?: number;
  rPortfolio?: number;
  rSuper?: number;
};

export type AdviceTrack = {
  p20: AdviceRow[];
  p50: AdviceRow[];
  p80: AdviceRow[];
};

export type Results = {
  graph: Array<{ age: number; p20: number; p50: number; p80: number }>;
  atEnd: { p20: number; p50: number; p80: number; endAge: number };
  breakdown: Array<{ age: number; ret20: number; ret50: number; ret80: number; bal20: number; bal50: number; bal80: number }>;
  events?: PolicyEvent[];
  /** legacy single track kept for older clients */
  advice?: AdviceRow[];
  /** preferred structure: three tracks for unlucky/median/lucky */
  adviceByPath?: AdviceTrack;
};

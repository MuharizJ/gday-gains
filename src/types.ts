export type SpecialRow = { age: number; amount: number; description?: string };

export type Inputs = {
  // Personal
  firstName: string;
  birthdate: string;       // yyyy-mm-dd
  retired: 'retired' | 'notRetired';
  retirementAge: number;
  lifeExpectancy: number;

  // Portfolio
  portfolioBalance: number;
  stocksPct: number;
  fundsPct: number;        // must sum to 100 with stocksPct
  superBalance: number;
  monthlyContribution: number;
  contributionGrowth: number;           // %/yr
  monthlySuperContribution: number;
  superGrowth: number;                  // %/yr
  specialContributions: SpecialRow[];

  // Expenses
  livingExpenses: number;  // $/mo
  inflation: number;       // %/yr
  floorWithdrawal: number; // $/mo
  taxablePortion: number;  // %
  effectiveTaxRate: number;// %
  specialWithdrawals: SpecialRow[];

  // Settings
  portfolioExpectedReturn: number; // %/yr
  portfolioSD: number;             // %/yr
  correlation: number;             // keep but unused for now
  portfolioRecalibrationPercent: number; // post-ret haircut %
  portfolioRecalibrationAge: number;

  superBlendedReturn: number; // %/yr
  superRecalibrationPercent: number;
  superRecalibrationAge: number;

  removeVolatility: boolean;
  includeFatTails: boolean;   // (placeholder)
  fatTailMagnitude: number;   // 1|2
  fatTailFrequency: number;   // 1|2
  fatTailSkew: number;        // -1|0|1

  blackSwanAge: number;       // age at shock
  blackSwanDropPct: number;   // drop %
};

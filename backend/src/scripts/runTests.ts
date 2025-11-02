import { simulatePath } from '../model/engine';
import type { Inputs } from '../model/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

const base: Inputs = {
  // Personal
  firstName: 'Test', birthdate: '1981-08-18', retired: 'notRetired',
  retirementAge: 55, lifeExpectancy: 75,

  // Portfolio
  portfolioBalance: 500000, superBalance: 250000,
  monthlyContribution: 7000, contributionGrowth: 3,
  monthlySuperContribution: 4000, superGrowth: 3,
  stocksPct: 100, fundsPct: 0,
  specialContributions: [
    { age: 46, amount: 250000 },
    { age: 50, amount: 250000 },
    { age: 54, amount: 1500000 },
  ],

  // Expenses
  livingExpenses: 35000, inflation: 3, floorWithdrawal: 10000,
  taxablePortion: 100, effectiveTaxRate: 0, specialWithdrawals: [],

  // Settings
  portfolioExpectedReturn: 12, portfolioSD: 15, correlation: 0,
  portfolioRecalibrationPercent: 4, portfolioRecalibrationAge: 55,
  superBlendedReturn: 12, superRecalibrationPercent: 5, superRecalibrationAge: 55,

  removeVolatility: true, includeFatTails: false,
  fatTailMagnitude: 1, fatTailFrequency: 1, fatTailSkew: 0,

  blackSwanAge: 52, blackSwanDropPct: 40,
  // contributeAfterRetirement: false, // optional explicit flag
};

const rows = simulatePath(base, 42, true);

const r54 = rows.find(r => r.age === 54)!;
const r55 = rows.find(r => r.age === 55)!;
const r56 = rows.find(r => r.age === 56)!;

// Contributions
assert(r54.contribPortfolio > 0 && r54.contribSuper > 0, 'Contribs active before retirement');
assert(r55.contribPortfolio === 0 && r55.contribSuper === 0, 'Contribs must stop at retirement');
assert(r56.contribPortfolio === 0 && r56.contribSuper === 0, 'Contribs remain zero after retirement');

// Withdrawals + inflation indexing
const spend55 = r55.withdrawFromPortfolio + r55.withdrawFromSuper;
const spend56 = r56.withdrawFromPortfolio + r56.withdrawFromSuper;
assert(spend55 > 0, 'Withdrawals start at retirement');
assert(Math.abs(spend56 / spend55 - 1.03) < 1e-6, 'Withdrawals index at inflation');

// Haircut on returns after 55
const rP54 = r54.rPortfolio;
const rP55 = r55.rPortfolio;
assert(rP55 < rP54, 'Portfolio return drops after haircut age');

console.log('✅ Engine behavior OK (no post-retirement contributions, spending & haircuts correct).');

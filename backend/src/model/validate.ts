// backend/src/model/validate.ts
import { z } from 'zod';
import type { Inputs } from './types';
import { parseBirthdate, safeNum } from './helpers';

// Coercers that tolerate mobile formatting (spaces/commas/currency)
const num = () => z.preprocess(safeNum, z.number().finite());
const int = () => z.preprocess(safeNum, z.number().int());

export const InputsSchema = z.object({
  firstName: z.string().default(''),

  // Validate birthdate is parseable by our UTC parser
  birthdate: z.string().refine(s => !isNaN(parseBirthdate(s).getTime()), 'Invalid birthdate'),

  retired: z.enum(['retired','notRetired']).default('notRetired'),
  retirementAge: int(),
  lifeExpectancy: int(),

  // Balances & contributions
  portfolioBalance: num(),
  stocksPct: num(),
  fundsPct: num(),
  monthlyContribution: num(),
  contributionGrowth: num(),

  superBalance: num(),
  monthlySuperContribution: num(),
  superGrowth: num(),

  // Expenses / inflation
  livingExpenses: num(),
  inflation: num(),
  floorWithdrawal: num(),

  // Portfolio assumptions
  portfolioExpectedReturn: num(),
  portfolioSD: num(),
  correlation: num(),
  portfolioRecalibrationPercent: num(),
  portfolioRecalibrationAge: int(),

  // Super assumptions
  superBlendedReturn: num(),
  superRecalibrationPercent: num(),
  superRecalibrationAge: int(),

  // Volatility features
  removeVolatility: z.coerce.boolean().default(false),
  includeFatTails: z.coerce.boolean().default(false),
  fatTailMagnitude: num(),
  fatTailFrequency: num(),
  fatTailSkew: num(),

  // Black swan (coerced; default to 0 if blank)
  blackSwanAge: int().default(0),
  blackSwanDropPct: num().default(0),

  // Irregular contributions
  specialContributions: z.array(
    z.object({
      age: int(),
      amount: num(),
      description: z.string().optional(),
      // optional: bucket: z.enum(['portfolio','super']).optional()
    })
  ).default([]),
});

export function parseInputs(i: unknown): Inputs {
  return InputsSchema.parse(i);
}

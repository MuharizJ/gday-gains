// backend/src/model/validate.ts
import { z } from 'zod';
import type { Inputs } from './types';

const num = z.coerce.number();
const str = z.string();

export const InputsSchema = z.object({
  firstName: str.default(''),
  birthdate: str,                          // yyyy-mm-dd
  retired: z.enum(['retired','notRetired']).default('notRetired'),
  retirementAge: num,
  lifeExpectancy: num,

  portfolioBalance: num,
  stocksPct: num, fundsPct: num,
  monthlyContribution: num,
  contributionGrowth: num,

  superBalance: num,
  monthlySuperContribution: num,
  superGrowth: num,

  livingExpenses: num,
  inflation: num,
  floorWithdrawal: num,

  portfolioExpectedReturn: num,
  portfolioSD: num,
  correlation: num,
  portfolioRecalibrationPercent: num,
  portfolioRecalibrationAge: num,

  superBlendedReturn: num,
  superRecalibrationPercent: num,
  superRecalibrationAge: num,

  removeVolatility: z.coerce.boolean().default(false),
  includeFatTails: z.coerce.boolean().default(false), fatTailMagnitude: num, fatTailFrequency: num, fatTailSkew: num,

  blackSwanAge: num,
  blackSwanDropPct: num,

  specialContributions: z.array(
    z.object({
      age: num,
      amount: num,
      description: z.string().optional()
    })
  ).default([]),
});

export function parseInputs(i: unknown): Inputs {
  return InputsSchema.parse(i);
}

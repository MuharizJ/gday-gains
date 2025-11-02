// formSchema.ts
import * as Yup from 'yup';
import { Inputs } from './types';

export const initialValues: Inputs = {
  // Personal
  firstName: '', birthdate: '', retired: 'notRetired',
  retirementAge: 60, lifeExpectancy: 90,

  // Portfolio
  portfolioBalance: 500000, stocksPct: 70, fundsPct: 30,
  superBalance: 250000, monthlyContribution: 7000, contributionGrowth: 0,
  monthlySuperContribution: 0, superGrowth: 0,

  // NEW – dynamic rows
  specialContributions: [],

  // Expenses
  livingExpenses: 12000, inflation: 3, floorWithdrawal: 6000,
  taxablePortion: 100, effectiveTaxRate: 0, specialWithdrawals: [],

  // Settings
  portfolioExpectedReturn: 8, portfolioSD: 15, correlation: 0,
  portfolioRecalibrationPercent: 2, portfolioRecalibrationAge: 60,

  superBlendedReturn: 8, superRecalibrationPercent: 0, superRecalibrationAge: 60,

  removeVolatility: false, includeFatTails: false,
  fatTailMagnitude: 1, fatTailFrequency: 1, fatTailSkew: 0,

  blackSwanAge: 65, blackSwanDropPct: 30,
};

export const validationSchema = Yup.object({
  // ...your existing rules...

  // 👇 NEW: Irregular contributions validation
  specialContributions: Yup.array()
    // Optional: ignore completely empty rows (no age, no amount, no description)
    .compact((row: any) =>
      !row || (row.age === undefined && row.amount === undefined && !row.description)
    )
    .of(
      Yup.object({
        age: Yup.number()
          .transform((v, orig) => (orig === '' ? undefined : v)) // handle empty string from inputs
          .typeError('Enter an age')
          .integer('Age must be a whole number')
          .min(0, 'Age must be ≥ 0')
          .max(120, 'Age looks too high')
          .required('Age required'),
        amount: Yup.number()
          .transform((v, orig) => (orig === '' ? undefined : v))
          .typeError('Enter an amount')
          .min(1, 'Amount must be > 0')
          .required('Amount required'),
        description: Yup.string().max(120, 'Keep under 120 chars'),
      })
    ),
});

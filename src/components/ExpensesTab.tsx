import React from 'react';
import Grid from '@mui/material/Grid';
import FormSection from './ui/FormSection';
import FTextField from './ui/FTextField';
import FCurrencyField from './ui/FCurrencyField';

export default function ExpensesTab() {
  return (
    <FormSection title="Retirement Distributions">
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <FCurrencyField name="livingExpenses" label="Retirement Living Expenses ($/mo)" />
        </Grid>
        <Grid item xs={12} md={4}>
          <FTextField name="inflation" label="Inflation (%/yr)" type="number" />
        </Grid>
        <Grid item xs={12} md={4}>
          <FCurrencyField name="floorWithdrawal" label="Floor Withdrawal ($/mo)" />
        </Grid>
      </Grid>
    </FormSection>
  );
}

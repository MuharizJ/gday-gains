import React from 'react';
import Grid from '@mui/material/Grid';
import { FieldArray } from 'formik';
import { IconButton, Button, Tooltip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

import FormSection from './ui/FormSection';
import FTextField from './ui/FTextField';
import FCurrencyField from './ui/FCurrencyField';

export default function PortfolioTab() {
  return (
    <>
      {/* Row 1: Core portfolio */}
      <FormSection title="Balances & Contributions">
        <Grid container spacing={2}>
          {/* --- Primary portfolio row --- */}
          <Grid item xs={12} md={4}>
            <FCurrencyField name="portfolioBalance" label="Portfolio Balance ($)" />
          </Grid>
          <Grid item xs={12} md={4}>
            <FCurrencyField name="monthlyContribution" label="Contribution ($/mo)" />
          </Grid>
          <Grid item xs={12} md={4}>
            <FTextField name="contributionGrowth" label="Contribution Growth (%/yr)" type="number" />
          </Grid>

          {/* --- Super row --- */}
          <Grid item xs={12} md={4}>
            <FCurrencyField name="superBalance" label="Super Balance ($)" />
          </Grid>
          <Grid item xs={12} md={4}>
            <FCurrencyField name="monthlySuperContribution" label="Monthly Super Contribution ($/mo)" />
          </Grid>
          <Grid item xs={12} md={4}>
            <FTextField name="superGrowth" label="Super Growth (%/yr)" type="number" />
          </Grid>
        </Grid>
      </FormSection>

      {/* Allocation stays as-is */}
      <FormSection title="Asset Allocation">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FTextField name="stocksPct" label="Stocks (%)" type="number" />
          </Grid>
          <Grid item xs={12} md={6}>
            <FTextField name="fundsPct" label="ETFs & Managed Funds (%)" type="number" />
          </Grid>
        </Grid>
      </FormSection>

      {/* New: Irregular/Special contributions */}
      <FormSection title="Irregular Contributions">
        <FieldArray name="specialContributions">
          {({ push, remove, form }) => (
            <>
              {form.values.specialContributions?.map((_: any, idx: number) => (
                <Grid container spacing={2} alignItems="center" key={idx} sx={{ mb: 0.5 }}>
                  <Grid item xs={12} md={3}>
                    <FTextField name={`specialContributions.${idx}.age`} label="Age at contribution" type="number" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FCurrencyField name={`specialContributions.${idx}.amount`} label="Amount ($)" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FTextField name={`specialContributions.${idx}.description`} label="Description (optional)" />
                  </Grid>
                  <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Tooltip title="Remove">
                      <IconButton color="inherit" onClick={() => remove(idx)}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              ))}

              <Button
                startIcon={<AddIcon />}
                onClick={() => push({ age: undefined, amount: undefined, description: '' })}
                sx={{ mt: 1 }}
              >
                Add contribution
              </Button>
            </>
          )}
        </FieldArray>
      </FormSection>
    </>
  );
}

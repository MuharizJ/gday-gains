import React from 'react';
import Grid from '@mui/material/Grid';
import { Box } from '@mui/material';
import FormSection from './ui/FormSection';
import FTextField from './ui/FTextField';
import FCheckbox from './ui/FCheckbox';
import FSlider from './ui/FSlider';

export default function SettingsTab() {
  return (
    <>
      <FormSection title="Portfolio Assumptions">
        <Grid container spacing={2}>
          <Grid xs={12} md={3}><FTextField name="portfolioExpectedReturn" label="Expected Return (%)" type="number" /></Grid>
          <Grid xs={12} md={3}><FTextField name="portfolioSD" label="Std Dev (%)" type="number" /></Grid>
          <Grid xs={12} md={3}><FTextField name="correlation" label="Correlation" type="number" /></Grid>
          <Grid xs={12} md={3}><FTextField name="portfolioRecalibrationPercent" label="Post-Ret Haircut (%)" type="number" /></Grid>
          <Grid xs={12} md={3}><FTextField name="portfolioRecalibrationAge" label="Haircut Age" type="number" /></Grid>
        </Grid>
      </FormSection>

      <FormSection title="Super Assumptions">
        <Grid container spacing={2}>
          <Grid xs={12} md={3}><FTextField name="superBlendedReturn" label="Super Return (%)" type="number" /></Grid>
          <Grid xs={12} md={3}><FTextField name="superRecalibrationPercent" label="Post-Ret Haircut (%)" type="number" /></Grid>
          <Grid xs={12} md={3}><FTextField name="superRecalibrationAge" label="Haircut Age" type="number" /></Grid>
        </Grid>
      </FormSection>

      <FormSection title="Volatility Features">
        <Grid container spacing={2}>
          <Grid xs={12}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <FCheckbox name="removeVolatility" label="Remove Volatility" />
              <FCheckbox name="includeFatTails" label="Include Fat Tails (placeholder)" />
            </Box>
          </Grid>
          <Grid xs={12} md={4}><FSlider name="fatTailMagnitude" label="FT Magnitude" min={1} max={2} step={1} /></Grid>
          <Grid xs={12} md={4}><FSlider name="fatTailFrequency" label="FT Frequency" min={1} max={2} step={1} /></Grid>
          <Grid xs={12} md={4}><FSlider name="fatTailSkew" label="FT Skew" min={-1} max={1} step={1} /></Grid>
        </Grid>
      </FormSection>

      <FormSection title="Black Swan">
        <Grid container spacing={2}>
          <Grid xs={12} md={3}><FTextField name="blackSwanAge" label="Age" type="number" /></Grid>
          <Grid xs={12} md={3}><FTextField name="blackSwanDropPct" label="Drop (%)" type="number" /></Grid>
        </Grid>
      </FormSection>
    </>
  );
}

import React from 'react';
import Grid from '@mui/material/Grid';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useField, useFormikContext } from 'formik';
import FormSection from './ui/FormSection';
import FTextField from './ui/FTextField';
import FSlider from './ui/FSlider';

function RetiredToggle() {
  const { setFieldValue } = useFormikContext<any>();
  const [field] = useField('retired');
  return (
    <ToggleButtonGroup
      value={field.value}
      exclusive
      onChange={(_, v) => v && setFieldValue('retired', v)}
      size="small"
    >
      <ToggleButton value="retired">I’m Retired</ToggleButton>
      <ToggleButton value="notRetired">I’m Not Retired</ToggleButton>
    </ToggleButtonGroup>
  );
}

export default function PersonalTab() {
  return (
    <>
      <FormSection title="Basics">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}><FTextField name="firstName" label="First Name" /></Grid>
          <Grid item xs={12} md={6}><FTextField name="birthdate" label="Birthdate" type="date" /></Grid>
          <Grid item xs={12} md={4}><FTextField name="retirementAge" label="Retirement Age" type="number" /></Grid>
          <Grid item xs={12} md={8}><FSlider name="lifeExpectancy" label="Life Expectancy" min={60} max={110} /></Grid>
        </Grid>
      </FormSection>

      <FormSection title="Status">
        <RetiredToggle />
      </FormSection>
    </>
  );
}

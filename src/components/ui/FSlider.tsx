import { useField, useFormikContext } from 'formik';
import { Slider, Stack, Typography } from '@mui/material';

export default function FSlider({
  name, label, min, max, step,
}: { name: string; label: string; min: number; max: number; step?: number }) {
  const { setFieldValue } = useFormikContext<any>();
  const [field] = useField<number>(name);
  return (
    <Stack spacing={1} sx={{ px: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}: <b>{field.value}</b>
      </Typography>
      <Slider value={Number(field.value || 0)} min={min} max={max} step={step}
              onChange={(_, v) => setFieldValue(name, v)} />
    </Stack>
  );
}

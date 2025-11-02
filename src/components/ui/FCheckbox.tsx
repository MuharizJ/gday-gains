import { useField } from 'formik';
import { Checkbox, FormControlLabel } from '@mui/material';

export default function FCheckbox({ name, label }: { name: string; label: string }) {
  const [field] = useField({ name, type: 'checkbox' });
  return <FormControlLabel control={<Checkbox {...field} checked={Boolean(field.value)} />} label={label} />;
}

import { useField, useFormikContext } from 'formik';
import TextField from '@mui/material/TextField';
import { NumericFormat } from 'react-number-format';

type Props = {
  name: string;
  label: string;
  allowDecimals?: boolean;       // default false (no cents)
};

export default function FCurrencyField({ name, label, allowDecimals = false }: Props) {
  const { setFieldValue } = useFormikContext<any>();
  const [field, meta] = useField(name);
  const error = meta.touched && Boolean(meta.error);

  return (
    <NumericFormat
      customInput={TextField}
      value={field.value ?? ''}
      name={name}
      label={label}
      thousandSeparator
      decimalScale={allowDecimals ? 2 : 0}
      fixedDecimalScale={allowDecimals}
      allowNegative={false}
      fullWidth
      size="small"
      error={error}
      helperText={error ? meta.error : ' '}
      inputProps={{ inputMode: 'numeric' }}
      onValueChange={(vals) => setFieldValue(name, vals.floatValue ?? 0)}
      onBlur={field.onBlur}
    />
  );
}

import { useField } from 'formik';
import TextField from '@mui/material/TextField';

type Props = { name: string; label: string; type?: string; placeholder?: string; };
export default function FTextField(props: Props) {
  const [field, meta] = useField(props.name);
  const error = meta.touched && Boolean(meta.error);
  return <TextField {...field} {...props} error={error} helperText={error ? meta.error : ' '} />;
}

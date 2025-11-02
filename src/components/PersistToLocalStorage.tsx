import { useEffect } from 'react';
import { useFormikContext } from 'formik';
import type { Inputs } from '../types';
import { saveForm } from '../utils/persist';


export default function PersistToLocalStorage() {
  const { values } = useFormikContext<Inputs>();
  useEffect(() => {
    saveForm(values);
  }, [values]);
  return null;
}

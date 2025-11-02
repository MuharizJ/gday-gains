import { Inputs } from '../types';
const KEY = 'gday-gains-form';

export const loadForm = (): Partial<Inputs> | null => {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
};
export const saveForm = (vals: Inputs) => {
  try { localStorage.setItem(KEY, JSON.stringify(vals)); } catch {}
};

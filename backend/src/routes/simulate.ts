// backend/src/routes/simulate.ts
import { Router } from 'express';
import { parseInputs } from '../model/validate';
import { simulateMonteCarlo, simulateDeterministic } from '../model/engine';

const r = Router();

r.post('/simulate', (req, res) => {
  try {
    const inputs = parseInputs(req.body);
    const results = simulateMonteCarlo(inputs, 10000, 1234);
    res.json(results);
  } catch (e:any) {
    res.status(400).json({ error: e?.message || 'Invalid payload' });
  }
});

r.post('/simulate/deterministic', (req, res) => {
  try {
    const inputs = parseInputs(req.body);
    const table = simulateDeterministic(inputs);
    res.json({ table });
  } catch (e:any) {
    res.status(400).json({ error: e?.message || 'Invalid payload' });
  }
});

export default r;

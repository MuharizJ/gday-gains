// backend/src/scripts/runScenario.ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseInputs } from '../model/validate';
import { simulateDeterministic, simulateMonteCarlo } from '../model/engine';

function pretty(n:number){ return '$' + n.toLocaleString(); }

(async () => {
  const path = process.argv[2] || './src/scenarios/sample.json';
  const raw = JSON.parse(readFileSync(resolve(path), 'utf8'));
  const inputs = parseInputs(raw);

  console.log('Deterministic (volatility OFF) table:\n');
  const table = simulateDeterministic(inputs);
  console.table(table.map(r => ({
    age: r.age,
    begin: pretty(Math.round(r.beginPortfolio + r.beginSuper)),
    irregular: pretty(r.irregular),
    contrib: pretty(Math.round(r.contribPortfolio + r.contribSuper)),
    spend: pretty(Math.round(r.withdrawFromPortfolio + r.withdrawFromSuper)),
    rP: (r.rPortfolio*100).toFixed(2)+'%',
    rS: (r.rSuper*100).toFixed(2)+'%',
    end: pretty(Math.round(r.endPortfolio + r.endSuper)),
  })));

  console.log('\nMonte Carlo (10k) percentiles at end:\n');
  const mc = simulateMonteCarlo(inputs, 10000, 1234);
  console.table([{
    endAge: mc.atEnd.endAge,
    p20: pretty(mc.atEnd.p20),
    p50: pretty(mc.atEnd.p50),
    p80: pretty(mc.atEnd.p80),
  }]);
})();

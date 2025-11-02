export const MOCK_RESULTS = {
  graph: Array.from({ length: 46 }, (_, i) => {
    const age = 45 + i;
    const base = 750000 * Math.pow(1.08, i);
    return { age, p20: Math.round(base * 0.6), p50: Math.round(base), p80: Math.round(base * 1.6) };
  }),
  atEnd: { p20: 0, p50: 0, p80: 0, endAge: 90 },
  breakdown: []
};
// compute atEnd/breakdown
(() => {
  const last = (MOCK_RESULTS.graph as any[])[(MOCK_RESULTS.graph as any[]).length - 1];
  (MOCK_RESULTS as any).atEnd = { p20: last.p20, p50: last.p50, p80: last.p80, endAge: last.age };
  const startBal = 750000, startAge = 45;
  const ages = [65, 70, 75, 80, 85];
  (MOCK_RESULTS as any).breakdown = ages.map((a) => {
    const row = (MOCK_RESULTS.graph as any[])[a - startAge];
    const yrs = Math.max(1, a - startAge);
    const imp = (x: number) => (Math.pow(x / Math.max(1, startBal), 1 / yrs) - 1) * 100;
    return { age: a, ret20: +imp(row.p20).toFixed(2), ret50: +imp(row.p50).toFixed(2), ret80: +imp(row.p80).toFixed(2),
      bal20: row.p20, bal50: row.p50, bal80: row.p80 };
  });
})();

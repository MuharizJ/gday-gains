// backend/mockResults.js
function buildMock({ startAge = 45, endAge = 90, startBal = 750000, mu = 0.08 } = {}) {
  const graph = [];
  for (let age = startAge; age <= endAge; age++) {
    const t = age - startAge;
    const median = startBal * Math.pow(1 + mu, t);
    const p20 = median * 0.6;
    const p80 = median * 1.6;
    graph.push({ age, p20: Math.round(p20), p50: Math.round(median), p80: Math.round(p80) });
  }
  const last = graph[graph.length - 1];
  const ages = [65, 70, 75, 80, 85].filter(a => a >= startAge && a <= endAge);
  const breakdown = ages.map(a => {
    const row = graph[a - startAge];
    const yrs = Math.max(1, a - startAge);
    const imp = x => (Math.pow(x / Math.max(1, startBal), 1 / yrs) - 1) * 100;
    return {
      age: a,
      ret20: +imp(row.p20).toFixed(2),
      ret50: +imp(row.p50).toFixed(2),
      ret80: +imp(row.p80).toFixed(2),
      bal20: row.p20, bal50: row.p50, bal80: row.p80
    };
  });
  return { graph, atEnd: { p20: last.p20, p50: last.p50, p80: last.p80, endAge }, breakdown };
}
module.exports = { buildMock };

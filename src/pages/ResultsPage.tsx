import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, Grid, Typography,
  Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, Divider
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ReferenceDot
} from 'recharts';
import type { Inputs } from '../types';

type GraphPoint = { age: number; p20: number; p50: number; p80: number };
type PolicyEvent = { age: number; type: 'black-swan' | 'cut' | 'floor' };
type AdviceRow = {
  age: number;
  policy: 'normal' | 'cut' | 'floor';
  targetSpend: number;   // yearly; UI shows monthly
  actualSpend: number;   // yearly; UI shows monthly
  endBalance: number;    // legacy
  // NEW: richer per-row fields from backend
  endPortfolio?: number;
  endSuper?: number;
  rPortfolio?: number;   // decimal, e.g. 0.12
  rSuper?: number;       // decimal
};

type Results = {
  graph: GraphPoint[];
  atEnd: { p20: number; p50: number; p80: number; endAge: number };
  breakdown: { age: number; ret20: number; ret50: number; ret80: number; bal20: number; bal50: number; bal80: number; }[];
  events?: PolicyEvent[];
  advice?: AdviceRow[]; // legacy single track
  adviceByPath?: { p20: AdviceRow[]; p50: AdviceRow[]; p80: AdviceRow[] }; // new
};

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;
const monthly = (yr: number) => yr / 12;
const fmtPct = (d?: number) => {
  const v = (d ?? 0) * 100;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
};

function clampAge(data: GraphPoint[], a: number) {
  if (!data.length) return a;
  return Math.min(Math.max(a, data[0].age), data[data.length - 1].age);
}
function getAtAge(data: GraphPoint[], targetAge: number): GraphPoint {
  if (!data.length) return { age: targetAge, p20: 0, p50: 0, p80: 0 };
  const t = clampAge(data, targetAge);
  let best = data[0];
  for (const pt of data) {
    if (pt.age <= t) best = pt;
    if (pt.age === t) return pt;
  }
  return best;
}
function sliceByAges(data: GraphPoint[], fromAge: number, toAge: number) {
  const lo = Math.min(fromAge, toAge);
  const hi = Math.max(fromAge, toAge);
  return data.filter(d => d.age >= lo && d.age <= hi);
}

const evStyle = (t: PolicyEvent['type']) =>
  t === 'black-swan'
    ? { stroke: '#ef5350', fill: '#ef5350', label: 'Shock' }
    : t === 'floor'
      ? { stroke: '#6d4c41', fill: '#6d4c41', label: 'Floor' }
      : { stroke: '#ffa000', fill: '#ffa000', label: 'Cut' };

function Section({ title, data, cardAge, idPrefix, markers = [] }: {
  title: string; data: GraphPoint[]; cardAge: number; idPrefix: string; markers?: PolicyEvent[];
}) {
  if (!data.length) return null;
  const at = getAtAge(data, cardAge);
  const minY = Math.min(...data.map(d => Math.min(d.p20, d.p50, d.p80)));
  return (
    <Box sx={{ mb: 5 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>{title}</Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ height: 380 }}>
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`${idPrefix}-g20`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef5350" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ef5350" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={`${idPrefix}-g50`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#42a5f5" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#42a5f5" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={`${idPrefix}-g80`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#66bb6a" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#66bb6a" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <XAxis dataKey="age" />
              <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}m`} />
              <Tooltip formatter={(v: any) => fmtMoney(Number(v) || 0)} />
              <Legend />

              <Area dataKey="p20" name="Unlucky (20th)" type="monotone" stroke="#ef5350" fill={`url(#${idPrefix}-g20)`} />
              <Area dataKey="p50" name="Median (50th)"  type="monotone" stroke="#42a5f5" fill={`url(#${idPrefix}-g50)`} />
              <Area dataKey="p80" name="Lucky (80th)"   type="monotone" stroke="#66bb6a" fill={`url(#${idPrefix}-g80)`} />

              {markers.map((e, i) => {
                const s = evStyle(e.type);
                return (
                  <ReferenceDot
                    key={`${idPrefix}-${e.type}-${e.age}-${i}`}
                    x={e.age}
                    y={minY}
                    r={5}
                    stroke={s.stroke}
                    fill={s.fill}
                    ifOverflow="extendDomain"
                    label={{ value: s.label, position: 'top' }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {(['p20', 'p50', 'p80'] as const).map(k => (
          <Grid item xs={12} md={4} key={k}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip size="small" label={k === 'p20' ? '20th' : k === 'p50' ? '50th' : '80th'}
                        color={k === 'p20' ? 'error' : k === 'p50' ? 'primary' : 'success'} />
                  <Typography variant="subtitle2">
                    {k === 'p20' ? 'Unlucky' : k === 'p50' ? 'Median' : 'Lucky'}
                  </Typography>
                </Box>
                <Typography variant="h5">{fmtMoney((at as any)[k] ?? 0)}</Typography>
                <Typography variant="body2" color="text.secondary">at age {at.age}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function AdviceTabs({ tracks, retireAge }: {
  tracks?: { p20: AdviceRow[]; p50: AdviceRow[]; p80: AdviceRow[] };
  retireAge: number;
}) {
  const safeTracks = tracks ?? { p20: [], p50: [], p80: [] };
  const [tab, setTab] = React.useState<'p20' | 'p50' | 'p80'>('p20');
  const rows = tab === 'p50' ? safeTracks.p50 : tab === 'p80' ? safeTracks.p80 : safeTracks.p20;

  const SUPER_DRAW_AGE = 63;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Advice & Timeline</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        <strong>Shock</strong> = black-swan drop. <strong>Cut</strong> = guardrail cut. <strong>Floor</strong> = spending clamped to your floor.
      </Typography>

      <Card>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab label="Unlucky" value="p20" />
            <Tab label="Median"  value="p50" />
            <Tab label="Lucky"   value="p80" />
          </Tabs>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Age</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Target ($/mo)</TableCell>
                <TableCell align="right">Actual ($/mo)</TableCell>
                <TableCell align="right">Drawable Portfolio</TableCell>
                <TableCell align="right">Super Balance</TableCell>
                <TableCell align="right">Combined Balance</TableCell>
                <TableCell align="right">ROI (Portfolio)</TableCell>
                <TableCell align="right">ROI (Super)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => {
                const isRetired = r.age >= retireAge;

                const drawable =
                  r.age < SUPER_DRAW_AGE
                    ? (r.endPortfolio ?? 0)
                    : (r.endPortfolio ?? 0) + (r.endSuper ?? 0);

                const superBal =
                  r.age < SUPER_DRAW_AGE ? (r.endSuper ?? 0) : 0;

                const combined = (r.endPortfolio ?? 0) + (r.endSuper ?? 0);

                const icon =
                  r.policy === 'floor' ? <FiberManualRecordIcon sx={{ fontSize: 10, color: "#f83d04ff" , ml: 0.5 }} /> :
                  r.policy === 'cut'   ? <FiberManualRecordIcon sx={{ fontSize: 10, color: "#f8bf05ff", ml: 0.5 }} /> :
                  null;

                return (
                  <TableRow key={`${tab}-${r.age}`}>
                    <TableCell>{r.age}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={isRetired ? 'Retired' : 'Normal'}
                        color={isRetired ? 'warning' : 'success'}
                      />
                    </TableCell>
                    <TableCell align="right">{fmtMoney(monthly(r.targetSpend))}</TableCell>
                    <TableCell align="right">
                      {fmtMoney(monthly(r.actualSpend))}
                      {icon}
                    </TableCell>
                    <TableCell align="right">{fmtMoney(drawable)}</TableCell>
                    <TableCell align="right">{fmtMoney(superBal)}</TableCell>
                    <TableCell align="right">{fmtMoney(combined)}</TableCell>
                    <TableCell align="right">{fmtPct(r.rPortfolio)}</TableCell>
                    <TableCell align="right">{fmtPct(r.rSuper)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function ResultsPage() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { results?: Results; inputs?: Inputs } };
  const results = state?.results;
  const inputs  = state?.inputs;

  const adviceTracks = React.useMemo((): { p20: AdviceRow[]; p50: AdviceRow[]; p80: AdviceRow[] } => {
    if (results?.adviceByPath && results.adviceByPath.p20 && results.adviceByPath.p50 && results.adviceByPath.p80) {
      return results.adviceByPath;
    }
    if (results?.advice) {
      return { p20: results.advice, p50: results.advice, p80: results.advice };
    }
    return { p20: [], p50: [], p80: [] };
  }, [results]);

  if (!results || !inputs || !results.graph?.length) {
    return (
      <Box p={3}>
        <Typography>No results found. Go back and run a simulation.</Typography>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => nav(-1)}>Back</Button>
        </Box>
      </Box>
    );
  }

  // Safe to access results/inputs below
  const startAge = results.graph[0].age;
  const retireAge = Math.max(startAge, Math.round(inputs.retirementAge));
  const lifeAge   = Math.max(retireAge, Math.round(inputs.lifeExpectancy));

  const preData  = sliceByAges(results.graph, startAge, retireAge);
  const postData = sliceByAges(results.graph, retireAge, lifeAge);

  const preMarkers  = (results.events ?? []).filter(e => e.age <  retireAge);
  const postMarkers = (results.events ?? []).filter(e => e.age >= retireAge);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mt: 1, mb:3 }}>
        <Button variant="outlined" onClick={() => nav(-1)}>Edit</Button>
      </Box>

      <Section
        title="We ran 10,000 simulations based on your information."
        data={preData}
        cardAge={retireAge}
        idPrefix="pre"
        markers={preMarkers}
      />

      <Section
        title="From retirement to life expectancy"
        data={postData}
        cardAge={lifeAge}
        idPrefix="post"
        markers={postMarkers}
      />

      <Divider sx={{ my: 4 }} />
      <AdviceTabs tracks={adviceTracks} retireAge={retireAge} />

      <Box sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => nav(-1)}>Edit</Button>
      </Box>
    </Box>
  );
}

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
  targetSpend: number;              // yearly desired spend
  actualSpend: number;              // yearly actual spend
  endBalance?: number;              // legacy combined
  endPortfolio?: number;            // portfolio end-of-year
  endSuper?: number;                // super end-of-year
  rPortfolio?: number;              // decimal ROI
  rSuper?: number;                  // decimal ROI
};

type Results = {
  graph: GraphPoint[];
  atEnd: { p20: number; p50: number; p80: number; endAge: number };
  breakdown: { age: number; ret20: number; ret50: number; ret80: number; bal20: number; bal50: number; bal80: number; }[];
  events?: PolicyEvent[];
  advice?: AdviceRow[];
  adviceByPath?: { p20: AdviceRow[]; p50: AdviceRow[]; p80: AdviceRow[] };
};

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;
const monthly = (y: number) => `$${Math.round((y || 0) / 12).toLocaleString()}`;

function clampAge(age: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, age));
}

function sliceByAges(arr: GraphPoint[], startAge: number, endAge: number): GraphPoint[] {
  const lo = clampAge(startAge, arr[0].age, arr[arr.length - 1].age);
  const hi = clampAge(endAge, arr[0].age, arr[arr.length - 1].age);
  return arr.filter(d => d.age >= lo && d.age <= hi);
}

function getAtAge(arr: GraphPoint[], age: number): GraphPoint {
  const hit = arr.find(d => d.age === age);
  if (hit) return hit;
  return arr.reduce((prev, curr) => Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev);
}

const evStyle = (t: PolicyEvent['type']) => {
  switch (t) {
    case 'black-swan': return { stroke: '#6d4c41', fill: '#8d6e63', label: 'Shock' };
    case 'cut':        return { stroke: '#ff9800', fill: '#ffb74d', label: 'C' };
    case 'floor':      return { stroke: '#795548', fill: '#a1887f', label: 'F' };
    default:           return { stroke: '#9e9e9e', fill: '#bdbdbd', label: '' };
  }
};

/* ------------------ Graph + Cards Section ------------------ */
function Section({
  title, data, cardAge, idPrefix, markers = [],
  visible, onToggle, splitAtCardAge
}: {
  title: string; data: GraphPoint[]; cardAge: number; idPrefix: string; markers?: PolicyEvent[];
  visible: { p20: boolean; p50: boolean; p80: boolean };
  onToggle: (k: 'p20' | 'p50' | 'p80') => void;
  splitAtCardAge?: {
    p20?: { portfolio: number; super: number };
    p50?: { portfolio: number; super: number };
    p80?: { portfolio: number; super: number };
  };
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

              {visible.p20 && (<Area dataKey="p20" name="Unlucky (20th)" type="monotone" stroke="#ef5350" fill={`url(#${idPrefix}-g20)`} />)}
              {visible.p50 && (<Area dataKey="p50" name="Median (50th)"  type="monotone" stroke="#42a5f5" fill={`url(#${idPrefix}-g50)`} />)}
              {visible.p80 && (<Area dataKey="p80" name="Lucky (80th)"   type="monotone" stroke="#66bb6a" fill={`url(#${idPrefix}-g80)`} />)}

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
        {(['p20', 'p50', 'p80'] as const).map(k => {
          const selected = visible[k];
          const split = splitAtCardAge && (splitAtCardAge as any)[k];
          const color = k === 'p20' ? 'error' : k === 'p50' ? 'primary' : 'success';
          return (
            <Grid item xs={12} md={4} key={k}>
              <Card
                onClick={() => onToggle(k)}
                sx={{
                  cursor: 'pointer',
                  borderWidth: 2,
                  borderStyle: 'solid',
                  borderColor: selected ? (color === 'error' ? 'error.main' : color === 'primary' ? 'primary.main' : 'success.main') : 'divider',
                  boxShadow: selected ? 4 : 1
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip size="small" label={k === 'p20' ? '20th' : k === 'p50' ? '50th' : '80th'} color={color as any} />
                    <Typography variant="subtitle2">
                      {k === 'p20' ? 'Unlucky' : k === 'p50' ? 'Median' : 'Lucky'}
                    </Typography>
                    {selected && <FiberManualRecordIcon fontSize="small" color={color as any} />}
                  </Box>
                  <Typography variant="h5">{fmtMoney((at as any)[k] ?? 0)}</Typography>
                  <Typography variant="body2" color="text.secondary">at age {at.age}</Typography>

                  {split && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Drawable: {fmtMoney(split.portfolio || 0)}
                      </Typography><br />
                      <Typography variant="caption" color="text.secondary">
                        Super: {fmtMoney(split.super || 0)}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

/* ------------------ Advice Tabs (default Median) ------------------ */
function AdviceTabs({ tracks, retireAge }: {
  tracks?: { p20: AdviceRow[]; p50: AdviceRow[]; p80: AdviceRow[] };
  retireAge: number;
}) {
  const safeTracks = tracks ?? { p20: [], p50: [], p80: [] };
  const [tab, setTab] = React.useState<'p20' | 'p50' | 'p80'>('p50'); // default Median
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
              {rows.map((r, i) => {
                const retired = r.age >= retireAge;
                const canDrawSuper = r.age >= SUPER_DRAW_AGE;
                const statusLabel = retired ? 'Retired' : 'Normal';
                const combined = (r.endPortfolio || 0) + (r.endSuper || 0);
                const draw = canDrawSuper ? combined : (r.endPortfolio || 0);
                return (
                  <TableRow key={`${tab}-${r.age}-${i}`}>
                    <TableCell>{r.age}</TableCell>
                    <TableCell>
                      <Chip label={statusLabel} size="small" color={retired ? 'warning' : 'success'} />
                    </TableCell>
                    <TableCell align="right">{monthly(r.targetSpend)}</TableCell>
                    <TableCell align="right">
                      {monthly(r.actualSpend)} {r.policy !== 'normal' ? <FiberManualRecordIcon sx={{ fontSize: 8, color: 'error.main', ml: 0.25 }} /> : null}
                    </TableCell>
                    <TableCell align="right">{fmtMoney(draw)}</TableCell>
                    <TableCell align="right">{fmtMoney(r.endSuper || 0)}</TableCell>
                    <TableCell align="right">{fmtMoney(combined)}</TableCell>
                    <TableCell align="right">{r.rPortfolio !== undefined ? `${(r.rPortfolio * 100).toFixed(1)}%` : '—'}</TableCell>
                    <TableCell align="right">{r.rSuper      !== undefined ? `${(r.rSuper * 100).toFixed(1)}%`      : '—'}</TableCell>
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

/* ------------------ Top-level Results Page ------------------ */
function ResultsPage() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { results?: Results; inputs?: Inputs } };

  // Hooks must be called unconditionally (before any early return)
  const [visible, setVisible] = React.useState<{ p20: boolean; p50: boolean; p80: boolean }>({
    p20: false, p50: true, p80: false
  });

  // Pull state after hooks; memoize advice tracks safely even if results are missing
  const results = state?.results;
  const inputs  = state?.inputs;

  const adviceTracks = React.useMemo((): { p20: AdviceRow[]; p50: AdviceRow[]; p80: AdviceRow[] } => {
    if (!results) return { p20: [], p50: [], p80: [] };
    if (results.adviceByPath && results.adviceByPath.p20 && results.adviceByPath.p50 && results.adviceByPath.p80) {
      return results.adviceByPath;
    }
    if (results.advice) return { p20: results.advice, p50: results.advice, p80: results.advice };
    return { p20: [], p50: [], p80: [] };
  }, [results]);

  // Early guard AFTER hooks are called
  if (!results || !inputs || !results.graph?.length) {
    return (
      <Box p={3}>
        <Typography>No results found. Go back and run a simulation.</Typography>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => nav(-1)}>Back</Button>
        </Box>
      </Box>
    );
    // (Hooks already called above; rules-of-hooks satisfied)
  }

  const onToggle = (k: 'p20'|'p50'|'p80') => setVisible(v => ({ ...v, [k]: !v[k] }));

  const startAge = results.graph[0].age;
  const retireAge = Math.max(startAge, Math.round(inputs.retirementAge));
  const lifeAge   = Math.max(retireAge, Math.round(inputs.lifeExpectancy));

  const preData  = sliceByAges(results.graph, startAge, retireAge);
  const postData = sliceByAges(results.graph, retireAge, lifeAge);

  const preMarkers  = (results.events ?? []).filter(e => e.age <  retireAge);
  const postMarkers = (results.events ?? []).filter(e => e.age >= retireAge);

  const splitAtAge = (rows: AdviceRow[] | undefined, age: number) => {
    const r = (rows || []).find(x => x.age === age);
    if (!r) return undefined as any;
    return { portfolio: r.endPortfolio ?? 0, super: r.endSuper ?? 0 };
  };
  const splitAtRet = {
    p20: splitAtAge(adviceTracks.p20, retireAge),
    p50: splitAtAge(adviceTracks.p50, retireAge),
    p80: splitAtAge(adviceTracks.p80, retireAge),
  } as const;

  return (
    <Box p={3}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        We ran 10,000 simulations based on your information.
      </Typography>

      <Section
        title="Up to retirement"
        data={preData}
        cardAge={retireAge}
        idPrefix="pre"
        markers={preMarkers}
        visible={visible}
        onToggle={onToggle}
        splitAtCardAge={splitAtRet}
      />

      <Section
        title="From retirement to life expectancy"
        data={postData}
        cardAge={lifeAge}
        idPrefix="post"
        markers={postMarkers}
        visible={visible}
        onToggle={onToggle}
      />

      <Divider sx={{ my: 4 }} />
      <AdviceTabs tracks={adviceTracks} retireAge={retireAge} />

      <Box sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => nav(-1)}>Edit</Button>
      </Box>
    </Box>
  );
}

export default ResultsPage;

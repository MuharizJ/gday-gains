import React, { useState } from 'react';
import { Tabs, Tab, Box, Button, CircularProgress, Paper } from '@mui/material';
import { Formik, Form } from 'formik';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import PersonalTab from '../components/PersonalTab';
import PortfolioTab from '../components/PortfolioTab';
import ExpensesTab from '../components/ExpensesTab';
import SettingsTab from '../components/SettingsTab';

import { initialValues, validationSchema } from '../formSchema';
import { loadForm } from '../utils/persist';
import type { Inputs } from '../types';
import PersistToLocalStorage from '../components/PersistToLocalStorage';

/**
 * Resolve API base:
 * - REACT_APP_API_URL or REACT_APP_API_BASE_URL if set (preferred in prod)
 * - Dev fallback: http://localhost:5001
 * - Prod fallback: same-origin (window.location.origin)
 * Also: if someone forgets the protocol (e.g. "my-api.up.railway.app"), add https://
 */
function normalizeBase(raw: string) {
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, '');
}

const envApi =
  process.env.REACT_APP_API_URL ??
  process.env.REACT_APP_API_BASE_URL ??
  (process.env.NODE_ENV === 'development' ? 'http://localhost:5001' : window.location.origin);

const API_BASE = normalizeBase(envApi);

export default function InputsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  const saved = loadForm();
  const seed: Inputs = { ...initialValues, ...(saved || {}) };

  return (
    <Formik<Inputs>
      initialValues={seed}
      validationSchema={validationSchema}
      onSubmit={async (values) => {
        setPending(true);
        try {
          const url = `${API_BASE}/api/simulate`;
          const res = await axios.post(url, values, { withCredentials: false });
          navigate('/results', { state: { results: res.data, inputs: values } });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('simulate failed', err);
          alert('Simulation failed');
        } finally {
          setPending(false);
        }
      }}
    >
      {() => (
        <Form>
          <PersistToLocalStorage />

          <Paper
            elevation={0}
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              position: 'sticky',
              top: 16,
              zIndex: 1,
              background: '#fff',
            }}
          >
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ flex: 1 }}>
              <Tab label="Personal" />
              <Tab label="Portfolio" />
              <Tab label="Expenses" />
              <Tab label="Settings" />
            </Tabs>
            <Button
              type="submit"
              disabled={pending}
              startIcon={pending ? <CircularProgress size={16} /> : null}
            >
              {pending ? 'Running…' : 'Show Me'}
            </Button>
          </Paper>

          <Box>{tabValue === 0 && <PersonalTab />}</Box>
          <Box>{tabValue === 1 && <PortfolioTab />}</Box>
          <Box>{tabValue === 2 && <ExpensesTab />}</Box>
          <Box>{tabValue === 3 && <SettingsTab />}</Box>
        </Form>
      )}
    </Formik>
  );
}

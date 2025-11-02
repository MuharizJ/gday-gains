import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1e88e5' },
    secondary: { main: '#00bfa5' },
    background: { default: '#f7f8fb', paper: '#ffffff' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { variant: 'contained' },
      styleOverrides: { root: { borderRadius: 12, textTransform: 'none' } },
    },
    MuiTextField: {
      defaultProps: { size: 'small', fullWidth: true, variant: 'outlined' },
    },
    MuiCard: {
      styleOverrides: { root: { borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' } },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3 } } },
    MuiTab:  { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
  },
});

export default theme;

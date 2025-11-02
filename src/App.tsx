import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, AppBar, Toolbar, Typography, Box, Container } from '@mui/material';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import theme from './theme';
import InputsPage from './pages/InputsPage';
import ResultsPage from './pages/ResultsPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid #eee' }}>
          <Toolbar>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Gday-Gains</Typography>
            <Box sx={{ flex: 1 }} />
            {/* (Show Me stays inside the form on Inputs) */}
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Routes>
            <Route path="/" element={<InputsPage />} />
            <Route path="/results" element={<ResultsPage />} />
          </Routes>
        </Container>
      </Router>
    </ThemeProvider>
  );
}

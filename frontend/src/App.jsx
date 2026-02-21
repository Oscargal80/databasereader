import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme, Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LicenseEntry from './pages/LicenseEntry';
import axios from 'axios';

import useAppStore from './store/useAppStore';

const createAppTheme = (mode) => createTheme({
  palette: {
    mode,
    ...(mode === 'light' ? {
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
      background: { default: '#f5f5f5' },
    } : {
      primary: { main: '#90caf9' },
      secondary: { main: '#f48fb1' },
      background: { default: '#121212', paper: '#1e1e1e' },
    }),
  },
});

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  return user ? children : <Navigate to="/login" />;
};

function App() {
  const { themeMode } = useAppStore();
  const theme = React.useMemo(() => createAppTheme(themeMode), [themeMode]);

  const [licenseStatus, setLicenseStatus] = React.useState({ checked: false, isLicensed: false, machineCode: null });

  React.useEffect(() => {
    const checkLicense = async () => {
      try {
        const baseURL = import.meta.env.VITE_API_URL || (window.location.protocol === 'file:' ? 'http://localhost:5000/api' : '/api');
        const res = await axios.get(`${baseURL}/license/status`);
        setLicenseStatus({
          checked: true,
          isLicensed: res.data.isLicensed,
          machineCode: res.data.machineCode
        });
      } catch (err) {
        setLicenseStatus({ checked: true, isLicensed: false, machineCode: 'CONNECTION-ERROR' });
      }
    };
    checkLicense();
  }, []);

  if (!licenseStatus.checked) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
          <CircularProgress size={60} />
          <Box ml={2}>Initialising System Core...</Box>
        </Box>
      </ThemeProvider>
    );
  }

  if (!licenseStatus.isLicensed) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LicenseEntry
          machineCode={licenseStatus.machineCode}
          onActivated={() => setLicenseStatus({ ...licenseStatus, isLicensed: true })}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

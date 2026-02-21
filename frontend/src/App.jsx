import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme, Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

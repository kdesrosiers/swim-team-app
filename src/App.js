import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import PracticeBuilder from './pages/PracticeBuilder';
import PracticeLibrary from './pages/PracticeLibrary';
import ConfigHub from './pages/ConfigHub';
import ConfigMaintenance from './pages/ConfigMaintenance';
import SeasonsMaintenance from './pages/SeasonsMaintenance';
import FeedbackManagement from './pages/FeedbackManagement';
import SwimmerRoster from './pages/SwimmerRoster';
import UserSettings from './pages/UserSettings';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import './App.css';

// Protected route wrapper
function ProtectedRoute({ element }) {
  const userStr = localStorage.getItem('user');
  const isAuthenticated = !!userStr;
  return isAuthenticated ? element : <Navigate to="/login" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <Suspense fallback={<div style={{padding: 20}}>Loading…</div>}>
          <Routes>
            {/* Default route - redirect to login if not authenticated */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Public routes (no layout) */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes (with layout) */}
            <Route path="/home" element={<ProtectedRoute element={<Layout />} />}>
              <Route index element={<Home />} />
              <Route path="builder" element={<PracticeBuilder />} />
              <Route path="practices" element={<PracticeLibrary />} />
              <Route path="swimmers" element={<SwimmerRoster />} />
              <Route path="feedback" element={<FeedbackManagement />} />
              <Route path="config" element={<ConfigHub />} />
              <Route path="config/rosters" element={<ConfigMaintenance />} />
              <Route path="config/seasons" element={<SeasonsMaintenance />} />
              <Route path="settings" element={<UserSettings />} />
            </Route>

            {/* Catch-all for protected routes (redirect to login) */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

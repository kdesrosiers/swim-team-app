import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import PracticeBuilder from './pages/PracticeBuilder';
import PracticeLibrary from './pages/PracticeLibrary';
import ConfigHub from './pages/ConfigHub';
import ConfigMaintenance from './pages/ConfigMaintenance';
import SeasonsMaintenance from './pages/SeasonsMaintenance';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import './App.css';

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
            {/* Public routes (no layout) */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes (with layout) */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="builder" element={<PracticeBuilder />} />
              <Route path="practices" element={<PracticeLibrary />} />
              <Route path="config" element={<ConfigHub />} />
              <Route path="config/rosters" element={<ConfigMaintenance />} />
              <Route path="config/seasons" element={<SeasonsMaintenance />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

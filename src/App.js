import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import PracticeBuilder from './pages/PracticeBuilder';
import PracticeLibrary from './pages/PracticeLibrary';
import NotFound from './pages/NotFound';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{padding: 20}}>Loading…</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="builder" element={<PracticeBuilder />} />
            <Route path="practices" element={<PracticeLibrary />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

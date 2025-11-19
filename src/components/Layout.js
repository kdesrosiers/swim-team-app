import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import ThemeSettings from './ThemeSettings';
import FeedbackButton from './FeedbackButton';
import './Layout.css';

export default function Layout() {
  const { setIsSettingsOpen } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAdmin(user.isAdmin || false);
      } catch (e) {
        console.error("Failed to parse user data:", e);
        setIsAdmin(false);
      }
    }
  }, []);

  return (
    <div>
      <header className="site-header">
        <div className="brand">Swim Team App</div>
        <nav className="nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Home
          </NavLink>
          <NavLink
            to="/builder"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Practice Builder
          </NavLink>
          <NavLink
            to="/practices"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Practice Library
          </NavLink>
          {isAdmin && (
            <NavLink
              to="/swimmers"
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              Swimmers
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/feedback"
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              Feedback
            </NavLink>
          )}
          <NavLink
            to="/config"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Configuration
          </NavLink>
          <button
            className="settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Theme Settings"
          >
            🎨
          </button>
        </nav>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <ThemeSettings />
      <FeedbackButton />
    </div>
  );
}

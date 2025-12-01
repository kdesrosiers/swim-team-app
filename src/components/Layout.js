import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import ThemeSettings from './ThemeSettings';
import FeedbackButton from './FeedbackButton';
import './Layout.css';

export default function Layout() {
  const { setIsSettingsOpen } = useTheme();
  const navigate = useNavigate();
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div>
      <header className="site-header">
        <div className="brand">Swim Team App</div>
        <nav className="nav">
          <NavLink
            to="/home"
            end
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Home
          </NavLink>
          <NavLink
            to="/home/builder"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Practice Builder
          </NavLink>
          <NavLink
            to="/home/practices"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Practice Library
          </NavLink>
          {isAdmin && (
            <NavLink
              to="/home/swimmers"
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              Swimmers
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/home/feedback"
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              Feedback
            </NavLink>
          )}
          <NavLink
            to="/home/config"
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
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Sign Out"
          >
            Sign Out
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

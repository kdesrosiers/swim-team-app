import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
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
          <NavLink
            to="/config"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Configuration
          </NavLink>
        </nav>
      </header>

      <main className="site-main">
        <Outlet />
      </main>
    </div>
  );
}

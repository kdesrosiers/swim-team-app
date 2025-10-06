import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  return (
    <div className="home-page">
      <div className="home-hero">
        <h1>Welcome to Swim Team App 🏊</h1>
        <p>
          A modern platform for managing swim team practices, rosters, and training programs.
          Build, save, and export practice plans with ease.
        </p>
      </div>

      <div className="home-features">
        <div className="feature-card">
          <div className="feature-icon">📝</div>
          <h3>Practice Builder</h3>
          <p>
            Create custom practice plans with drag-and-drop sections.
            Live yardage and time calculations help you plan the perfect workout.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">📚</div>
          <h3>Practice Library</h3>
          <p>
            Browse and search your saved practices by roster and date.
            Quickly preview and reuse your best training sessions.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">⚙️</div>
          <h3>Configuration</h3>
          <p>
            Manage rosters, set default warmups, and configure practice schedules.
            Customize the app to match your team's needs.
          </p>
        </div>
      </div>

      <div className="home-cta">
        <h2>Ready to get started?</h2>
        <p>Build your first practice or explore your library</p>
        <div className="cta-buttons">
          <Link to="/builder" className="btn btn-primary">
            Create Practice
          </Link>
          <Link to="/practices" className="btn btn-secondary">
            View Library
          </Link>
        </div>
      </div>
    </div>
  );
}

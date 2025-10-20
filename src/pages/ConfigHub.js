// src/pages/ConfigHub.js
import React from "react";
import { useNavigate } from "react-router-dom";
import "./ConfigHub.css";

function ConfigHub() {
  const navigate = useNavigate();

  const configOptions = [
    {
      id: "rosters",
      title: "Roster Configuration",
      description: "Manage rosters, warmups, and practice schedules",
      icon: "👥",
      path: "/config/rosters",
      color: "#3b82f6",
    },
    {
      id: "seasons",
      title: "Seasons Management",
      description: "Configure swim seasons with start and end dates",
      icon: "📅",
      path: "/config/seasons",
      color: "#10b981",
    },
  ];

  return (
    <div className="config-hub-container">
      <div className="config-hub-header">
        <h1>Configuration</h1>
        <p className="config-hub-subtitle">
          Choose a configuration area to manage
        </p>
      </div>

      <div className="config-cards-grid">
        {configOptions.map((option) => (
          <div
            key={option.id}
            className="config-card"
            onClick={() => navigate(option.path)}
            style={{ "--card-color": option.color }}
          >
            <div className="config-card-icon">{option.icon}</div>
            <h2 className="config-card-title">{option.title}</h2>
            <p className="config-card-description">{option.description}</p>
            <div className="config-card-arrow">→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConfigHub;

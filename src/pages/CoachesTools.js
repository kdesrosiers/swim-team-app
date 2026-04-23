import React from "react";
import { useNavigate } from "react-router-dom";
import "./CoachesTools.css";

const tools = [
  {
    id: "time-standards",
    title: "Time Standards",
    description: "Manage time cut tables by event, age group, and standard level",
    icon: "🏅",
    path: "/home/coaches/time-standards",
    color: "#0ea5e9",
  },
];

export default function CoachesTools() {
  const navigate = useNavigate();
  return (
    <div className="coaches-hub-container">
      <div className="coaches-hub-header">
        <h1>Coaches Tools</h1>
        <p className="coaches-hub-subtitle">Resources and tools for coaching staff</p>
      </div>
      <div className="coaches-cards-grid">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="coaches-card"
            onClick={() => navigate(tool.path)}
            style={{ "--card-color": tool.color }}
          >
            <div className="coaches-card-icon">{tool.icon}</div>
            <h2 className="coaches-card-title">{tool.title}</h2>
            <p className="coaches-card-description">{tool.description}</p>
            <div className="coaches-card-arrow">→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

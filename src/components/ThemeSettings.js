import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './ThemeSettings.css';

export default function ThemeSettings() {
  const { theme, updateTheme, resetTheme, isSettingsOpen, setIsSettingsOpen } = useTheme();

  if (!isSettingsOpen) return null;

  const presets = [
    {
      name: 'Default Blue',
      colors: {
        primary: '#4f46e5',
        accent: '#8b5cf6',
        background: '#f9fafb',
        textPrimary: '#1f2937',
        textSecondary: '#6b7280',
      }
    },
    {
      name: 'Ocean',
      colors: {
        primary: '#0891b2',
        accent: '#06b6d4',
        background: '#f0f9ff',
        textPrimary: '#164e63',
        textSecondary: '#0e7490',
      }
    },
    {
      name: 'Forest',
      colors: {
        primary: '#059669',
        accent: '#10b981',
        background: '#f0fdf4',
        textPrimary: '#064e3b',
        textSecondary: '#047857',
      }
    },
    {
      name: 'Sunset',
      colors: {
        primary: '#dc2626',
        accent: '#f97316',
        background: '#fef2f2',
        textPrimary: '#7f1d1d',
        textSecondary: '#991b1b',
      }
    },
    {
      name: 'Dark Purple',
      colors: {
        primary: '#7c3aed',
        accent: '#a855f7',
        background: '#faf5ff',
        textPrimary: '#581c87',
        textSecondary: '#6b21a8',
      }
    }
  ];

  const applyPreset = (preset) => {
    Object.entries(preset.colors).forEach(([key, value]) => {
      updateTheme(key, value);
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="theme-backdrop" onClick={() => setIsSettingsOpen(false)} />

      {/* Modal */}
      <div className="theme-modal">
        <div className="theme-header">
          <h2>Theme Settings</h2>
          <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>
            ✕
          </button>
        </div>

        <div className="theme-content">
          {/* Color Presets */}
          <section className="theme-section">
            <h3>Color Presets</h3>
            <div className="preset-grid">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className="preset-btn"
                  onClick={() => applyPreset(preset)}
                  title={preset.name}
                >
                  <div className="preset-colors">
                    <div
                      className="preset-color"
                      style={{ background: preset.colors.primary }}
                    />
                    <div
                      className="preset-color"
                      style={{ background: preset.colors.accent }}
                    />
                  </div>
                  <span className="preset-name">{preset.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Custom Colors */}
          <section className="theme-section">
            <h3>Custom Colors</h3>
            <div className="color-controls">
              <div className="color-control">
                <label>Primary Color</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme.primary}
                    onChange={(e) => updateTheme('primary', e.target.value)}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={theme.primary}
                    onChange={(e) => updateTheme('primary', e.target.value)}
                    className="color-text"
                    placeholder="#4f46e5"
                  />
                </div>
              </div>

              <div className="color-control">
                <label>Accent Color</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme.accent}
                    onChange={(e) => updateTheme('accent', e.target.value)}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={theme.accent}
                    onChange={(e) => updateTheme('accent', e.target.value)}
                    className="color-text"
                    placeholder="#8b5cf6"
                  />
                </div>
              </div>

              <div className="color-control">
                <label>Background Color</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme.background}
                    onChange={(e) => updateTheme('background', e.target.value)}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={theme.background}
                    onChange={(e) => updateTheme('background', e.target.value)}
                    className="color-text"
                    placeholder="#f9fafb"
                  />
                </div>
              </div>

              <div className="color-control">
                <label>Text Color (Primary)</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme.textPrimary}
                    onChange={(e) => updateTheme('textPrimary', e.target.value)}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={theme.textPrimary}
                    onChange={(e) => updateTheme('textPrimary', e.target.value)}
                    className="color-text"
                    placeholder="#1f2937"
                  />
                </div>
              </div>

              <div className="color-control">
                <label>Text Color (Secondary)</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme.textSecondary}
                    onChange={(e) => updateTheme('textSecondary', e.target.value)}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={theme.textSecondary}
                    onChange={(e) => updateTheme('textSecondary', e.target.value)}
                    className="color-text"
                    placeholder="#6b7280"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Preview */}
          <section className="theme-section">
            <h3>Preview</h3>
            <div className="theme-preview">
              <div className="preview-card">
                <h4 style={{ color: theme.textPrimary }}>Sample Card</h4>
                <p style={{ color: theme.textSecondary }}>
                  This is how your text will look with the current theme settings.
                </p>
                <button
                  className="preview-button"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
                    color: 'white'
                  }}
                >
                  Sample Button
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="theme-footer">
          <button className="theme-btn secondary" onClick={resetTheme}>
            Reset to Default
          </button>
          <button className="theme-btn primary" onClick={() => setIsSettingsOpen(false)}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}

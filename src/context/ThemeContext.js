import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const DEFAULT_THEME = {
  primary: '#4f46e5',
  accent: '#8b5cf6',
  background: '#f9fafb',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('swimTeamTheme');
    return savedTheme ? JSON.parse(savedTheme) : DEFAULT_THEME;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Apply theme to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--gray-50', theme.background);
    root.style.setProperty('--text', theme.textPrimary);
    root.style.setProperty('--text-secondary', theme.textSecondary);

    // Calculate hover color (slightly darker)
    const primaryHover = adjustColorBrightness(theme.primary, -20);
    root.style.setProperty('--primary-hover', primaryHover);

    // Calculate light version
    const primaryLight = adjustColorBrightness(theme.primary, 40);
    root.style.setProperty('--primary-light', primaryLight);

    // Save to localStorage
    localStorage.setItem('swimTeamTheme', JSON.stringify(theme));
  }, [theme]);

  const updateTheme = (key, value) => {
    setTheme(prev => ({ ...prev, [key]: value }));
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      updateTheme,
      resetTheme,
      isSettingsOpen,
      setIsSettingsOpen
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Helper function to adjust color brightness
function adjustColorBrightness(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

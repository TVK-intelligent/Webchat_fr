import React from "react";
import { useTheme } from "../context/ThemeContext";
import "../styles/ThemeToggle.css";

const ThemeToggle = ({ showLabel = true, size = "normal" }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={`theme-toggle-container ${size}`}>
      {showLabel && (
        <span className="theme-label">
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </span>
      )}
      <button
        className={`theme-toggle ${theme}`}
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      >
        <div className="theme-toggle-track">
          <div className="theme-toggle-thumb">
            <span className="theme-icon">
              {theme === "light" ? "🌙" : "☀️"}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default ThemeToggle;

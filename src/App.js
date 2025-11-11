import React, { useState } from "react";
import "./App.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./styles/Theme.css";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./pages/Dashboard";

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (loading) {
    return <div className="loading-screen">Đang tải...</div>;
  }

  if (!isAuthenticated) {
    return showRegister ? (
      <Register onSwitchToLogin={() => setShowRegister(false)} />
    ) : (
      <Login onSwitchToRegister={() => setShowRegister(true)} />
    );
  }

  return <Dashboard />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

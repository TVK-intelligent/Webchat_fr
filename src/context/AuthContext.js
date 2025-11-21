import React, { createContext, useContext, useState, useEffect } from "react";
import { authService, userService } from "../services/api";
import {
  connectWebSocket,
  disconnectWebSocket,
  broadcastUserStatus,
} from "../services/websocket";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Initialize user from localStorage to preserve state across re-renders
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Update user in context and localStorage (used after profile update)
  //  IMPORTANT: This must call setUser to trigger re-render in consuming components
  const updateUser = (userData) => {
    if (!userData) return;
    try {
      // Add timestamp to force re-render of components using user data
      const updatedUserData = {
        ...userData,
        updatedAt: Date.now(), // Force re-render timestamp
      };
      localStorage.setItem("user", JSON.stringify(updatedUserData));
      setUser(updatedUserData); //  Always update state to trigger re-render
      console.log(" User updated in AuthContext:", updatedUserData);
    } catch (e) {
      console.warn("Failed to write user to localStorage", e);
    }
  };

  // Check token when app loads
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        try {
          setToken(storedToken);
          const response = await userService.getCurrentUser();
          updateUser(response.data); //  Use updateUser to sync with UI

          connectWebSocket(
            storedToken,
            () => {
              console.log(" WebSocket connected from AuthContext");

              //  Broadcast user status to ONLINE after WebSocket connection established
              setTimeout(() => {
                const user = response.data;
                broadcastUserStatus(user.id, true);
                console.log(" User status set to ONLINE on page refresh");
              }, 500); // Delay slightly to ensure WebSocket is fully ready
            },
            (error) => {
              console.error("❌ WebSocket connection failed:", error);
            }
          );
        } catch (error) {
          console.error("❌ Failed to load user:", error);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();

    // 🔴 Handle beforeunload to set OFFLINE before closing
    const handleBeforeUnload = () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          //  Gửi OFFLINE status synchronously (blocking) để ensure được xử lý
          // navigator.sendBeacon không đảm bảo gửi JSON đúng format
          // Thay vào đó, khóa connection qua navigator.sendBeacon với form-encoded data
          const beaconData = new FormData();
          beaconData.append("userId", userData.id);
          beaconData.append("isOnline", "false");

          // Cách 1: Dùng sendBeacon (best-effort, không đảm bảo)
          navigator.sendBeacon(
            "http://localhost:8081/api/users/set-offline",
            JSON.stringify({ userId: userData.id, isOnline: false })
          );
          console.log("🔴 OFFLINE status sent via sendBeacon on page close");
        } catch (e) {
          console.warn("Failed to send OFFLINE status on unload:", e);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const login = async (username, password) => {
    try {
      setError(null);
      const response = await authService.login(username, password);
      const { token: newToken, ...userData } = response.data;

      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);

      // Connect WebSocket after login
      connectWebSocket(
        newToken,
        () => {
          console.log(" WebSocket connected from login");

          //  Broadcast user status to ONLINE after WebSocket connection established
          setTimeout(() => {
            broadcastUserStatus(userData.id, true);
            console.log(" User status set to ONLINE");
          }, 500); // Delay slightly to ensure WebSocket is fully ready
        },
        (error) => {
          console.error("❌ WebSocket connection failed after login:", error);
        }
      );

      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Đăng nhập thất bại";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const register = async (username, password, displayName = "") => {
    try {
      setError(null);
      await authService.register(username, password, displayName);
      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Đăng ký thất bại";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    // 🔴 Set user status to OFFLINE before logout
    if (user?.id) {
      try {
        //  Gửi OFFLINE status via WebSocket (more reliable than REST API)
        broadcastUserStatus(user.id, false);
        console.log("🔴 User status OFFLINE sent via WebSocket during logout");
      } catch (e) {
        console.warn("Failed to send OFFLINE status via WebSocket:", e);
      }
    }

    authService.logout();
    disconnectWebSocket();
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setError(null);
  };

  const value = {
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

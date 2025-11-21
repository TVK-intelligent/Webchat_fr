import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getAvatarUrlWithTimestamp } from "../utils/avatarUtils";
import "../styles/Sidebar.css";

const Sidebar = ({ user, onTabChange, activeTab }) => {
  const { logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [forceRender, setForceRender] = useState(0);

  // Force re-render when avatar URL changes to clear image cache
  useEffect(() => {
    setForceRender((prev) => prev + 1);
  }, [user?.avatarUrl]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>Web Chat</h1>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => onTabChange("chat")}
        >
          💬 Chat
        </button>
        <button
          className={`nav-item ${activeTab === "rooms" ? "active" : ""}`}
          onClick={() => onTabChange("rooms")}
        >
          🏠 Chat Rooms
        </button>
        <button
          className={`nav-item ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => onTabChange("friends")}
        >
          👥 Friends
        </button>
        <button
          className={`nav-item ${
            activeTab === "notifications" ? "active" : ""
          }`}
          onClick={() => onTabChange("notifications")}
        >
          🔔 Notifications
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.avatarUrl ? (
              <img
                src={getAvatarUrlWithTimestamp(user.avatarUrl)}
                alt="Avatar"
                className="avatar-img"
                key={`${user.avatarUrl}-${user.updatedAt || forceRender}`}
              />
            ) : (
              user?.displayName?.charAt(0).toUpperCase() ||
              user?.username?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="user-details">
            <h4>{user?.displayName || user?.username}</h4>
            <p>{user?.username}</p>
          </div>
        </div>

        <div className="user-menu">
          <button
            className="menu-toggle"
            onClick={() => setShowMenu(!showMenu)}
          >
            ⚙️
          </button>
          {showMenu && (
            <div className="dropdown-menu">
              <button
                onClick={() => {
                  onTabChange("profile");
                  setShowMenu(false);
                }}
              >
                👤 Profile
              </button>
              <button
                onClick={() => {
                  onTabChange("settings");
                  setShowMenu(false);
                }}
              >
                ⚙️ Settings
              </button>
              <button onClick={logout} className="logout-btn">
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

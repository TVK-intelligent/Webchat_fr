import React, { useState, useEffect } from "react";
import { notificationService } from "../services/api";
import { notificationAudioService } from "../services/notificationAudioService";
import { subscribeToNotifications } from "../services/notificationWebSocket";
import { useAuth } from "../context/AuthContext";
import "../styles/Notifications.css";

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, read, unread
  const [audioEnabled, setAudioEnabled] = useState(
    notificationAudioService.isAudioEnabled()
  );

  // 🔔 Load notifications on mount (REST API)
  useEffect(() => {
    const loadInitialNotifications = async () => {
      try {
        const response = await notificationService.getNotifications();
        setNotifications(response.data || []);
        console.log("Loaded initial notifications:", response.data.length);
      } catch (error) {
        console.error("Error loading initial notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialNotifications();
  }, []);

  //  Sync audio enabled state with service
  useEffect(() => {
    const isEnabled = notificationAudioService.isAudioEnabled();
    setAudioEnabled(isEnabled);
    console.log(" Audio service enabled state synced:", isEnabled);

    // Listen for audio enabled changes from other components
    const handleAudioEnabledChanged = (e) => {
      setAudioEnabled(e.detail.enabled);
      console.log("Audio enabled changed:", e.detail.enabled);
    };

    window.addEventListener("audioEnabledChanged", handleAudioEnabledChanged);
    return () =>
      window.removeEventListener(
        "audioEnabledChanged",
        handleAudioEnabledChanged
      );
  }, []);

  //  Subscribe to real-time notifications via WebSocket
  useEffect(() => {
    if (!user?.id) {
      console.warn("User ID not available");
      return;
    }

    console.log(
      "Notifications component subscribing to WebSocket (for UI updates only)"
    );

    // NOTE: Audio playback is now handled by useNotificationListener hook
    // This component only updates the UI and displays notifications

    const subscription = subscribeToNotifications(user.id, (notification) => {
      console.log(
        "New notification received in Notifications component:",
        notification
      );

      //  Add to state (only new, not existing)
      setNotifications((prev) => {
        // Check if notification already exists
        const exists = prev.some((n) => n.id === notification.id);
        if (exists) {
          console.log(`Notification ${notification.id} already exists`);
          return prev;
        }
        console.log(`Adding new notification ${notification.id}`);
        return [notification, ...prev];
      });
    });

    return () => {
      if (subscription) {
        console.log("Unsubscribing from WebSocket notifications");
        subscription.unsubscribe();
      }
    };
  }, [user?.id]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleToggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    notificationAudioService.setEnabled(newState);
  };

  const handleDelete = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getFilteredNotifications = () => {
    switch (filter) {
      case "read":
        return notifications.filter((n) => n.read);
      case "unread":
        return notifications.filter((n) => !n.read);
      default:
        return notifications;
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "FRIEND_REQUEST":
        return "👤";
      case "ROOM_INVITE":
        return "💬";
      case "MESSAGE":
        return "💌";
      case "USER_JOINED":
        return "";
      case "USER_LEFT":
        return "❌";
      default:
        return "📢";
    }
  };

  const getNotificationText = (notification) => {
    switch (notification.type) {
      case "FRIEND_REQUEST":
        return notification.fromUser
          ? `${notification.fromUser.displayName} gửi lời mời kết bạn`
          : "Lời mời kết bạn mới";
      case "INVITE":
        if (notification.fromUser) {
          return `${
            notification.fromUser.displayName ||
            notification.fromUser.username ||
            "Người dùng"
          } mời bạn vào phòng`;
        } else if (notification.content) {
          // Fallback to content if fromUser is not available
          return notification.content;
        }
        return "Mời tham gia phòng chat";
      case "MESSAGE":
        return "Tin nhắn mới";
      case "USER_JOINED":
        return "Thành viên tham gia";
      case "USER_LEFT":
        return "Thành viên rời khỏi";
      default:
        return "Thông báo mới";
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleDateString("vi-VN");
  };

  const filteredNotifications = getFilteredNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return <div className="notifications-container">Đang tải...</div>;
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h2>Notifications</h2>
        <div className="header-controls">
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} chưa đọc</span>
          )}
          <button
            className={`btn-sound-toggle ${
              audioEnabled ? "enabled" : "disabled"
            }`}
            onClick={handleToggleAudio}
            title={
              audioEnabled ? "Tắt âm thanh thông báo" : "Bật âm thanh thông báo"
            }
          >
            {audioEnabled ? "Enabled" : "Muted"}
          </button>{" "}
        </div>
      </div>

      <div className="notification-filters">
        <button
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Tất cả
        </button>
        <button
          className={`filter-btn ${filter === "unread" ? "active" : ""}`}
          onClick={() => setFilter("unread")}
        >
          Chưa đọc
        </button>
        <button
          className={`filter-btn ${filter === "read" ? "active" : ""}`}
          onClick={() => setFilter("read")}
        >
          Đã đọc
        </button>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="no-notifications">
          <p>No notifications</p>
        </div>
      ) : (
        <div className="notifications-list">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${
                notification.read ? "read" : "unread"
              }`}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <h4>{getNotificationText(notification)}</h4>
                <p>
                  {notification.type === "INVITE" && notification.content
                    ? `Phòng: ${notification.content}`
                    : notification.content}
                </p>
                <span className="notification-time">
                  {formatTime(notification.createdAt)}
                </span>
              </div>
              <div className="notification-actions">
                {!notification.read && (
                  <button
                    className="btn-mark-read"
                    onClick={() => handleMarkAsRead(notification.id)}
                    title="Đánh dấu là đã đọc"
                  >
                    ✓
                  </button>
                )}
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(notification.id)}
                  title="Xóa"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;

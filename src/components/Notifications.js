import React, { useState, useEffect } from "react";
import { notificationService } from "../services/api";
import { notificationSoundService } from "../services/notificationSound";
import { desktopNotificationService } from "../services/desktopNotification";
import "../styles/Notifications.css";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, read, unread
  const [soundEnabled, setSoundEnabled] = useState(
    notificationSoundService.isNotificationSoundEnabled()
  );
  const [desktopNotificationEnabled, setDesktopNotificationEnabled] = useState(
    desktopNotificationService.isDesktopNotificationEnabled()
  );
  const notificationsRef = React.useRef([]);

  const loadNotifications = React.useCallback(async () => {
    try {
      const response = await notificationService.getNotifications();
      const newNotifications = response.data;

      // Phát âm thanh khi có thông báo mới chưa đọc
      const newUnreadCount = newNotifications.filter((n) => !n.read).length;
      const prevUnreadCount = notificationsRef.current.filter(
        (n) => !n.read
      ).length;

      // Nếu có thêm thông báo chưa đọc, phát âm thanh
      if (newUnreadCount > prevUnreadCount) {
        notificationSoundService.play();

        // ✅ Phát Desktop Notification chỉ cho tin nhắn chưa đọc
        if (desktopNotificationService.isDesktopNotificationEnabled()) {
          // Tìm tất cả thông báo tin nhắn chưa đọc mới (không có trong prevNotifications)
          const newUnreadMessages = newNotifications.filter(
            (n) =>
              !n.read &&
              n.type === "MESSAGE" && // Chỉ loại MESSAGE
              !notificationsRef.current.find((prev) => prev.id === n.id)
          );

          // Thông báo cho từng tin nhắn mới chưa đọc
          newUnreadMessages.forEach((newMsg) => {
            const senderName = newMsg.fromUser
              ? newMsg.fromUser.displayName || newMsg.fromUser.username
              : "Người gửi";
            const messageContent =
              newMsg.message || newMsg.content || "Tin nhắn mới";

            console.log("📨 Desktop Notification for unread message:", {
              messageId: newMsg.id,
              sender: senderName,
              content: messageContent,
            });

            // Truyền messageId để tránh trùng lặp
            desktopNotificationService.notifyNewMessage(
              senderName,
              messageContent,
              "Thông báo tin nhắn",
              newMsg.id
            );
          });
        }
      }

      notificationsRef.current = newNotifications;
      setNotifications(newNotifications);
    } catch (error) {
      console.error("❌ Lỗi tải thông báo:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load once on mount
    loadNotifications();

    // Refresh notifications mỗi 5 giây
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("❌ Lỗi đánh dấu là đã đọc:", error);
    }
  };

  const handleToggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    notificationSoundService.setEnabled(newState);
  };

  const handleToggleDesktopNotification = async () => {
    if (!desktopNotificationService.constructor.isSupported()) {
      alert("⚠️ Trình duyệt của bạn không hỗ trợ Desktop Notifications");
      return;
    }

    const newState = !desktopNotificationEnabled;

    if (newState) {
      // Yêu cầu quyền từ trình duyệt
      const granted = await desktopNotificationService.requestPermission();
      if (granted) {
        setDesktopNotificationEnabled(true);
        desktopNotificationService.setEnabled(true);
        desktopNotificationService.notifyGeneral(
          "✅ Desktop Notifications",
          "Bạn đã bật Desktop Notifications"
        );
      } else {
        alert("❌ Bạn đã từ chối quyền Desktop Notifications");
        setDesktopNotificationEnabled(false);
      }
    } else {
      setDesktopNotificationEnabled(false);
      desktopNotificationService.setEnabled(false);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("❌ Lỗi xóa thông báo:", error);
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
        return "✅";
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
        <h2>🔔 Thông báo</h2>
        <div className="header-controls">
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} chưa đọc</span>
          )}
          <button
            className={`btn-sound-toggle ${
              soundEnabled ? "enabled" : "disabled"
            }`}
            onClick={handleToggleSound}
            title={
              soundEnabled ? "Tắt âm thanh thông báo" : "Bật âm thanh thông báo"
            }
          >
            {soundEnabled ? "🔔" : "🔇"}
          </button>
          {desktopNotificationService.constructor.isSupported() && (
            <button
              className={`btn-desktop-toggle ${
                desktopNotificationEnabled ? "enabled" : "disabled"
              }`}
              onClick={handleToggleDesktopNotification}
              title={
                desktopNotificationEnabled
                  ? "Tắt Desktop Notifications"
                  : "Bật Desktop Notifications"
              }
            >
              {desktopNotificationEnabled ? "🖥️" : "⛔"}
            </button>
          )}
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
          <p>📭 Chưa có thông báo nào</p>
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
                  🗑️
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

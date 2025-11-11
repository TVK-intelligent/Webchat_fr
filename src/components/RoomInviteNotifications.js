import React, { useState, useEffect } from "react";
import { roomInviteService } from "../services/api";
import { desktopNotificationService } from "../services/desktopNotification";
import "../styles/RoomInviteNotifications.css";

const RoomInviteNotifications = () => {
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const previousInvitesRef = React.useRef([]);

  useEffect(() => {
    loadPendingInvites();
    // Refresh pending invites every 5 seconds
    const interval = setInterval(loadPendingInvites, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingInvites = async () => {
    try {
      const response = await roomInviteService.getPendingInvites();
      console.log("🎯 Pending invites data:", response.data); // Debug log

      // ✅ Phát Desktop Notification cho lời mời mới
      const newInvites = response.data || [];
      const previousInvites = previousInvitesRef.current;

      newInvites.forEach((invite) => {
        const isNewInvite = !previousInvites.find(
          (prev) => prev.id === invite.id
        );
        if (
          isNewInvite &&
          desktopNotificationService.isDesktopNotificationEnabled()
        ) {
          const inviterName =
            invite.inviter?.displayName ||
            invite.inviter?.username ||
            "Người dùng";
          const roomName = invite.roomName || "Phòng";
          desktopNotificationService.notifyRoomInvite(inviterName, roomName);
        }
      });

      previousInvitesRef.current = newInvites;
      setPendingInvites(newInvites);
    } catch (err) {
      console.error("Failed to load pending invites:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    try {
      await roomInviteService.acceptInvite(inviteId);
      setPendingInvites(
        pendingInvites.filter((invite) => invite.id !== inviteId)
      );
      showNotification("✅ Đã chấp nhận lời mời!", "success");
    } catch (err) {
      console.error("Failed to accept invite:", err);
      showNotification("❌ Lỗi khi chấp nhận lời mời", "error");
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    try {
      await roomInviteService.declineInvite(inviteId);
      setPendingInvites(
        pendingInvites.filter((invite) => invite.id !== inviteId)
      );
      showNotification("👋 Đã từ chối lời mời", "info");
    } catch (err) {
      console.error("Failed to decline invite:", err);
      showNotification("❌ Lỗi khi từ chối lời mời", "error");
    }
  };

  const toggleExpanded = (inviteId) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(inviteId)) {
      newExpanded.delete(inviteId);
    } else {
      newExpanded.add(inviteId);
    }
    setExpandedIds(newExpanded);
  };

  const showNotification = (message, type) => {
    // You can implement a toast notification here
    console.log(`[${type}] ${message}`);
  };

  if (loading) {
    return <div className="room-invites-loading">Đang tải lời mời...</div>;
  }

  if (pendingInvites.length === 0) {
    return null;
  }

  return (
    <div className="room-invite-notifications">
      <div className="notifications-header">
        <div className="header-content">
          <h3>🎯 Lời mời vào phòng</h3>
          <span className="badge">{pendingInvites.length}</span>
        </div>
        <p className="header-subtitle">
          Bạn có {pendingInvites.length} lời mời chưa trả lời
        </p>
      </div>

      <div className="invites-list">
        {pendingInvites.map((invite) => {
          // Xử lý null/undefined cho inviter
          const inviterName =
            invite.inviter?.displayName ||
            invite.inviter?.username ||
            "Người dùng";
          const inviterUsername = invite.inviter?.username || "unknown";
          const inviterAvatar = invite.inviter?.avatarUrl;
          const inviterInitial = (
            invite.inviter?.displayName ||
            invite.inviter?.username ||
            "?"
          )
            .charAt(0)
            .toUpperCase();

          return (
            <div key={invite.id} className="invite-notification">
              <div
                className="invite-main"
                onClick={() => toggleExpanded(invite.id)}
              >
                <div className="invite-avatar">
                  {inviterAvatar ? (
                    <img
                      src={`http://localhost:8081${inviterAvatar}`}
                      alt={inviterName}
                      onError={(e) => {
                        console.warn(
                          "❌ Avatar failed to load:",
                          inviterAvatar
                        );
                        e.target.style.display = "none";
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = "flex";
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="avatar-placeholder"
                    style={{
                      display: inviterAvatar ? "none" : "flex",
                    }}
                  >
                    {inviterInitial}
                  </div>
                </div>

                <div className="invite-content">
                  <div className="invite-main-info">
                    <div className="invite-title">
                      <strong className="inviter-name">{inviterName}</strong>
                      <span className="invite-verb">mời bạn vào phòng</span>
                    </div>
                    <div className="invite-inviter-detail">
                      👤{" "}
                      <span className="inviter-handle">@{inviterUsername}</span>
                    </div>
                    <div className="invite-room">
                      <span className="room-icon">🏠</span>
                      <span className="room-name">
                        {invite.roomName || "Phòng"}
                      </span>
                    </div>
                  </div>
                  {invite.createdAt && (
                    <div className="invite-time">
                      {formatTime(new Date(invite.createdAt))}
                    </div>
                  )}
                </div>

                <div
                  className={`expand-icon ${
                    expandedIds.has(invite.id) ? "expanded" : ""
                  }`}
                  title={expandedIds.has(invite.id) ? "Thu gọn" : "Xem thêm"}
                >
                  ▼
                </div>
              </div>

              {expandedIds.has(invite.id) && (
                <div className="invite-actions">
                  <button
                    className="action-btn accept-btn"
                    onClick={() => handleAcceptInvite(invite.id)}
                  >
                    ✅ Chấp nhận
                  </button>
                  <button
                    className="action-btn decline-btn"
                    onClick={() => handleDeclineInvite(invite.id)}
                  >
                    ❌ Từ chối
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper function to format time
const formatTime = (date) => {
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

export default RoomInviteNotifications;

import React, { useState, useEffect } from "react";
import { friendService } from "../services/api";
import { desktopNotificationService } from "../services/desktopNotification";
import SearchUsers from "./SearchUsers";
import "../styles/Friends.css";

const Friends = () => {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [activeTab, setActiveTab] = useState("friends"); // "friends", "pending"
  const previousRequestsRef = React.useRef([]);

  useEffect(() => {
    loadData();

    // Reload friends every 10 seconds to get latest status
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        friendService.getFriendsList(),
        friendService.getPendingRequests(),
      ]);

      console.log("👥 Friends data:", friendsRes.data); // Debug
      console.log("📥 Pending requests data:", requestsRes.data); // Debug

      // ✅ Phát Desktop Notification cho lời mời kết bạn mới
      const newRequests = requestsRes.data || [];
      const previousRequests = previousRequestsRef.current;

      newRequests.forEach((request) => {
        const isNewRequest = !previousRequests.find(
          (prev) => prev.id === request.id
        );
        if (
          isNewRequest &&
          desktopNotificationService.isDesktopNotificationEnabled()
        ) {
          const senderName =
            request.fromUser?.displayName ||
            request.fromUser?.username ||
            "Người dùng";
          desktopNotificationService.notifyFriendRequest(senderName);
        }
      });

      previousRequestsRef.current = newRequests;
      setFriends(friendsRes.data || []);
      setPendingRequests(newRequests);
    } catch (error) {
      console.error("❌ Lỗi tải dữ liệu bạn bè:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (friendshipId) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bạn này?")) {
      try {
        await friendService.removeFriend(friendshipId);
        alert("✅ Xóa bạn thành công!");
        loadData();
      } catch (error) {
        console.error("❌ Lỗi xóa bạn:", error);
        alert("❌ Không thể xóa bạn!");
      }
    }
  };

  const handleAcceptRequest = async (friendshipId) => {
    try {
      await friendService.acceptFriendRequest(friendshipId);
      alert("✅ Chấp nhận lời mời thành công!");
      loadData();
    } catch (error) {
      console.error("❌ Lỗi chấp nhận lời mời:", error);
      alert("❌ Không thể chấp nhận lời mời!");
    }
  };

  const handleDeclineRequest = async (friendshipId) => {
    try {
      await friendService.declineFriendRequest(friendshipId);
      alert("✅ Từ chối lời mời thành công!");
      loadData();
    } catch (error) {
      console.error("❌ Lỗi từ chối lời mời:", error);
      alert("❌ Không thể từ chối lời mời!");
    }
  };

  if (loading) {
    return <div className="friends-container">⏳ Đang tải...</div>;
  }

  return (
    <div className="friends-container">
      <div className="friends-header">
        <h2>👥 Danh sách Bạn bè</h2>
        <button
          className="btn-search-friends"
          onClick={() => setShowSearchModal(true)}
        >
          🔍 Tìm kiếm & Kết bạn
        </button>
      </div>

      {/* Tabs */}
      <div className="friends-tabs">
        <button
          className={`tab ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          💬 Bạn bè ({friends.length})
        </button>
        <button
          className={`tab ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          📥 Lời mời ({pendingRequests.length})
        </button>
      </div>

      {/* Friends Tab */}
      {activeTab === "friends" && (
        <div className="friends-section">
          {friends.length === 0 ? (
            <div className="no-content">
              <p>📭 Chưa có bạn bè nào. Hãy tìm kiếm & kết bạn!</p>
            </div>
          ) : (
            <div className="friends-list">
              {friends.map((friendship) => {
                // Xác định bạn của người dùng (vì mối quan hệ có thể đi từ 2 hướng)
                const friend =
                  friendship.friend.id ===
                  JSON.parse(localStorage.getItem("user"))?.id
                    ? friendship.user
                    : friendship.friend;

                // 🔍 Debug log
                console.log("🔍 Friend data:", {
                  id: friend.id,
                  username: friend.username,
                  status: friend.status,
                  showOnlineStatus: friend.showOnlineStatus,
                  isOnline:
                    friend.status === "ONLINE" && friend.showOnlineStatus,
                });

                return (
                  <div key={friendship.id} className="friend-item">
                    <div className="friend-avatar">
                      {friend.avatarUrl ? (
                        <img
                          src={`http://localhost:8081${friend.avatarUrl}`}
                          alt={friend.displayName}
                          onError={(e) => {
                            console.warn(
                              "❌ Avatar failed to load:",
                              friend.avatarUrl
                            );
                            e.target.style.display = "none";
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = "flex";
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="avatar-placeholder-friends"
                        style={{ display: friend.avatarUrl ? "none" : "flex" }}
                      >
                        {friend.displayName?.charAt(0).toUpperCase()}
                      </div>
                      {/* Status indicator */}
                      <div
                        className={`status-indicator ${
                          friend.status === "ONLINE" &&
                          friend.showOnlineStatus !== false
                            ? "online"
                            : "offline"
                        }`}
                        title={
                          friend.status === "ONLINE" &&
                          friend.showOnlineStatus !== false
                            ? "Online"
                            : "Offline"
                        }
                      />
                    </div>
                    <div className="friend-info">
                      <h4>{friend.displayName}</h4>
                      <p>@{friend.username}</p>
                      <span className="friend-status">
                        {friend.status === "ONLINE" &&
                        friend.showOnlineStatus !== false ? (
                          <span className="online-badge">🟢 Online</span>
                        ) : (
                          <span className="offline-badge">⚫ Offline</span>
                        )}
                      </span>
                    </div>
                    <button
                      className="btn-remove-friend"
                      onClick={() => handleRemoveFriend(friendship.id)}
                      title="Xóa bạn"
                    >
                      ❌
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pending Requests Tab */}
      {activeTab === "pending" && (
        <div className="pending-section">
          {pendingRequests.length === 0 ? (
            <div className="no-content">
              <p>📭 Không có lời mời chờ xử lý</p>
            </div>
          ) : (
            <div className="pending-list">
              {pendingRequests.map((invite) => (
                <div key={invite.id} className="pending-item">
                  <div className="pending-avatar">
                    {invite.user.avatarUrl ? (
                      <img
                        src={`http://localhost:8081${invite.user.avatarUrl}`}
                        alt={invite.user.displayName}
                        onError={(e) => {
                          console.warn(
                            "❌ Pending avatar failed to load:",
                            invite.user.avatarUrl
                          );
                          e.target.style.display = "none";
                          if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className="avatar-placeholder-friends"
                      style={{
                        display: invite.user.avatarUrl ? "none" : "flex",
                      }}
                    >
                      {invite.user.displayName?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="pending-info">
                    <h4>{invite.user.displayName}</h4>
                    <p>@{invite.user.username}</p>
                    <small>
                      Gửi lời mời vào{" "}
                      {new Date(invite.createdAt).toLocaleDateString("vi-VN")}
                    </small>
                  </div>
                  <div className="pending-actions">
                    <button
                      className="btn-accept-pending"
                      onClick={() => handleAcceptRequest(invite.id)}
                      title="Chấp nhận"
                    >
                      ✅
                    </button>
                    <button
                      className="btn-decline-pending"
                      onClick={() => handleDeclineRequest(invite.id)}
                      title="Từ chối"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <SearchUsers
          onClose={() => {
            setShowSearchModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default Friends;

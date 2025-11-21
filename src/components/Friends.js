import React, { useState, useEffect } from "react";
import { friendService } from "../services/api";
import webSocketService from "../services/websocket";
import SearchUsers from "./SearchUsers";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/Friends.css";

const Friends = () => {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [activeTab, setActiveTab] = useState("friends"); // "friends", "pending"

  useEffect(() => {
    loadData();

    // Subscribe to user status changes (real-time online/offline)
    console.log("Friends component: Subscribing to global user status");
    const unsubscribe = webSocketService.subscribeToUserStatus(
      null, // null = global status listener
      (statusUpdate) => {
        console.log("User status update received:", statusUpdate);

        // Update friends list with new status
        setFriends((prevFriends) => {
          console.log("Current friends before update:", prevFriends);
          const updated = prevFriends.map((friendship) => {
            // Xác định bạn (vì mối quan hệ có thể đi từ 2 hướng)
            const isFriendTheFirstUser =
              friendship.friend.id ===
              JSON.parse(localStorage.getItem("user"))?.id;
            const friend = isFriendTheFirstUser
              ? friendship.user
              : friendship.friend;

            if (friend.id === statusUpdate.userId) {
              console.log(
                `Updated friend ${statusUpdate.userId} status to ${statusUpdate.status}`
              );
              // Create updated friend object
              const updatedFriend = {
                ...friend,
                status: statusUpdate.status,
                showOnlineStatus: statusUpdate.isOnline,
              };

              // Return updated friendship
              return isFriendTheFirstUser
                ? { ...friendship, user: updatedFriend }
                : { ...friendship, friend: updatedFriend };
            }
            return friendship;
          });
          console.log("Friends after update:", updated);
          return updated;
        });
      }
    );

    console.log(
      "Friends useEffect cleanup registered, unsubscribe:",
      unsubscribe
    );

    return () => {
      console.log(
        "Friends component unmounting, unsubscribing from user status"
      );
      if (unsubscribe?.unsubscribe) {
        unsubscribe.unsubscribe();
      }
    };

    // ⚠️ DISABLED: Background service xử lý notifications
    // Component chỉ load 1 lần khi mount để hiển thị UI
    // const interval = setInterval(loadData, 10000);
    // return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        friendService.getFriendsList(),
        friendService.getPendingRequests(),
      ]);

      console.log("Friends data:", friendsRes.data); // Debug
      console.log("Pending requests data:", requestsRes.data); // Debug

      // Update UI only - don't play audio here
      // Background service will handle notifications
      setFriends(friendsRes.data || []);
      setPendingRequests(requestsRes.data || []);
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (friendshipId) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bạn này?")) {
      try {
        await friendService.removeFriend(friendshipId);
        alert("Friend removed successfully!");
        loadData();
      } catch (error) {
        console.error("Error deleting friend:", error);
        alert("Cannot remove friend!");
      }
    }
  };

  const handleAcceptRequest = async (friendshipId) => {
    try {
      await friendService.acceptFriendRequest(friendshipId);
      alert("Friend request accepted!");
      loadData();
    } catch (error) {
      console.error("Error accepting invite:", error);
      alert("Cannot accept invite!");
    }
  };

  const handleDeclineRequest = async (friendshipId) => {
    try {
      await friendService.declineFriendRequest(friendshipId);
      alert("Friend request declined!");
      loadData();
    } catch (error) {
      console.error("Error declining invite:", error);
      alert("Cannot decline invite!");
    }
  };

  if (loading) {
    return <div className="friends-container">Loading...</div>;
  }

  return (
    <div className="friends-container">
      <div className="friends-header">
        <h2>Friend List</h2>
        <button
          className="btn-search-friends"
          onClick={() => setShowSearchModal(true)}
        >
          Search & Add Friend
        </button>
      </div>

      {/* Tabs */}
      <div className="friends-tabs">
        <button
          className={`tab ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          Friends ({friends.length})
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
                          src={getFullAvatarUrl(friend.avatarUrl)}
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
                          <span className="online-badge">Online</span>
                        ) : (
                          <span className="offline-badge">Offline</span>
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
                        src={getFullAvatarUrl(invite.user.avatarUrl)}
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
                    ></button>
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

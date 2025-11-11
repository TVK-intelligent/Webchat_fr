import React, { useState, useEffect, useCallback } from "react";
import { friendService } from "../services/api";
import "../styles/SearchUsers.css";

const SearchUsers = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentRequests, setSentRequests] = useState({});
  const [friends, setFriends] = useState(new Set()); // Track current friends
  const [pendingRequests, setPendingRequests] = useState(new Set()); // Track pending requests

  // Load current friends and pending requests on mount
  useEffect(() => {
    const loadFriendsAndRequests = async () => {
      try {
        const [friendsRes, requestsRes] = await Promise.all([
          friendService.getFriendsList(),
          friendService.getPendingRequests(),
        ]);

        // Extract friend IDs
        const friendIds = new Set(
          (friendsRes.data || []).map((f) => {
            const currentUser = JSON.parse(localStorage.getItem("user"));
            return f.friend.id === currentUser.id ? f.user.id : f.friend.id;
          })
        );
        setFriends(friendIds);

        // Extract pending request sender IDs
        const pendingIds = new Set(
          (requestsRes.data || []).map((req) => req.user.id)
        );
        setPendingRequests(pendingIds);

        console.log("👥 Current friends:", friendIds);
        console.log("📥 Pending requests from:", pendingIds);
      } catch (err) {
        console.error("❌ Error loading friends and requests:", err);
      }
    };

    loadFriendsAndRequests();
  }, []);

  // Tìm kiếm người dùng
  const performSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await friendService.searchUsers(searchQuery);
      setSearchResults(response.data || []);
    } catch (err) {
      setError("Lỗi tìm kiếm: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayTimer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(delayTimer);
  }, [searchQuery, performSearch]);

  // Gửi lời mời kết bạn
  const handleSendRequest = async (userId) => {
    // Check if already friends
    if (friends.has(userId)) {
      alert("⚠️ Bạn đã là bạn bè rồi!");
      return;
    }

    // Check if already pending request
    if (pendingRequests.has(userId)) {
      alert("⚠️ Đang chờ xác nhận từ người này!");
      return;
    }

    // Check if already sent request
    if (sentRequests[userId]) {
      alert("⚠️ Bạn đã gửi lời mời rồi!");
      return;
    }

    try {
      await friendService.sendFriendRequest(userId);
      setSentRequests({ ...sentRequests, [userId]: true });
      alert("✅ Lời mời kết bạn đã gửi!");
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error("❌ Error sending friend request:", err);
      alert("❌ Lỗi: " + errorMsg);
    }
  };

  return (
    <div className="search-users-container">
      <div className="search-users-header">
        <h2>🔍 Tìm kiếm người dùng</h2>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="search-users-input">
        <input
          type="text"
          placeholder="Nhập tên hoặc username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="search-users-results">
        {loading && <div className="loading">Đang tìm kiếm...</div>}

        {!loading && searchResults.length === 0 && searchQuery && (
          <div className="no-results">Không tìm thấy người dùng</div>
        )}

        {searchResults.map((user) => (
          <div key={user.id} className="search-user-item">
            <div className="user-info">
              <img
                src={
                  user.avatarUrl
                    ? `http://localhost:8081${user.avatarUrl}`
                    : "https://via.placeholder.com/40"
                }
                alt={user.displayName}
                className="user-avatar"
              />
              <div className="user-details">
                <p className="user-name">{user.displayName}</p>
                <p className="user-username">@{user.username}</p>
              </div>
            </div>
            <button
              className={`add-friend-btn ${
                friends.has(user.id)
                  ? "already-friend"
                  : sentRequests[user.id]
                  ? "sent"
                  : ""
              }`}
              onClick={() => handleSendRequest(user.id)}
              disabled={
                friends.has(user.id) ||
                sentRequests[user.id] ||
                pendingRequests.has(user.id)
              }
              title={
                friends.has(user.id)
                  ? "Đã là bạn bè"
                  : pendingRequests.has(user.id)
                  ? "Đang chờ xác nhận"
                  : sentRequests[user.id]
                  ? "Đã gửi lời mời"
                  : "Gửi lời mời kết bạn"
              }
            >
              {friends.has(user.id)
                ? "👥 Bạn bè"
                : pendingRequests.has(user.id)
                ? "⏳ Chờ"
                : sentRequests[user.id]
                ? "✓ Đã gửi"
                : "+ Kết bạn"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchUsers;

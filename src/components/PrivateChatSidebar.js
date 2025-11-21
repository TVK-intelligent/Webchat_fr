import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { friendService } from "../services/api";
import PrivateChatConversation from "./PrivateChatConversation";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/PrivateChatSidebar.css";

const PrivateChatSidebar = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Load friends list
  useEffect(() => {
    const loadFriends = async () => {
      try {
        const response = await friendService.getFriendsList();
        setConversations(response.data || []);
        console.log("Loaded friends for chat:", response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading friends:", error);
        setLoading(false);
      }
    };

    loadFriends();
  }, []);

  const filteredConversations = conversations.filter((friendship) => {
    const friend =
      friendship.friend.id === user.id ? friendship.user : friendship.friend;
    return (
      (friend?.displayName || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (friend?.username || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (selectedFriend) {
    return (
      <div className="private-chat-sidebar">
        <PrivateChatConversation
          friend={selectedFriend}
          onBack={() => setSelectedFriend(null)}
        />
      </div>
    );
  }

  return (
    <div className="private-chat-sidebar">
      <div className="chat-sidebar-header">
        <h3>💌 Messages</h3>
      </div>

      <div className="chat-search">
        <input
          type="text"
          placeholder="🔍 Tìm bạn bè..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="chat-search-input"
        />
      </div>

      <div className="conversations-list">
        {loading ? (
          <div className="loading">Đang tải...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="no-conversations">
            <p>No messages yet</p>
          </div>
        ) : (
          filteredConversations.map((friendship) => {
            const friend =
              friendship.friend.id === user.id
                ? friendship.user
                : friendship.friend;

            const isOnline =
              friend.status === "ONLINE" && friend.showOnlineStatus !== false;

            return (
              <div
                key={friendship.id}
                className="conversation-item"
                onClick={() => setSelectedFriend(friend)}
              >
                <div className="conversation-avatar">
                  {friend.avatarUrl ? (
                    <img
                      src={getFullAvatarUrl(friend.avatarUrl)}
                      alt={friend.displayName}
                      onError={(e) => {
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
                      display: friend.avatarUrl ? "none" : "flex",
                    }}
                  >
                    {friend.displayName?.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={`online-indicator ${isOnline ? "online" : ""}`}
                  />
                </div>

                <div className="conversation-info">
                  <div className="conversation-name">{friend.displayName}</div>
                  <div className="conversation-username">
                    @{friend.username}
                  </div>
                </div>

                <div className="conversation-status">
                  {isOnline ? (
                    <span className="status-badge online">Online</span>
                  ) : (
                    <span className="status-badge offline">Offline</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PrivateChatSidebar;

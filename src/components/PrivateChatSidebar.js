import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { friendService, messageService } from "../services/api";
import PrivateChatConversation from "./PrivateChatConversation";
import { subscribeGlobalPrivateMessages } from "../services/globalMessageListener";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/PrivateChatSidebar.css";

const PrivateChatSidebar = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});
  const globalMessageSubscriptionRef = useRef(null);

  // Load friends list
  useEffect(() => {
    const loadFriends = async () => {
      try {
        const response = await friendService.getFriendsList();
        setConversations(response.data || []);
        console.log("Loaded friends for chat:", response.data);
        setLoading(false);

        // Load unread counts for each friend
        const friends = response.data || [];
        const counts = {};
        for (const friendship of friends) {
          const friend =
            friendship.friend.id === user.id
              ? friendship.user
              : friendship.friend;
          try {
            const countResponse =
              await messageService.getUnreadPrivateMessageCount(friend.id);
            counts[`private_${friend.id}`] = countResponse.data || 0;
          } catch (error) {
            console.error(
              `Error loading unread count for friend ${friend.id}:`,
              error
            );
            counts[`private_${friend.id}`] = 0;
          }
        }
        setUnreadCounts(counts);
      } catch (error) {
        console.error("Error loading friends:", error);
        setLoading(false);
      }
    };

    loadFriends();
  }, [user.id]);

  // Subscribe to incoming private messages to update unread counts
  // This should run whenever user is NOT in a specific chat
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Only subscribe if we're NOT looking at the conversation list
    // (i.e., not viewing a specific friend's chat)
    if (selectedFriend) {
      console.log("[SIDEBAR] Not subscribing - viewing a friend's chat");
      return;
    }

    console.log("[SIDEBAR] Subscribing to global private messages");

    globalMessageSubscriptionRef.current = subscribeGlobalPrivateMessages(
      user.id,
      (newMessage) => {
        console.log("[SIDEBAR] New private message received:", newMessage);

        // Only increment if message is from another user (not the current user)
        if (newMessage.senderId !== user.id) {
          const senderId = newMessage.senderId;
          const conversationId = `private_${senderId}`;

          console.log(
            `[SIDEBAR] Incrementing unread count for ${conversationId}`
          );
          setUnreadCounts((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] || 0) + 1,
          }));
        }
      }
    );

    return () => {
      console.log("[SIDEBAR] Unsubscribing from global private messages");
      if (globalMessageSubscriptionRef.current?.unsubscribe) {
        globalMessageSubscriptionRef.current.unsubscribe();
      }
    };
  }, [user?.id, selectedFriend]);

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
          onUnreadCleared={(conversationId) => {
            // Clear unread count for this conversation
            setUnreadCounts((prev) => ({
              ...prev,
              [conversationId]: 0,
            }));
          }}
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
              friend.status === "ONLINE" && friend.showOnlineStatus === true;

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
                  {unreadCounts[`private_${friend.id}`] > 0 && (
                    <span className="unread-badge">
                      {unreadCounts[`private_${friend.id}`]}
                    </span>
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

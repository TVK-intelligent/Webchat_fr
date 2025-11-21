import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  friendService,
  chatRoomService,
  messageService,
} from "../services/api";
import { subscribeToRoomEvents } from "../services/roomWebSocket";
import {
  subscribeToReadReceipt,
  subscribeToRoomChat,
  subscribeToPrivateMessages,
} from "../services/websocket";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/ConversationList.css";

const ConversationList = ({
  onSelectConversation,
  selectedConversationId,
  onUnreadCleared,
  onMessageSent,
}) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // "all", "direct", "group"
  const [unreadCounts, setUnreadCounts] = useState({});
  const readReceiptSubscriptionsRef = useRef({});
  const messageSentCallbackRef = useRef(onMessageSent);

  // Update ref when callback changes
  useEffect(() => {
    messageSentCallbackRef.current = onMessageSent;
  }, [onMessageSent]);

  // Load conversations (friends + rooms)
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const [friendsRes, roomsRes] = await Promise.all([
          friendService.getFriendsList(),
          chatRoomService.getAllRooms(),
        ]);

        const friends = (friendsRes.data || []).map((friendship) => {
          const friend =
            friendship.friend.id === user.id
              ? friendship.user
              : friendship.friend;
          return {
            id: `private_${friend.id}`,
            type: "direct",
            friend,
            displayName: friend.displayName,
            avatar: friend.avatarUrl,
            isOnline: friend.status === "ONLINE" && friend.showOnlineStatus,
            lastMessage: "",
            timestamp: new Date(),
          };
        });

        //  Filter rooms: ẩn các phòng riêng tư mà người dùng không phải là thành viên
        const allRooms = roomsRes.data || [];
        const rooms = allRooms
          .filter((room) => {
            // Hiển thị phòng công khai
            if (!room.isPrivate) {
              return true;
            }

            // Với phòng riêng tư, chỉ hiển thị nếu người dùng là thành viên
            const isMember = room.members?.some((m) => m.id === user?.id);
            return isMember;
          })
          .map((room) => ({
            id: `room_${room.id}`,
            roomId: room.id,
            type: "group",
            displayName: room.name,
            avatar: room.avatarUrl,
            description: room.description,
            memberCount: room.members?.length || 0,
            lastMessage: "",
            timestamp: new Date(),
          }));

        const allConversations = [...friends, ...rooms].sort(
          (a, b) => b.timestamp - a.timestamp
        );

        setConversations(allConversations);
        console.log(
          `Loaded conversations: ${friends.length} friends + ${rooms.length} rooms`
        );

        //  Fetch unread counts for all conversations (both rooms and private messages)
        const newUnreadCounts = {};

        // Fetch for rooms
        for (const room of rooms) {
          try {
            const response = await messageService.getUnreadCount(room.roomId);
            newUnreadCounts[room.id] = response.data || 0;
          } catch (error) {
            console.error(
              "Error fetching unread count for room",
              room.roomId,
              error
            );
          }
        }

        //  Fetch for private messages
        for (const friend of friends) {
          try {
            const response = await messageService.getUnreadPrivateMessageCount(
              friend.friend.id
            );
            newUnreadCounts[friend.id] = response.data || 0;
          } catch (error) {
            console.error(
              "Error fetching unread count for friend",
              friend.friend.id,
              error
            );
          }
        }

        setUnreadCounts(newUnreadCounts);

        setLoading(false);
      } catch (error) {
        console.error("❌ Error loading conversations:", error);
        setLoading(false);
      }
    };

    loadConversations();
  }, [user?.id]);

  // Subscribe to new rooms
  useEffect(() => {
    const roomSubscription = subscribeToRoomEvents(
      (newRoom) => {
        console.log("New room:", newRoom);
        const newConversation = {
          id: `room_${newRoom.id}`,
          roomId: newRoom.id,
          type: "group",
          displayName: newRoom.name,
          avatar: newRoom.avatarUrl,
          description: newRoom.description,
          memberCount: 0,
          lastMessage: "",
          timestamp: new Date(),
        };
        setConversations((prev) => [newConversation, ...prev]);
      },
      (deletedRoomId) => {
        setConversations((prev) =>
          prev.filter((c) => c.roomId !== deletedRoomId)
        );
      }
    );

    return () => {
      if (roomSubscription?.unsubscribe) {
        roomSubscription.unsubscribe();
      }
    };
  }, []);

  // Subscribe to room messages to move conversation to top when new messages arrive
  useEffect(() => {
    const rooms = conversations.filter((c) => c.type === "group");
    const subscriptions = [];

    rooms.forEach((room) => {
      const sub = subscribeToRoomChat(room.roomId, (newMessage) => {
        console.log(`New message in room ${room.roomId}, moving to top`);
        setConversations((prev) => {
          // Find and move the room conversation to top
          const index = prev.findIndex((c) => c.roomId === room.roomId);
          if (index > 0) {
            const updatedConversations = [...prev];
            const [roomConv] = updatedConversations.splice(index, 1);
            // Update timestamp to current time so it appears at top
            roomConv.timestamp = new Date();
            return [roomConv, ...updatedConversations];
          }
          return prev;
        });

        // Trigger callback if message was sent by current user
        if (
          newMessage.senderId === user?.id &&
          messageSentCallbackRef.current
        ) {
          messageSentCallbackRef.current("room", room.roomId);
        }
      });
      subscriptions.push(sub);
    });

    return () => {
      subscriptions.forEach((sub) => {
        if (sub?.unsubscribe) {
          sub.unsubscribe();
        }
      });
    };
  }, [conversations, user?.id]);

  // Subscribe to private messages to move conversation to top when new messages arrive
  useEffect(() => {
    if (!user?.id) return;

    const sub = subscribeToPrivateMessages(user.id, (newMessage) => {
      console.log(
        `New private message from/to ${newMessage.senderId}, moving to top`
      );
      setConversations((prev) => {
        // Find the friend conversation (could be sender or recipient)
        const friendId =
          newMessage.senderId === user.id
            ? newMessage.recipientId
            : newMessage.senderId;
        const index = prev.findIndex(
          (c) => c.type === "direct" && c.friend?.id === friendId
        );

        if (index > 0) {
          const updatedConversations = [...prev];
          const [friendConv] = updatedConversations.splice(index, 1);
          // Update timestamp to current time so it appears at top
          friendConv.timestamp = new Date();
          return [friendConv, ...updatedConversations];
        }
        return prev;
      });

      // Trigger callback if message was sent by current user
      if (newMessage.senderId === user.id && messageSentCallbackRef.current) {
        const friendId =
          newMessage.senderId === user.id
            ? newMessage.recipientId
            : newMessage.senderId;
        messageSentCallbackRef.current("direct", friendId);
      }
    });

    return () => {
      if (sub?.unsubscribe) {
        sub.unsubscribe();
      }
    };
  }, [user?.id]);

  //  Fetch unread counts periodically and subscribe to read receipts
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      const newUnreadCounts = {};

      // Fetch for rooms
      const rooms = conversations.filter((c) => c.type === "group");
      for (const room of rooms) {
        try {
          const response = await messageService.getUnreadCount(room.roomId);
          newUnreadCounts[room.id] = response.data || 0;
        } catch (error) {
          console.error(
            "Error fetching unread count for room",
            room.roomId,
            error
          );
        }
      }

      //  Fetch for private messages
      const friends = conversations.filter((c) => c.type === "direct");
      for (const friend of friends) {
        try {
          const response = await messageService.getUnreadPrivateMessageCount(
            friend.friend.id
          );
          newUnreadCounts[friend.id] = response.data || 0;
        } catch (error) {
          console.error(
            "Error fetching unread count for friend",
            friend.friend.id,
            error
          );
        }
      }

      setUnreadCounts(newUnreadCounts);
    };

    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 5000);

    //  Subscribe to read receipt events for each room
    const subscriptions = {};
    conversations
      .filter((c) => c.type === "group")
      .forEach((room) => {
        const subscription = subscribeToReadReceipt(
          room.roomId,
          (readReceipt) => {
            if (readReceipt.receiptType === "ROOM") {
              setUnreadCounts((prev) => ({
                ...prev,
                [room.id]: Math.max(
                  0,
                  (prev[room.id] || 0) - readReceipt.markedCount
                ),
              }));
            }
          }
        );
        subscriptions[room.id] = subscription;
      });

    readReceiptSubscriptionsRef.current = subscriptions;

    return () => {
      clearInterval(interval);
      Object.values(readReceiptSubscriptionsRef.current).forEach((sub) => {
        if (sub?.unsubscribe) {
          sub.unsubscribe();
        }
      });
    };
  }, [conversations]);

  const filteredConversations = conversations.filter((conv) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "direct" && conv.type === "direct") ||
      (activeTab === "group" && conv.type === "group");

    const matchesSearch = (conv.displayName || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  return (
    <div className="conversation-list">
      {/* Header */}
      <div className="conversation-list-header">
        <h3>Messages</h3>
        <button className="btn-new-chat" title="New message">
          New
        </button>
      </div>

      {/* Search */}
      <div className="conversation-search">
        <input
          type="text"
          placeholder="Tìm hội thoại..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Tabs */}
      <div className="conversation-tabs">
        <button
          className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          Tất cả
        </button>
        <button
          className={`tab-btn ${activeTab === "direct" ? "active" : ""}`}
          onClick={() => setActiveTab("direct")}
        >
          Tin nhắn riêng
        </button>
        <button
          className={`tab-btn ${activeTab === "group" ? "active" : ""}`}
          onClick={() => setActiveTab("group")}
        >
          Nhóm
        </button>
      </div>

      {/* Conversations List */}
      <div className="conversations-container">
        {loading ? (
          <div className="loading">Đang tải...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const isSelected = selectedConversationId === conversation.id;

            return (
              <div
                key={conversation.id}
                className={`conversation-item ${isSelected ? "active" : ""}`}
                onClick={() => onSelectConversation(conversation)}
              >
                {/* Avatar */}
                <div className="conversation-avatar-wrapper">
                  {conversation.avatar ? (
                    <img
                      src={getFullAvatarUrl(conversation.avatar)}
                      alt={conversation.displayName}
                      className="conversation-avatar"
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
                      display: conversation.avatar ? "none" : "flex",
                    }}
                  >
                    {conversation.type === "direct" ? (
                      conversation.displayName?.charAt(0).toUpperCase() || "?"
                    ) : (
                      <span>👥</span>
                    )}
                  </div>

                  {/* Online indicator for direct messages */}
                  {conversation.type === "direct" && (
                    <div
                      className={`online-indicator ${
                        conversation.isOnline ? "online" : ""
                      }`}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="conversation-info-wrapper">
                  <div className="conversation-header">
                    <div className="conversation-name">
                      {conversation.displayName}
                    </div>
                    <div className="conversation-time">
                      {new Date(conversation.timestamp).toLocaleTimeString(
                        "vi-VN",
                        { hour: "2-digit", minute: "2-digit" }
                      )}
                    </div>
                  </div>

                  <div className="conversation-preview">
                    {conversation.type === "direct" ? (
                      <>
                        <span className="preview-username">
                          @{conversation.friend?.username || ""}
                        </span>
                        <span className="status-text">
                          {conversation.isOnline ? "Online" : "Offline"}
                        </span>
                      </>
                    ) : (
                      <span className="group-info">
                        {conversation.memberCount} members
                      </span>
                    )}
                  </div>
                </div>

                {/* Badge */}
                <div className="conversation-badge">
                  {unreadCounts[conversation.id] > 0 && (
                    <span className="unread-badge">
                      {unreadCounts[conversation.id]}
                    </span>
                  )}
                  {conversation.type === "group" ? (
                    <span className="badge-group">👥</span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;

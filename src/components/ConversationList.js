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
  waitForWebSocketConnection,
} from "../services/websocket";
import {
  subscribeGlobalRoomMessages,
  subscribeGlobalPrivateMessages,
} from "../services/globalMessageListener";
import { notificationAudioService } from "../services/notificationAudioService";
import {
  notifyNewRoomMessage,
  notifyNewPrivateMessage,
} from "../services/pushNotificationIntegration";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/ConversationList.css";

const ConversationList = ({
  onSelectConversation,
  selectedConversationId,
  onUnreadCleared,
  onMessageSent,
  messageSentTrigger,
  unreadCounts: parentUnreadCounts = {},
}) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // "all", "direct", "group"
  const [unreadCounts, setUnreadCounts] = useState({});
  const readReceiptSubscriptionsRef = useRef({});
  const lastMessageSentTriggerRef = useRef(null);

  const moveConversationToTop = (type, id) => {
    console.log(`Moving conversation to top: type=${type}, id=${id}`);
    setConversations((prev) => {
      let index = -1;

      if (type === "room") {
        index = prev.findIndex((c) => c.roomId === id);
      } else if (type === "direct") {
        index = prev.findIndex(
          (c) => c.type === "direct" && c.friend?.id === id
        );
      }

      if (index !== -1) {
        const updatedConversations = [...prev];
        const [conv] = updatedConversations.splice(index, 1);
        conv.timestamp = new Date();
        return [conv, ...updatedConversations];
      }
      return prev;
    });
  };

  // Listen to messageSentTrigger from parent (Dashboard)
  useEffect(() => {
    if (
      messageSentTrigger &&
      messageSentTrigger.type &&
      messageSentTrigger.id &&
      (!lastMessageSentTriggerRef.current ||
        lastMessageSentTriggerRef.current.timestamp !==
          messageSentTrigger.timestamp)
    ) {
      console.log(
        `📢 ConversationList received messageSentTrigger: type=${messageSentTrigger.type}, id=${messageSentTrigger.id}`
      );
      lastMessageSentTriggerRef.current = messageSentTrigger;
      moveConversationToTop(messageSentTrigger.type, messageSentTrigger.id);
    }
  }, [messageSentTrigger]);

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

        //  Filter rooms: ẩn các phòng riêng tư mà người dùng không phải là thành viên, và ẩn các phòng PRIVATE_ tự động tạo
        const allRooms = roomsRes.data || [];
        const rooms = allRooms
          .filter((room) => {
            // Ẩn phòng PRIVATE_ tự động tạo cho private messages
            if (room.name && room.name.startsWith("PRIVATE_")) {
              return false;
            }

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
            displayName: `${room.isPrivate ? "🔒" : "🏠"} ${room.name}`,
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

        // Note: unreadCounts are now managed by Dashboard and passed as prop
        // So we don't fetch them here anymore. The parent component handles it.

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
  const roomSubscriptionsRef = useRef({});
  const roomNamesRef = useRef({}); // Cache room names to ensure we have them for push notifications

  useEffect(() => {
    // Update room names cache whenever conversations change
    conversations.forEach((conv) => {
      if (conv.type === "group" && conv.roomId) {
        // Extract actual name from displayName (remove emoji prefix - uses Unicode code points)
        // 🏠 = \uDFE0, 🔒 = \uDD12
        let actualName = conv.displayName || `Room ${conv.roomId}`;
        // Remove leading emoji and optional whitespace
        actualName = actualName.replace(/^[\uDFE0\uDD12]\s*/, "");
        roomNamesRef.current[conv.roomId] = actualName;
      }
    });
    console.log(
      `[CONVERSATION_LIST] Updated room names cache:`,
      roomNamesRef.current
    );
  }, [conversations]);

  useEffect(() => {
    // Add a ref to track if component is mounted
    let isMounted = true;

    const subscribeToRooms = async () => {
      const rooms = conversations.filter((c) => c.type === "group");
      const roomIds = rooms.map((r) => r.roomId);
      const currentRoomIds = new Set(roomIds);
      const subscribedRoomIds = new Set(
        Object.keys(roomSubscriptionsRef.current)
      );

      // Unsubscribe from all and resubscribe to get fresh callbacks
      // This ensures callbacks have access to latest conversations state
      subscribedRoomIds.forEach((roomId) => {
        const sub = roomSubscriptionsRef.current[roomId];
        if (sub?.unsubscribe) {
          console.log(
            `[CONVERSATION] Unsubscribing from room ${roomId} to refresh callback`
          );
          sub.unsubscribe();
        }
        delete roomSubscriptionsRef.current[roomId];
      });

      // Wait for WebSocket connection before subscribing to rooms
      const isConnected = await waitForWebSocketConnection(10000); // Wait up to 10 seconds
      if (!isMounted || !isConnected) {
        if (!isConnected) {
          console.warn(
            " WebSocket not connected after timeout - subscriptions will retry automatically"
          );
        }
        return;
      }

      // Subscribe to all current rooms with fresh callback
      currentRoomIds.forEach((roomId) => {
        const sub = subscribeGlobalRoomMessages(roomId, (newMessage) => {
          console.log(`New message in room ${roomId}, moving to top`);
          if (!isMounted) return;

          // Get room name from cache (always up to date)
          const roomName = roomNamesRef.current[roomId] || `Room ${roomId}`;
          console.log(
            `[CONVERSATION_LIST] Room name for push notification: "${roomName}"`
          );

          // Play notification sound if message is from another user
          if (newMessage.senderId !== user.id) {
            console.log(
              `🔊 Playing message notification sound for room ${roomId}`
            );
            notificationAudioService.playMessageSound();

            // Send push notification if tab is hidden
            const isTabHidden = document.hidden;
            if (isTabHidden) {
              const displayName =
                newMessage.senderDisplayName ||
                newMessage.sender?.displayName ||
                newMessage.senderUsername ||
                newMessage.sender?.username ||
                "Unknown";

              console.log(
                `[CONVERSATION_LIST] 📬 Sending push notification for room ${roomId} (name: "${roomName}")`
              );
              notifyNewRoomMessage(
                roomId,
                roomName,
                displayName,
                newMessage.content
              );
            }
          }

          setConversations((prev) => {
            const index = prev.findIndex((c) => c.roomId === roomId);
            if (index !== -1) {
              const updatedConversations = [...prev];
              const [roomConv] = updatedConversations.splice(index, 1);
              roomConv.timestamp = new Date();
              return [roomConv, ...updatedConversations];
            }
            return prev;
          });
        });
        roomSubscriptionsRef.current[roomId] = sub;
      });
    };

    subscribeToRooms();

    return () => {
      isMounted = false;
    };
  }, [conversations, user.id]); // Trigger whenever conversations or user changes

  // Private message moving to top is now handled via messageSentTrigger from Dashboard
  // which gets called from PrivateChatConversation when message is sent/received
  // This prevents double subscription to /user/{userId}/queue/messages

  // Sync unreadCounts with parent prop (from Dashboard)
  useEffect(() => {
    console.log(
      "[CONVERSATION] Syncing unreadCounts from parent:",
      parentUnreadCounts
    );
    setUnreadCounts(parentUnreadCounts);
  }, [parentUnreadCounts]);

  //  Subscribe to private messages to update unread counts
  const privateMessageSubscriptionRef = useRef(null);

  useEffect(() => {
    // If viewing a private chat, unsubscribe from listener to avoid updating badge
    if (selectedConversationId?.startsWith("private_")) {
      console.log(
        "[CONVERSATION] Viewing private chat, unsubscribing from listener"
      );
      if (privateMessageSubscriptionRef.current?.unsubscribe) {
        privateMessageSubscriptionRef.current.unsubscribe();
        privateMessageSubscriptionRef.current = null;
      }
      return;
    }

    if (!user?.id) {
      return;
    }

    console.log("[CONVERSATION] Subscribing to global private messages");

    privateMessageSubscriptionRef.current = subscribeGlobalPrivateMessages(
      user.id,
      (newMessage) => {
        console.log("[CONVERSATION] New private message received:", newMessage);

        // Only update badge if message is from another user
        if (newMessage.senderId !== user.id) {
          const senderId = newMessage.senderId;
          const conversationId = `private_${senderId}`;

          console.log(
            `[CONVERSATION] Incrementing badge for ${conversationId}`
          );
          setUnreadCounts((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] || 0) + 1,
          }));

          // Send push notification if tab is hidden
          const isTabHidden = document.hidden;
          const displayName =
            newMessage.senderDisplayName ||
            newMessage.sender?.displayName ||
            newMessage.senderUsername ||
            newMessage.sender?.username ||
            "Unknown";

          console.log(
            `[CONVERSATION_LIST] Private message push notification check:`,
            `isTabHidden=${isTabHidden}, sender=${displayName}`
          );

          if (isTabHidden) {
            console.log(
              `[CONVERSATION_LIST] 📬 Sending push notification for private message from ${displayName}`
            );
            notifyNewPrivateMessage(senderId, displayName, newMessage.content);
          }
        }
      }
    );

    return () => {
      console.log(
        "[CONVERSATION] Cleanup: Unsubscribing from global private messages"
      );
      if (privateMessageSubscriptionRef.current?.unsubscribe) {
        privateMessageSubscriptionRef.current.unsubscribe();
        privateMessageSubscriptionRef.current = null;
      }
    };
  }, [user?.id, selectedConversationId]);

  // Fetch and refresh unread counts periodically
  // (This will be called for room unread counts, but private message counts come from parent prop)
  useEffect(() => {
    // Skip if we already have unread counts from parent
    if (Object.keys(parentUnreadCounts).length > 0) {
      console.log(
        "[CONVERSATION] Using unread counts from parent, skipping fetch"
      );
      return;
    }

    let isMounted = true;

    const fetchUnreadCounts = async () => {
      if (!isMounted) return;

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

      if (isMounted) {
        setUnreadCounts(newUnreadCounts);
      }
    };

    // Only fetch if we don't have parent counts
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 5000);

    //  Subscribe to read receipt events for each room - wait for WebSocket first
    const subscribeToReadReceipts = async () => {
      // Wait for WebSocket connection
      const isConnected = await waitForWebSocketConnection(10000);
      if (!isMounted || !isConnected) {
        console.warn(" WebSocket not ready for read receipt subscriptions");
        return;
      }

      const subscriptions = {};
      conversations
        .filter((c) => c.type === "group")
        .forEach((room) => {
          const subscription = subscribeToReadReceipt(
            room.roomId,
            (readReceipt) => {
              if (!isMounted) return;

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

      if (isMounted) {
        readReceiptSubscriptionsRef.current = subscriptions;
      }
    };

    subscribeToReadReceipts();

    return () => {
      isMounted = false;
      clearInterval(interval);
      Object.values(readReceiptSubscriptionsRef.current).forEach((sub) => {
        if (sub?.unsubscribe) {
          sub.unsubscribe();
        }
      });
    };
  }, [conversations, parentUnreadCounts]);

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      // Cleanup room subscriptions
      Object.values(roomSubscriptionsRef.current).forEach((sub) => {
        if (sub?.unsubscribe) {
          sub.unsubscribe();
        }
      });
      roomSubscriptionsRef.current = {};
    };
  }, []);

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
        <h3>💬 Messages</h3>
        <button className="btn-new-chat" title="New message">
          ➕
        </button>
      </div>

      {/* Search */}
      <div className="conversation-search">
        <input
          type="text"
          placeholder="🔍 Tìm hội thoại..."
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

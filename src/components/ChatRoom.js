import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { chatRoomService, messageService } from "../services/api";
import { notificationSoundService } from "../services/notificationSound";
import { desktopNotificationService } from "../services/desktopNotification";
import RoomInvite from "./RoomInvite";
import RoomMembers from "./RoomMembers";
import {
  subscribeToRoomChat,
  sendChatMessage,
  subscribeToTypingIndicator,
  sendTypingIndicator,
  waitForWebSocketConnection,
  recallMessageWebSocket,
  subscribeToReadReceipt,
  subscribeToMemberEvents,
} from "../services/websocket";
import "../styles/ChatRoom.css";

const ChatRoom = ({ roomId, roomName }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [roomMembers, setRoomMembers] = useState([]);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isRoomOwner, setIsRoomOwner] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const readReceiptSubscriptionRef = useRef(null);
  const memberEventsSubscriptionRef = useRef(null);
  const loadedMessageIdsRef = useRef(new Set()); // 📌 Track loaded messages to avoid duplicate notifications
  const isPageVisibleRef = useRef(true); // 📌 Track if user is viewing the page

  // 📌 Monitor page visibility (user focus/blur)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("👋 User left the tab/browser");
        isPageVisibleRef.current = false;
      } else {
        console.log("👁️ User returned to the tab/browser");
        isPageVisibleRef.current = true;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ✅ Mark all messages as read IMMEDIATELY when entering room
  useEffect(() => {
    console.log("🚀 ChatRoom mounted for roomId:", roomId);

    // Call markAllAsRead as soon as possible, don't wait for loadMessages
    const markAsReadImmediately = async () => {
      try {
        console.log("📝 Marking all messages as read in room", roomId);
        await messageService.markAllAsRead(roomId);
        console.log("✅ Immediately marked all messages in room as read");
      } catch (error) {
        console.error("❌ Error marking all messages as read:", error);
      }
    };

    // Call it right away without waiting
    markAsReadImmediately();

    // Subscribe to read receipt events to update UI when other users mark read
    const subscription = subscribeToReadReceipt(roomId, (readReceipt) => {
      console.log(
        `📬 Read receipt in room ${roomId} from user ${readReceipt.userId}:`,
        readReceipt
      );
      // Just log - the badge will be updated by RoomList's subscription
    });
    readReceiptSubscriptionRef.current = subscription;

    return () => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [roomId]);

  // Load messages khi component mount
  useEffect(() => {
    // 📌 Reset loaded message IDs khi đổi phòng
    loadedMessageIdsRef.current.clear();

    const loadMessages = async () => {
      try {
        const response = await messageService.getMessages(roomId);
        // Normalize messages từ REST API (có createdAt) và WebSocket (có timestamp)
        const processedMessages = response.data.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp || msg.createdAt, // Normalize timestamp field
          senderUsername: msg.sender?.username || msg.senderUsername, // Get from sender object or field
          senderDisplayName: msg.sender?.displayName || msg.senderDisplayName, // Get from sender object or field
          content: msg.recalled ? "Message recalled" : msg.content,
        }));
        setMessages(processedMessages);

        // 📌 Lưu tất cả messageIds đã load từ server để tránh gửi notification cho tin nhắn cũ
        processedMessages.forEach((msg) => {
          loadedMessageIdsRef.current.add(msg.id);
        });
        console.log(
          `✅ Loaded ${processedMessages.length} messages, preventing duplicate notifications for:`,
          Array.from(loadedMessageIdsRef.current)
        );

        setLoading(false);
      } catch (error) {
        console.error("❌ Lỗi tải tin nhắn:", error);
        setLoading(false);
      }
    };

    const loadRoomMembers = async () => {
      try {
        const response = await chatRoomService.getRoomMembers(roomId);
        setRoomMembers(response.data);

        // Lấy room info để check xem user có phải chủ phòng không
        const roomResponse = await chatRoomService.getRoomById(roomId);
        setIsRoomOwner(roomResponse.data?.owner?.id === user.id);
        console.log(
          `👑 Room owner: ${roomResponse.data?.owner?.id}, Current user: ${
            user.id
          }, IsOwner: ${roomResponse.data?.owner?.id === user.id}`
        );
      } catch (error) {
        console.error("❌ Lỗi tải thành viên phòng:", error);
      }
    };

    loadMessages();
    loadRoomMembers();
  }, [roomId, user.id]);

  // Subscribe to member events (leave/kick)
  useEffect(() => {
    const subscription = subscribeToMemberEvents(roomId, (memberEvent) => {
      console.log("👥 Member event received:", memberEvent);

      if (memberEvent.reason === "left") {
        console.log(`✅ Member ${memberEvent.username} left the room`);
      } else if (memberEvent.reason === "kicked") {
        console.log(
          `🚫 Member ${memberEvent.username} was kicked from the room`
        );

        // Nếu chính mình bị đuổi, hiển thị thông báo và rời khỏi phòng
        if (memberEvent.userId === user.id) {
          alert("❌ Bạn đã bị đuổi khỏi phòng này!");
          // Navigate back to room list (sẽ được xử lý ở component cha)
          window.location.hash = "/";
          window.location.reload();
        }
      }

      // Reload danh sách thành viên
      chatRoomService
        .getRoomMembers(roomId)
        .then((res) => setRoomMembers(res.data))
        .catch((err) => console.error("Lỗi reload thành viên:", err));
    });

    memberEventsSubscriptionRef.current = subscription;

    return () => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [roomId, user.id]);

  // Subscribe to room chat messages
  useEffect(() => {
    const subscription = subscribeToRoomChat(roomId, (newMessage) => {
      console.log("📨 New message received from WebSocket:", newMessage);

      // Phát âm thanh khi có tin nhắn mới từ người khác
      if (newMessage.senderId !== user.id) {
        notificationSoundService.play();

        // 📌 Chỉ gửi desktop notification nếu message này chưa được load trước đó
        const isNewMessage = !loadedMessageIdsRef.current.has(newMessage.id);

        if (isNewMessage) {
          console.log(
            `✅ Message ${newMessage.id} is NEW (not in loaded messages), sending desktop notification`
          );

          // 📌 Chỉ gửi notification khi user KHÔNG xem tab
          const shouldNotify = !isPageVisibleRef.current;

          if (shouldNotify && !newMessage.read) {
            const senderName =
              newMessage.senderDisplayName ||
              newMessage.senderUsername ||
              "Người dùng";
            const messageContent =
              newMessage.content || "[Tin nhắn không có nội dung]";

            console.log("🖥️ Desktop Notification check:");
            console.log("   Page visible:", isPageVisibleRef.current);
            console.log("   Should notify:", shouldNotify);
            console.log(
              "   Enabled:",
              desktopNotificationService.isDesktopNotificationEnabled()
            );
            console.log("   Sender:", senderName);
            console.log("   Content:", messageContent);
            console.log("   Message ID:", newMessage.id);
            console.log("   Is unread:", !newMessage.read);

            // Truyền messageId để tránh trùng lặp notification
            desktopNotificationService.notifyNewMessage(
              senderName,
              messageContent,
              roomName,
              newMessage.id
            );

            console.log("✅ Desktop notification called");
          } else if (!shouldNotify) {
            console.log(
              "ℹ️ User is viewing page, skipping desktop notification (user can see message in app)"
            );
          }
        } else {
          console.log(
            `⏭️ Message ${newMessage.id} was already loaded, skipping desktop notification`
          );
        }

        // ✅ Auto mark new message as read when it arrives (user is viewing room)
        messageService
          .markAsRead(newMessage.id)
          .then(() => {
            console.log(
              `✅ Auto-marked new message ${newMessage.id} as read (user is in room)`
            );
          })
          .catch((error) => {
            console.warn(
              `⚠️ Failed to auto-mark message ${newMessage.id} as read:`,
              error
            );
          });
      }

      // Normalize message data
      const normalizedMessage = {
        ...newMessage,
        timestamp: newMessage.timestamp || new Date().toISOString(),
        senderUsername:
          newMessage.senderUsername || newMessage.sender?.username,
        senderDisplayName:
          newMessage.senderDisplayName || newMessage.sender?.displayName,
      };

      // 📌 Lưu message ID vào set để biết nó đã được load
      loadedMessageIdsRef.current.add(newMessage.id);

      // Handle recall events that come through /topic/room/{roomId}
      // (backend may send them here for compatibility)
      if (
        newMessage.recalled === true &&
        newMessage.content === "Message recalled"
      ) {
        console.log(
          "🔙 Recall event received from room channel, will process it"
        );
        // Don't skip - process it immediately
        const messageId = newMessage.id;
        setMessages((prev) =>
          prev.map((msg) => {
            if (String(msg.id) === String(messageId)) {
              console.log(
                `✅ Updating message ${messageId} to recalled status (via room channel)`
              );
              return {
                ...msg,
                content: "Message recalled",
                recalled: true,
              };
            }
            return msg;
          })
        );
        return;
      }

      setMessages((prev) => {
        // Kiểm tra nếu tin nhắn này đã tồn tại (update case - ví dụ recalled)
        const existingMessageIndex = prev.findIndex(
          (msg) => String(msg.id) === String(normalizedMessage.id)
        );

        if (existingMessageIndex !== -1) {
          // Cập nhật tin nhắn đã tồn tại (recalled, edited, etc)
          console.log("🔄 Updating existing message:", normalizedMessage.id);
          const updated = [...prev];
          updated[existingMessageIndex] = {
            ...normalizedMessage,
            pending: false,
          };
          return updated;
        }

        // Tìm pending message của người gửi message này
        const hasPendingFromSender = prev.some(
          (msg) => msg.pending && msg.senderId === normalizedMessage.senderId
        );

        if (hasPendingFromSender) {
          // Replace pending message bằng message từ server
          console.log(
            "✅ Replacing pending message with server response:",
            normalizedMessage.id
          );
          return prev.map((msg) => {
            if (msg.pending && msg.senderId === normalizedMessage.senderId) {
              return {
                ...normalizedMessage,
                pending: false,
              };
            }
            return msg;
          });
        } else {
          // Đây là message từ người khác hoặc không phải pending
          console.log(
            "➕ Adding new message from other user:",
            normalizedMessage.senderUsername
          );
          return [...prev, { ...normalizedMessage, pending: false }];
        }
      });
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [roomId, user.id, roomName]);

  // Subscribe to typing indicators
  useEffect(() => {
    const subscription = subscribeToTypingIndicator(roomId, (data) => {
      if (data.isTyping) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.userId]: data,
        }));
      } else {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          delete updated[data.userId];
          return updated;
        });
      }
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [roomId]);

  // Note: Recall events are now handled through subscribeToRoomChat
  // No need for separate /topic/recall/room/{roomId} subscription

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const messageContent = input;
    const messageId = Date.now(); // Temporary ID for optimistic update

    // Optimistic update - thêm message vào UI ngay lập tức
    const optimisticMessage = {
      id: messageId,
      roomId: roomId,
      senderId: user.id,
      senderUsername: user.username,
      senderDisplayName: user.displayName,
      content: messageContent,
      timestamp: new Date().toISOString(),
      recalled: false,
      pending: true, // Đánh dấu là message chưa được confirm
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInput("");
    setTypingUsers((prev) => {
      const updated = { ...prev };
      delete updated[user.id];
      return updated;
    });

    try {
      // 🔊 Phát âm thanh khi gửi tin nhắn
      notificationSoundService.play();

      // ⏳ Đợi WebSocket kết nối
      const isConnected = await waitForWebSocketConnection(5000);

      if (isConnected) {
        // 📤 Gửi CHỈ qua WebSocket
        console.log("📤 Sending message via WebSocket...");
        sendChatMessage(roomId, user.id, messageContent);
        console.log("✅ Message sent via WebSocket");

        // WebSocket subscription sẽ nhận message từ server
        // và tự động replace pending message
      } else {
        console.error("❌ WebSocket connection failed");
        // Remove optimistic message nếu lỗi
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        alert("❌ Lỗi kết nối WebSocket. Không thể gửi tin nhắn.");
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
      // Remove optimistic message nếu lỗi
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      alert(
        "❌ Lỗi gửi tin nhắn: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);

    // Always send typing indicator - let websocket service handle retries
    // Clear existing timeout
    if (typingTimeoutRef.current[user.id]) {
      clearTimeout(typingTimeoutRef.current[user.id]);
    }

    // Send typing start indicator (websocket service will retry if needed)
    sendTypingIndicator(roomId, user.id, true);

    // Set new timeout to stop typing
    typingTimeoutRef.current[user.id] = setTimeout(() => {
      sendTypingIndicator(roomId, user.id, false);
    }, 3000);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRecallMessage = async (messageId) => {
    try {
      if (!messageId) {
        console.error("❌ Invalid messageId:", messageId);
        alert("Lỗi: ID tin nhắn không hợp lệ");
        return;
      }

      console.log("🔙 Attempting to recall message:", messageId);

      // Chỉ gửi WebSocket message - backend sẽ xử lý database và broadcast
      await recallMessageWebSocket(roomId, messageId);
      console.log("✅ Message recall request sent via WebSocket");

      // UI sẽ được update khi nhận WebSocket response từ server
    } catch (error) {
      console.error("❌ Error recalling message:", error);
      alert(
        "Lỗi thu hồi tin nhắn: " +
          (error.response?.data?.message || error.message || error.toString())
      );
    }
    setSelectedMessageId(null);
  };

  const canRecallMessage = (message) => {
    if (!message) {
      console.log("❌ canRecallMessage: message is empty");
      return false;
    }
    // Chỉ người gửi mới có thể thu hồi
    if (message.senderId !== user.id) {
      console.log("❌ canRecallMessage: not sender", message.senderId, user.id);
      return false;
    }
    // Không thu hồi tin nhắn đã bị gọi lại
    if (message.recalled) {
      console.log("❌ canRecallMessage: already recalled");
      return false;
    }
    // Chỉ thu hồi tin nhắn trong 2 phút
    const messageTime = new Date(message.timestamp);
    const currentTime = new Date();
    const diffInMinutes = (currentTime - messageTime) / (1000 * 60);
    const canRecall = diffInMinutes <= 2;
    console.log(
      `📊 canRecallMessage: ${canRecall}, diff=${diffInMinutes.toFixed(
        2
      )}min, timestamp=${message.timestamp}`
    );
    return canRecall;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypingText = () => {
    const typingUserIds = Object.keys(typingUsers);
    if (typingUserIds.length === 0) return "";
    if (typingUserIds.length === 1) {
      const userId = typingUserIds[0];
      const member = roomMembers.find((m) => m.id === parseInt(userId));
      return `${member?.username || "Ai đó"} đang gõ...`;
    }
    return `${typingUserIds.length} người đang gõ...`;
  };

  const handleLeaveRoom = async () => {
    if (
      window.confirm(
        "Bạn có chắc muốn rời phòng này? (Chủ phòng không thể rời)"
      )
    ) {
      try {
        console.log("🚪 Attempting to leave room:", roomId);
        await chatRoomService.leaveRoom(roomId);
        console.log("✅ Left room successfully");
        alert("✅ Bạn đã rời khỏi phòng này");
        // Navigate back to room list
        window.location.hash = "/";
        window.location.reload();
      } catch (error) {
        console.error("❌ Error leaving room:", error);
        alert("❌ " + (error.response?.data?.error || error.message));
      }
    }
  };

  if (loading) {
    return <div className="chat-room-container">Đang tải...</div>;
  }

  return (
    <div className="chat-room-container">
      <div className="chat-header">
        <h2>{roomName}</h2>
        <div className="header-right">
          <span className="member-count">{roomMembers.length} thành viên</span>
          <button
            className="btn-invite"
            onClick={() => setShowMembersModal(true)}
            title="Xem danh sách thành viên"
          >
            👥 Thành viên
          </button>
          <button
            className="btn-invite"
            onClick={() => setShowInviteModal(true)}
            title="Mời bạn vào phòng"
          >
            ➕ Mời
          </button>
          {!isRoomOwner && (
            <button
              className="btn-leave"
              onClick={handleLeaveRoom}
              title="Rời phòng"
            >
              � Rời
            </button>
          )}
        </div>
      </div>

      {showMembersModal && (
        <RoomMembers
          roomId={roomId}
          onClose={() => setShowMembersModal(false)}
          isOwner={isRoomOwner}
        />
      )}

      {showInviteModal && (
        <RoomInvite
          roomId={roomId}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={() => {
            // Reload room members when invite is sent
            chatRoomService
              .getRoomMembers(roomId)
              .then((res) => setRoomMembers(res.data));
          }}
        />
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>📭 Không có tin nhắn nào</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.senderId === user.id ? "sent" : "received"
              } ${msg.pending ? "pending" : ""} ${
                msg.recalled ? "recalled" : ""
              }`}
              onMouseEnter={() => setSelectedMessageId(msg.id)}
              onMouseLeave={() => setSelectedMessageId(null)}
            >
              <div className="message-content">
                <strong>
                  {msg.senderDisplayName || msg.senderUsername || "Unknown"}
                </strong>
                <p className={msg.recalled ? "recalled" : ""}>{msg.content}</p>
                <span className="message-time">
                  {msg.timestamp && formatTime(msg.timestamp)}{" "}
                  {msg.pending && "⏳"}
                </span>
              </div>
              {msg.senderId === user.id &&
                selectedMessageId === msg.id &&
                !msg.recalled &&
                !msg.pending && (
                  <div className="message-actions">
                    {canRecallMessage(msg) ? (
                      <button
                        className="btn-action btn-recall"
                        onClick={() => {
                          console.log(
                            "🖱️ Recall button clicked for message:",
                            msg.id
                          );
                          handleRecallMessage(msg.id);
                        }}
                        title="Thu hồi tin nhắn (còn 2 phút)"
                      >
                        🔙 Thu hồi
                      </button>
                    ) : (
                      <span style={{ color: "#999", fontSize: "12px" }}>
                        ⏰ Hết hạn thu hồi
                      </span>
                    )}
                  </div>
                )}
            </div>
          ))
        )}
        {getTypingText() && (
          <div className="typing-indicator">
            <p>{getTypingText()}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Nhập tin nhắn... (Shift+Enter để xuống dòng)"
          rows="3"
        />
        <button onClick={handleSendMessage} className="btn-send">
          📤 Gửi
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;

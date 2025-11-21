import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { chatRoomService, messageService } from "../services/api";
import { useMessageNotification } from "../hooks/useMessageNotification";
import RoomInvite from "./RoomInvite";
import RoomMembers from "./RoomMembers";
import EmojiPicker from "emoji-picker-react";
import {
  subscribeToRoomChat,
  sendChatMessage,
  subscribeToTypingIndicator,
  sendTypingIndicator,
  waitForWebSocketConnection,
  recallMessageWebSocket,
  subscribeToReadReceipt,
  subscribeToMemberEvents,
  subscribeToMessageRecall,
} from "../services/websocket";
import "../styles/ChatRoom.css";

const ChatRoom = ({ roomId, roomName, onMessageSent }) => {
  const { user } = useAuth();
  const { handleNewMessage } = useMessageNotification(roomId, roomName);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [roomMembers, setRoomMembers] = useState([]);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isRoomOwner, setIsRoomOwner] = useState(false);
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const readReceiptSubscriptionRef = useRef(null);
  const memberEventsSubscriptionRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Mark all messages as read IMMEDIATELY when entering room
  useEffect(() => {
    console.log("ChatRoom mounted for roomId:", roomId);

    // Call markAllAsRead as soon as possible, don't wait for loadMessages
    const markAsReadImmediately = async () => {
      try {
        console.log("Marking all messages as read in room", roomId);
        await messageService.markAllAsRead(roomId);
        console.log("Immediately marked all messages in room as read");
      } catch (error) {
        console.error("Error marking all messages as read:", error);
      }
    };

    // Call it right away without waiting
    markAsReadImmediately();

    // Subscribe to read receipt events to update UI when other users mark read
    const subscription = subscribeToReadReceipt(roomId, (readReceipt) => {
      console.log(
        `Read receipt in room ${roomId} from user ${readReceipt.userId}:`,
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
    const loadMessages = async () => {
      try {
        const response = await messageService.getMessages(roomId);
        // Normalize messages từ REST API (có createdAt) và WebSocket (có timestamp)
        const processedMessages = response.data.map((msg) => {
          const normalized = {
            ...msg,
            timestamp: msg.timestamp || msg.createdAt, // Normalize timestamp field
            senderUsername: msg.sender?.username || msg.senderUsername, // Get from sender object or field
            senderDisplayName: msg.sender?.displayName || msg.senderDisplayName, // Get from sender object or field
          };

          // Xử lý tin nhắn đã thu hồi
          if (msg.recalled) {
            normalized.content = "🔙 Tin nhắn đã bị thu hồi";
            normalized.recalled = true;
            // Lưu trữ thông tin người thu hồi nếu có
            normalized.recalledBySenderDisplayName =
              msg.recalledBySenderDisplayName || msg.senderDisplayName;
            normalized.recalledBySenderUsername =
              msg.recalledBySenderUsername || msg.senderUsername;
          } else {
            normalized.content = msg.content;
            normalized.recalled = false;
          }

          return normalized;
        });
        setMessages(processedMessages);
        console.log(
          `Loaded ${processedMessages.length} messages for room ${roomId}`
        );

        setLoading(false);
      } catch (error) {
        console.error("Lỗi tải tin nhắn:", error);
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
        setIsPrivateRoom(roomResponse.data?.isPrivate || false);

        console.log(
          `Room owner: ${roomResponse.data?.owner?.id}, Current user: ${
            user.id
          }, IsOwner: ${roomResponse.data?.owner?.id === user.id}, IsPrivate: ${
            roomResponse.data?.isPrivate
          }`
        );
      } catch (error) {
        console.error("Lỗi tải thành viên phòng:", error);
      }
    };

    loadMessages();
    loadRoomMembers();
  }, [roomId, user.id]);

  // Subscribe to member events (leave/kick)
  useEffect(() => {
    const subscription = subscribeToMemberEvents(roomId, (memberEvent) => {
      console.log("Member event received:", memberEvent);

      if (memberEvent.reason === "left") {
        console.log(`Member ${memberEvent.username} left the room`);
      } else if (memberEvent.reason === "kicked") {
        console.log(`Member ${memberEvent.username} was kicked from the room`);

        // Nếu chính mình bị đuổi, hiển thị thông báo và rời khỏi phòng
        if (memberEvent.userId === user.id) {
          alert("Bạn đã bị đuổi khỏi phòng này!");
          // Navigate back to room list (sẽ được xử lý ở component cha)
          window.location.hash = "/";
          window.location.reload();
        }
      }

      // Reload danh sách thành viên
      chatRoomService
        .getRoomMembers(roomId)
        .then((res) => setRoomMembers(res.data))
        .catch((err) => console.error("Error reloading members:", err));
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
      console.log("New message received from WebSocket:", newMessage);

      // Handle notification (sound + desktop notification)
      handleNewMessage(newMessage);

      // Auto mark new message as read when it arrives (user is viewing room)
      if (newMessage.senderId !== user.id) {
        messageService
          .markAsRead(newMessage.id)
          .then(() => {
            console.log(
              `Auto-marked new message ${newMessage.id} as read (user is in room)`
            );
          })
          .catch((error) => {
            console.warn(
              `Failed to auto-mark message ${newMessage.id} as read:`,
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

      // Handle recall events that come through /topic/room/{roomId}
      // (backend may send them here for compatibility)
      if (
        newMessage.recalled === true &&
        newMessage.content === "Message recalled"
      ) {
        console.log("Recall event received from room channel, will process it");
        // Don't skip - process it immediately
        const messageId = newMessage.id;
        setMessages((prev) =>
          prev.map((msg) => {
            if (String(msg.id) === String(messageId)) {
              console.log(
                `Updating message ${messageId} to recalled status (via room channel)`
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
          console.log("Updating existing message:", normalizedMessage.id);
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
            "Replacing pending message with server response:",
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
            "Adding new message from other user:",
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
  }, [roomId, user.id, roomName, handleNewMessage]);

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

  // Subscribe to message recall events
  useEffect(() => {
    console.log("Setting up message recall subscription for room:", roomId);

    const subscription = subscribeToMessageRecall(roomId, (recallEvent) => {
      console.log("Message recall event received:", recallEvent);

      // Kiểm tra xem đây có phải event cho người thu hồi không
      const isForRecaller = recallEvent.forRecaller === true;
      console.log("isForRecaller:", isForRecaller);

      // Nếu đây là event cho người thu hồi, chỉ cần update tin nhắn mà không cần notification
      if (isForRecaller && recallEvent.senderId === user.id) {
        console.log(
          "This is for recaller - updating message without notification"
        );
        const messageId = recallEvent.messageId || recallEvent.id;

        setMessages((prev) => {
          const updated = [...prev];
          const index = updated.findIndex(
            (msg) => String(msg.id) === String(messageId)
          );

          if (index !== -1) {
            console.log(`Updating recalled message ${messageId} for recaller`);
            updated[index] = {
              ...updated[index],
              content: "Message recalled",
              recalled: true,
            };
          }
          return updated;
        });
        return; // Không hiển thị notification cho người thu hồi
      }

      // Đối với những người khác, hiển thị thông báo chi tiết
      if (!isForRecaller || recallEvent.senderId !== user.id) {
        console.log(
          "This is for other members - showing detailed notification"
        );
        const messageId = recallEvent.messageId || recallEvent.id;
        console.log(
          "Looking for messageId:",
          messageId,
          "Type:",
          typeof messageId
        );

        // Update message to show recalled status
        setMessages((prev) => {
          console.log("Current messages count:", prev.length);
          let updated = [...prev];
          let foundByRealId = false;

          // First, try to find by real message ID
          const realIdIndex = updated.findIndex(
            (msg) => String(msg.id) === String(messageId) && !msg.pending
          );
          if (realIdIndex !== -1) {
            console.log(`Found message by real ID: ${messageId}`);
            const oldMsg = updated[realIdIndex];
            updated[realIdIndex] = {
              ...oldMsg,
              content: "🔙 Tin nhắn đã bị thu hồi",
              recalled: true,
              // Preserve sender info (original sender)
              senderDisplayName: oldMsg.senderDisplayName || "Unknown",
              senderUsername: oldMsg.senderUsername || "Unknown",
              // Store who recalled this message (from recallEvent)
              recalledBySenderDisplayName: recallEvent.senderDisplayName,
              recalledBySenderUsername: recallEvent.senderUsername,
            };
            foundByRealId = true;
          }

          // If not found by real ID, try to find pending message from same sender
          if (!foundByRealId && recallEvent.senderId) {
            const pendingIndex = updated.findIndex(
              (msg) =>
                msg.pending &&
                msg.senderId === recallEvent.senderId &&
                msg.roomId === roomId
            );
            if (pendingIndex !== -1) {
              console.log(
                `Found pending message from sender ${recallEvent.senderId}, marking as recalled`
              );
              const oldMsg = updated[pendingIndex];
              updated[pendingIndex] = {
                ...oldMsg,
                content: "Message recalled",
                recalled: true,
                // Update with real ID from backend and preserve sender info
                id: messageId,
                senderDisplayName: oldMsg.senderDisplayName || "Unknown",
                senderUsername: oldMsg.senderUsername || "Unknown",
                // Store who recalled this message (from recallEvent)
                recalledBySenderDisplayName: recallEvent.senderDisplayName,
                recalledBySenderUsername: recallEvent.senderUsername,
              };
            } else {
              console.warn(
                `No pending message found from sender ${recallEvent.senderId}`
              );
            }
          } else if (!foundByRealId) {
            console.warn(
              `Message not found by real ID ${messageId} and no sender ID in event`
            );
          }

          return updated;
        });
      }
    });

    console.log("Recall subscription set up, subscription:", subscription);

    return () => {
      console.log("Cleaning up recall subscription for room:", roomId);
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [roomId, user.id]);

  // Note: Recall events are now handled through subscribeToMessageRecall

  // Scroll to bottom - luôn scroll xuống cuối
  useEffect(() => {
    const container = document.querySelector(".messages-container");
    if (container) {
      // Luôn scroll xuống dưới cùng
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 0);
    }
  }, [messages]);

  // Handle click outside emoji picker
  useEffect(() => {
    if (showEmojiPicker) {
      document.addEventListener("click", handleClickOutsideEmojiPicker);
      return () => {
        document.removeEventListener("click", handleClickOutsideEmojiPicker);
      };
    }
  }, [showEmojiPicker]);

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

    //  Notify parent that message was sent (move conversation to top)
    if (onMessageSent) {
      onMessageSent("room", roomId);
    }

    try {
      // Wait for WebSocket connection
      const isConnected = await waitForWebSocketConnection(5000);

      if (isConnected) {
        // Send ONLY via WebSocket
        console.log("Sending message via WebSocket...");
        sendChatMessage(roomId, user.id, messageContent);
        console.log("Message sent via WebSocket");

        // WebSocket subscription will receive message from server
        // and automatically replace pending message
      } else {
        console.error("WebSocket connection failed");
        // Remove optimistic message if error
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        alert("WebSocket connection error. Cannot send message.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message if error
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      alert(
        "Error sending message: " +
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
        console.error("Invalid messageId:", messageId);
        alert("Error: Invalid message ID");
        return;
      }

      console.log("Attempting to recall message:", messageId);

      // Send WebSocket message only - backend will handle database and broadcast
      await recallMessageWebSocket(roomId, messageId);
      console.log("Message recall request sent via WebSocket");

      // UI will be updated when receiving WebSocket response from server
    } catch (error) {
      console.error("Error recalling message:", error);
      alert(
        "Error recalling message: " +
          (error.response?.data?.message || error.message || error.toString())
      );
    }
    setSelectedMessageId(null);
  };

  const canRecallMessage = (message) => {
    if (!message) {
      console.log("canRecallMessage: message is empty");
      return false;
    }
    // Only sender can recall
    if (message.senderId !== user.id) {
      console.log("canRecallMessage: not sender", message.senderId, user.id);
      return false;
    }
    // Don't recall already recalled message
    if (message.recalled) {
      console.log("canRecallMessage: already recalled");
      return false;
    }
    // Only recall message within 2 minutes
    const messageTime = new Date(message.timestamp);
    const currentTime = new Date();
    const diffInMinutes = (currentTime - messageTime) / (1000 * 60);
    const canRecall = diffInMinutes <= 2;
    console.log(
      `canRecallMessage: ${canRecall}, diff=${diffInMinutes.toFixed(
        2
      )}min, timestamp=${message.timestamp}`
    );
    return canRecall;
  };

  const handleEmojiClick = (emojiObject) => {
    setInput((prevInput) => prevInput + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleClickOutsideEmojiPicker = (e) => {
    if (
      emojiPickerRef.current &&
      !emojiPickerRef.current.contains(e.target) &&
      !e.target.classList.contains("btn-emoji")
    ) {
      setShowEmojiPicker(false);
    }
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
        console.log("Left room successfully");
        alert("You left the room successfully");
        // Navigate back to room list
        window.location.hash = "/";
        window.location.reload();
      } catch (error) {
        console.error("Error leaving room:", error);
        alert(error.response?.data?.error || error.message);
      }
    }
  };

  if (loading) {
    return <div className="chat-room-container">Đang tải...</div>;
  }

  return (
    <div className="chat-room-container">
      <div className="chat-header">
        <h2>
          💬 {isPrivateRoom ? "🔒" : "🏠"} {roomName}
        </h2>
        <div className="header-right">
          <span className="member-count">
            👥 {roomMembers.length} thành viên
          </span>
          <button
            className="btn-invite"
            onClick={() => setShowMembersModal(true)}
            title="View member list"
          >
            👥 Members
          </button>
          {isRoomOwner && (
            <button
              className="btn-invite"
              onClick={() => setShowInviteModal(true)}
              title="Invite friends to room"
            >
              📨 Invite
            </button>
          )}
          {!isRoomOwner &&
            isPrivateRoom &&
            roomMembers.some((m) => m.id === user.id) && (
              <button
                className="btn-leave"
                onClick={handleLeaveRoom}
                title="Leave room"
              >
                🚪 Leave
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
            <p>No messages</p>
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
                <p className={msg.recalled ? "recalled" : ""}>
                  {msg.content}
                  {msg.recalled &&
                    (msg.recalledBySenderDisplayName ||
                      msg.recalledBySenderUsername) && (
                      <span className="recall-info">
                        {" "}
                        (Thu hồi bởi{" "}
                        {msg.recalledBySenderDisplayName ||
                          msg.recalledBySenderUsername}
                        )
                      </span>
                    )}
                </p>
                <span className="message-time">
                  {msg.timestamp && formatTime(msg.timestamp)}{" "}
                  {msg.pending && "Sending..."}
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
                        🔙 Recall
                      </button>
                    ) : (
                      <span style={{ color: "#999", fontSize: "12px" }}>
                        Recall expired
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
        <div className="input-actions">
          <button
            className="btn-emoji"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add emoji"
          >
            😊 Add emoji
          </button>
          <button onClick={handleSendMessage} className="btn-send">
            📤 Send
          </button>
        </div>
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="emoji-picker-container">
            <EmojiPicker onEmojiClick={handleEmojiClick} theme="auto" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;

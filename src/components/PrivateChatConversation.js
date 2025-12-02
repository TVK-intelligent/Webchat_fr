import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { messageService } from "../services/api";
import {
  sendPrivateMessage,
  sendPrivateTypingIndicator,
  waitForWebSocketConnection,
  recallPrivateMessage,
  subscribeToPrivateMessageRecall,
} from "../services/websocket";
import { usePrivateMessageListener } from "../hooks/usePrivateMessageListener";
import { notifyNewPrivateMessage } from "../services/pushNotificationIntegration";
import EmojiPicker from "emoji-picker-react";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/PrivateChatConversation.css";

const PrivateChatConversation = ({ friend, onBack, onUnreadCleared }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const onUnreadClearedRef = useRef(onUnreadCleared);

  //  Sync callback ref whenever it changes (without triggering effect)
  useEffect(() => {
    onUnreadClearedRef.current = onUnreadCleared;
  }, [onUnreadCleared]);

  // Mark all messages as read IMMEDIATELY when entering conversation
  useEffect(() => {
    console.log("[PRIVATE_CHAT] Conversation opened for friend:", friend?.id);

    const markAsReadImmediately = async () => {
      try {
        if (!friend?.id) {
          console.warn("[PRIVATE_CHAT] Friend ID is missing");
          return;
        }
        console.log(
          "[PRIVATE_CHAT] Marking all messages as read with friend",
          friend.id
        );

        // Try to mark all as read (bulk operation)
        try {
          await messageService.markAllPrivateAsRead(friend.id);
          console.log(
            "[PRIVATE_CHAT] ✅ Immediately marked all messages as read (bulk)"
          );
        } catch (bulkError) {
          console.warn(
            "[PRIVATE_CHAT] ⚠️ Bulk mark-as-read failed, falling back to individual messages:",
            bulkError?.message
          );
          // Fallback: mark each message individually
          for (const msg of messages) {
            if (!msg.isRead && msg.senderId === friend.id) {
              try {
                await messageService.markAsRead(msg.id);
              } catch (err) {
                console.warn(`Failed to mark message ${msg.id} as read:`, err);
              }
            }
          }
        }

        // Call callback to clear badge
        if (onUnreadClearedRef.current) {
          const conversationId = `private_${friend.id}`;
          console.log(
            `[PRIVATE_CHAT] Calling onUnreadCleared for: ${conversationId}`
          );
          onUnreadClearedRef.current(conversationId);
        }
      } catch (error) {
        console.error(
          "[PRIVATE_CHAT] Error marking all messages as read:",
          error
        );
      }
    };

    markAsReadImmediately();
  }, [friend?.id, messages]);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        console.log(`Loading messages with friend ID: ${friend?.id}`);
        if (!friend?.id) {
          console.warn("Friend ID is missing");
          setLoading(false);
          return;
        }

        const response = await messageService.getPrivateMessages(friend.id);
        // Normalize messages: ensure timestamp exists (use createdAt if timestamp missing)
        const normalizedMessages = (response.data || []).map((msg) => {
          // Priority: senderDisplayName > sender.displayName > senderUsername > "Unknown"
          const displayName =
            msg.senderDisplayName ||
            msg.sender?.displayName ||
            msg.senderUsername ||
            msg.sender?.username ||
            "Unknown";
          const username =
            msg.senderUsername || msg.sender?.username || "Unknown";

          const normalized = {
            ...msg,
            timestamp: msg.timestamp || msg.createdAt,
            senderDisplayName: displayName,
            senderUsername: username,
          };
          // Log first few messages to see structure
          if (msg.id % 10 === 0) {
            console.log(
              `Message ${msg.id}: displayName=${normalized.senderDisplayName}, username=${normalized.senderUsername}`
            );
          }
          return normalized;
        });
        setMessages(normalizedMessages);
        console.log(
          `Loaded ${normalizedMessages.length} messages with ${friend.displayName}`
        );
        setLoading(false);
      } catch (error) {
        console.error("Error loading private messages:", error);
        setLoading(false);
      }
    };

    loadMessages();
  }, [friend]);

  // Subscribe to private messages using the global listener hook
  usePrivateMessageListener(user.id, (newMessage) => {
    console.log("🔔 [PRIVATE_CHAT_HOOK_CALLBACK] Hook callback triggered!");
    console.log(
      "🔔 [PRIVATE_CHAT_HOOK_CALLBACK] Message received:",
      newMessage
    );
    console.log(
      `🔔 [PRIVATE_CHAT_HOOK_CALLBACK] Checking: senderId=${newMessage.senderId} vs friend.id=${friend.id}`
    );

    // Key debug: check if we're in the right conversation
    const isFromThisConversation =
      newMessage.senderId === friend.id || newMessage.recipientId === friend.id;
    console.log(
      `🔔 [PRIVATE_CHAT_HOOK_CALLBACK] isFromThisConversation=${isFromThisConversation}`
    );

    if (isFromThisConversation) {
      console.log(`   ✅ Message matches this conversation`);
      // Đảm bảo có senderUsername và senderDisplayName
      // Priority: senderDisplayName > sender.displayName > senderUsername > "Unknown"
      const displayName =
        newMessage.senderDisplayName ||
        newMessage.sender?.displayName ||
        newMessage.senderUsername ||
        newMessage.sender?.username ||
        "Unknown";
      const username =
        newMessage.senderUsername || newMessage.sender?.username || "Unknown";

      const messageWithMetadata = {
        ...newMessage,
        timestamp: newMessage.timestamp || new Date().toISOString(),
        senderDisplayName: displayName,
        senderUsername: username,
      };
      console.log("Saving message with metadata:", messageWithMetadata);

      // Check if message already exists (to avoid duplicate from optimistic + server response)
      setMessages((prev) => {
        // Check if message with same ID exists
        const exists = prev.some(
          (msg) => String(msg.id) === String(newMessage.id)
        );
        if (exists) {
          console.log(
            `📌 Message ${newMessage.id} already exists, skipping duplicate`
          );
          return prev;
        }

        // Also check if it's an optimistic message (temporary ID = Date.now())
        // and the new message has very similar content
        const isDuplicate = prev.some(
          (msg) =>
            msg.senderId === newMessage.senderId &&
            msg.content === newMessage.content &&
            msg.id !== newMessage.id
        );

        if (isDuplicate) {
          console.log(
            `📌 Duplicate detected: replacing optimistic with server response`
          );
          // Remove the optimistic message (temp ID) and add the real one
          return [
            ...prev.filter(
              (msg) =>
                !(
                  msg.senderId === newMessage.senderId &&
                  msg.content === newMessage.content &&
                  msg.id !== newMessage.id
                )
            ),
            messageWithMetadata,
          ];
        }

        return [...prev, messageWithMetadata];
      });

      // Send push notification if sender is not the current user
      const isFromOther = newMessage.senderId !== user.id;
      const isTabHidden = document.hidden;

      console.log(
        `[PRIVATE_CHAT] Push notification check:`,
        `isFromOther=${isFromOther}, isTabHidden=${isTabHidden}`
      );

      if (isFromOther && isTabHidden) {
        console.log("📬 Sending push notification for private message");
        notifyNewPrivateMessage(
          newMessage.senderId,
          displayName,
          newMessage.content
        );
      } else {
        console.log(
          `[PRIVATE_CHAT] ❌ Push notification NOT sent: isFromOther=${isFromOther}, isTabHidden=${isTabHidden}`
        );
      }

      // Mark this new message as read immediately
      messageService
        .markAsRead(newMessage.id)
        .then(() => {
          console.log(`[PRIVATE_CHAT] Message ${newMessage.id} marked as read`);
          // Clear badge in parent when message is read
          console.log(
            `[PRIVATE_CHAT] Checking: senderId=${
              newMessage.senderId
            }, friend.id=${friend.id}, callback=${!!onUnreadClearedRef.current}`
          );
          if (onUnreadClearedRef.current) {
            const conversationId = `private_${friend.id}`;
            console.log(
              `[PRIVATE_CHAT] ✅ Calling onUnreadCleared with: ${conversationId}`
            );
            onUnreadClearedRef.current(conversationId);
          } else {
            console.warn(
              `[PRIVATE_CHAT] ❌ onUnreadClearedRef.current is null!`
            );
          }
        })
        .catch((error) =>
          console.warn("Failed to mark received message as read:", error)
        );
    }
  });

  //  Subscribe to private message recall events
  useEffect(() => {
    console.log(
      "Setting up private message recall subscription for user:",
      user.id
    );

    const subscription = subscribeToPrivateMessageRecall(
      user.id,
      (recallEvent) => {
        console.log("Private message recall event received:", recallEvent);
        console.log(
          `Recall event has: senderDisplayName=${recallEvent.senderDisplayName}, senderUsername=${recallEvent.senderUsername}`
        );

        // Private chat: Giữ nguyên cách xử lý (không phân biệt giữa người thu hồi và những người khác)
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
          let found = false;

          const index = updated.findIndex(
            (msg) => String(msg.id) === String(messageId)
          );

          if (index !== -1) {
            console.log(`Found message by ID: ${messageId}`);
            // Preserve sender info từ message cũ hoặc lấy từ recall event
            // Priority: oldMsg.senderDisplayName > recallEvent.senderDisplayName > oldMsg.senderUsername > "Unknown"
            const oldMsg = updated[index];
            const displayName =
              oldMsg.senderDisplayName ||
              recallEvent.senderDisplayName ||
              oldMsg.senderUsername ||
              recallEvent.senderUsername ||
              "Unknown";
            const username =
              oldMsg.senderUsername || recallEvent.senderUsername || "Unknown";

            console.log(
              `OLD: displayName=${oldMsg.senderDisplayName}, username=${oldMsg.senderUsername}`
            );
            console.log(
              `EVENT: displayName=${recallEvent.senderDisplayName}, username=${recallEvent.senderUsername}`
            );
            console.log(
              `FINAL: displayName=${displayName}, username=${username}`
            );

            updated[index] = {
              ...oldMsg,
              content: "Message recalled",
              recalled: true,
              senderDisplayName: displayName,
              senderUsername: username,
            };
            found = true;
          }

          if (!found) {
            console.warn(`Message not found by ID ${messageId}`);
          }

          return updated;
        });
      }
    );

    console.log("Private message recall subscription set up");

    return () => {
      console.log("Cleaning up private message recall subscription");
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [user.id]);

  //  Mark messages as read - run once when friend changes
  useEffect(() => {
    let isMounted = true;

    const markMessagesAsRead = async () => {
      try {
        if (!friend?.id) {
          console.log("[MARK_AS_READ] No friend ID");
          return;
        }

        console.log(
          `[MARK_AS_READ] Starting to mark messages as read for friend ${friend.id}`
        );

        // Get all messages from this friend
        const messagesToMark = messages.filter(
          (msg) => msg.senderId === friend.id
        );

        console.log(
          `[MARK_AS_READ] Found ${messagesToMark.length} messages from friend`
        );

        if (messagesToMark.length > 0) {
          // Mark all messages from this friend as read on the server
          for (const msg of messagesToMark) {
            if (!isMounted) break;
            try {
              await messageService.markAsRead(msg.id);
              console.log(`[MARK_AS_READ] Marked message ${msg.id} as read`);
            } catch (error) {
              console.warn(`Warning marking message ${msg.id} as read:`, error);
            }
          }
        }

        // Always notify parent to clear badge when opening the chat
        if (isMounted && onUnreadClearedRef.current) {
          const conversationId = `private_${friend.id}`;
          console.log(
            `[MARK_AS_READ] Calling onUnreadCleared with: ${conversationId}`
          );
          onUnreadClearedRef.current(conversationId);
        }
      } catch (error) {
        console.error("[MARK_AS_READ] Error:", error);
      }
    };

    // Wait a bit for messages to load, then mark as read
    const timer = setTimeout(() => {
      if (isMounted) {
        markMessagesAsRead();
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
    // Only depend on friend.id to avoid infinite loops
    // The effect will run every time friend changes, which is what we want
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend?.id]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
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

  const handleClickOutsideEmojiPicker = (e) => {
    if (
      emojiPickerRef.current &&
      !emojiPickerRef.current.contains(e.target) &&
      !e.target.classList.contains("btn-emoji")
    ) {
      setShowEmojiPicker(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const messageContent = input;
    setInput("");
    setShowEmojiPicker(false);

    try {
      const isConnected = await waitForWebSocketConnection(5000);
      if (isConnected) {
        // 1. Create optimistic message
        const optimisticMessage = {
          id: Date.now(), // Temporary ID
          senderId: user.id,
          recipientId: friend.id,
          content: messageContent,
          timestamp: new Date().toISOString(),
          senderDisplayName: user.displayName,
          senderUsername: user.username,
          recalled: false,
        };

        // 2. Add optimistic message to UI immediately
        setMessages((prev) => [...prev, optimisticMessage]);
        console.log("📌 Added optimistic message:", optimisticMessage);

        // 3. Send actual message via WebSocket
        sendPrivateMessage(user.id, friend.id, messageContent);
        console.log("Message sent to", friend.displayName);
      } else {
        console.error("WebSocket connection failed after 5 seconds");
        alert(
          "WebSocket connection failed. Unable to send message.\n\nPlease check:\n- Backend server is running?\n- WebSocket endpoint is ready?"
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error sending message: " + (error.message || error.toString()));
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    sendPrivateTypingIndicator(friend.id, user.id, true);

    typingTimeoutRef.current = setTimeout(() => {
      sendPrivateTypingIndicator(friend.id, user.id, false);
    }, 3000);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setInput((prevInput) => prevInput + emojiObject.emoji);
  };

  const handleRecallMessage = async (messageId) => {
    if (!window.confirm("Bạn có chắc muốn thu hồi tin nhắn này?")) {
      return;
    }

    try {
      console.log("Attempting to recall private message:", messageId);

      // Gửi request thu hồi via WebSocket
      await recallPrivateMessage(messageId);
      console.log("Private message recall request sent via WebSocket");

      // UI sẽ được update khi nhận WebSocket response từ server
    } catch (error) {
      console.error("Error recalling private message:", error);
      alert("Error recalling message");
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    // Xử lý cả ISO string và array format từ LocalDateTime
    let date;
    if (Array.isArray(timestamp)) {
      // LocalDateTime từ backend: [year, month, day, hour, minute, second, nano]
      date = new Date(
        timestamp[0],
        timestamp[1] - 1,
        timestamp[2],
        timestamp[3],
        timestamp[4],
        timestamp[5]
      );
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="private-chat-conversation">
      {/* Header */}
      <div className="conversation-header">
        <div className="header-info">
          <div className="header-avatar">
            {friend.avatarUrl ? (
              <img
                src={getFullAvatarUrl(friend.avatarUrl)}
                alt={friend.displayName}
              />
            ) : (
              <div className="avatar-placeholder">
                {friend.displayName?.charAt(0).toUpperCase()}
              </div>
            )}
            <div
              className={`status-indicator-header ${
                friend.status === "ONLINE" && friend.showOnlineStatus === true
                  ? "online"
                  : "offline"
              }`}
            />
          </div>
          <div className="header-details">
            <h3>{friend.displayName}</h3>
            <p>@{friend.username}</p>
            <span className="header-status">
              {friend.status === "ONLINE" && friend.showOnlineStatus === true
                ? "🟢 Online"
                : "⚫ Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {loading ? (
          <div className="loading">Đang tải...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>Start a conversation with {friend.displayName}</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.senderId === user.id ? "sent" : "received"
              } ${msg.recalled ? "recalled" : ""}`}
              onMouseEnter={() => setSelectedMessageId(msg.id)}
              onMouseLeave={() => setSelectedMessageId(null)}
            >
              <div className="message-content">
                <strong>
                  {msg.senderDisplayName ||
                    msg.sender?.displayName ||
                    msg.senderUsername ||
                    msg.sender?.username ||
                    "Unknown"}
                </strong>
                <p className={msg.recalled ? "recalled" : ""}>
                  {msg.recalled ? "Message recalled" : msg.content}
                </p>
                <span className="message-time">
                  {formatTime(msg.timestamp || msg.createdAt)}
                </span>
              </div>
              {msg.senderId === user.id &&
                selectedMessageId === msg.id &&
                !msg.recalled && (
                  <div className="message-actions">
                    <button
                      className="btn-action btn-recall"
                      onClick={() => handleRecallMessage(msg.id)}
                      title="Recall message"
                    >
                      🔙 Recall
                    </button>
                  </div>
                )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="conversation-input">
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Nhập tin nhắn..."
          rows="2"
        />
        <div className="input-actions">
          <button
            className="btn-emoji"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Thêm emoji"
          >
            😊
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

export default PrivateChatConversation;

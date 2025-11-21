import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { messageService } from "../services/api";
import {
  subscribeToPrivateMessages,
  sendPrivateMessage,
  sendPrivateTypingIndicator,
  waitForWebSocketConnection,
  recallPrivateMessage,
  subscribeToPrivateMessageRecall,
} from "../services/websocket";
import EmojiPicker from "emoji-picker-react";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/PrivateChatConversation.css";

const PrivateChatConversation = ({
  friend,
  onBack,
  onUnreadCleared,
  onMessageSent,
}) => {
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

  // Subscribe to private messages
  useEffect(() => {
    const subscription = subscribeToPrivateMessages(user.id, (newMessage) => {
      console.log("Private message received:", newMessage);
      if (
        newMessage.senderId === friend.id ||
        newMessage.recipientId === friend.id
      ) {
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
        setMessages((prev) => [...prev, messageWithMetadata]);
      }
    });

    return () => {
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [friend.id, user.id]);

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

  //  Mark messages as read - separate effect to avoid loop
  useEffect(() => {
    const markMessagesAsRead = async () => {
      try {
        const unreadMessages = messages.filter(
          (msg) => msg.senderId === friend.id && !msg.isRead
        );
        if (unreadMessages.length > 0) {
          for (const msg of unreadMessages) {
            await messageService.markAsRead(msg.id);
          }
          //  Notify parent to clear badge with conversationId format
          if (onUnreadClearedRef.current) {
            const conversationId = `private_${friend.id}`;
            console.log("Calling onUnreadCleared with:", conversationId);
            onUnreadClearedRef.current(conversationId);
          }
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };

    if (messages.length > 0) {
      markMessagesAsRead();
    }
  }, [messages, friend.id]);

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

    //  Notify parent that message was sent (move conversation to top)
    if (onMessageSent) {
      onMessageSent("direct", friend.id);
    }

    try {
      const isConnected = await waitForWebSocketConnection(5000);
      if (isConnected) {
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
          </div>
          <div className="header-details">
            <h3>{friend.displayName}</h3>
            <p>@{friend.username}</p>
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
                      Recall
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
            Send
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

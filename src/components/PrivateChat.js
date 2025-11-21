import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { messageService } from "../services/api";
import {
  subscribeToPrivateMessages,
  subscribeToPrivateTypingIndicator,
  sendPrivateMessage,
  sendPrivateTypingIndicator,
  waitForWebSocketConnection,
} from "../services/websocket";
import EmojiPicker from "emoji-picker-react";
import "../styles/PrivateChat.css";

const PrivateChat = ({ friendId, friendName, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const emojiPickerRef = useRef(null);

  // Load private messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        console.log(`Loading messages with friend ID: ${friendId}`);
        if (!friendId) {
          console.warn("Friend ID is missing");
          setLoading(false);
          return;
        }

        const response = await messageService.getPrivateMessages(friendId);
        const processedMessages = (response.data || []).map((msg) => ({
          ...msg,
          timestamp: msg.timestamp || msg.createdAt,
          senderUsername: msg.sender?.username || msg.senderUsername,
          senderDisplayName: msg.sender?.displayName || msg.senderDisplayName,
        }));
        setMessages(processedMessages);
        console.log(
          `Loaded ${processedMessages.length} private messages with user ${friendId}`
        );
        setLoading(false);
      } catch (error) {
        console.error("Error loading private messages:", error);
        setLoading(false);
      }
    };

    loadMessages();
  }, [friendId]);

  // Subscribe to private messages
  useEffect(() => {
    const subscription = subscribeToPrivateMessages(user.id, (newMessage) => {
      // Only add messages from this specific friend
      if (
        newMessage.senderId === friendId ||
        newMessage.recipientId === friendId
      ) {
        console.log("Private message received from WebSocket:", newMessage);

        const normalizedMessage = {
          ...newMessage,
          timestamp: newMessage.timestamp || new Date().toISOString(),
          senderUsername:
            newMessage.senderUsername || newMessage.sender?.username,
          senderDisplayName:
            newMessage.senderDisplayName || newMessage.sender?.displayName,
        };

        setMessages((prev) => {
          // Check if message already exists
          const existingMessageIndex = prev.findIndex(
            (msg) => String(msg.id) === String(normalizedMessage.id)
          );

          if (existingMessageIndex !== -1) {
            const updated = [...prev];
            updated[existingMessageIndex] = normalizedMessage;
            return updated;
          }

          // Check for pending message from same sender
          const hasPendingFromSender = prev.some(
            (msg) => msg.pending && msg.senderId === normalizedMessage.senderId
          );

          if (hasPendingFromSender) {
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
            return [...prev, { ...normalizedMessage, pending: false }];
          }
        });

        // Mark as read
        messageService
          .markAsRead(newMessage.id)
          .catch((error) =>
            console.warn("Failed to mark message as read:", error)
          );
      }
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [friendId, user.id]);

  // Subscribe to typing indicators
  useEffect(() => {
    const subscription = subscribeToPrivateTypingIndicator(user.id, (data) => {
      if (data.userId === friendId) {
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
      }
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [friendId, user.id]);

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

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const messageContent = input;
    const messageId = Date.now();

    // Optimistic update
    const optimisticMessage = {
      id: messageId,
      senderId: user.id,
      recipientId: friendId,
      senderUsername: user.username,
      senderDisplayName: user.displayName,
      content: messageContent,
      timestamp: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInput("");
    setTypingUsers((prev) => {
      const updated = { ...prev };
      delete updated[user.id];
      return updated;
    });

    try {
      const isConnected = await waitForWebSocketConnection(5000);

      if (isConnected) {
        console.log(" Sending private message via WebSocket...");
        sendPrivateMessage(user.id, friendId, messageContent);
        console.log(" Private message sent");
      } else {
        console.error("WebSocket connection failed after 5 seconds");
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        alert(
          "WebSocket connection error. Cannot send message.\n\n Check if backend server is running and WebSocket endpoint is ready."
        );
      }
    } catch (error) {
      console.error("❌ Error sending private message:", error);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      alert("❌ Lỗi gửi tin nhắn: " + (error.message || error.toString()));
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);

    if (typingTimeoutRef.current[user.id]) {
      clearTimeout(typingTimeoutRef.current[user.id]);
    }

    sendPrivateTypingIndicator(friendId, user.id, true);

    typingTimeoutRef.current[user.id] = setTimeout(() => {
      sendPrivateTypingIndicator(friendId, user.id, false);
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

  const getTypingText = () => {
    if (typingUsers[friendId]) {
      return `${friendName} đang gõ...`;
    }
    return "";
  };

  if (loading) {
    return (
      <div className="private-chat-container">
        <div className="private-chat-header">
          <h2>{friendName}</h2>
          <button onClick={onClose} className="btn-close">
            ✕
          </button>
        </div>
        <div className="private-messages-container">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="private-chat-container">
      <div className="private-chat-header">
        <h2>{friendName}</h2>
        <button onClick={onClose} className="btn-close">
          ✕
        </button>
      </div>

      <div className="private-messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>📭 Bắt đầu cuộc trò chuyện với {friendName}</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`private-message ${
                msg.senderId === user.id ? "sent" : "received"
              } ${msg.pending ? "pending" : ""}`}
            >
              <div className="message-content">
                <p>{msg.content}</p>
                <span className="message-time">
                  {formatTime(msg.timestamp || msg.createdAt)}{" "}
                  {msg.pending && "Sending..."}
                </span>
              </div>
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

export default PrivateChat;

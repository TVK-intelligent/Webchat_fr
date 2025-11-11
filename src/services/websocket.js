import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

// WebSocket client adapted to your Spring backend configuration:
// - STOMP endpoint: /ws (supports SockJS)
// - Application destination prefix: /app
// - Broker prefixes: /topic, /queue, /user

let stompClient = null;
let messageQueue = [];
let isConnecting = false;
let reconnectAttempts = 0;
let queueProcessingInterval = null;
const subscriptions = new Map(); // roomId -> subscription

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
const QUEUE_PROCESS_INTERVAL = 300; // ms

// --- Queue processing ----------------------------------------------------
const processMessageQueue = () => {
  if (!messageQueue.length || !stompClient || !stompClient.active) return;

  console.log(`📤 Processing ${messageQueue.length} queued messages...`);

  const successful = [];

  for (let i = 0; i < messageQueue.length; i++) {
    const { destination, body, callback } = messageQueue[i];

    try {
      // use publish (stompjs >= 6.x)
      stompClient.publish({ destination, body });
      if (callback) callback();
      successful.push(i);
    } catch (err) {
      console.error("⚠️ Error sending queued message:", err);
      break; // keep order
    }
  }

  // remove successfully sent messages from end to start
  for (let i = successful.length - 1; i >= 0; i--) {
    messageQueue.splice(successful[i], 1);
  }

  if (messageQueue.length)
    console.log(`⏳ ${messageQueue.length} messages still queued`);
};

const startQueueProcessor = () => {
  if (!queueProcessingInterval) {
    console.log("▶️ Starting queue processor...");
    queueProcessingInterval = setInterval(
      processMessageQueue,
      QUEUE_PROCESS_INTERVAL
    );
  }
};

const stopQueueProcessor = () => {
  if (queueProcessingInterval) {
    console.log("⏹️ Stopping queue processor...");
    clearInterval(queueProcessingInterval);
    queueProcessingInterval = null;
  }
};

// --- Connect / reconnect -------------------------------------------------
export const connectWebSocket = (token, onConnect, onError) => {
  // Prevent duplicate connects
  if (stompClient && stompClient.active) {
    console.log("✅ WebSocket already connected");
    if (onConnect) onConnect();
    return;
  }

  if (isConnecting) {
    console.log("⏳ WebSocket connection in progress...");
    return;
  }

  isConnecting = true;
  console.log("🔗 Initiating WebSocket connection...");

  // Use the SockJS endpoint configured in your backend: /ws
  const sockjsUrl = `http://localhost:8081/ws`;

  // create a SockJS socket (fallbacks handled by SockJS)
  const socket = new SockJS(sockjsUrl);

  stompClient = new Client({
    webSocketFactory: () => socket,
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 0, // we'll manage reconnect manually
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,

    onConnect: (frame) => {
      console.log(
        "✅ WebSocket Connected:",
        frame && frame.headers ? frame.headers : frame
      );
      isConnecting = false;
      reconnectAttempts = 0;
      startQueueProcessor();
      processMessageQueue();
      if (onConnect) onConnect();
    },

    onStompError: (frame) => {
      console.error("❌ STOMP Error:", frame);
      isConnecting = false;
      if (onError) onError(frame);
      attemptReconnect(token, onConnect, onError);
    },

    onWebSocketError: (error) => {
      console.error("❌ WebSocket Error:", error);
      isConnecting = false;
      if (onError) onError(error);
      attemptReconnect(token, onConnect, onError);
    },

    onDisconnect: () => {
      console.log("⚠️ WebSocket Disconnected");
      stopQueueProcessor();
      attemptReconnect(token, onConnect, onError);
    },

    debug: (msg) => {
      // Only print important STOMP lifecycle traces
      if (
        msg &&
        (msg.includes("CONNECTED") ||
          msg.includes("ERROR") ||
          msg.includes("DISCONNECT"))
      ) {
        console.log("🔍 STOMP:", msg);
      }
    },
  });

  stompClient.activate();
};

const attemptReconnect = (token, onConnect, onError) => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(
      `❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
    );
    stopQueueProcessor();
    isConnecting = false;
    if (onError) onError("Max reconnection attempts reached");
    return;
  }

  reconnectAttempts++;
  console.log(
    `⚠️ Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_DELAY}ms`
  );

  setTimeout(() => {
    // deactivate previous client if active
    if (stompClient && stompClient.active) {
      try {
        stompClient.deactivate();
      } catch (e) {
        console.warn("⚠️ Error during previous deactivate", e);
      }
    }

    stompClient = null;
    isConnecting = false;
    connectWebSocket(token, onConnect, onError);
  }, RECONNECT_DELAY);
};

export const disconnectWebSocket = async () => {
  stopQueueProcessor();
  if (stompClient) {
    try {
      await stompClient.deactivate();
      console.log("✅ WebSocket Disconnected");
    } catch (err) {
      console.warn("⚠️ Error during disconnect:", err);
    }
  }
  stompClient = null;
  reconnectAttempts = 0;
};

// --- Subscriptions helpers -----------------------------------------------
const subscribeWithRetry = (key, subscribeFn, maxRetries = 10, delay = 500) => {
  let retries = 0;
  let subscription = null;
  let isUnsubscribed = false; // Track if user unsubscribed before connection
  let timeoutId = null; // Track timeout for cleanup

  const attempt = () => {
    // If user already unsubscribed, stop retrying
    if (isUnsubscribed) {
      console.log(`⏭️ Skipping retry for ${key} (already unsubscribed)`);
      return;
    }

    // If already subscribed, return existing
    if (subscriptions.has(key) && subscriptions.get(key)) {
      console.log(`✅ Using existing subscription for ${key}`);
      return;
    }

    if (!stompClient || !stompClient.active) {
      if (retries < maxRetries) {
        retries++;
        console.log(
          `🔄 Subscription retry ${retries}/${maxRetries} for ${key} (waiting ${delay}ms)`
        );
        timeoutId = setTimeout(attempt, delay);
      } else {
        console.error(
          `❌ Subscription failed for ${key} after ${maxRetries} retries`
        );
      }
      return;
    }

    try {
      subscription = subscribeFn();
      if (subscription) {
        subscriptions.set(key, subscription);
        console.log(
          `✅ Subscription successful for ${key} after ${retries} retries`
        );
      }
    } catch (err) {
      console.error(`❌ Error subscribing to ${key}:${retries}:`, err.message);
      if (retries < maxRetries) {
        retries++;
        console.log(
          `🔄 Retrying after error for ${key} (${retries}/${maxRetries})`
        );
        timeoutId = setTimeout(attempt, delay);
      }
    }
  };

  attempt();

  return {
    unsubscribe: () => {
      isUnsubscribed = true;
      // Clear any pending retry
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const sub = subscriptions.get(key);
      if (sub) {
        try {
          sub.unsubscribe();
          console.log(`✅ Unsubscribed from ${key}`);
        } catch (e) {
          console.warn(`⚠️ Error while unsubscribing from ${key}`, e);
        }
        subscriptions.delete(key);
      }
    },
  };
};

// --- Chat messages -------------------------------------------------------
export const subscribeToRoomChat = (roomId, onMessageReceived) => {
  const key = `room:${roomId}`;
  return subscribeWithRetry(key, () => {
    console.log(`📡 Subscribing to room chat: /topic/room/${roomId}`);
    return stompClient.subscribe(`/topic/room/${roomId}`, (message) => {
      try {
        const msg = JSON.parse(message.body);
        onMessageReceived(msg);
      } catch (e) {
        console.error("Error parsing room message", e);
      }
    });
  });
};

export const sendChatMessage = (roomId, senderId, content) => {
  if (!stompClient) {
    console.error("❌ WebSocket not initialized");
    return;
  }

  const message = {
    roomId,
    senderId,
    content,
    messageType: "TEXT",
    timestamp: new Date().toISOString(),
  };

  const destination = `/app/chat/room/${roomId}`; // backend listens on /app/chat/room/{id}
  const body = JSON.stringify(message);

  console.log("📊 Message object being sent:", { destination, message });
  console.log("🔍 stompClient state:", {
    active: stompClient?.active,
    hasPublish: typeof stompClient?.publish === "function",
  });

  const isReady =
    stompClient &&
    stompClient.active &&
    typeof stompClient.publish === "function";

  if (isReady) {
    try {
      stompClient.publish({ destination, body });
      console.log("✅ Chat message sent successfully to", destination);
    } catch (err) {
      console.warn("⚠️ Error sending message, queueing:", err);
      messageQueue.push({ destination, body });
      console.log(`📋 Total queued messages: ${messageQueue.length}`);
    }
  } else {
    console.warn("⚠️ WebSocket not ready, queueing chat message");
    messageQueue.push({ destination, body });
    console.log(`📋 Total queued messages: ${messageQueue.length}`);
  }
};

// --- Typing indicators ---------------------------------------------------
let typingLock = false; // prevent parallel retries spamming
export const subscribeToTypingIndicator = (roomId, onTypingReceived) => {
  const key = `typing:${roomId}`;
  return subscribeWithRetry(key, () => {
    return stompClient.subscribe(`/topic/typing/room/${roomId}`, (message) => {
      try {
        const data = JSON.parse(message.body);
        onTypingReceived(data);
      } catch (e) {
        console.error("Error parsing typing indicator", e);
      }
    });
  });
};

export const sendTypingIndicator = (roomId, userId, isTyping) => {
  if (!stompClient) {
    console.error("❌ WebSocket not initialized");
    return;
  }

  const indicator = {
    roomId,
    userId,
    isTyping,
    timestamp: new Date().toISOString(),
  };
  const destination = `/app/typing/room/${roomId}`;
  const body = JSON.stringify(indicator);

  // don't spam retries – short lock
  if (typingLock && isTyping) return;

  const maxRetries = 8;
  const retryDelay = 200;
  let retryCount = 0;

  const doSend = () => {
    if (
      stompClient &&
      stompClient.active &&
      typeof stompClient.publish === "function"
    ) {
      try {
        stompClient.publish({ destination, body });
        console.log(
          isTyping
            ? "✅ Typing indicator (start) sent"
            : "✅ Typing indicator (stop) sent"
        );
        typingLock = false;
      } catch (err) {
        console.warn("⚠️ Error publishing typing indicator, queueing:", err);
        if (isTyping) messageQueue.push({ destination, body });
        typingLock = false;
      }
      return;
    }

    if (isTyping && retryCount < maxRetries) {
      retryCount++;
      typingLock = true;
      console.log(`🔄 Typing indicator retry ${retryCount}/${maxRetries}...`);
      setTimeout(doSend, retryDelay);
    } else if (isTyping) {
      console.warn(
        "⚠️ WebSocket not active after retries, queueing typing indicator"
      );
      messageQueue.push({ destination, body });
      typingLock = false;
    } else {
      // For stop typing, don't retry or queue
      console.log("ℹ️ Typing stop not sent (websocket inactive)");
      typingLock = false;
    }
  };

  doSend();
};

// --- Private messages, status, recall (same pattern) ---------------------
export const subscribeToPrivateMessages = (userId, onMessageReceived) => {
  const key = `private:${userId}`;
  return subscribeWithRetry(key, () => {
    return stompClient.subscribe(
      `/user/${userId}/queue/messages`,
      (message) => {
        try {
          const msg = JSON.parse(message.body);
          onMessageReceived(msg);
        } catch (e) {
          console.error("Error parsing private message", e);
        }
      }
    );
  });
};

export const sendPrivateMessage = (userId, recipientId, content) => {
  if (!stompClient) return console.error("❌ WebSocket not initialized");

  const message = {
    recipientId,
    content,
    messageType: "PRIVATE",
    timestamp: new Date().toISOString(),
  };
  const destination = `/app/private/${recipientId}`;
  const body = JSON.stringify(message);

  const isReady =
    stompClient &&
    stompClient.active &&
    typeof stompClient.publish === "function";
  if (isReady) {
    try {
      stompClient.publish({ destination, body });
      console.log("✅ Private message sent successfully");
    } catch (err) {
      console.warn("⚠️ Error sending private message, queueing:", err);
      messageQueue.push({ destination, body });
    }
  } else {
    console.warn("⚠️ WebSocket not ready, queueing private message");
    messageQueue.push({ destination, body });
  }
};

export const subscribeToUserStatus = (roomId, onStatusChange) => {
  const key = `status:${roomId}`;
  return subscribeWithRetry(key, () => {
    return stompClient.subscribe(`/topic/room/${roomId}/status`, (message) => {
      try {
        const status = JSON.parse(message.body);
        onStatusChange(status);
      } catch (e) {
        console.error("Error parsing status change", e);
      }
    });
  });
};

export const broadcastUserStatus = (userId, isOnline) => {
  if (!stompClient) return console.error("❌ WebSocket not initialized");

  const status = { userId, isOnline, timestamp: new Date().toISOString() };
  const destination = `/app/status/change`;
  const body = JSON.stringify(status);

  if (
    stompClient &&
    stompClient.active &&
    typeof stompClient.publish === "function"
  ) {
    try {
      stompClient.publish({ destination, body });
      console.log(
        `✅ User status ${
          isOnline ? "online" : "offline"
        } broadcast successfully`
      );
    } catch (err) {
      console.warn("⚠️ Error sending status update, queueing:", err);
      messageQueue.push({ destination, body });
    }
  } else {
    console.warn("⚠️ WebSocket not ready, queueing status update");
    messageQueue.push({ destination, body });
  }
};

export const recallMessageWebSocket = (roomId, messageId) => {
  if (!stompClient) {
    console.error("❌ WebSocket not initialized");
    return Promise.reject(new Error("WebSocket not initialized"));
  }

  if (!roomId || !messageId) {
    console.error("❌ Missing roomId or messageId", { roomId, messageId });
    return Promise.reject(new Error("Missing roomId or messageId parameters"));
  }

  // Lấy user ID từ localStorage (được lưu sau khi login)
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    console.error("❌ User data not found in localStorage");
    console.log("📋 localStorage keys:", Object.keys(localStorage));
    return Promise.reject(new Error("User data not found in localStorage"));
  }

  let userId;
  try {
    const userData = JSON.parse(userStr);
    userId = userData.id;
    if (!userId) {
      console.error("❌ User ID is missing from user data", userData);
      return Promise.reject(new Error("User ID is missing from user data"));
    }
  } catch (e) {
    console.error("❌ Error parsing user data from localStorage", e);
    return Promise.reject(new Error("Invalid user data in localStorage"));
  }

  const recall = {
    roomId,
    messageId,
    userId,
    timestamp: new Date().toISOString(),
  };
  const destination = `/app/recall/room/${roomId}`;
  const body = JSON.stringify(recall);

  return new Promise((resolve, reject) => {
    if (
      stompClient &&
      stompClient.active &&
      typeof stompClient.publish === "function"
    ) {
      try {
        stompClient.publish({ destination, body });
        console.log("✅ Message recall sent successfully:", recall);
        resolve();
      } catch (err) {
        console.warn("⚠️ Error sending message recall, queueing:", err);
        messageQueue.push({ destination, body });
        resolve(); // Queued successfully
      }
    } else {
      console.warn("⚠️ WebSocket not ready, queueing message recall");
      messageQueue.push({ destination, body });
      resolve(); // Queued successfully
    }
  });
};

export const subscribeToMessageRecall = (roomId, onRecallReceived) => {
  const key = `recall:${roomId}`;
  return subscribeWithRetry(key, () => {
    console.log(
      `📡 Subscribing to message recalls: /topic/recall/room/${roomId}`
    );
    return stompClient.subscribe(`/topic/recall/room/${roomId}`, (message) => {
      try {
        const recall = JSON.parse(message.body);
        console.log("✅ Recall message received from WebSocket:", recall);
        onRecallReceived(recall);
      } catch (e) {
        console.error("❌ Error parsing message recall", e);
      }
    });
  });
};

// --- Read receipts (when user marks messages as read) --------------------
/**
 * Subscribe to read receipt events trong một phòng
 * Server broadcast khi user đánh dấu tin nhắn đã đọc
 */
export const subscribeToReadReceipt = (roomId, onReadReceiptReceived) => {
  const key = `read-status:${roomId}`;
  return subscribeWithRetry(key, () => {
    console.log(
      `📡 Subscribing to read receipts: /topic/room/${roomId}/read-status`
    );
    return stompClient.subscribe(
      `/topic/room/${roomId}/read-status`,
      (message) => {
        try {
          const receipt = JSON.parse(message.body);
          console.log("✅ Read receipt received from WebSocket:", receipt);
          onReadReceiptReceived(receipt);
        } catch (e) {
          console.error("❌ Error parsing read receipt", e);
        }
      }
    );
  });
};

// --- Member events (join/leave/kick) ------------------------------------
/**
 * Subscribe to member events (leave, kick) trong phòng
 * Server broadcast khi member rời hoặc bị đuổi
 */
export const subscribeToMemberEvents = (roomId, onMemberEventReceived) => {
  const key = `member-events:${roomId}`;
  return subscribeWithRetry(key, () => {
    console.log(
      `📡 Subscribing to member events: /topic/room/${roomId}/members`
    );
    return stompClient.subscribe(`/topic/room/${roomId}/members`, (message) => {
      try {
        const event = JSON.parse(message.body);
        console.log("✅ Member event received from WebSocket:", event);
        onMemberEventReceived(event);
      } catch (e) {
        console.error("❌ Error parsing member event", e);
      }
    });
  });
};

export const isWebSocketConnected = () => !!(stompClient && stompClient.active);

export const waitForWebSocketConnection = (maxWaitTime = 5000) => {
  return new Promise((resolve) => {
    if (stompClient && stompClient.active) return resolve(true);
    const start = Date.now();
    const iv = setInterval(() => {
      if (stompClient && stompClient.active) {
        clearInterval(iv);
        resolve(true);
      } else if (Date.now() - start > maxWaitTime) {
        clearInterval(iv);
        resolve(false);
      }
    }, 100);
  });
};

const webSocketService = {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToRoomChat,
  sendChatMessage,
  subscribeToTypingIndicator,
  sendTypingIndicator,
  subscribeToPrivateMessages,
  sendPrivateMessage,
  subscribeToUserStatus,
  broadcastUserStatus,
  recallMessageWebSocket,
  subscribeToMessageRecall,
  subscribeToReadReceipt,
  subscribeToMemberEvents,
  isWebSocketConnected,
  waitForWebSocketConnection,
};

export default webSocketService;

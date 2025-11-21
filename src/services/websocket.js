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
let heartbeatInterval = null; //  Heartbeat interval
let heartbeatMonitorInterval = null; //  Monitor heartbeat health
let lastHeartbeatTime = null; // Track when last heartbeat was sent
const subscriptions = new Map(); // roomId -> subscription

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
const QUEUE_PROCESS_INTERVAL = 300; // ms
const HEARTBEAT_INTERVAL = 15000; //  15 seconds (reduced from 30s for more frequent updates)

// --- Queue processing ----------------------------------------------------
const processMessageQueue = () => {
  if (!messageQueue.length || !stompClient || !stompClient.active) return;

  console.log(` Processing ${messageQueue.length} queued messages...`);

  const successful = [];

  for (let i = 0; i < messageQueue.length; i++) {
    const { destination, body, callback } = messageQueue[i];

    try {
      // use publish (stompjs >= 6.x)
      stompClient.publish({ destination, body });
      if (callback) callback();
      successful.push(i);
    } catch (err) {
      console.error(" Error sending queued message:", err);
      break; // keep order
    }
  }

  // remove successfully sent messages from end to start
  for (let i = successful.length - 1; i >= 0; i--) {
    messageQueue.splice(successful[i], 1);
  }

  if (messageQueue.length)
    console.log(` ${messageQueue.length} messages still queued`);
};

const startQueueProcessor = () => {
  if (!queueProcessingInterval) {
    console.log(" Starting queue processor...");
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

// --- Heartbeat mechanism -------------------------------------------------
const startHeartbeat = (userId) => {
  if (heartbeatInterval) {
    console.log(" Heartbeat already running");
    return;
  }

  console.log(` Starting heartbeat for user ${userId}...`);
  lastHeartbeatTime = Date.now();

  heartbeatInterval = setInterval(() => {
    if (stompClient && stompClient.active) {
      try {
        stompClient.publish({
          destination: "/app/heartbeat",
          body: String(userId),
        });
        lastHeartbeatTime = Date.now();
        console.log(
          ` Heartbeat sent for user ${userId} (interval: ${HEARTBEAT_INTERVAL}ms)`
        );
      } catch (err) {
        console.warn(" Error sending heartbeat:", err);
      }
    } else {
      console.warn(" Cannot send heartbeat - WebSocket not active");
    }
  }, HEARTBEAT_INTERVAL);

  // 🔍 Monitor heartbeat health - if heartbeat doesn't send, force it
  startHeartbeatMonitor(userId);
};

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    console.log("⏹️ Stopping heartbeat...");
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (heartbeatMonitorInterval) {
    console.log("⏹️ Stopping heartbeat monitor...");
    clearInterval(heartbeatMonitorInterval);
    heartbeatMonitorInterval = null;
  }
  lastHeartbeatTime = null;
};

const startHeartbeatMonitor = (userId) => {
  if (heartbeatMonitorInterval) {
    clearInterval(heartbeatMonitorInterval);
  }

  // Check every 5 seconds if heartbeat is being sent on time
  heartbeatMonitorInterval = setInterval(() => {
    if (!lastHeartbeatTime) return;

    const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime;
    const timeoutThreshold = HEARTBEAT_INTERVAL + 5000; // 15s + 5s buffer

    if (timeSinceLastHeartbeat > timeoutThreshold) {
      console.warn(
        ` HEARTBEAT MISSED! ${Math.round(
          timeSinceLastHeartbeat / 1000
        )}s since last heartbeat (threshold: ${Math.round(
          timeoutThreshold / 1000
        )}s)`
      );
      console.warn(
        " Browser may have throttled timers - forcing immediate heartbeat"
      );

      // Force send a heartbeat now
      if (stompClient && stompClient.active) {
        try {
          stompClient.publish({
            destination: "/app/heartbeat",
            body: String(userId),
          });
          lastHeartbeatTime = Date.now();
          console.log(
            ` FORCED heartbeat sent for user ${userId} to prevent timeout`
          );
        } catch (err) {
          console.error(" Error sending forced heartbeat:", err);
        }
      }
    }
  }, 5000); // Check every 5 seconds
};

// --- Page visibility handler (prevent heartbeat from stopping) -----------
let currentUserId = null;

const setupPageVisibilityHandler = (userId) => {
  currentUserId = userId;

  // Remove old listener if exists
  document.removeEventListener("visibilitychange", handleVisibilityChange);

  // Add new listener
  document.addEventListener("visibilitychange", handleVisibilityChange);
  console.log("👁️ Page visibility handler installed");
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    console.log(" Tab is now hidden - heartbeat will continue");
  } else {
    console.log(" Tab is now visible - ensuring heartbeat is active");
    // If page becomes visible and heartbeat stopped, restart it
    if (
      !heartbeatInterval &&
      currentUserId &&
      stompClient &&
      stompClient.active
    ) {
      startHeartbeat(currentUserId);
      // Send immediate heartbeat on visibility return
      try {
        stompClient.publish({
          destination: "/app/heartbeat",
          body: String(currentUserId),
        });
        console.log(
          ` Immediate heartbeat sent after page became visible for user ${currentUserId}`
        );
      } catch (err) {
        console.warn(" Error sending immediate heartbeat:", err);
      }
    }
  }
};

// --- Connect / reconnect -------------------------------------------------
export const connectWebSocket = (token, onConnect, onError) => {
  // Prevent duplicate connects
  if (stompClient && stompClient.active) {
    console.log(" WebSocket already connected");
    if (onConnect) onConnect();
    return;
  }

  if (isConnecting) {
    console.log(" WebSocket connection in progress...");
    return;
  }

  isConnecting = true;
  console.log("🔗 Initiating WebSocket connection...");
  console.log(
    "📝 Token being used:",
    token ? `${token.substring(0, 20)}...` : "NO TOKEN"
  );

  // Use the SockJS endpoint configured in your backend: /ws
  const sockjsUrl = `http://localhost:8081/ws`;

  // create a SockJS socket (fallbacks handled by SockJS)
  const socket = new SockJS(sockjsUrl);

  stompClient = new Client({
    webSocketFactory: () => socket,
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    forceBinaryFrame: false,
    reconnectDelay: 0, // we'll manage reconnect manually
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,

    onConnect: (frame) => {
      console.log(
        " WebSocket Connected:",
        frame && frame.headers ? frame.headers : frame
      );
      isConnecting = false;
      reconnectAttempts = 0;
      startQueueProcessor();
      processMessageQueue();

      //  Register user and start heartbeat after connection
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.id) {
            // Register session
            stompClient.publish({
              destination: "/app/register-session",
              body: String(user.id),
            });
            // Start heartbeat
            startHeartbeat(user.id);
            // Setup page visibility handler to prevent heartbeat from stopping
            setupPageVisibilityHandler(user.id);
            console.log(` User ${user.id} registered and heartbeat started`);
          }
        } catch (e) {
          console.warn(" Failed to register session:", e);
        }
      }

      if (onConnect) onConnect();
    },

    onStompError: (frame) => {
      console.error(" STOMP Error Details:", {
        command: frame?.command,
        headers: frame?.headers,
        body: frame?.body,
        fullFrame: frame,
      });
      isConnecting = false;
      if (onError) onError(frame);
      attemptReconnect(token, onConnect, onError);
    },

    onWebSocketError: (error) => {
      console.error(" WebSocket Connection Error:", {
        message: error?.message,
        code: error?.code,
        reason: error?.reason,
        fullError: error,
      });
      isConnecting = false;
      if (onError) onError(error);
      attemptReconnect(token, onConnect, onError);
    },

    onDisconnect: (frame) => {
      console.log(" WebSocket Disconnected", frame);
      stopQueueProcessor();
      stopHeartbeat(); //  Stop heartbeat immediately

      //  Try to notify server user is offline (best-effort)
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          // Gửi OFFLINE via sendBeacon (không cần chờ response)
          navigator.sendBeacon(
            "http://localhost:8081/api/users/set-offline",
            JSON.stringify({ userId: user.id, isOnline: false })
          );
          console.log(" User", user.id, "sent OFFLINE on WebSocket disconnect");
        }
      } catch (e) {
        console.warn(" Error sending OFFLINE on disconnect:", e);
      }

      attemptReconnect(token, onConnect, onError);
    },

    debug: (msg) => {
      // Print ALL STOMP debug messages during initial connection
      console.log("🔍 STOMP DEBUG:", msg);
    },
  });

  console.log(
    " Calling stompClient.activate() - attempting connection to:",
    sockjsUrl
  );

  // Add a timeout to detect if connection is taking too long
  const connectionTimeout = setTimeout(() => {
    if (stompClient && !stompClient.active && isConnecting) {
      console.error(
        " WebSocket connection timeout after 10 seconds - connection not established"
      );
      console.error(
        "🔍 Possible causes: backend not running, wrong URL, firewall blocking, CORS issues"
      );
    }
  }, 10000);

  // Store timeout ID for cleanup
  stompClient._connectionTimeout = connectionTimeout;

  try {
    stompClient.activate();
  } catch (err) {
    console.error(" Error calling stompClient.activate():", err);
    clearTimeout(connectionTimeout);
    isConnecting = false;
    if (onError) onError(err);
  }
};

const attemptReconnect = (token, onConnect, onError) => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(
      ` Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
    );
    stopQueueProcessor();
    isConnecting = false;
    if (onError) onError("Max reconnection attempts reached");
    return;
  }

  reconnectAttempts++;
  console.log(
    ` Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_DELAY}ms`
  );

  setTimeout(() => {
    // deactivate previous client if active
    if (stompClient && stompClient.active) {
      try {
        stompClient.deactivate();
      } catch (e) {
        console.warn(" Error during previous deactivate", e);
      }
    }

    stompClient = null;
    isConnecting = false;
    connectWebSocket(token, onConnect, onError);
  }, RECONNECT_DELAY);
};

export const disconnectWebSocket = async () => {
  stopQueueProcessor();
  stopHeartbeat(); //  Stop heartbeat on disconnect
  if (stompClient) {
    try {
      await stompClient.deactivate();
      console.log(" WebSocket Disconnected");
    } catch (err) {
      console.warn(" Error during disconnect:", err);
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
      console.log(` Skipping retry for ${key} (already unsubscribed)`);
      return;
    }

    // If already subscribed, return existing
    if (subscriptions.has(key) && subscriptions.get(key)) {
      console.log(` Using existing subscription for ${key}`);
      return;
    }

    if (!stompClient || !stompClient.active) {
      if (retries < maxRetries) {
        retries++;
        // Don't log every retry as an error - it's expected during connection startup
        if (retries <= 2) {
          console.log(
            ` Waiting for WebSocket connection to subscribe to ${key} (attempt ${retries}/${maxRetries})`
          );
        } else if (retries === maxRetries) {
          console.warn(
            ` Subscription for ${key} still waiting after ${maxRetries} attempts (${
              (maxRetries * delay) / 1000
            }s)`
          );
        }
        timeoutId = setTimeout(attempt, delay);
      } else {
        console.error(
          ` Subscription failed for ${key} after ${maxRetries} retries (${
            (maxRetries * delay) / 1000
          }s)`
        );
      }
      return;
    }

    try {
      subscription = subscribeFn();
      if (subscription) {
        subscriptions.set(key, subscription);
        console.log(
          ` Subscription successful for ${key}${
            retries > 0 ? ` (after ${retries} retries)` : ""
          }`
        );
      }
    } catch (err) {
      console.error(` Error subscribing to ${key}:`, err.message);
      if (retries < maxRetries) {
        retries++;
        console.log(
          ` Retrying subscription for ${key} (${retries}/${maxRetries})`
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
          console.log(` Unsubscribed from ${key}`);
        } catch (e) {
          console.warn(` Error while unsubscribing from ${key}`, e);
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
    console.log(` Subscribing to room chat: /topic/room/${roomId}`);
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
    console.error(" WebSocket not initialized");
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
      console.log(" Chat message sent successfully to", destination);
    } catch (err) {
      console.warn(" Error sending message, queueing:", err);
      messageQueue.push({ destination, body });
      console.log(`📋 Total queued messages: ${messageQueue.length}`);
    }
  } else {
    console.warn(" WebSocket not ready, queueing chat message");
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
    console.error(" WebSocket not initialized");
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
            ? " Typing indicator (start) sent"
            : " Typing indicator (stop) sent"
        );
        typingLock = false;
      } catch (err) {
        console.warn(" Error publishing typing indicator, queueing:", err);
        if (isTyping) messageQueue.push({ destination, body });
        typingLock = false;
      }
      return;
    }

    if (isTyping && retryCount < maxRetries) {
      retryCount++;
      typingLock = true;
      console.log(` Typing indicator retry ${retryCount}/${maxRetries}...`);
      setTimeout(doSend, retryDelay);
    } else if (isTyping) {
      console.warn(
        " WebSocket not active after retries, queueing typing indicator"
      );
      messageQueue.push({ destination, body });
      typingLock = false;
    } else {
      // For stop typing, don't retry or queue
      console.log(" Typing stop not sent (websocket inactive)");
      typingLock = false;
    }
  };

  doSend();
};

// --- Private typing indicator ---
export const sendPrivateTypingIndicator = (recipientId, userId, isTyping) => {
  if (!stompClient) {
    console.error(" WebSocket not initialized");
    return;
  }

  const indicator = {
    userId,
    isTyping,
    timestamp: new Date().toISOString(),
  };
  const destination = `/app/private-typing/${recipientId}`;
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
            ? " Private typing indicator (start) sent"
            : " Private typing indicator (stop) sent"
        );
        typingLock = false;
      } catch (err) {
        console.warn(
          " Error publishing private typing indicator, queueing:",
          err
        );
        if (isTyping) messageQueue.push({ destination, body });
        typingLock = false;
      }
      return;
    }

    if (isTyping && retryCount < maxRetries) {
      retryCount++;
      typingLock = true;
      console.log(
        ` Private typing indicator retry ${retryCount}/${maxRetries}...`
      );
      setTimeout(doSend, retryDelay);
    } else if (isTyping) {
      console.warn(
        " WebSocket not active after retries, queueing private typing indicator"
      );
      messageQueue.push({ destination, body });
      typingLock = false;
    } else {
      // For stop typing, don't retry or queue
      console.log(" Private typing stop not sent (websocket inactive)");
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

export const subscribeToPrivateTypingIndicator = (userId, onTypingChange) => {
  const key = `private-typing:${userId}`;
  return subscribeWithRetry(key, () => {
    return stompClient.subscribe(`/user/${userId}/queue/typing`, (message) => {
      try {
        const typing = JSON.parse(message.body);
        onTypingChange(typing);
      } catch (e) {
        console.error("Error parsing private typing indicator", e);
      }
    });
  });
};

export const sendPrivateMessage = (userId, recipientId, content) => {
  if (!stompClient) return console.error(" WebSocket not initialized");

  const message = {
    senderId: userId, //  Include sender ID
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
      console.log(" Private message sent successfully");
    } catch (err) {
      console.warn(" Error sending private message, queueing:", err);
      messageQueue.push({ destination, body });
    }
  } else {
    console.warn(" WebSocket not ready, queueing private message");
    messageQueue.push({ destination, body });
  }
};

export const subscribeToUserStatus = (roomId, onStatusChange) => {
  if (roomId) {
    // Subscribe to room-specific user status
    const key = `status:${roomId}`;
    return subscribeWithRetry(key, () => {
      return stompClient.subscribe(
        `/topic/room/${roomId}/status`,
        (message) => {
          try {
            const status = JSON.parse(message.body);
            onStatusChange(status);
          } catch (e) {
            console.error("Error parsing status change", e);
          }
        }
      );
    });
  } else {
    //  Subscribe to GLOBAL user status changes (for Friends list, etc)
    const key = `global-user-status`;
    console.log(
      " subscribeToUserStatus called with roomId=null, registering global listener"
    );
    return subscribeWithRetry(key, () => {
      console.log(" Subscribing to global user status: /topic/user-status");
      return stompClient.subscribe(`/topic/user-status`, (message) => {
        try {
          const status = JSON.parse(message.body);
          console.log(" Global user status received from server:", status);
          console.log("📞 Calling onStatusChange callback with:", status);
          onStatusChange(status);
        } catch (e) {
          console.error(" Error parsing global status change", e);
        }
      });
    });
  }
};

export const broadcastUserStatus = (userId, isOnline) => {
  if (!stompClient) return console.error(" WebSocket not initialized");

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
        ` User status ${isOnline ? "online" : "offline"} broadcast successfully`
      );
    } catch (err) {
      console.warn(" Error sending status update, queueing:", err);
      messageQueue.push({ destination, body });
    }
  } else {
    console.warn(" WebSocket not ready, queueing status update");
    messageQueue.push({ destination, body });
  }
};

export const recallMessageWebSocket = (roomId, messageId) => {
  if (!stompClient) {
    console.error(" WebSocket not initialized");
    return Promise.reject(new Error("WebSocket not initialized"));
  }

  if (!roomId || !messageId) {
    console.error(" Missing roomId or messageId", { roomId, messageId });
    return Promise.reject(new Error("Missing roomId or messageId parameters"));
  }

  // Lấy user ID từ localStorage (được lưu sau khi login)
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    console.error(" User data not found in localStorage");
    console.log("📋 localStorage keys:", Object.keys(localStorage));
    return Promise.reject(new Error("User data not found in localStorage"));
  }

  let userId;
  try {
    const userData = JSON.parse(userStr);
    userId = userData.id;
    if (!userId) {
      console.error(" User ID is missing from user data", userData);
      return Promise.reject(new Error("User ID is missing from user data"));
    }
  } catch (e) {
    console.error(" Error parsing user data from localStorage", e);
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
        console.log(" Message recall sent successfully:", recall);
        resolve();
      } catch (err) {
        console.warn(" Error sending message recall, queueing:", err);
        messageQueue.push({ destination, body });
        resolve(); // Queued successfully
      }
    } else {
      console.warn(" WebSocket not ready, queueing message recall");
      messageQueue.push({ destination, body });
      resolve(); // Queued successfully
    }
  });
};

export const subscribeToMessageRecall = (roomId, onRecallReceived) => {
  const key = `recall:${roomId}`;
  return subscribeWithRetry(
    key,
    () => {
      console.log(
        ` Subscribing to message recalls: /topic/recall/room/${roomId}`
      );
      return stompClient.subscribe(
        `/topic/recall/room/${roomId}`,
        (message) => {
          try {
            const recall = JSON.parse(message.body);
            console.log(" Recall message received from WebSocket:", recall);
            onRecallReceived(recall);
          } catch (e) {
            console.error(" Error parsing message recall", e);
          }
        }
      );
    },
    20,
    500
  ); //  Increase maxRetries to 20 (10 seconds total)
};

// --- Private message recall -----
export const recallPrivateMessage = (messageId) => {
  if (!stompClient) {
    console.error(" WebSocket not initialized");
    return Promise.reject(new Error("WebSocket not initialized"));
  }

  if (!messageId) {
    console.error(" Missing messageId");
    return Promise.reject(new Error("Missing messageId parameter"));
  }

  const userStr = localStorage.getItem("user");
  if (!userStr) {
    console.error(" User data not found in localStorage");
    return Promise.reject(new Error("User data not found in localStorage"));
  }

  let userId;
  try {
    const userData = JSON.parse(userStr);
    userId = userData.id;
    if (!userId) {
      console.error(" User ID is missing from user data", userData);
      return Promise.reject(new Error("User ID is missing from user data"));
    }
  } catch (e) {
    console.error(" Error parsing user data from localStorage", e);
    return Promise.reject(new Error("Invalid user data in localStorage"));
  }

  const recall = {
    messageId,
    userId,
    timestamp: new Date().toISOString(),
  };
  const destination = `/app/private/recall`;
  const body = JSON.stringify(recall);

  return new Promise((resolve, reject) => {
    if (
      stompClient &&
      stompClient.active &&
      typeof stompClient.publish === "function"
    ) {
      try {
        stompClient.publish({ destination, body });
        console.log(" Private message recall sent successfully:", recall);
        resolve();
      } catch (err) {
        console.warn(" Error sending private message recall, queueing:", err);
        messageQueue.push({ destination, body });
        resolve();
      }
    } else {
      console.warn(" WebSocket not ready, queueing private message recall");
      messageQueue.push({ destination, body });
      resolve();
    }
  });
};

export const subscribeToPrivateMessageRecall = (userId, onRecallReceived) => {
  const key = `private-recall:${userId}`;
  return subscribeWithRetry(
    key,
    () => {
      console.log(
        ` Subscribing to private message recalls: /user/${userId}/queue/recall`
      );
      return stompClient.subscribe(
        `/user/${userId}/queue/recall`,
        (message) => {
          try {
            const recall = JSON.parse(message.body);
            console.log(
              " Private message recall received from WebSocket:",
              recall
            );
            onRecallReceived(recall);
          } catch (e) {
            console.error(" Error parsing private message recall", e);
          }
        }
      );
    },
    20,
    500
  );
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
      ` Subscribing to read receipts: /topic/room/${roomId}/read-status`
    );
    return stompClient.subscribe(
      `/topic/room/${roomId}/read-status`,
      (message) => {
        try {
          const receipt = JSON.parse(message.body);
          console.log(" Read receipt received from WebSocket:", receipt);
          onReadReceiptReceived(receipt);
        } catch (e) {
          console.error(" Error parsing read receipt", e);
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
    console.log(` Subscribing to member events: /topic/room/${roomId}/members`);
    return stompClient.subscribe(`/topic/room/${roomId}/members`, (message) => {
      try {
        const event = JSON.parse(message.body);
        console.log(" Member event received from WebSocket:", event);
        onMemberEventReceived(event);
      } catch (e) {
        console.error(" Error parsing member event", e);
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
  sendPrivateTypingIndicator,
  subscribeToPrivateMessages,
  subscribeToPrivateTypingIndicator,
  sendPrivateMessage,
  subscribeToUserStatus,
  broadcastUserStatus,
  recallMessageWebSocket,
  subscribeToMessageRecall,
  recallPrivateMessage,
  subscribeToPrivateMessageRecall,
  subscribeToReadReceipt,
  subscribeToMemberEvents,
  isWebSocketConnected,
  waitForWebSocketConnection,
  getStompClient: () => stompClient, //  Expose stompClient getter
};

export default webSocketService;

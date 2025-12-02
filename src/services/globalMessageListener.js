/**
 * Service quản lý global listeners cho Dashboard
 * Đảm bảo luôn lắng nghe, không bị unsubscribe khi component khác unmount
 */

import { subscribeToPrivateMessages } from "../services/websocket";
import { subscribeToRoomChat } from "../services/websocket";

let privateMessageSubscription = null;
let privateMessageListeners = new Set();

let roomMessageSubscriptions = new Map(); // roomId -> subscription
let roomMessageListeners = new Map(); // roomId -> Set of callbacks

/**
 * Subscribe global private messages (từ Dashboard)
 * Subscription này KHÔNG BẰNG nhứt bị unsubscribe trừ khi explicit call clearPrivateMessageSubscription
 */
export const subscribeGlobalPrivateMessages = (userId, onMessageReceived) => {
  console.log(
    "[GLOBAL_LISTENER] Setting up global private message listener for user:",
    userId
  );
  console.log(
    "[GLOBAL_LISTENER] Current subscription exists?",
    privateMessageSubscription !== null
  );

  // Tạo subscription nếu chưa có
  if (!privateMessageSubscription) {
    console.log(
      "[GLOBAL_LISTENER] Creating NEW private message subscription via subscribeToPrivateMessages"
    );
    privateMessageSubscription = subscribeToPrivateMessages(
      userId,
      (message) => {
        console.log(
          "[GLOBAL_LISTENER] 🎯 Private message received from WebSocket:",
          message
        );
        console.log(
          "[GLOBAL_LISTENER] 📋 Broadcasting to",
          privateMessageListeners.size,
          "listeners"
        );
        // Phát tới tất cả listeners
        privateMessageListeners.forEach((callback) => {
          try {
            console.log("[GLOBAL_LISTENER] 📤 Calling listener callback");
            callback(message);
          } catch (error) {
            console.error(
              "[GLOBAL_LISTENER] Error in private message listener:",
              error
            );
          }
        });
      }
    );
    console.log(
      "[GLOBAL_LISTENER] Subscription created:",
      privateMessageSubscription
    );
  } else {
    console.log(
      "[GLOBAL_LISTENER] Reusing existing private message subscription"
    );
  }

  // Thêm callback
  privateMessageListeners.add(onMessageReceived);
  console.log(
    `[GLOBAL_LISTENER] Added private message listener, total: ${privateMessageListeners.size}`
  );

  // Return object với unsubscribe (nhưng chỉ xóa từ Set, không unsubscribe từ WebSocket)
  return {
    unsubscribe: () => {
      console.log("[GLOBAL_LISTENER] Removing private message listener");
      privateMessageListeners.delete(onMessageReceived);
      console.log(
        `[GLOBAL_LISTENER] Removed listener, remaining: ${privateMessageListeners.size}`
      );
    },
  };
};

/**
 * Clear all private message listeners (khi logout)
 */
export const clearPrivateMessageSubscription = () => {
  console.log("[GLOBAL_LISTENER] Clearing private message subscription");
  privateMessageListeners.clear();
  if (privateMessageSubscription && privateMessageSubscription.unsubscribe) {
    privateMessageSubscription.unsubscribe();
  }
  privateMessageSubscription = null;
};

/**
 * Subscribe global room messages
 */
export const subscribeGlobalRoomMessages = (roomId, onMessageReceived) => {
  console.log(
    `[GLOBAL_LISTENER] Setting up global room message listener for room ${roomId}`
  );

  // Tạo listeners set nếu chưa có
  if (!roomMessageListeners.has(roomId)) {
    roomMessageListeners.set(roomId, new Set());
  }

  // Tạo subscription nếu chưa có
  if (!roomMessageSubscriptions.has(roomId)) {
    console.log(
      `[GLOBAL_LISTENER] Creating NEW subscription for room ${roomId} via subscribeToRoomChat`
    );
    const subscription = subscribeToRoomChat(roomId, (message) => {
      console.log(
        `[GLOBAL_LISTENER] 🎯 Room message received from WebSocket for room ${roomId}:`,
        message
      );
      // Phát tới tất cả listeners
      const listeners = roomMessageListeners.get(roomId);
      console.log(
        `[GLOBAL_LISTENER] 📋 Broadcasting to ${
          listeners?.size || 0
        } listeners for room ${roomId}`
      );
      if (listeners) {
        listeners.forEach((callback) => {
          try {
            console.log(
              `[GLOBAL_LISTENER] 📤 Calling listener callback for room ${roomId}`
            );
            callback(message);
          } catch (error) {
            console.error(
              "[GLOBAL_LISTENER] Error in room message listener:",
              error
            );
          }
        });
      }
    });
    roomMessageSubscriptions.set(roomId, subscription);
    console.log(
      `[GLOBAL_LISTENER] Room subscription created for room ${roomId}:`,
      subscription
    );
  } else {
    console.log(
      `[GLOBAL_LISTENER] Reusing existing subscription for room ${roomId}`
    );
  }

  // Thêm callback
  const listeners = roomMessageListeners.get(roomId);
  listeners.add(onMessageReceived);
  console.log(
    `[GLOBAL_LISTENER] Added room message listener for room ${roomId}, total: ${listeners.size}`
  );

  // Return object
  return {
    unsubscribe: () => {
      console.log(
        `[GLOBAL_LISTENER] Removing room message listener for room ${roomId}`
      );
      listeners.delete(onMessageReceived);
      console.log(
        `[GLOBAL_LISTENER] Removed listener, remaining: ${listeners.size}`
      );
    },
  };
};

/**
 * Clear all room message subscriptions (khi logout)
 */
export const clearRoomMessageSubscriptions = () => {
  console.log("[GLOBAL_LISTENER] Clearing all room message subscriptions");
  roomMessageListeners.clear();
  roomMessageSubscriptions.forEach((subscription) => {
    if (subscription && subscription.unsubscribe) {
      subscription.unsubscribe();
    }
  });
  roomMessageSubscriptions.clear();
};

/**
 * Clear all subscriptions (khi logout)
 */
export const clearAllGlobalSubscriptions = () => {
  console.log("[GLOBAL_LISTENER] Clearing ALL global subscriptions");
  clearPrivateMessageSubscription();
  clearRoomMessageSubscriptions();
};

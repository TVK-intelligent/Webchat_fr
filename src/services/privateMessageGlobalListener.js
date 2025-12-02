/**
 * Service để lắng nghe tất cả tin nhắn riêng toàn cục
 * Được sử dụng trong Dashboard để đẩy hộp thoại lên top khi có tin nhắn mới
 */

import { subscribeToPrivateMessages } from "./websocket";

let globalSubscription = null;
let listeners = [];

/**
 * Subscribe to all private messages globally
 * @param {Function} onPrivateMessageReceived - Callback khi có tin nhắn riêng mới
 * @returns {Object} - Object với phương thức unsubscribe
 */
export const subscribeToAllPrivateMessages = (
  userId,
  onPrivateMessageReceived
) => {
  console.log(
    "[PRIVATE_MESSAGE_GLOBAL] Setting up global listener for user",
    userId
  );

  if (!globalSubscription) {
    // Subscribe to the actual WebSocket stream
    globalSubscription = subscribeToPrivateMessages(userId, (message) => {
      console.log("[PRIVATE_MESSAGE_GLOBAL] Message received:", message);
      // Notify all registered listeners
      listeners.forEach((listener) => {
        try {
          listener(message);
        } catch (error) {
          console.error("[PRIVATE_MESSAGE_GLOBAL] Error in listener:", error);
        }
      });
    });
  }

  // Add this callback to the list of listeners
  if (!listeners.includes(onPrivateMessageReceived)) {
    listeners.push(onPrivateMessageReceived);
  }

  // Return unsubscribe function
  return {
    unsubscribe: () => {
      console.log("[PRIVATE_MESSAGE_GLOBAL] Removing listener");
      const index = listeners.indexOf(onPrivateMessageReceived);
      if (index > -1) {
        listeners.splice(index, 1);
      }

      // If no more listeners, unsubscribe from WebSocket
      if (listeners.length === 0 && globalSubscription) {
        console.log(
          "[PRIVATE_MESSAGE_GLOBAL] No more listeners, unsubscribing from WebSocket"
        );
        if (globalSubscription.unsubscribe) {
          globalSubscription.unsubscribe();
        }
        globalSubscription = null;
      }
    },
  };
};

/**
 * Clear all listeners (useful on logout)
 */
export const clearAllPrivateMessageListeners = () => {
  console.log("[PRIVATE_MESSAGE_GLOBAL] Clearing all listeners");
  listeners = [];
  if (globalSubscription && globalSubscription.unsubscribe) {
    globalSubscription.unsubscribe();
  }
  globalSubscription = null;
};

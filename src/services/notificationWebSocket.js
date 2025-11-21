/**
 * WebSocket subscriptions cho Notifications
 * Dùng với websocket.js để subscribe đến notification events
 */

import webSocketService from "./websocket";

export const subscribeToNotifications = (userId, onNotificationReceived) => {
  //  Retry logic cho WebSocket connection
  let subscription = null;

  const subscribeWithRetry = (attempt = 1, maxAttempts = 15) => {
    const stompClient = webSocketService.getStompClient();

    if (!stompClient || !stompClient.active) {
      if (attempt <= maxAttempts) {
        // Suppress verbose logging for early attempts - this is normal during startup
        if (attempt <= 2) {
          console.log(
            `WebSocket connection initializing, will subscribe to notifications on ready (attempt ${attempt}/${maxAttempts})`
          );
        } else if (attempt === maxAttempts) {
          console.warn(
            `WebSocket still not connected for notifications after ${maxAttempts} attempts (${
              (maxAttempts * 500) / 1000
            }s)`
          );
        }
        // Retry após 500ms
        setTimeout(() => subscribeWithRetry(attempt + 1, maxAttempts), 500);
        return;
      } else {
        console.error(
          "WebSocket connection failed - could not subscribe to notifications"
        );
        return;
      }
    }

    console.log(
      `[NOTIFICATION] Subscribing: /user/${userId}/topic/notifications (attempt ${attempt})`
    );

    try {
      subscription = stompClient.subscribe(
        `/user/${userId}/topic/notifications`,
        (message) => {
          try {
            const notification = JSON.parse(message.body);
            console.log("NOTIFICATION ARRIVED:", notification);
            console.log("TYPE:", notification.type);
            console.log("FULL DATA:", JSON.stringify(notification));
            onNotificationReceived(notification);
          } catch (e) {
            console.error("Error parsing notification:", e);
          }
        }
      );

      console.log("SUCCESSFULLY SUBSCRIBED to notifications!");
    } catch (err) {
      if (attempt <= maxAttempts) {
        console.error(
          `Error subscribing to notifications (attempt ${attempt}):`,
          err.message
        );
        // Retry - PHẢI RETURN để dừng execution
        setTimeout(() => subscribeWithRetry(attempt + 1, maxAttempts), 500);
        return;
      } else {
        console.error(
          "Failed to subscribe to notifications after max attempts"
        );
        return;
      }
    }
  };

  subscribeWithRetry();

  return {
    unsubscribe: () => {
      if (subscription) {
        try {
          subscription.unsubscribe();
          console.log(`Unsubscribed from notifications`);
        } catch (e) {
          console.warn("Error unsubscribing from notifications:", e);
        }
      }
    },
  };
};

/**
 * Subscribe to room invites notifications
 */
export const subscribeToRoomInviteNotifications = (
  userId,
  onRoomInviteReceived
) => {
  //  Retry logic cho WebSocket connection
  const subscribeWithRetry = (attempt = 1, maxAttempts = 10) => {
    const stompClient = webSocketService.getStompClient();

    if (!stompClient || !stompClient.active) {
      if (attempt <= maxAttempts) {
        // Suppress verbose logging for early attempts
        if (attempt <= 2) {
          console.log(
            `WebSocket initializing for room invites (attempt ${attempt}/${maxAttempts})`
          );
        } else if (attempt === maxAttempts) {
          console.warn(
            `WebSocket still not connected for room invites after ${maxAttempts} attempts`
          );
        }
        // Retry depois de 500ms
        setTimeout(() => subscribeWithRetry(attempt + 1, maxAttempts), 500);
        return null;
      } else {
        console.error("WebSocket connection failed for room invites");
        return null;
      }
    }

    console.log(
      `Subscribing to room invites: /user/${userId}/topic/room-invites`
    );

    try {
      const subscription = stompClient.subscribe(
        `/user/${userId}/topic/room-invites`,
        (message) => {
          try {
            const roomInvite = JSON.parse(message.body);
            console.log("Room invite received:", roomInvite);
            onRoomInviteReceived(roomInvite);
          } catch (e) {
            console.error("Error parsing room invite:", e);
          }
        }
      );

      return {
        unsubscribe: () => {
          try {
            subscription.unsubscribe();
            console.log(`Unsubscribed from room invites`);
          } catch (e) {
            console.warn("Error unsubscribing from room invites:", e);
          }
        },
      };
    } catch (err) {
      console.error("Error subscribing to room invites:", err.message);
      if (attempt <= maxAttempts) {
        setTimeout(() => subscribeWithRetry(attempt + 1, maxAttempts), 500);
      }
      return null;
    }
  };

  return subscribeWithRetry();
};

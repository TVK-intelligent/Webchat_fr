/**
 * WebSocket subscriptions cho Notifications
 * Dùng với websocket.js để subscribe đến notification events
 */

import webSocketService from "./websocket";

export const subscribeToNotifications = (userId, onNotificationReceived) => {
  let subscription = null;
  let timeoutId = null;
  let isUnsubscribed = false;

  const subscribeWithRetry = (attempt = 1, maxAttempts = 15) => {
    // If already unsubscribed, stop retrying
    if (isUnsubscribed) {
      console.log(
        `[NOTIFICATION] Skipping retry for userId ${userId} (already unsubscribed)`
      );
      return;
    }

    const stompClient = webSocketService.getStompClient();

    if (!stompClient || !stompClient.active) {
      if (attempt <= maxAttempts) {
        // Suppress verbose logging for early attempts - this is normal during startup
        if (attempt <= 2) {
          console.log(
            `[NOTIFICATION] WebSocket initializing (attempt ${attempt}/${maxAttempts}), will retry...`
          );
        } else if (attempt === maxAttempts) {
          console.warn(
            `[NOTIFICATION] WebSocket still not connected after ${maxAttempts} attempts (${
              (maxAttempts * 500) / 1000
            }s)`
          );
        }
        // Retry após 500ms
        timeoutId = setTimeout(
          () => subscribeWithRetry(attempt + 1, maxAttempts),
          500
        );
        return;
      } else {
        console.error(
          "[NOTIFICATION] WebSocket connection failed - could not subscribe to notifications"
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
            console.log("[NOTIFICATION] Arrived:", notification);
            console.log("[NOTIFICATION] Type:", notification.type);
            onNotificationReceived(notification);
          } catch (e) {
            console.error("[NOTIFICATION] Error parsing:", e);
          }
        }
      );

      console.log("[NOTIFICATION] Successfully subscribed!");
    } catch (err) {
      if (attempt <= maxAttempts) {
        console.error(
          `[NOTIFICATION] Error on attempt ${attempt}:`,
          err.message
        );
        // Retry
        timeoutId = setTimeout(
          () => subscribeWithRetry(attempt + 1, maxAttempts),
          500
        );
        return;
      } else {
        console.error("[NOTIFICATION] Failed to subscribe after max attempts");
        return;
      }
    }
  };

  subscribeWithRetry();

  return {
    unsubscribe: () => {
      isUnsubscribed = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (subscription) {
        try {
          subscription.unsubscribe();
          console.log(`[NOTIFICATION] Unsubscribed from notifications`);
        } catch (e) {
          console.warn("[NOTIFICATION] Error unsubscribing:", e);
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
  let subscription = null;
  let timeoutId = null;
  let isUnsubscribed = false;

  const subscribeWithRetry = (attempt = 1, maxAttempts = 10) => {
    // If already unsubscribed, stop retrying
    if (isUnsubscribed) {
      console.log(
        `[ROOM_INVITE] Skipping retry for userId ${userId} (already unsubscribed)`
      );
      return;
    }

    const stompClient = webSocketService.getStompClient();

    if (!stompClient || !stompClient.active) {
      if (attempt <= maxAttempts) {
        // Suppress verbose logging for early attempts
        if (attempt <= 2) {
          console.log(
            `[ROOM_INVITE] WebSocket initializing (attempt ${attempt}/${maxAttempts})`
          );
        } else if (attempt === maxAttempts) {
          console.warn(
            `[ROOM_INVITE] WebSocket still not connected after ${maxAttempts} attempts`
          );
        }
        // Retry depois de 500ms
        timeoutId = setTimeout(
          () => subscribeWithRetry(attempt + 1, maxAttempts),
          500
        );
        return;
      } else {
        console.error("[ROOM_INVITE] WebSocket connection failed");
        return;
      }
    }

    console.log(
      `[ROOM_INVITE] Subscribing: /user/${userId}/topic/room-invites`
    );

    try {
      subscription = stompClient.subscribe(
        `/user/${userId}/topic/room-invites`,
        (message) => {
          try {
            const roomInvite = JSON.parse(message.body);
            console.log("[ROOM_INVITE] Received:", roomInvite);
            onRoomInviteReceived(roomInvite);
          } catch (e) {
            console.error("[ROOM_INVITE] Error parsing:", e);
          }
        }
      );

      console.log("[ROOM_INVITE] Successfully subscribed!");
    } catch (err) {
      console.error("[ROOM_INVITE] Error on attempt", attempt, err.message);
      if (attempt <= maxAttempts) {
        timeoutId = setTimeout(
          () => subscribeWithRetry(attempt + 1, maxAttempts),
          500
        );
      }
    }
  };

  subscribeWithRetry();

  return {
    unsubscribe: () => {
      isUnsubscribed = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (subscription) {
        try {
          subscription.unsubscribe();
          console.log(`[ROOM_INVITE] Unsubscribed`);
        } catch (e) {
          console.warn("[ROOM_INVITE] Error unsubscribing:", e);
        }
      }
    },
  };
};

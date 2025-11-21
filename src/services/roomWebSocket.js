/**
 * WebSocket subscriptions cho Room events
 * Lắng nghe: tạo phòng mới, xóa phòng, cập nhật phòng
 */

import webSocketService from "./websocket";

/**
 * Subscribe to room events (create, delete, update)
 * Tất cả users sẽ nhận được thông báo phòng mới
 */
export const subscribeToRoomEvents = (
  onRoomCreated,
  onRoomDeleted,
  onRoomUpdated
) => {
  let activeSubscription = null;

  //  Đợi WebSocket kết nối (retry logic)
  const trySubscribe = (attempt = 1, maxAttempts = 15) => {
    //  Nếu đã subscribe thành công trước đó, trả về subscription hiện tại
    if (activeSubscription) {
      console.log(
        "Already subscribed to room events, returning existing subscription"
      );
      return activeSubscription;
    }

    const stompClient = webSocketService.getStompClient();

    if (!stompClient || !stompClient.active) {
      if (attempt <= maxAttempts) {
        // Suppress verbose logging for early attempts
        if (attempt <= 2) {
          console.log(
            `WebSocket initializing for room events (attempt ${attempt}/${maxAttempts})`
          );
        } else if (attempt === maxAttempts) {
          console.warn(
            `WebSocket still not connected for room events after ${maxAttempts} attempts`
          );
        }
        //  Retry después de 500ms
        const timeoutId = setTimeout(
          () => trySubscribe(attempt + 1, maxAttempts),
          500
        );
        //  Return object com unsubscribe function para cleanup timeout
        return {
          unsubscribe: () => clearTimeout(timeoutId),
        };
      } else {
        console.error("Failed to connect WebSocket for room events");
        return null;
      }
    }

    console.log("Subscribing to room events: /topic/rooms");

    try {
      //  Double check stompClient.active antes subscribe
      if (!stompClient.active) {
        throw new Error("STOMP client is not active yet");
      }

      const subscription = stompClient.subscribe(
        "/topic/rooms", //  Broadcast channel para tudo room events
        (message) => {
          try {
            const event = JSON.parse(message.body);
            console.log("Room event received:", event);

            // Processar selon tipo de event
            switch (event.type) {
              case "ROOM_CREATED":
                console.log("New room created:", event.room);
                if (onRoomCreated) onRoomCreated(event.room);
                break;

              case "ROOM_DELETED":
                console.log("Room deleted:", event.roomId);
                if (onRoomDeleted) onRoomDeleted(event.roomId);
                break;

              case "ROOM_UPDATED":
                console.log("Room updated:", event.room);
                if (onRoomUpdated) onRoomUpdated(event.room);
                break;

              default:
                console.warn("Unknown room event type:", event.type);
            }
          } catch (e) {
            console.error("Error parsing room event:", e);
          }
        }
      );

      //  Guardar subscription para reutilizar si retry
      activeSubscription = {
        unsubscribe: () => {
          try {
            subscription.unsubscribe();
            activeSubscription = null;
            console.log("Unsubscribed from room events");
          } catch (e) {
            console.warn("Error unsubscribing from room events:", e);
          }
        },
      };

      console.log("Successfully subscribed to room events");
      return activeSubscription;
    } catch (err) {
      console.warn(
        `Error subscribing to room events (attempt ${attempt}):`,
        err.message
      );
      // Retry se ainda houver tentativas
      if (attempt < maxAttempts) {
        console.log(
          `Retrying room subscription (${attempt}/${maxAttempts})...`
        );
        const timeoutId = setTimeout(
          () => trySubscribe(attempt + 1, maxAttempts),
          500
        );
        //  Return object para RoomList possa cleanup timeout
        return {
          unsubscribe: () => clearTimeout(timeoutId),
        };
      } else {
        console.error("Failed to subscribe to room events");
      }
      return null;
    }
  };

  //  Khởi động subscription lần đầu tiên
  return trySubscribe();
};

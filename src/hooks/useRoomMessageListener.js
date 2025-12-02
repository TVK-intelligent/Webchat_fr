/**
 * Hook để lắng nghe tất cả tin nhắn phòng toàn cục
 * Sử dụng global service để đảm bảo subscription không bị unsubscribe khi component unmount
 */

import { useEffect, useRef } from "react";
import { subscribeGlobalRoomMessages } from "../services/globalMessageListener";

/**
 * Hook để subscribe tất cả tin nhắn phòng
 * @param {number} roomId - Room ID
 * @param {Function} onMessageReceived - Callback khi nhận tin nhắn
 */
export const useRoomMessageListener = (roomId, onMessageReceived) => {
  const callbackRef = useRef(onMessageReceived);
  const roomIdRef = useRef(roomId);
  const unsubscribeRef = useRef(null);

  // Update refs khi callback thay đổi
  useEffect(() => {
    callbackRef.current = onMessageReceived;
  }, [onMessageReceived]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    console.log(`[ROOM_MESSAGE_HOOK] Component subscribing to room ${roomId}`);

    // Subscribe sử dụng global service (subscription sẽ không bị unsubscribe khi component unmount)
    const unsubscribe = subscribeGlobalRoomMessages(
      roomId,
      callbackRef.current
    );
    unsubscribeRef.current = unsubscribe;

    // Cleanup: chỉ xóa callback khỏi listeners, không unsubscribe từ global service
    return () => {
      console.log(
        `[ROOM_MESSAGE_HOOK] Component unsubscribing from room ${roomId}`
      );
      if (unsubscribeRef.current) {
        unsubscribeRef.current.unsubscribe();
      }
    };
  }, [roomId]);
};

/**
 * Clear tất cả room listeners (khi logout) - không cần vì clearAllGlobalSubscriptions gọi từ Dashboard
 */
export const clearRoomMessageListeners = () => {
  console.log(
    "[ROOM_MESSAGE_HOOK] Clear function (handled by globalMessageListener)"
  );
};

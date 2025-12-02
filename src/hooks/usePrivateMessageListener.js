/**
 * Hook để lắng nghe tất cả tin nhắn riêng toàn cục
 * Sử dụng global service để đảm bảo subscription không bị unsubscribe khi component unmount
 */

import { useEffect, useRef } from "react";
import { subscribeGlobalPrivateMessages } from "../services/globalMessageListener";

/**
 * Hook sử dụng cho bất kỳ component nào muốn lắng nghe tin nhắn riêng
 * @param {number} userId - User ID
 * @param {Function} onMessageReceived - Callback khi nhận tin nhắn
 */
export const usePrivateMessageListener = (userId, onMessageReceived) => {
  const callbackRef = useRef(onMessageReceived);
  const userIdRef = useRef(userId);
  const unsubscribeRef = useRef(null);

  // Update refs khi callback thay đổi
  useEffect(() => {
    callbackRef.current = onMessageReceived;
  }, [onMessageReceived]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    console.log(
      `[PRIVATE_MESSAGE_HOOK] Component subscribing with userId: ${userId}`
    );

    // Subscribe sử dụng global service (subscription sẽ không bị unsubscribe khi component unmount)
    const unsubscribe = subscribeGlobalPrivateMessages(
      userId,
      callbackRef.current
    );
    unsubscribeRef.current = unsubscribe;

    // Cleanup: chỉ xóa callback khỏi listeners, không unsubscribe từ global service
    return () => {
      console.log("[PRIVATE_MESSAGE_HOOK] Component unsubscribing");
      if (unsubscribeRef.current) {
        unsubscribeRef.current.unsubscribe();
      }
    };
  }, [userId]);
};

/**
 * Clear tất cả listeners (khi logout) - không cần vì clearAllGlobalSubscriptions gọi từ Dashboard
 */
export const clearPrivateMessageListeners = () => {
  console.log(
    "[PRIVATE_MESSAGE_HOOK] Clear function (handled by globalMessageListener)"
  );
};

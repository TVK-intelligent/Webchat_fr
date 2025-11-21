import { useEffect, useRef } from "react";
import { notificationAudioService } from "../services/notificationAudioService";
import { subscribeToNotifications } from "../services/notificationWebSocket";
import { useAuth } from "../context/AuthContext";

/**
 * Custom hook để lắng nghe và xử lý notifications từ WebSocket
 * Hook này chạy ở background, không phụ thuộc vào tab hiện tại
 * Sử dụng useRef để xử lý React Strict Mode (tránh re-subscribe trong dev mode)
 */
export const useNotificationListener = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const subscriptionRef = useRef(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    console.log(
      " useNotificationListener useEffect triggered, userId:",
      userId,
      "user object:",
      user
    );

    if (!userId) {
      console.warn("⚠️ User ID not available for notification listener");
      return;
    }

    //  Chỉ subscribe một lần - tránh re-subscribe trong React Strict Mode
    if (isSubscribedRef.current) {
      console.log(" Already subscribed, skipping duplicate subscription");
      return;
    }

    console.log("📡 Setting up notification listener for user:", userId);

    // Gọi subscribe một lần - subscribeToNotifications sẽ tự handle retry logic
    subscriptionRef.current = subscribeToNotifications(
      userId,
      (notification) => {
        console.log(" Notification received in hook:", notification);
        console.log("📝 Type:", notification.type);
        console.log(
          " Audio enabled:",
          notificationAudioService.isAudioEnabled()
        );
        console.log(" Audio volume:", notificationAudioService.getVolume());

        //  Phát âm thanh riêng theo loại thông báo - LUÔN PHÁT
        if (notification.type === "MESSAGE") {
          console.log("🎵 Playing MESSAGE sound");
          notificationAudioService.playMessageSound();
        } else if (notification.type === "INVITE") {
          console.log("🎵 Playing ROOM INVITE sound - INVOKING NOW");
          try {
            notificationAudioService.playRoomInviteSound();
            console.log(" Room invite sound method called successfully");
          } catch (e) {
            console.error("❌ Error calling room invite sound:", e);
          }
        } else if (notification.type === "FRIEND_REQUEST") {
          console.log("🎵 Playing FRIEND REQUEST sound");
          notificationAudioService.playFriendRequestSound();
        }
      }
    );

    if (subscriptionRef.current) {
      console.log(" Notification listener set up successfully");
      isSubscribedRef.current = true;
    } else {
      console.log(
        "⚠️ Subscription returned null on initial attempt - will retry in background"
      );
    }

    // 🚨 IMPORTANT: No cleanup function needed because:
    // - We only subscribe ONCE on mount (guarded by isSubscribedRef)
    // - subscription should stay active for entire app lifetime
    // - Cleanup would only happen on actual component unmount (end of session)
    // - React Strict Mode double-invoke is handled by isSubscribedRef guard
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ⚠️ EMPTY DEPENDENCY - chỉ chạy lần đầu tiên khi component mount
};

export default useNotificationListener;

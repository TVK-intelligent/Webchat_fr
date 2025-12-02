/**
 * Hook: usePushNotifications
 * Quản lý Push Notifications trong component
 * - Khởi tạo push notification service
 * - Yêu cầu quyền
 * - Xử lý notification click events
 */

import { useEffect } from "react";

const usePushNotifications = (onNotificationClick) => {
  useEffect(() => {
    let pushNotificationService = null;

    const initPushNotifications = async () => {
      try {
        // Import động để tránh lỗi nếu file không tồn tại
        const module = await import("../services/pushNotificationService");
        pushNotificationService = module.default;

        console.log("🔔 Initializing Push Notifications...");

        // Khởi tạo service
        const initialized = await pushNotificationService.init();

        if (!initialized) {
          console.warn("⚠️ Push Notification Service initialization failed");
          return;
        }

        console.log("✅ Push Notification Service initialized");

        // Kiểm tra quyền
        if (
          pushNotificationService.permission === "default" ||
          pushNotificationService.permission === "denied"
        ) {
          console.log("📋 Requesting notification permission...");
          await pushNotificationService.requestPermission();
        }

        // Lắng nghe notification click events
        window.addEventListener("pushNotificationClick", (event) => {
          console.log("📩 Push notification clicked in app:", event.detail);
          if (onNotificationClick) {
            onNotificationClick(event.detail);
          }
        });

        console.log("✅ Push notification listeners registered");
      } catch (error) {
        console.warn("⚠️ Failed to initialize push notifications:", error);
      }
    };

    // Khởi tạo push notifications khi component mount
    initPushNotifications();

    // Cleanup
    return () => {
      if (window) {
        window.removeEventListener(
          "pushNotificationClick",
          onNotificationClick
        );
      }
    };
  }, [onNotificationClick]);
};

export default usePushNotifications;

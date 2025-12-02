/**
 * Push Notification Integration
 * Tích hợp push notifications vào các sự kiện của chat
 * - Tin nhắn mới
 * - Tin nhắn phòng
 * - Lời mời kết bạn
 * - Lời mời phòng
 */

import pushNotificationService from "./pushNotificationService";

/**
 * Thông báo tin nhắn riêng mới
 * @param {string} senderId - ID người gửi
 * @param {string} senderName - Tên người gửi
 * @param {string} messageContent - Nội dung tin nhắn
 */
export const notifyNewPrivateMessage = async (
  senderId,
  senderName,
  messageContent
) => {
  console.log("📨 [notifyNewPrivateMessage] Called with:", {
    senderId,
    senderName,
    messageContent,
  });

  if (!pushNotificationService.isSupported) {
    console.warn(
      "⚠️ [notifyNewPrivateMessage] Push notifications not supported"
    );
    return false;
  }

  if (!pushNotificationService.isPermissionGranted()) {
    console.log(
      "⚠️ [notifyNewPrivateMessage] Permission not granted, requesting...",
      "Current permission:",
      pushNotificationService.permission
    );
    const granted = await pushNotificationService.requestPermission();
    if (!granted) {
      console.warn(
        "⚠️ [notifyNewPrivateMessage] User denied notification permission"
      );
      return false;
    }
  }

  try {
    console.log("📨 [notifyNewPrivateMessage] Sending notification:", {
      senderId,
      senderName,
      messageContent,
    });

    const result = await pushNotificationService.notifyNewMessage(
      senderName,
      messageContent,
      senderId
    );

    console.log(
      "✅ [notifyNewPrivateMessage] Notification sent successfully:",
      result
    );
    return result;
  } catch (error) {
    console.error(
      "❌ [notifyNewPrivateMessage] Error sending notification:",
      error
    );
    return false;
  }
};

/**
 * Thông báo tin nhắn phòng mới
 * @param {string} roomId - ID phòng
 * @param {string} roomName - Tên phòng
 * @param {string} senderName - Tên người gửi
 * @param {string} messageContent - Nội dung tin nhắn
 */
export const notifyNewRoomMessage = async (
  roomId,
  roomName,
  senderName,
  messageContent
) => {
  if (!pushNotificationService.isSupported) {
    console.warn("⚠️ Push notifications not supported");
    return false;
  }

  if (!pushNotificationService.isPermissionGranted()) {
    console.log("⚠️ Push notification permission not granted");
    return false;
  }

  try {
    console.log("💬 Sending room message notification:", {
      roomId,
      roomName,
      senderName,
      messageContent,
    });

    const result = await pushNotificationService.notifyRoomMessage(
      roomName,
      senderName,
      messageContent,
      roomId
    );

    console.log("✅ Room message notification sent:", result);
    return result;
  } catch (error) {
    console.error("❌ Error sending room message notification:", error);
    return false;
  }
};

/**
 * Thông báo lời mời kết bạn
 * @param {string} senderId - ID người gửi
 * @param {string} senderName - Tên người gửi
 */
export const notifyFriendRequest = async (senderId, senderName) => {
  if (!pushNotificationService.isSupported) {
    console.warn("⚠️ Push notifications not supported");
    return false;
  }

  if (!pushNotificationService.isPermissionGranted()) {
    console.log("⚠️ Push notification permission not granted");
    return false;
  }

  try {
    console.log("👤 Sending friend request notification:", {
      senderId,
      senderName,
    });

    const result = await pushNotificationService.notifyFriendRequest(
      senderName,
      senderId
    );

    console.log("✅ Friend request notification sent:", result);
    return result;
  } catch (error) {
    console.error("❌ Error sending friend request notification:", error);
    return false;
  }
};

/**
 * Thông báo lời mời tham gia phòng
 * @param {string} roomId - ID phòng
 * @param {string} roomName - Tên phòng
 * @param {string} inviterId - ID người mời
 * @param {string} inviterName - Tên người mời
 */
export const notifyRoomInvite = async (
  roomId,
  roomName,
  inviterId,
  inviterName
) => {
  if (!pushNotificationService.isSupported) {
    console.warn("⚠️ Push notifications not supported");
    return false;
  }

  if (!pushNotificationService.isPermissionGranted()) {
    console.log("⚠️ Push notification permission not granted");
    return false;
  }

  try {
    console.log("🎯 Sending room invite notification:", {
      roomId,
      roomName,
      inviterId,
      inviterName,
    });

    const result = await pushNotificationService.notifyRoomInvite(
      roomName,
      inviterName,
      roomId,
      inviterId
    );

    console.log("✅ Room invite notification sent:", result);
    return result;
  } catch (error) {
    console.error("❌ Error sending room invite notification:", error);
    return false;
  }
};

/**
 * Yêu cầu quyền push notifications (để call trực tiếp nếu cần)
 */
export const requestPushNotificationPermission = async () => {
  if (!pushNotificationService.isSupported) {
    console.warn("⚠️ Push notifications not supported");
    return false;
  }

  try {
    const granted = await pushNotificationService.requestPermission();
    console.log(
      "🔔 Notification permission result:",
      granted ? "Granted" : "Denied/Dismissed"
    );
    return granted;
  } catch (error) {
    console.error("❌ Error requesting permission:", error);
    return false;
  }
};

/**
 * Kiểm tra xem push notifications có được hỗ trợ không
 */
export const isPushNotificationsSupported = () => {
  return pushNotificationService.isSupported;
};

/**
 * Kiểm tra xem user đã cho phép notifications không
 */
export const isPushNotificationsEnabled = () => {
  return pushNotificationService.isPermissionGranted();
};

/**
 * Đóng tất cả notifications
 */
export const closeAllNotifications = async () => {
  try {
    await pushNotificationService.closeAllNotifications();
    console.log("✅ All notifications closed");
  } catch (error) {
    console.error("❌ Error closing notifications:", error);
  }
};

const pushNotificationIntegration = {
  notifyNewPrivateMessage,
  notifyNewRoomMessage,
  notifyFriendRequest,
  notifyRoomInvite,
  requestPushNotificationPermission,
  isPushNotificationsSupported,
  isPushNotificationsEnabled,
  closeAllNotifications,
};

export default pushNotificationIntegration;

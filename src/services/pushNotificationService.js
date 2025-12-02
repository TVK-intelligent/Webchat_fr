/**
 * Push Notification Service
 * Xử lý Web Push Notifications (Desktop Notifications)
 * - Đăng ký Service Worker
 * - Yêu cầu quyền từ user
 * - Gửi push notification
 * - Xử lý notification click events
 */

class PushNotificationService {
  constructor() {
    this.isSupported = this.checkSupport();
    this.permission = Notification.permission;
    this.swRegistration = null;
  }

  /**
   * Kiểm tra trình duyệt có hỗ trợ Web Push không
   */
  checkSupport() {
    const hasNotificationAPI = "Notification" in window;
    const hasServiceWorker = "serviceWorker" in navigator;
    const hasMessageEventSource = "MessageEvent" in window;

    const supported = hasNotificationAPI && hasServiceWorker;

    console.log("🔍 Push Notification Support Check:", {
      hasNotificationAPI,
      hasServiceWorker,
      hasMessageEventSource,
      supported,
    });

    return supported;
  }

  /**
   * Khởi tạo Push Notification Service
   * - Đăng ký Service Worker
   * - Kiểm tra quyền
   */
  async init() {
    if (!this.isSupported) {
      console.warn(
        "⚠️ Browser không hỗ trợ Web Push Notifications (Notification API hoặc Service Worker)"
      );
      return false;
    }

    try {
      console.log("🚀 Initializing Push Notification Service...");

      // Đăng ký Service Worker
      this.swRegistration = await navigator.serviceWorker.register(
        "/service-worker.js",
        { scope: "/" }
      );

      console.log(
        "✅ Service Worker registered successfully:",
        this.swRegistration
      );

      // Kiểm tra quyền
      this.permission = Notification.permission;
      console.log("🔔 Current notification permission:", this.permission);

      // Lắng nghe notification click từ Service Worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        console.log("📩 Message from Service Worker:", event.data);
        this.handleNotificationClick(event.data);
      });

      return true;
    } catch (error) {
      console.error("❌ Error initializing Push Notification Service:", error);
      return false;
    }
  }

  /**
   * Yêu cầu quyền push notification từ user
   */
  async requestPermission() {
    if (!this.isSupported) {
      console.warn("⚠️ Push Notifications không được hỗ trợ");
      return false;
    }

    try {
      console.log("📋 Requesting notification permission...");
      const permission = await Notification.requestPermission();
      this.permission = permission;

      console.log("✅ Notification permission:", permission);

      if (permission === "granted") {
        console.log("✅ User đã cấp quyền notifications");
        return true;
      } else if (permission === "denied") {
        console.warn("⚠️ User đã từ chối quyền notifications");
        return false;
      } else {
        console.log("⏳ User chưa quyết định quyền notifications");
        return false;
      }
    } catch (error) {
      console.error("❌ Error requesting notification permission:", error);
      return false;
    }
  }

  /**
   * Gửi push notification
   * @param {Object} notification - Notification config
   * @param {string} notification.title - Tiêu đề
   * @param {string} notification.body - Nội dung
   * @param {string} notification.icon - Icon URL
   * @param {string} notification.badge - Badge URL
   * @param {string} notification.tag - Để nhóm notifications
   * @param {Object} notification.data - Dữ liệu tùy chỉnh
   */
  async sendNotification({
    title,
    body,
    icon = "/logo192.png",
    badge = "/logo192.png",
    tag = "general",
    data = {},
  }) {
    if (!this.isSupported) {
      console.warn("⚠️ Push Notifications không được hỗ trợ");
      return false;
    }

    if (this.permission !== "granted") {
      console.warn(
        "⚠️ Không có quyền gửi notifications (permission:",
        this.permission + ")"
      );
      return false;
    }

    try {
      if (!this.swRegistration) {
        console.error("❌ Service Worker chưa được đăng ký");
        return false;
      }

      const options = {
        body,
        icon,
        badge,
        tag, // Dùng tag để update notification thay vì hiện nhiều
        requireInteraction: false,
        data, // Dữ liệu được gửi khi user click
      };

      console.log(
        "📤 [showNotification] Calling swRegistration.showNotification with:",
        { title, tag }
      );

      const result = await this.swRegistration.showNotification(title, options);

      console.log(
        "✅ [showNotification] Notification displayed successfully, result:",
        result
      );
      return true;
    } catch (error) {
      console.error("❌ [showNotification] Error sending notification:", error);
      return false;
    }
  }

  /**
   * Gửi notification cho tin nhắn mới
   */
  async notifyNewMessage(senderName, messageContent, senderId) {
    // Close previous notification from this sender to allow new one
    await this.closeNotificationByTag(`message-${senderId}`);

    return this.sendNotification({
      title: `📨 Tin nhắn từ ${senderName}`,
      body: messageContent.substring(0, 100), // Giới hạn 100 ký tự
      tag: `message-${senderId}`, // Dùng tag để update thay vì nhiều notification
      data: {
        type: "message",
        senderId,
        action: "open_message",
      },
    });
  }

  /**
   * Gửi notification cho tin nhắn phòng
   */
  async notifyRoomMessage(roomName, senderName, messageContent, roomId) {
    // Close previous notification for this room to allow new one
    await this.closeNotificationByTag(`room-${roomId}`);

    return this.sendNotification({
      title: `💬 ${roomName}`,
      body: `${senderName}: ${messageContent.substring(0, 80)}`,
      tag: `room-${roomId}`, // Dùng tag để update thay vì nhiều notification
      data: {
        type: "room_message",
        roomId,
        action: "open_room",
      },
    });
  }

  /**
   * Gửi notification cho lời mời kết bạn
   */
  async notifyFriendRequest(senderName, senderId) {
    // Close previous notification from this user to allow new one
    await this.closeNotificationByTag(`friend-request-${senderId}`);

    return this.sendNotification({
      title: `👤 Lời mời kết bạn`,
      body: `${senderName} muốn kết bạn với bạn`,
      tag: `friend-request-${senderId}`,
      data: {
        type: "friend_request",
        senderId,
        action: "open_friend_requests",
      },
    });
  }

  /**
   * Gửi notification cho lời mời phòng
   */
  async notifyRoomInvite(roomName, inviterName, roomId, inviterId) {
    // Close previous notification for this room invite to allow new one
    await this.closeNotificationByTag(`room-invite-${roomId}`);

    return this.sendNotification({
      title: `🎯 Lời mời tham gia phòng`,
      body: `${inviterName} mời bạn tham gia ${roomName}`,
      tag: `room-invite-${roomId}`,
      data: {
        type: "room_invite",
        roomId,
        inviterId,
        action: "open_room_invites",
      },
    });
  }

  /**
   * Xử lý notification click
   */
  handleNotificationClick(data) {
    console.log("🖱️ Notification clicked:", data);

    if (!data) return;

    const { type, senderId, roomId, action } = data;

    // Emit custom event để các component có thể lắng nghe
    const event = new CustomEvent("pushNotificationClick", {
      detail: { type, senderId, roomId, action },
    });
    window.dispatchEvent(event);

    console.log("📤 Custom event 'pushNotificationClick' dispatched");
  }

  /**
   * Lấy tất cả notifications
   */
  async getNotifications() {
    if (!this.swRegistration) return [];
    return await this.swRegistration.getNotifications();
  }

  /**
   * Đóng notification theo tag
   */
  async closeNotificationByTag(tag) {
    if (!this.swRegistration) {
      console.log(`⚠️ [closeNotificationByTag] Service Worker not registered`);
      return;
    }
    const notifications = await this.swRegistration.getNotifications();
    const matchingNotifications = notifications.filter((n) => n.tag === tag);

    console.log(
      `🔍 [closeNotificationByTag] Looking for tag "${tag}": found ${matchingNotifications.length} notifications`
    );

    matchingNotifications.forEach((n) => {
      console.log(
        `❌ [closeNotificationByTag] Closing notification with tag "${tag}"`
      );
      n.close();
    });
  }

  /**
   * Đóng tất cả notifications
   */
  async closeAllNotifications() {
    if (!this.swRegistration) return;
    const notifications = await this.swRegistration.getNotifications();
    notifications.forEach((n) => n.close());
  }

  /**
   * Kiểm tra notification permission
   */
  isPermissionGranted() {
    return this.permission === "granted";
  }

  /**
   * Kiểm tra notification permission
   */
  isPermissionDenied() {
    return this.permission === "denied";
  }
}

// Singleton instance
const pushNotificationService = new PushNotificationService();

export default pushNotificationService;

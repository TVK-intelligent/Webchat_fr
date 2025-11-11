/**
 * Desktop Notification Service
 * Quản lý Desktop Notifications khi nhận tin nhắn hoặc thông báo
 */

class DesktopNotificationService {
  constructor() {
    this.isEnabled = this.isDesktopNotificationEnabled();
    this.permission = Notification.permission;
    this.activeNotifications = new Map();
  }

  /**
   * Kiểm tra xem trình duyệt hỗ trợ Desktop Notifications
   */
  static isSupported() {
    return "Notification" in window;
  }

  /**
   * Kiểm tra xem Desktop Notifications đã được bật
   */
  isDesktopNotificationEnabled() {
    return localStorage.getItem("desktopNotificationEnabled") === "true";
  }

  /**
   * Bật/Tắt Desktop Notifications
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem("desktopNotificationEnabled", enabled);
  }

  /**
   * Yêu cầu quyền từ trình duyệt
   */
  async requestPermission() {
    if (!DesktopNotificationService.isSupported()) {
      console.warn("⚠️ Trình duyệt không hỗ trợ Desktop Notifications");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      console.log("🔔 Desktop Notification permission:", permission);
      return permission === "granted";
    } catch (error) {
      console.error("❌ Lỗi yêu cầu quyền Desktop Notification:", error);
      return false;
    }
  }

  /**
   * Phát Desktop Notification
   */
  notify(title, options = {}) {
    console.log("🔔 notify() called:", {
      title,
      options,
      isEnabled: this.isEnabled,
    });

    if (!this.isEnabled) {
      console.debug("Desktop Notifications đã bị tắt");
      return null;
    }

    if (!DesktopNotificationService.isSupported()) {
      console.warn("⚠️ Trình duyệt không hỗ trợ Desktop Notifications");
      return null;
    }

    if (this.permission !== "granted") {
      console.warn(
        "⚠️ Không có quyền hiển thị Desktop Notifications. Permission:",
        this.permission
      );
      return null;
    }

    try {
      const defaultOptions = {
        icon: "/android-chrome-192x192.png", // Favicon hoặc app icon
        badge: "/favicon.ico",
        tag: `notification-${Date.now()}`,
        requireInteraction: false,
        ...options,
      };

      console.log("📮 Creating notification with options:", defaultOptions);
      const notification = new Notification(title, defaultOptions);
      console.log("✅ Notification created successfully");

      // Lưu notification vào map để quản lý
      this.activeNotifications.set(defaultOptions.tag, notification);

      // Tự động đóng sau 5 giây nếu không set requireInteraction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
          this.activeNotifications.delete(defaultOptions.tag);
        }, 5000);
      }

      // Xử lý click notification
      notification.onclick = () => {
        console.log("📬 Notification clicked");
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      // Xử lý close
      notification.onclose = () => {
        console.log("📭 Notification closed");
        this.activeNotifications.delete(defaultOptions.tag);
      };

      console.log("✅ Desktop Notification phát:", title);
      return notification;
    } catch (error) {
      console.error("❌ Lỗi phát Desktop Notification:", error);
      return null;
    }
  }

  /**
   * Phát notification khi có tin nhắn mới
   * @param {string} senderName - Tên người gửi
   * @param {string} messageContent - Nội dung tin nhắn
   * @param {string} roomName - Tên phòng chat
   * @param {number} messageId - ID tin nhắn (để tránh trùng lặp)
   */
  notifyNewMessage(senderName, messageContent, roomName, messageId) {
    console.log("📨 notifyNewMessage called with:", {
      senderName,
      messageContent,
      roomName,
      messageId,
      enabled: this.isEnabled,
      permission: this.permission,
      supported: DesktopNotificationService.isSupported(),
    });

    if (!this.isEnabled) {
      console.warn("⚠️ Desktop notifications disabled");
      return null;
    }

    const title = `📨 Tin nhắn từ ${senderName}`;
    const body = messageContent.substring(0, 100); // Giới hạn 100 ký tự
    // Dùng messageId làm tag để chỉ thông báo 1 lần cho mỗi tin nhắn
    const tag = `message-${messageId}`;
    const options = {
      body: body,
      tag: tag, // Cùng tag = thay thế notification cũ, không trùng lặp
      badge: "/favicon.ico",
      requireInteraction: false,
    };

    console.log("📨 Phát notification:", { title, body, tag });
    return this.notify(title, options);
  }

  /**
   * Phát notification khi có lời mời kết bạn
   */
  notifyFriendRequest(userName) {
    const title = "👥 Lời mời kết bạn";
    const body = `${userName} đã gửi lời mời kết bạn`;
    const options = {
      body: body,
      tag: `friend-request-${Date.now()}`,
      badge: "/favicon.ico",
      requireInteraction: true,
    };

    return this.notify(title, options);
  }

  /**
   * Phát notification khi có lời mời vào phòng
   */
  notifyRoomInvite(inviterName, roomName) {
    const title = "🎉 Lời mời vào phòng";
    const body = `${inviterName} mời bạn vào phòng "${roomName}"`;
    const options = {
      body: body,
      tag: `room-invite-${Date.now()}`,
      badge: "/favicon.ico",
      requireInteraction: true,
    };

    return this.notify(title, options);
  }

  /**
   * Phát notification thông báo chung
   */
  notifyGeneral(title, body, options = {}) {
    const defaultOptions = {
      body: body,
      tag: `general-${Date.now()}`,
      badge: "/favicon.ico",
      ...options,
    };

    return this.notify(title, defaultOptions);
  }

  /**
   * Đóng tất cả notifications
   */
  closeAll() {
    this.activeNotifications.forEach((notification) => {
      notification.close();
    });
    this.activeNotifications.clear();
    console.log("✅ Tất cả Desktop Notifications đã đóng");
  }

  /**
   * Đóng notification theo tag
   */
  closeByTag(tag) {
    const notification = this.activeNotifications.get(tag);
    if (notification) {
      notification.close();
      this.activeNotifications.delete(tag);
    }
  }

  /**
   * Lấy số notifications đang hoạt động
   */
  getActiveCount() {
    return this.activeNotifications.size;
  }
}

// Export singleton instance
export const desktopNotificationService = new DesktopNotificationService();

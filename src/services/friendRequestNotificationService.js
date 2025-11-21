/**
 * Friend Request Notification Service
 * Polls friend requests in the background (không phụ thuộc vào component)
 * Phát âm thanh khi có lời kết bạn mới - CHỈ 1 LẦN DUY NHẤT
 */

import { friendService } from "./api";
import { notificationAudioService } from "./notificationAudioService";

class FriendRequestNotificationService {
  constructor() {
    this.pollingInterval = null;
    this.isPolling = false;
    this.notifiedRequestIds = new Set(); // Track đã phát âm thanh cho requests nào
    this.pollIntervalMs = 10000; // Poll mỗi 10 giây
  }

  /**
   * Bắt đầu polling friend requests ở background
   */
  startPolling() {
    if (this.isPolling) {
      console.log("Friend request polling already running");
      return;
    }

    console.log("Starting friend request background polling...");
    this.isPolling = true;

    // Polling ngay lập tức
    this.pollFriendRequests();

    // Tiếp tục polling mỗi 10 giây
    this.pollingInterval = setInterval(() => {
      this.pollFriendRequests();
    }, this.pollIntervalMs);
  }

  /**
   * Dừng polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log("Friend request polling stopped");
  }

  /**
   * Poll friend requests một lần
   */
  async pollFriendRequests() {
    try {
      const response = await friendService.getPendingRequests();
      const newRequests = response.data || [];

      console.log("Polled friend requests:", newRequests.length);

      // Check xem có request chưa được phát âm thanh không
      newRequests.forEach((request) => {
        //  Chỉ phát nếu chưa từng phát cho request này
        if (!this.notifiedRequestIds.has(request.id)) {
          const senderName =
            request.fromUser?.displayName ||
            request.fromUser?.username ||
            "Người dùng";

          console.log("NEW FRIEND REQUEST DETECTED - Playing sound ONCE!");
          console.log("From:", senderName);

          // 🎵 Phát âm thanh
          notificationAudioService.playFriendRequestSound();

          //  Mark đã phát cho request này
          this.notifiedRequestIds.add(request.id);
        }
      });
    } catch (error) {
      console.error("Error polling friend requests:", error);
    }
  }

  /**
   * Reset (dùng khi user logout)
   */
  reset() {
    this.stopPolling();
    this.notifiedRequestIds.clear();
  }
}

// Export singleton
export const friendRequestNotificationService =
  new FriendRequestNotificationService();
export default friendRequestNotificationService;

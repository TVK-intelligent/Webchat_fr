/**
 * Room Invite Notification Service
 * Polls room invites in the background (không phụ thuộc vào component)
 * Phát âm thanh khi có lời mời vào phòng mới - CHỈ 1 LẦN DUY NHẤT
 */

import { roomInviteService } from "./api";
import { notificationAudioService } from "./notificationAudioService";
import { notifyRoomInvite } from "./pushNotificationIntegration";

class RoomInviteNotificationService {
  constructor() {
    this.pollingInterval = null;
    this.isPolling = false;
    this.notifiedInviteIds = new Set(); // Track đã phát âm thanh cho invites nào
    this.pollIntervalMs = 3000; // Poll mỗi 3 giây (nhanh hơn để phát âm thanh kịp thời)
  }

  /**
   * Bắt đầu polling room invites ở background
   */
  startPolling() {
    if (this.isPolling) {
      console.log("Room invite polling already running");
      return;
    }

    console.log(
      `Starting room invite background polling (interval: ${this.pollIntervalMs}ms)...`
    );
    this.isPolling = true;

    // Polling ngay lập tức
    this.pollRoomInvites();

    // Tiếp tục polling mỗi 3 giây
    this.pollingInterval = setInterval(() => {
      this.pollRoomInvites();
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
    console.log("Room invite polling stopped");
  }

  /**
   * Poll room invites một lần
   */
  async pollRoomInvites() {
    try {
      const response = await roomInviteService.getPendingInvites();
      const newInvites = response.data || [];

      console.log(
        `Polled room invites: ${newInvites.length} total, ${this.notifiedInviteIds.size} already notified`
      );

      //  Sync: Xóa IDs của invites không còn tồn tại (user đã từ chối)
      const currentInviteIds = new Set(newInvites.map((inv) => inv.id));
      for (const id of this.notifiedInviteIds) {
        if (!currentInviteIds.has(id)) {
          console.log(`Removing tracked invite ${id} (no longer pending)`);
          this.notifiedInviteIds.delete(id);
        }
      }

      // Check xem có invite chưa được phát âm thanh không
      newInvites.forEach((invite) => {
        //  Chỉ phát nếu chưa từng phát cho invite này
        if (!this.notifiedInviteIds.has(invite.id)) {
          const inviterName =
            invite.inviter?.displayName ||
            invite.inviter?.username ||
            "Người dùng";
          const roomName = invite.roomName || "Phòng";

          console.log("NEW ROOM INVITE DETECTED - Playing sound ONCE!");
          console.log("From:", inviterName, "To room:", roomName);
          console.log(
            "Audio enabled:",
            notificationAudioService.isAudioEnabled()
          );
          console.log("Audio volume:", notificationAudioService.getVolume());

          // 🎵 Phát âm thanh
          try {
            notificationAudioService.playRoomInviteSound();
            console.log("Room invite sound triggered successfully");
          } catch (error) {
            console.error("Error playing room invite sound:", error);
          }

          // 📬 Gửi push notification nếu tab bị ẩn
          const isTabHidden = document.hidden;
          console.log(
            `[ROOM_INVITE] Push notification check: isTabHidden=${isTabHidden}`
          );

          if (isTabHidden) {
            console.log("📬 Sending push notification for room invite");
            notifyRoomInvite(
              invite.roomId,
              roomName,
              invite.inviter?.id,
              inviterName
            );
          } else {
            console.log(
              `[ROOM_INVITE] ❌ Push notification NOT sent: tab is visible`
            );
          }

          //  Mark đã phát cho invite này
          this.notifiedInviteIds.add(invite.id);
          console.log(
            `Marked invite ${invite.id} as notified. Total notified: ${this.notifiedInviteIds.size}`
          );
        }
      });
    } catch (error) {
      console.error("Error polling room invites:", error);
    }
  }

  /**
   * Reset (dùng khi user logout)
   */
  reset() {
    this.stopPolling();
    this.notifiedInviteIds.clear();
  }
}

// Export singleton
export const roomInviteNotificationService =
  new RoomInviteNotificationService();
export default roomInviteNotificationService;

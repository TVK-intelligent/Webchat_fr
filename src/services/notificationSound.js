/**
 * Notification Sound Service
 * Quản lý âm thanh thông báo cho ứng dụng chat
 */

class NotificationSoundService {
  constructor() {
    this.audio = null;
    this.isEnabled =
      localStorage.getItem("notificationSoundEnabled") !== "false";
    this.volume =
      parseFloat(localStorage.getItem("notificationSoundVolume")) || 0.5;
    this.soundUrl =
      localStorage.getItem("notificationSoundUrl") ||
      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
  }

  /**
   * Khởi tạo audio element
   */
  initAudio() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = "auto";
    }
    this.audio.src = this.soundUrl;
    this.audio.volume = this.volume;
  }

  /**
   * Phát âm thanh thông báo
   */
  play() {
    try {
      if (!this.isEnabled) {
        console.log("🔇 Notification sound is disabled");
        return;
      }

      this.initAudio();

      // Reset audio để có thể phát liên tiếp
      this.audio.currentTime = 0;

      // Phát âm thanh
      const playPromise = this.audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("🔊 Notification sound played successfully");
          })
          .catch((error) => {
            console.warn("⚠️ Error playing notification sound:", error.message);
            // Có thể bị chặn bởi browser's autoplay policy
          });
      }
    } catch (error) {
      console.error("❌ Error in notification sound service:", error);
    }
  }

  /**
   * Dừng phát âm thanh
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  /**
   * Bật/Tắt âm thanh thông báo
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem(
      "notificationSoundEnabled",
      enabled ? "true" : "false"
    );
    console.log(`🔔 Notification sound ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Kiểm tra trạng thái bật/tắt
   */
  isNotificationSoundEnabled() {
    return this.isEnabled;
  }

  /**
   * Cài đặt âm lượng (0 - 1)
   */
  setVolume(volume) {
    const validVolume = Math.max(0, Math.min(1, volume));
    this.volume = validVolume;
    localStorage.setItem("notificationSoundVolume", validVolume.toString());
    if (this.audio) {
      this.audio.volume = validVolume;
    }
    console.log(`🔊 Volume set to ${(validVolume * 100).toFixed(0)}%`);
  }

  /**
   * Lấy âm lượng hiện tại
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Cài đặt URL âm thanh tùy chỉnh
   */
  setSoundUrl(url) {
    this.soundUrl = url;
    localStorage.setItem("notificationSoundUrl", url);
    if (this.audio) {
      this.audio.src = url;
    }
    console.log(`🎵 Sound URL set to: ${url}`);
  }

  /**
   * Lấy URL âm thanh hiện tại
   */
  getSoundUrl() {
    return this.soundUrl;
  }

  /**
   * Test phát âm thanh (để người dùng nghe trước khi lưu)
   */
  testSound() {
    console.log("🧪 Testing notification sound...");
    this.play();
  }

  /**
   * Reset về cài đặt mặc định
   */
  resetToDefaults() {
    this.isEnabled = true;
    this.volume = 0.5;
    this.soundUrl =
      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
    localStorage.setItem("notificationSoundEnabled", "true");
    localStorage.setItem("notificationSoundVolume", "0.5");
    localStorage.setItem(
      "notificationSoundUrl",
      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
    );
    this.stop();
    console.log("♻️ Notification sound settings reset to defaults");
  }
}

// Export singleton instance
export const notificationSoundService = new NotificationSoundService();
export default notificationSoundService;

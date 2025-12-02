/**
 * Notification Audio Service - UNIFIED
 * Quản lý tất cả âm thanh thông báo trong ứng dụng
 * Supports: Friend Requests, Room Invites, Messages
 * Uses audio pool for room invites to support multiple simultaneous playbacks.
 */
class NotificationAudioService {
  constructor() {
    // Load settings from localStorage
    const enabledInStorage = localStorage.getItem("notificationAudioEnabled");
    this.isEnabled =
      enabledInStorage === null ? true : enabledInStorage !== "false";

    this.volume =
      parseFloat(localStorage.getItem("notificationAudioVolume")) || 0.5;

    console.log(
      `NotificationAudioService initialized: isEnabled=${this.isEnabled}, volume=${this.volume}`
    );

    // Available sounds for each notification type
    this.availableSounds = {
      friendRequest: {
        DEFAULT:
          "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
        BELL: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
        PING: "https://assets.mixkit.co/active_storage/sfx/3104/3104-preview.mp3",
        CHIME:
          "https://assets.mixkit.co/active_storage/sfx/3103/3103-preview.mp3",
        POP: "https://assets.mixkit.co/active_storage/sfx/3106/3106-preview.mp3",
      },
      roomInvite: {
        DEFAULT:
          "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
        BELL: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
        PING: "https://assets.mixkit.co/active_storage/sfx/3104/3104-preview.mp3",
        CHIME:
          "https://assets.mixkit.co/active_storage/sfx/3103/3103-preview.mp3",
        POP: "https://assets.mixkit.co/active_storage/sfx/3106/3106-preview.mp3",
      },
      message: {
        DEFAULT:
          "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
        BELL: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
        PING: "https://assets.mixkit.co/active_storage/sfx/3104/3104-preview.mp3",
        CHIME:
          "https://assets.mixkit.co/active_storage/sfx/3103/3103-preview.mp3",
        POP: "https://assets.mixkit.co/active_storage/sfx/3106/3106-preview.mp3",
      },
    };

    // Sound name mappings (tiếng Việt thống nhất)
    this.soundNames = {
      DEFAULT: "Mặc định",
      BELL: "Chuông",
      PING: "Ping",
      CHIME: "Chime",
      POP: "Pop",
    };

    // Notification sounds mapping (current selected sound for each type)
    this.soundUrls = {
      friendRequest:
        localStorage.getItem("soundUrl_friendRequest") ||
        "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
      roomInvite:
        localStorage.getItem("soundUrl_roomInvite") ||
        "https://assets.mixkit.co/active_storage/sfx/2872/2872-preview.mp3",
      message:
        localStorage.getItem("soundUrl_message") ||
        "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
    };

    // Keep individual audio instances
    this.audioInstances = {
      friendRequest: null,
      message: null,
      // Room invite uses a pool
      roomInvite: [],
    };

    /** Pool config */
    this.MAX_ROOM_INVITE_INSTANCES = 10;
    this.roomInvitePoolIndex = 0;

    // Load initial audio pool for room invites
    this.initRoomInvitePool();
  }

  /**
   * Initialize the audio pool for room invites
   * Pre-creates audio elements to avoid creation delays during playback
   */
  initRoomInvitePool() {
    if (this.audioInstances.roomInvite.length > 0) return;

    console.log("Initializing room invite audio pool...");

    for (let i = 0; i < this.MAX_ROOM_INVITE_INSTANCES; i++) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = this.soundUrls.roomInvite;
      audio.volume = this.volume;
      this.audioInstances.roomInvite.push(audio);
    }

    console.log(
      "Room invite pool ready:",
      this.audioInstances.roomInvite.length
    );
  }

  /**
   * Internal method to play a sound from a given audio instance
   * Handles pause, reset, and play with promise handling
   * Resets audio element after playback to ensure multiple plays work
   */
  playAudio(audio) {
    try {
      console.log("[AUDIO] Starting playAudio - audio element:", audio);
      console.log("[AUDIO] Audio src:", audio?.src);
      console.log("[AUDIO] Audio volume:", audio?.volume);
      console.log("[AUDIO] Audio enabled:", this.isEnabled);

      // Always pause and reset first to ensure clean playback
      audio.pause();
      audio.currentTime = 0;

      console.log("[AUDIO] After pause/reset - attempting to play");

      // Remove any previous event listeners to avoid stacking
      audio.onended = null;
      audio.onerror = null;

      // Handler called when audio finishes playing
      const onAudioEnded = () => {
        console.log("[AUDIO] ✅ Audio playback completed");
      };

      // Handler for playback errors
      const onAudioError = () => {
        console.error("[AUDIO] ❌ Audio playback error");
      };

      audio.onended = onAudioEnded;
      audio.onerror = onAudioError;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("✅ [AUDIO] Audio playback started successfully");
          })
          .catch((err) => {
            console.warn("❌ [AUDIO] Audio playback blocked or failed:", err);
          });
      } else {
        console.log("⚠️ [AUDIO] play() returned undefined - old browser");
      }
    } catch (error) {
      console.error("❌ [AUDIO] Error playing audio:", error);
    }
  }

  /**
   * Plays room invite sound using audio pool (rotating instances)
   * Rotates through available audio instances to support multiple invites
   */
  playRoomInviteSound() {
    //  ALWAYS PLAY - for room invites, ignore isEnabled setting
    const pool = this.audioInstances.roomInvite;

    if (!pool || pool.length === 0) {
      console.warn("Room invite audio pool not initialized — reloading...");
      this.initRoomInvitePool();
    }

    // Find next available audio (prioritize paused ones)
    let audioIndex = this.roomInvitePoolIndex;
    const audio = pool[audioIndex];

    console.log(
      `Playing room invite sound (pool index: ${audioIndex}/${pool.length})`
    );

    this.roomInvitePoolIndex =
      (audioIndex + 1) % this.MAX_ROOM_INVITE_INSTANCES;
    this.playAudio(audio);
  }

  /**
   * Generic sound play (non-pool)
   * Checks isEnabled before playing
   * Creates a NEW audio instance each time to ensure multiple plays work
   */
  playGenericSound(notificationType) {
    console.log(`[AUDIO] playGenericSound called for: ${notificationType}`);
    console.log(`[AUDIO] isEnabled: ${this.isEnabled}`);

    if (!this.isEnabled) {
      console.log("[AUDIO] ❌ Notification audio is disabled");
      return;
    }

    if (!this.soundUrls[notificationType]) {
      console.error("[AUDIO] Unknown sound type:", notificationType);
      return;
    }

    // Always create a NEW audio instance for each play
    // This ensures multiple successive plays work correctly
    console.log(`[AUDIO] Creating NEW Audio instance for ${notificationType}`);
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = this.soundUrls[notificationType];
    audio.volume = this.volume;

    console.log(
      `[AUDIO] Audio instance created - src: ${audio.src}, volume: ${audio.volume}`
    );
    console.log(`[AUDIO] ▶️ Playing ${notificationType} sound`);

    this.playAudio(audio);

    // Also store as backup in case it's needed later
    this.audioInstances[notificationType] = audio;
  }

  /**
   * Public API - Friend Request Sound
   */
  playFriendRequestSound() {
    this.playGenericSound("friendRequest");
  }

  /**
   * Public API - Message Sound
   */
  playMessageSound() {
    this.playGenericSound("message");
  }

  /**
   * Public API - Room Invite Sound (main method)
   */
  playRoomInvite() {
    this.playRoomInviteSound();
  }

  /**
   * Check if audio is enabled
   */
  isAudioEnabled() {
    return this.isEnabled;
  }

  /**
   * Get current volume
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Set enabled/disabled state
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem(
      "notificationAudioEnabled",
      enabled ? "true" : "false"
    );
    console.log(`Notification audio ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Set volume level
   */
  setVolume(volume) {
    const validVolume = Math.max(0, Math.min(1, volume));
    this.volume = validVolume;
    localStorage.setItem("notificationAudioVolume", validVolume.toString());

    // Update all audio instances
    Object.keys(this.audioInstances).forEach((type) => {
      if (type === "roomInvite") {
        const pool = this.audioInstances[type];
        if (Array.isArray(pool)) {
          pool.forEach((audio) => {
            if (audio) audio.volume = validVolume;
          });
        }
      } else {
        const audio = this.audioInstances[type];
        if (audio) audio.volume = validVolume;
      }
    });

    console.log(`Audio volume set to ${(validVolume * 100).toFixed(0)}%`);
  }

  /**
   * Get the current sound URL for a specific notification type
   */
  getSoundForType(notificationType) {
    return this.soundUrls[notificationType] || "";
  }

  /**
   * Set a custom sound URL for a specific notification type
   */
  setSoundForType(notificationType, soundUrl) {
    if (this.soundUrls.hasOwnProperty(notificationType)) {
      this.soundUrls[notificationType] = soundUrl;
      localStorage.setItem(`soundUrl_${notificationType}`, soundUrl);

      // Update audio instance with new URL
      if (notificationType === "roomInvite") {
        this.audioInstances[notificationType].forEach((audio) => {
          if (audio) audio.src = soundUrl;
        });
      } else {
        if (this.audioInstances[notificationType]) {
          this.audioInstances[notificationType].src = soundUrl;
        }
      }

      console.log(`Sound for ${notificationType} updated to: ${soundUrl}`);
    }
  }

  /**
   * Get available sounds for a specific notification type
   */
  getAvailableSounds(notificationType) {
    return this.availableSounds[notificationType] || {};
  }

  /**
   * Get a human-readable name for a sound key
   */
  getSoundName(soundKey) {
    return this.soundNames[soundKey] || soundKey;
  }

  /**
   * Test play a sound for a specific notification type
   */
  testSound(notificationType) {
    if (notificationType === "roomInvite") {
      this.playRoomInviteSound();
    } else if (notificationType === "friendRequest") {
      this.playFriendRequestSound();
    } else if (notificationType === "message") {
      this.playMessageSound();
    } else {
      console.warn(`Unknown notification type for test: ${notificationType}`);
    }
  }

  /**
   * Reset all sounds to default
   */
  resetToDefaults() {
    this.soundUrls = {
      friendRequest:
        "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
      roomInvite:
        "https://assets.mixkit.co/active_storage/sfx/2872/2872-preview.mp3",
      message:
        "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
    };

    // Reset audio instances with new URLs
    this.audioInstances.friendRequest = null;
    this.audioInstances.message = null;
    this.audioInstances.roomInvite = [];
    this.initRoomInvitePool();

    // Clear localStorage sound URLs
    localStorage.removeItem("soundUrl_friendRequest");
    localStorage.removeItem("soundUrl_roomInvite");
    localStorage.removeItem("soundUrl_message");

    console.log("Notification sounds reset to defaults");
  }
}

export const notificationAudioService = new NotificationAudioService();

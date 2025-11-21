import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { notificationAudioService } from "../services/notificationAudioService";
import { broadcastUserStatus } from "../services/websocket";
import ThemeToggle from "./ThemeToggle";
import "../styles/Settings.css";

const Settings = () => {
  const { user, logout } = useAuth();

  // Audio settings
  const [audioEnabled, setAudioEnabled] = useState(
    notificationAudioService.isAudioEnabled()
  );
  const [audioVolume, setAudioVolume] = useState(
    notificationAudioService.getVolume()
  );
  const [friendRequestSound, setFriendRequestSound] = useState(
    notificationAudioService.getSoundForType("friendRequest")
  );
  const [roomInviteSound, setRoomInviteSound] = useState(
    notificationAudioService.getSoundForType("roomInvite")
  );
  const [messageSound, setMessageSound] = useState(
    notificationAudioService.getSoundForType("message")
  );

  const [showOnlineStatus, setShowOnlineStatus] = useState(
    localStorage.getItem("showOnlineStatus") !== "false"
  );

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>⚙️ Settings</h2>
        <p className="settings-subtitle">Tùy chỉnh ứng dụng theo ý muốn</p>
      </div>

      <div className="settings-content">
        {/* Theme Settings */}
        <div className="settings-section">
          <h3>Appearance</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Chế độ hiển thị</label>
              <span className="setting-description">
                Chuyển đổi giữa chế độ sáng và tối
              </span>
            </div>
            <ThemeToggle size="normal" showLabel={true} />
          </div>
        </div>

        {/* Account Settings */}
        <div className="settings-section">
          <h3>Account</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Tên hiển thị</label>
              <span className="setting-description">
                {user?.displayName || user?.username}
              </span>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <label>Username</label>
              <span className="setting-description">@{user?.username}</span>
            </div>
          </div>
        </div>

        {/* Advanced Audio Settings - Separate Sounds for Each Notification Type */}
        <div className="settings-section">
          <h3>Individual Sound Notifications</h3>
          <p className="section-description">
            Cài đặt chuông khác nhau cho từng loại thông báo
          </p>

          <div className="setting-item">
            <div className="setting-info">
              <label>Bật chuông riêng</label>
              <span className="setting-description">
                Phát chuông khác nhau cho kết bạn, lời mời phòng và tin nhắn
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={(e) => {
                  setAudioEnabled(e.target.checked);
                  notificationAudioService.setEnabled(e.target.checked);
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {audioEnabled && (
            <>
              <div className="setting-item">
                <div className="setting-info">
                  <label>Âm lượng chuông</label>
                  <span className="setting-description">
                    {(audioVolume * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="volume-control">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={audioVolume}
                    onChange={(e) => {
                      const newVolume = parseFloat(e.target.value);
                      setAudioVolume(newVolume);
                      notificationAudioService.setVolume(newVolume);
                    }}
                    className="volume-slider"
                  />
                </div>
              </div>

              {/* Friend Request Sound */}
              <div className="setting-item">
                <div className="setting-info">
                  <label>Friend Request Sound</label>
                  <span className="setting-description">
                    Âm thanh khi có lời mời kết bạn
                  </span>
                </div>
                <div className="sound-control">
                  <select
                    className="sound-select"
                    value={friendRequestSound}
                    onChange={(e) => {
                      setFriendRequestSound(e.target.value);
                      notificationAudioService.setSoundForType(
                        "friendRequest",
                        e.target.value
                      );
                    }}
                  >
                    {Object.entries(
                      notificationAudioService.getAvailableSounds(
                        "friendRequest"
                      )
                    ).map(([key, url]) => (
                      <option key={key} value={url}>
                        {notificationAudioService.getSoundName(key)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-test-sound"
                    onClick={() =>
                      notificationAudioService.testSound("friendRequest")
                    }
                    title="Test chuông kết bạn"
                  ></button>
                </div>
              </div>

              {/* Room Invite Sound */}
              <div className="setting-item">
                <div className="setting-info">
                  <label>Room Invite Sound</label>
                  <span className="setting-description">
                    Âm thanh khi có lời mời vào phòng
                  </span>
                </div>
                <div className="sound-control">
                  <select
                    className="sound-select"
                    value={roomInviteSound}
                    onChange={(e) => {
                      setRoomInviteSound(e.target.value);
                      notificationAudioService.setSoundForType(
                        "roomInvite",
                        e.target.value
                      );
                    }}
                  >
                    {Object.entries(
                      notificationAudioService.getAvailableSounds("roomInvite")
                    ).map(([key, url]) => (
                      <option key={key} value={url}>
                        {notificationAudioService.getSoundName(key)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-test-sound"
                    onClick={() =>
                      notificationAudioService.testSound("roomInvite")
                    }
                    title="Test chuông lời mời phòng"
                  ></button>
                </div>
              </div>

              {/* Message Sound */}
              <div className="setting-item">
                <div className="setting-info">
                  <label>Message Sound</label>
                  <span className="setting-description">
                    Âm thanh khi có tin nhắn mới
                  </span>
                </div>
                <div className="sound-control">
                  <select
                    className="sound-select"
                    value={messageSound}
                    onChange={(e) => {
                      setMessageSound(e.target.value);
                      notificationAudioService.setSoundForType(
                        "message",
                        e.target.value
                      );
                    }}
                  >
                    {Object.entries(
                      notificationAudioService.getAvailableSounds("message")
                    ).map(([key, url]) => (
                      <option key={key} value={url}>
                        {notificationAudioService.getSoundName(key)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-test-sound"
                    onClick={() =>
                      notificationAudioService.testSound("message")
                    }
                    title="Test chuông tin nhắn"
                  ></button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Reset Chuông</label>
                  <span className="setting-description">
                    Khôi phục cài đặt chuông mặc định
                  </span>
                </div>
                <button
                  className="btn-reset-audio"
                  onClick={() => {
                    notificationAudioService.resetToDefaults();
                    setAudioEnabled(notificationAudioService.isAudioEnabled());
                    setAudioVolume(notificationAudioService.getVolume());
                    setFriendRequestSound(
                      notificationAudioService.getSoundForType("friendRequest")
                    );
                    setRoomInviteSound(
                      notificationAudioService.getSoundForType("roomInvite")
                    );
                    setMessageSound(
                      notificationAudioService.getSoundForType("message")
                    );
                  }}
                >
                  🔄 Reset
                </button>
              </div>
            </>
          )}
        </div>

        {/* Privacy Settings */}
        <div className="settings-section">
          <h3>🔒 Privacy</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Hiển thị trạng thái online</label>
              <span className="setting-description">
                Cho phép bạn bè xem khi bạn đang online
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showOnlineStatus}
                onChange={(e) => {
                  const isVisible = e.target.checked;
                  setShowOnlineStatus(isVisible);
                  localStorage.setItem(
                    "showOnlineStatus",
                    isVisible ? "true" : "false"
                  );
                  // Broadcast status change to WebSocket
                  // When toggled ON (true), broadcast true (ONLINE)
                  // When toggled OFF (false), broadcast false (OFFLINE)
                  broadcastUserStatus(user.id, isVisible);
                  console.log(
                    `Online status visibility: ${
                      isVisible ? "Visible (Online)" : "Hidden (Offline)"
                    }`
                  );
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-section danger-section">
          <h3>⚠️ Danger Zone</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Đăng xuất</label>
              <span className="setting-description">
                Đăng xuất khỏi tài khoản hiện tại
              </span>
            </div>
            <button className="btn-danger" onClick={logout}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

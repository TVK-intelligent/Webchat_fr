import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { notificationSoundService } from "../services/notificationSound";
import { desktopNotificationService } from "../services/desktopNotification";
import { broadcastUserStatus } from "../services/websocket";
import { NOTIFICATION_SOUNDS } from "../constants/notificationSounds";
import ThemeToggle from "./ThemeToggle";
import "../styles/Settings.css";

const Settings = () => {
  const { user, logout } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(
    notificationSoundService.isNotificationSoundEnabled()
  );
  const [soundUrl, setSoundUrl] = useState(
    notificationSoundService.getSoundUrl()
  );
  const [volume, setVolume] = useState(notificationSoundService.getVolume());
  const [showOnlineStatus, setShowOnlineStatus] = useState(
    localStorage.getItem("showOnlineStatus") !== "false"
  );
  const [desktopNotificationEnabled, setDesktopNotificationEnabled] = useState(
    desktopNotificationService.isDesktopNotificationEnabled()
  );

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>⚙️ Cài Đặt</h2>
        <p className="settings-subtitle">Tùy chỉnh ứng dụng theo ý muốn</p>
      </div>

      <div className="settings-content">
        {/* Theme Settings */}
        <div className="settings-section">
          <h3>🎨 Giao Diện</h3>
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
          <h3>👤 Tài Khoản</h3>
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

        {/* Notification Settings */}
        <div className="settings-section">
          <h3>🔔 Thông Báo</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Âm thanh thông báo</label>
              <span className="setting-description">
                Phát âm thanh khi gửi tin
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => {
                  setSoundEnabled(e.target.checked);
                  notificationSoundService.setEnabled(e.target.checked);
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {soundEnabled && (
            <>
              <div className="setting-item">
                <div className="setting-info">
                  <label>Âm thanh</label>
                  <span className="setting-description">
                    Chọn loại âm thanh thông báo
                  </span>
                </div>
                <select
                  className="sound-select"
                  value={soundUrl}
                  onChange={(e) => {
                    setSoundUrl(e.target.value);
                    notificationSoundService.setSoundUrl(e.target.value);
                  }}
                >
                  <option value={NOTIFICATION_SOUNDS.DEFAULT}>Mặc định</option>
                  <option value={NOTIFICATION_SOUNDS.BELL}>Chuông</option>
                  <option value={NOTIFICATION_SOUNDS.PING}>Ping</option>
                  <option value={NOTIFICATION_SOUNDS.CHIME}>Chime</option>
                  <option value={NOTIFICATION_SOUNDS.POP}>Pop</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Âm lượng</label>
                  <span className="setting-description">
                    {(volume * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="volume-control">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => {
                      const newVolume = parseFloat(e.target.value);
                      setVolume(newVolume);
                      notificationSoundService.setVolume(newVolume);
                    }}
                    className="volume-slider"
                  />
                  <button
                    className="btn-test-sound"
                    onClick={() => notificationSoundService.testSound()}
                    title="Test âm thanh"
                  >
                    🔊 Test
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Desktop Notifications Settings */}
        {desktopNotificationService.constructor.isSupported() && (
          <div className="settings-section">
            <h3>🖥️ Desktop Notifications</h3>
            <div className="setting-item">
              <div className="setting-info">
                <label>Desktop Notifications</label>
                <span className="setting-description">
                  Nhận thông báo từ hệ thống khi có tin nhắn hoặc thông báo mới
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={desktopNotificationEnabled}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      const granted =
                        await desktopNotificationService.requestPermission();
                      if (granted) {
                        setDesktopNotificationEnabled(true);
                        desktopNotificationService.setEnabled(true);
                        desktopNotificationService.notifyGeneral(
                          "✅ Desktop Notifications",
                          "Bạn đã bật Desktop Notifications"
                        );
                      } else {
                        setDesktopNotificationEnabled(false);
                      }
                    } else {
                      setDesktopNotificationEnabled(false);
                      desktopNotificationService.setEnabled(false);
                    }
                  }}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        )}

        {/* Privacy Settings */}
        <div className="settings-section">
          <h3>🔒 Quyền Riêng Tư</h3>
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
                    `🟢 Online status visibility: ${
                      isVisible ? "Hiển thị (Online)" : "Ẩn (Offline)"
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
          <h3>⚠️ Khu Vực Nguy Hiểm</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Đăng xuất</label>
              <span className="setting-description">
                Đăng xuất khỏi tài khoản hiện tại
              </span>
            </div>
            <button className="btn-danger" onClick={logout}>
              🚪 Đăng Xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

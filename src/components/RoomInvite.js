import React, { useState, useEffect, useCallback } from "react";
import { roomInviteService } from "../services/api";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/RoomInvite.css";

const RoomInvite = ({ roomId, onClose, onInviteSent }) => {
  const [availableFriends, setAvailableFriends] = useState([]);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [inviting, setInviting] = useState(false);

  const loadAvailableFriends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await roomInviteService.getAvailableFriendsForRoom(
        roomId
      );
      console.log("Available friends data:", response.data); // Debug log
      setAvailableFriends(response.data || []);
    } catch (err) {
      console.error("Failed to load available friends:", err);
      setError("Không thể tải danh sách bạn bè");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const loadInvitedUsers = useCallback(async () => {
    try {
      const response = await roomInviteService.getInvitedUsersForRoom(roomId);
      console.log("Invited users data:", response.data); // Debug log
      setInvitedUsers(response.data || []);
    } catch (err) {
      console.error("Failed to load invited users:", err);
    }
  }, [roomId]);

  useEffect(() => {
    if (roomId) {
      loadAvailableFriends();
      loadInvitedUsers();

      //  Polling để cập nhật danh sách bạn bè và người được mời
      // Đảm bảo khi bạn bè chấp nhận lời mời, danh sách được cập nhật ngay lập tức
      const interval = setInterval(() => {
        console.log("Polling available friends and invited users...");
        loadAvailableFriends();
        loadInvitedUsers();
      }, 3000); // Kiểm tra mỗi 3 giây

      return () => clearInterval(interval);
    }
  }, [roomId, loadAvailableFriends, loadInvitedUsers]);

  const handleSelectFriend = (friendId) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFriends.size === availableFriends.length) {
      setSelectedFriends(new Set());
    } else {
      setSelectedFriends(new Set(availableFriends.map((f) => f.id)));
    }
  };

  const handleInviteFriends = async () => {
    if (selectedFriends.size === 0) {
      setError("Vui lòng chọn ít nhất một bạn để mời");
      return;
    }

    try {
      setInviting(true);
      setError(null);
      setSuccess(null);

      let successCount = 0;
      let failCount = 0;

      for (const friendId of selectedFriends) {
        try {
          await roomInviteService.inviteUserToRoom(roomId, friendId);
          successCount++;
        } catch (err) {
          console.error(`Failed to invite user ${friendId}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(
          `Đã gửi ${successCount} lời mời${
            failCount > 0 ? `, thất bại ${failCount}` : ""
          }`
        );
        setSelectedFriends(new Set());
        await loadAvailableFriends();
        await loadInvitedUsers();

        if (onInviteSent) {
          onInviteSent();
        }

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Không thể gửi lời mời. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("Error inviting friends:", err);
      setError("Lỗi khi gửi lời mời");
    } finally {
      setInviting(false);
    }
  };

  if (loading && availableFriends.length === 0) {
    return (
      <div className="room-invite-container">
        <div className="loading">Đang tải dữ liệu...</div>
      </div>
    );
  }

  return (
    <div className="room-invite-modal">
      <div className="room-invite-content">
        <div className="room-invite-header">
          <div className="header-left">
            <h2>Invite friends to room</h2>
            <p className="header-subtitle">
              Chọn bạn bè để gửi lời mời tham gia
            </p>
          </div>
          {onClose && (
            <button className="close-btn" onClick={onClose} title="Đóng">
              ✕
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Preview section */}
        {selectedFriends.size > 0 && (
          <div className="invite-preview">
            <div className="preview-title">
              Friends will receive the invite like this:
            </div>
            <div className="preview-message">
              <div className="preview-avatar">
                <span>Person</span>
              </div>
              <div className="preview-content">
                <p className="preview-inviter">
                  <strong>Bạn</strong> mời họ vào phòng
                </p>
                <p className="preview-room">Chat room</p>
              </div>
            </div>
          </div>
        )}

        <div className="room-invite-body">
          {/* Danh sách bạn bè có thể mời */}
          <div className="section available-friends-section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">Friends</span>
                <div>
                  <h3>Bạn bè có thể mời</h3>
                  <p className="section-count">
                    {availableFriends.length} bạn bè
                  </p>
                </div>
              </div>
              {availableFriends.length > 0 && (
                <button
                  className="select-all-btn"
                  onClick={handleSelectAll}
                  title={
                    selectedFriends.size === availableFriends.length
                      ? "Bỏ chọn tất cả"
                      : "Chọn tất cả"
                  }
                >
                  {selectedFriends.size === availableFriends.length
                    ? "Bỏ chọn"
                    : "Chọn tất cả"}
                </button>
              )}
            </div>

            {availableFriends.length === 0 ? (
              <div className="empty-state">
                <p className="empty-icon">-</p>
                <p className="empty-text">No friends to invite</p>
                <small className="empty-hint">
                  Tất cả bạn bè của bạn đều đã là thành viên hoặc đang chờ lời
                  mời
                </small>
              </div>
            ) : (
              <div className="friends-list">
                {availableFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className={`friend-item ${
                      selectedFriends.has(friend.id) ? "selected" : ""
                    }`}
                    onClick={() => handleSelectFriend(friend.id)}
                  >
                    <div className="friend-avatar">
                      {friend.avatarUrl ? (
                        <img
                          src={getFullAvatarUrl(friend.avatarUrl)}
                          alt={friend.displayName}
                          onError={(e) => {
                            console.warn(
                              "Avatar failed to load:",
                              friend.avatarUrl
                            );
                            e.target.style.display = "none";
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = "flex";
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="avatar-placeholder"
                        style={{ display: friend.avatarUrl ? "none" : "flex" }}
                      >
                        {friend.displayName?.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="friend-info">
                      <div className="friend-name">{friend.displayName}</div>
                      <div className="friend-username">@{friend.username}</div>
                    </div>
                    <div className="checkbox">
                      <input
                        type="checkbox"
                        checked={selectedFriends.has(friend.id)}
                        onChange={() => handleSelectFriend(friend.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danh sách người đã được mời (chờ xác nhận) */}
          {invitedUsers.length > 0 && (
            <div className="section invited-section">
              <div className="section-header">
                <div className="section-title">
                  <span className="section-icon">Pending</span>
                  <div>
                    <h3>Đang chờ xác nhận</h3>
                    <p className="section-count">
                      {invitedUsers.length} lời mời
                    </p>
                  </div>
                </div>
              </div>
              <div className="invited-list">
                {invitedUsers.map((user) => (
                  <div key={user.id} className="invited-item">
                    <div className="invited-avatar">
                      {user.avatarUrl ? (
                        <img
                          src={getFullAvatarUrl(user.avatarUrl)}
                          alt={user.displayName}
                          onError={(e) => {
                            console.warn(
                              "Invited avatar failed to load:",
                              user.avatarUrl
                            );
                            e.target.style.display = "none";
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = "flex";
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="avatar-placeholder"
                        style={{ display: user.avatarUrl ? "none" : "flex" }}
                      >
                        {user.displayName?.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="invited-info">
                      <div className="invited-name">{user.displayName}</div>
                      <div className="invited-username">@{user.username}</div>
                    </div>
                    <div className="invited-status">Pending</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="room-invite-footer">
          <div className="footer-info">
            <span className="footer-selected-count">
              {selectedFriends.size > 0
                ? `${selectedFriends.size} bạn bè được chọn`
                : "Chọn bạn bè để mời"}
            </span>
          </div>
          <div className="footer-actions">
            {availableFriends.length > 0 && (
              <button
                className="invite-btn"
                onClick={handleInviteFriends}
                disabled={selectedFriends.size === 0 || inviting}
              >
                {inviting
                  ? "Sending..."
                  : `Send ${selectedFriends.size} invites`}
              </button>
            )}
            {onClose && (
              <button className="cancel-btn" onClick={onClose}>
                Đóng
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomInvite;

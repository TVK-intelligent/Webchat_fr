import React, { useState, useEffect } from "react";
import { chatRoomService, messageService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { subscribeToReadReceipt } from "../services/websocket";
import "../styles/RoomList.css";

const RoomList = ({ onSelectRoom, selectedRoomId, onCreateRoom }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [hoveredRoomId, setHoveredRoomId] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const readReceiptSubscriptionsRef = React.useRef({});

  // Load rooms
  useEffect(() => {
    loadRooms();
  }, []);

  // ✅ Fetch unread counts periodically
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      for (const room of rooms) {
        try {
          const response = await messageService.getUnreadCount(room.id);
          setUnreadCounts((prev) => ({
            ...prev,
            [room.id]: response.data,
          }));
        } catch (error) {
          console.error("Error fetching unread count for room", room.id, error);
        }
      }
    };

    if (rooms.length > 0) {
      fetchUnreadCounts();
      // Refresh every 5 seconds
      const interval = setInterval(fetchUnreadCounts, 5000);
      return () => clearInterval(interval);
    }
  }, [rooms]);

  // ✅ Subscribe to read receipt events (real-time unread count update)
  useEffect(() => {
    // Don't subscribe if no rooms
    if (rooms.length === 0) return;

    // Subscribe to read receipt for each room
    const subscriptions = {};
    for (const room of rooms) {
      const subscription = subscribeToReadReceipt(room.id, (readReceipt) => {
        console.log(
          `📬 Read receipt received for room ${room.id}:`,
          readReceipt
        );

        // Update unread count: trừ số messages vừa được mark
        if (readReceipt.receiptType === "ROOM") {
          setUnreadCounts((prev) => ({
            ...prev,
            [room.id]: Math.max(
              0,
              (prev[room.id] || 0) - readReceipt.markedCount
            ),
          }));
          console.log(
            `✅ Updated unread count for room ${room.id}: -${readReceipt.markedCount} messages`
          );
        }
      });
      if (subscription) {
        subscriptions[room.id] = subscription;
      }
    }

    readReceiptSubscriptionsRef.current = subscriptions;

    // Cleanup: unsubscribe from all
    return () => {
      Object.values(subscriptions).forEach((sub) => {
        if (sub && sub.unsubscribe) {
          sub.unsubscribe();
        }
      });
    };
  }, [rooms]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await chatRoomService.getAllRooms();
      console.log("📋 Rooms loaded:", response.data);
      setRooms(response.data);
    } catch (error) {
      console.error("❌ Lỗi tải phòng:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      alert("Vui lòng nhập tên phòng!");
      return;
    }

    try {
      const roomData = {
        name: newRoomName,
        description: newRoomDescription,
        isPrivate: isPrivate,
      };
      console.log("📤 Creating room with data:", roomData);

      const response = await chatRoomService.createRoom(roomData);
      console.log("✅ Room created:", response.data);

      setRooms([...rooms, response.data]);
      setNewRoomName("");
      setNewRoomDescription("");
      setIsPrivate(false);
      setShowCreateModal(false);

      if (onCreateRoom) {
        onCreateRoom(response.data);
      }
    } catch (error) {
      console.error("❌ Lỗi tạo phòng:", error);
      alert("Không thể tạo phòng!");
    }
  };

  const handleDeleteRoom = async (roomId, roomName) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa phòng "${roomName}"? Hành động này không thể hoàn tác.`
    );

    if (!confirmed) return;

    try {
      await chatRoomService.deleteRoom(roomId);
      setRooms(rooms.filter((room) => room.id !== roomId));
      alert("✅ Phòng đã được xóa thành công!");
    } catch (error) {
      console.error("❌ Lỗi xóa phòng:", error);
      if (error.response?.status === 403) {
        alert("❌ Bạn không có quyền xóa phòng này! Chỉ chủ phòng có thể xóa.");
      } else {
        alert(
          "❌ Không thể xóa phòng: " + (error.response?.data || error.message)
        );
      }
    }
  };

  return (
    <div className="room-list">
      <div className="room-list-header">
        <h3>💬 Phòng Chat</h3>
        <button
          className="btn-new-room"
          onClick={() => setShowCreateModal(true)}
        >
          + Tạo phòng
        </button>
      </div>

      {loading ? (
        <div className="loading">Đang tải...</div>
      ) : rooms.length === 0 ? (
        <div className="no-rooms">
          <p>📭 Chưa có phòng nào</p>
          <p className="hint">Tạo phòng đầu tiên của bạn</p>
        </div>
      ) : (
        <div className="rooms-container">
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`room-item ${
                selectedRoomId === room.id ? "active" : ""
              }`}
              onClick={() => onSelectRoom(room)}
              onMouseEnter={() => setHoveredRoomId(room.id)}
              onMouseLeave={() => setHoveredRoomId(null)}
            >
              <div className="room-info">
                <h4>{room.name}</h4>
                <p className="room-desc">{room.description}</p>
              </div>
              <div className="room-actions">
                {unreadCounts[room.id] > 0 && (
                  <span className="unread-badge">{unreadCounts[room.id]}</span>
                )}
                <span
                  className={`room-type ${
                    room.isPrivate ? "private" : "public"
                  }`}
                >
                  {room.isPrivate ? "🔒 Riêng tư" : "🌐 Công khai"}
                </span>
                {user &&
                  room &&
                  room.owner &&
                  room.owner.id === user.id &&
                  hoveredRoomId === room.id && (
                    <button
                      className="btn-delete-room"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRoom(room.id, room.name);
                      }}
                      title="Xóa phòng"
                    >
                      🗑️ Xóa
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Tạo Phòng Chat Mới</h2>

            <div className="form-group">
              <label>Tên phòng</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Nhập tên phòng"
              />
            </div>

            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder="Nhập mô tả phòng (tùy chọn)"
                rows="3"
              />
            </div>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="isPrivate"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <label htmlFor="isPrivate">🔒 Phòng riêng tư</label>
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowCreateModal(false)}
              >
                Hủy
              </button>
              <button className="btn-primary" onClick={handleCreateRoom}>
                Tạo phòng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomList;

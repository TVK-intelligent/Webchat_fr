import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { chatRoomService } from "../services/api";
import { subscribeToRoomEvents } from "../services/roomWebSocket";
import "../styles/RoomListSidebar.css";

const RoomListSidebar = ({ onSelectRoom, selectedRoomId }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [hoveredRoomId, setHoveredRoomId] = useState(null);

  // Load rooms từ API
  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await chatRoomService.getAllRooms();
      console.log("Rooms loaded:", response.data);

      // Log chi tiết từng phòng
      response.data.forEach((room, index) => {
        console.log(`🏠 Room ${index + 1}:`, {
          id: room.id,
          name: room.name,
          ownerId: room.owner?.id,
          ownerName: room.owner?.username,
          currentUserId: user?.id,
          isOwner: user?.id === room.owner?.id,
        });
      });

      setRooms(response.data);
    } catch (error) {
      console.error("Error loading rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Subscribe to room events
  useEffect(() => {
    const roomEventsSubscription = subscribeToRoomEvents(
      (newRoom) => {
        console.log("🎉 New room from WebSocket:", newRoom);
        setRooms((prevRooms) => {
          const exists = prevRooms.some((r) => r.id === newRoom.id);
          if (exists) return prevRooms;
          return [...prevRooms, newRoom];
        });
      },
      (deletedRoomId) => {
        console.log("🗑️ Room deleted from WebSocket:", deletedRoomId);
        setRooms((prevRooms) =>
          prevRooms.filter((r) => r.id !== deletedRoomId)
        );
      },
      (updatedRoom) => {
        console.log("✏️ Room updated from WebSocket:", updatedRoom);
        setRooms((prevRooms) =>
          prevRooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r))
        );
      }
    );

    return () => {
      if (roomEventsSubscription?.unsubscribe) {
        roomEventsSubscription.unsubscribe();
      }
    };
  }, []);

  // Create room
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
      console.log(" Creating room with data:", roomData);

      const response = await chatRoomService.createRoom(roomData);
      console.log(" Room created from REST API:", response.data);

      // Reset form
      setNewRoomName("");
      setNewRoomDescription("");
      setIsPrivate(false);
      setShowCreateModal(false);

      onSelectRoom(response.data);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Không thể tạo phòng!");
    }
  };

  // Delete room
  const handleDeleteRoom = async (roomId, roomName, e) => {
    e.stopPropagation();

    if (!window.confirm(`Bạn có chắc chắn muốn xóa phòng "${roomName}"?`))
      return;

    try {
      await chatRoomService.deleteRoom(roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      console.log("Room deleted successfully!");
    } catch (error) {
      console.error("Error deleting room:", error);
      alert("Cannot delete room: " + (error.response?.data || error.message));
    }
  };

  return (
    <div className="room-list-sidebar">
      {/* Header */}
      <div className="room-list-header">
        <h3>Chat Rooms</h3>
        <button
          className="btn-new-room"
          onClick={() => setShowCreateModal(true)}
          title="Create new room"
        >
          New
        </button>
      </div>

      {/* Rooms List */}
      <div className="rooms-list">
        {loading ? (
          <div className="loading">Đang tải...</div>
        ) : rooms.length === 0 ? (
          <div className="no-rooms">
            <p>No rooms</p>
          </div>
        ) : (
          rooms.map((room) => (
            <div
              key={room.id}
              className={`room-item ${
                selectedRoomId === room.id ? "active" : ""
              }`}
              onClick={() => onSelectRoom(room)}
              onMouseEnter={() => {
                console.log("🔍 Hover room:", {
                  roomId: room.id,
                  roomName: room.name,
                  ownerId: room.owner?.id,
                  userId: user?.id,
                  isOwner: user?.id === room.owner?.id,
                });
                setHoveredRoomId(room.id);
              }}
              onMouseLeave={() => setHoveredRoomId(null)}
            >
              <div className="room-info">
                <h4>{room.name}</h4>
                <p className="room-desc">{room.description}</p>
              </div>

              <div className="room-actions">
                <span
                  className={`room-type ${
                    room.isPrivate ? "private" : "public"
                  }`}
                >
                  {room.isPrivate ? "Private" : "Public"}
                </span>

                {/* Delete button - only show for owner on hover */}
                {user?.id === room.owner?.id && hoveredRoomId === room.id && (
                  <button
                    className="btn-delete-room"
                    onClick={(e) => handleDeleteRoom(room.id, room.name, e)}
                    title="Xóa phòng"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

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
              <label htmlFor="isPrivate">Private Room</label>
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

export default RoomListSidebar;

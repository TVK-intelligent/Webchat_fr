import React, { useState, useEffect, useRef } from "react";
import { chatRoomService, messageService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { subscribeToReadReceipt } from "../services/websocket";
import { subscribeToRoomEvents } from "../services/roomWebSocket";
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
  const readReceiptSubscriptionsRef = useRef({});

  // Load rooms từ API
  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await chatRoomService.getAllRooms();
      console.log("Rooms loaded:", response.data);
      console.log("First room owner check:", response.data[0]?.owner);
      console.log("Current user:", user);

      //  Filter rooms: ẩn các phòng riêng tư mà người dùng không phải là thành viên
      const filteredRooms = response.data.filter((room) => {
        // Hiển thị phòng công khai
        if (!room.isPrivate) {
          return true;
        }

        // Với phòng riêng tư, chỉ hiển thị nếu người dùng là thành viên
        const isMember = room.members?.some((m) => m.id === user?.id);
        return isMember;
      });

      console.log(
        `Filtered ${response.data.length} rooms to ${filteredRooms.length} visible rooms`
      );

      // Log detail for each room
      filteredRooms.forEach((room, index) => {
        console.log(`Room ${index + 1}:`, {
          id: room.id,
          name: room.name,
          isPrivate: room.isPrivate,
          ownerId: room.owner?.id,
          ownerName: room.owner?.username,
          memberCount: room.members?.length || 0,
          currentUserId: user?.id,
          isOwner: user?.id === room.owner?.id,
          isMember: room.members?.some((m) => m.id === user?.id),
        });
      });

      setRooms(filteredRooms);
    } catch (error) {
      console.error("Error loading rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //  Subscribe to room events
  useEffect(() => {
    const roomEventsSubscription = subscribeToRoomEvents(
      (newRoom) => {
        console.log("New room from WebSocket:", newRoom);
        setRooms((prevRooms) => {
          const exists = prevRooms.some((r) => r.id === newRoom.id);
          if (exists) return prevRooms;
          return [...prevRooms, newRoom];
        });
      },
      (deletedRoomId) => {
        setRooms((prevRooms) =>
          prevRooms.filter((r) => r.id !== deletedRoomId)
        );
      },
      (updatedRoom) => {
        setRooms((prevRooms) =>
          prevRooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r))
        );
      }
    );

    // Cleanup khi component unmount
    return () => {
      if (roomEventsSubscription?.unsubscribe) {
        roomEventsSubscription.unsubscribe();
      }
    };
  }, []);

  //  Fetch unread counts periodically
  useEffect(() => {
    if (rooms.length === 0) return;

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

    fetchUnreadCounts();
    // Increased polling interval from 5s to 30s to reduce backend spam
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [rooms]);

  //  Subscribe to read receipt events
  useEffect(() => {
    if (rooms.length === 0) return;

    const subscriptions = {};
    for (const room of rooms) {
      const subscription = subscribeToReadReceipt(room.id, (readReceipt) => {
        if (readReceipt.receiptType === "ROOM") {
          setUnreadCounts((prev) => ({
            ...prev,
            [room.id]: Math.max(
              0,
              (prev[room.id] || 0) - readReceipt.markedCount
            ),
          }));
        }
      });
      if (subscription) subscriptions[room.id] = subscription;
    }

    readReceiptSubscriptionsRef.current = subscriptions;

    return () => {
      Object.values(subscriptions).forEach((sub) => {
        if (sub?.unsubscribe) sub.unsubscribe();
      });
    };
  }, [rooms]);

  //  Tạo phòng
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
      console.log("Creating room with data:", roomData);

      const response = await chatRoomService.createRoom(roomData);
      console.log("Room created from REST API:", response.data);

      // Remove setRooms(), let WebSocket broadcast sync
      console.log("Waiting for WebSocket broadcast to sync room list...");

      // Reset form
      setNewRoomName("");
      setNewRoomDescription("");
      setIsPrivate(false);
      setShowCreateModal(false);

      if (onCreateRoom) onCreateRoom(response.data);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Cannot create room!");
    }
  };

  const handleDeleteRoom = async (roomId, roomName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phòng "${roomName}"?`))
      return;

    try {
      await chatRoomService.deleteRoom(roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      alert("Room deleted successfully!");
    } catch (error) {
      console.error("Error deleting room:", error);
      alert("Cannot delete room: " + (error.response?.data || error.message));
    }
  };

  return (
    <div className="room-list">
      <div className="room-list-header">
        <h3>🏠 Chat Rooms</h3>
        <button
          className="btn-new-room"
          onClick={() => {
            console.log("DEBUG - Current state:", {
              roomsCount: rooms.length,
              user: user,
              rooms: rooms.map((r) => ({
                id: r.id,
                name: r.name,
                ownerId: r.owner?.id,
                isOwner: user?.id === r.owner?.id,
              })),
            });
            setShowCreateModal(true);
          }}
        >
          ➕ Tạo phòng
        </button>
      </div>

      {loading ? (
        <div className="loading">Đang tải...</div>
      ) : rooms.length === 0 ? (
        <div className="no-rooms">
          <p>No rooms</p>
          <p className="hint">Create your first room</p>
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
              onMouseEnter={() => {
                console.log("Hover room:", {
                  roomId: room.id,
                  roomName: room.name,
                  ownerId: room.owner?.id,
                  userId: user?.id,
                  isOwner: user?.id === room.owner?.id,
                  owner: room.owner,
                });
                setHoveredRoomId(room.id);
              }}
              onMouseLeave={() => setHoveredRoomId(null)}
            >
              <div className="room-info" style={{ background: "white" }}>
                <h4
                  style={{
                    background: "white",
                    color: "#000000",
                    WebkitTextFillColor: "unset",
                    WebkitBackgroundClip: "unset",
                    backgroundClip: "unset",
                  }}
                >
                  {room.isPrivate ? "🔒" : "🏠"} {room.name}
                </h4>
                <p className="room-desc">{room.description}</p>
              </div>
              <div className="room-actions">
                {unreadCounts[room.id] > 0 && (
                  <span className="unread-badge">{unreadCounts[room.id]}</span>
                )}
                <div className="room-actions-other">
                  <span
                    className={`room-type ${
                      room.isPrivate ? "private" : "public"
                    }`}
                  >
                    {room.isPrivate ? "Private" : "Public"}
                  </span>
                  {user?.id === room.owner?.id && hoveredRoomId === room.id && (
                    <button
                      className="btn-delete-room"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("Delete button clicked:", {
                          roomId: room.id,
                          roomName: room.name,
                          userId: user?.id,
                          ownerId: room.owner?.id,
                          isOwner: user?.id === room.owner?.id,
                        });
                        handleDeleteRoom(room.id, room.name);
                      }}
                      title="Delete room"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
                ✕ Hủy
              </button>
              <button className="btn-primary" onClick={handleCreateRoom}>
                ✅ Tạo phòng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomList;

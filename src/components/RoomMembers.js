import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { chatRoomService } from "../services/api";
import "../styles/RoomMembers.css";

const RoomMembers = ({ roomId, onClose, isOwner }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await chatRoomService.getRoomMembersWithRoles(roomId);
        setMembers(response.data);
        setLoading(false);
      } catch (err) {
        setError("Lỗi tải danh sách thành viên");
        console.error(err);
        setLoading(false);
      }
    };

    loadMembers();
  }, [roomId]);

  const handleKickMember = async (memberId) => {
    if (window.confirm("Bạn có chắc muốn đuổi thành viên này khỏi phòng?")) {
      try {
        await chatRoomService.kickMember(roomId, memberId);
        setMembers(members.filter((m) => m.user.id !== memberId));
        console.log("✅ Đã đuổi thành viên khỏi phòng");
      } catch (err) {
        console.error("Lỗi đuổi thành viên:", err);
        setError(
          "Lỗi đuổi thành viên: " + err.response?.data?.error || err.message
        );
      }
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Danh sách thành viên</h3>
            <button className="btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="modal-body">
            <p>Đang tải...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👥 Danh sách thành viên ({members.length})</h3>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-body">
          {members.length === 0 ? (
            <p>Không có thành viên nào</p>
          ) : (
            <ul className="members-list">
              {members.map((member) => (
                <li key={member.user.id} className="member-item">
                  <div className="member-info">
                    <div className="member-details">
                      <div className="member-name">
                        {member.user.displayName}
                        {member.role === "OWNER" && (
                          <span className="badge badge-owner">👑 Chủ</span>
                        )}
                      </div>
                      <div className="member-username">
                        @{member.user.username}
                      </div>
                    </div>
                  </div>{" "}
                  {isOwner &&
                    member.user.id !== user.id &&
                    member.role !== "OWNER" && (
                      <button
                        className="btn-kick"
                        onClick={() => handleKickMember(member.user.id)}
                        title="Đuổi thành viên khỏi phòng"
                      >
                        🚫 Đuổi
                      </button>
                    )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomMembers;

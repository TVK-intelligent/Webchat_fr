import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import RoomList from "../components/RoomList";
import ChatRoom from "../components/ChatRoom";
import Friends from "../components/Friends";
import Notifications from "../components/Notifications";
import Profile from "../components/Profile";
import Settings from "../components/Settings";
import RoomInviteNotifications from "../components/RoomInviteNotifications";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    setActiveTab("chat");
  };

  const handleCreateRoom = (newRoom) => {
    setSelectedRoom(newRoom);
  };

  if (!user) {
    return <div>Đang tải...</div>;
  }

  return (
    <div className="dashboard">
      <Sidebar user={user} onTabChange={setActiveTab} activeTab={activeTab} />

      <div className="main-content">
        {activeTab === "chat" && (
          <div className="chat-section">
            <RoomList
              onSelectRoom={handleSelectRoom}
              selectedRoomId={selectedRoom?.id}
              onCreateRoom={handleCreateRoom}
            />
            <div className="chat-area">
              {selectedRoom ? (
                <>
                  <div className="chat-header-wrapper">
                    <RoomInviteNotifications />
                  </div>
                  <ChatRoom
                    roomId={selectedRoom.id}
                    roomName={selectedRoom.name}
                  />
                </>
              ) : (
                <div className="no-room-selected">
                  <h2>😊 Chào mừng!</h2>
                  <p>Chọn một phòng để bắt đầu chat</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "friends" && <Friends />}

        {activeTab === "notifications" && <Notifications />}

        {activeTab === "profile" && <Profile />}

        {activeTab === "settings" && <Settings />}
      </div>
    </div>
  );
};

export default Dashboard;

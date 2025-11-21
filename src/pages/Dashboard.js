import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import useNotificationListener from "../hooks/useNotificationListener";
import { friendRequestNotificationService } from "../services/friendRequestNotificationService";
import { roomInviteNotificationService } from "../services/roomInviteNotificationService";
import Sidebar from "../components/Sidebar";
import ConversationList from "../components/ConversationList";
import RoomListSidebar from "../components/RoomListSidebar";
import UnifiedChatArea from "../components/UnifiedChatArea";
import Friends from "../components/Friends";
import Notifications from "../components/Notifications";
import Profile from "../components/Profile";
import Settings from "../components/Settings";
import RoomInviteNotifications from "../components/RoomInviteNotifications";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [unreadCounts, setUnreadCounts] = useState({});

  console.log(" Dashboard rendering, user:", user?.id);

  //  Setup notification listener - runs in background
  useNotificationListener();

  //  Start background polling for friend requests and room invites
  useEffect(() => {
    if (user?.id) {
      console.log(" Starting background notification polling services");
      friendRequestNotificationService.startPolling();
      roomInviteNotificationService.stopPolling();

      return () => {
        console.log(" Stopping background notification polling services");
        friendRequestNotificationService.stopPolling();
        roomInviteNotificationService.stopPolling();
      };
    }
  }, [user?.id]);

  //  Memoized callback to clear unread counts
  const handleUnreadCleared = useCallback((conversationId) => {
    console.log(" Unread cleared for:", conversationId);
    setUnreadCounts((prev) => ({
      ...prev,
      [conversationId]: 0,
    }));
  }, []);

  //  Memoized callback when message is sent - triggers ConversationList to reorder
  const handleMessageSent = useCallback((type, id) => {
    console.log(
      ` Message sent in ${type} (id: ${id}), notifying ConversationList`
    );
    // Trigger ConversationList to update via its internal logic
    // (The actual reordering will be done by ConversationList's subscription to onMessageSent event)
  }, []);

  if (!user) {
    return <div>Đang tải...</div>;
  }

  return (
    <div className="dashboard">
      <Sidebar user={user} onTabChange={setActiveTab} activeTab={activeTab} />

      <div className="main-content">
        {activeTab === "chat" && (
          <div className="chat-section">
            <ConversationList
              onSelectConversation={setSelectedConversation}
              selectedConversationId={selectedConversation?.id}
              onUnreadCleared={handleUnreadCleared}
            />
            <div className="chat-area">
              {selectedConversation && (
                <div className="chat-header-wrapper">
                  <RoomInviteNotifications />
                </div>
              )}
              <UnifiedChatArea
                conversation={selectedConversation}
                onUnreadCleared={handleUnreadCleared}
                onMessageSent={handleMessageSent}
              />
            </div>
          </div>
        )}

        {activeTab === "rooms" && (
          <RoomListSidebar
            onSelectRoom={setSelectedRoom}
            selectedRoomId={selectedRoom?.id}
          />
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

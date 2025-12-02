import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import useNotificationListener from "../hooks/useNotificationListener";
import usePushNotifications from "../hooks/usePushNotifications";
import { friendRequestNotificationService } from "../services/friendRequestNotificationService";
import { roomInviteNotificationService } from "../services/roomInviteNotificationService";
import { notificationAudioService } from "../services/notificationAudioService";
import {
  subscribeGlobalPrivateMessages,
  clearAllGlobalSubscriptions,
} from "../services/globalMessageListener";
import {
  messageService,
  friendService,
  chatRoomService,
} from "../services/api";
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
  const [messageSentTrigger, setMessageSentTrigger] = useState(null);

  console.log(
    " Dashboard rendering,unreadCounts:",
    unreadCounts,
    "user:",
    user?.id
  );

  // Setup notification listener - runs in background
  useNotificationListener();

  // Setup push notifications with click handler
  const handlePushNotificationClick = useCallback((detail) => {
    console.log("🖱️ Push notification clicked in app:", detail);
    const { action, senderId, roomId } = detail;

    // Focus dashboard
    window.focus();

    // Switch to appropriate tab and select conversation/room
    if (action === "open_message" && senderId) {
      setActiveTab("chat");
      setSelectedConversation({ id: senderId });
    } else if (action === "open_room" && roomId) {
      setActiveTab("chat");
      setSelectedRoom({ id: roomId });
    } else if (action === "open_friend_requests") {
      setActiveTab("friends");
    } else if (action === "open_room_invites") {
      setActiveTab("notifications");
    }
  }, []);

  usePushNotifications(handlePushNotificationClick);

  //  Subscribe to global private messages (never unsubscribed until logout)
  useEffect(() => {
    if (user?.id) {
      console.log("📢 Dashboard: Setting up global private message listener");
      subscribeGlobalPrivateMessages(user.id, (newMessage) => {
        console.log("📨 Private message received in Dashboard:", newMessage);
        // Move the conversation to top and play sound if sender is not the current user
        if (newMessage.senderId !== user.id) {
          console.log(
            `📢 Pushing conversation with user ${newMessage.senderId} to top`
          );
          setMessageSentTrigger({
            type: "direct",
            id: newMessage.senderId,
            timestamp: Date.now(),
          });
          // Play notification sound
          console.log("🔊 Playing message notification sound");
          notificationAudioService.playMessageSound();
        }
      });

      // Không cleanup subscription - giữ lắng nghe luôn
      // chỉ cleanup khi logout (trong useEffect khác)
    }
  }, [user?.id]);

  //  Subscribe to global room messages (never unsubscribed until logout)
  useEffect(() => {
    if (user?.id) {
      console.log("📢 Dashboard: Setting up global room message listeners");
      // ConversationList đã subscribe tất cả rooms, nên không cần ở đây
      // Dashboard chỉ cần lắng nghe từ ConversationList
    }
  }, [user?.id]);

  //  Start background polling for friend requests and room invites
  useEffect(() => {
    if (user?.id) {
      console.log(" Starting background notification polling services");
      friendRequestNotificationService.startPolling();
      roomInviteNotificationService.startPolling();

      return () => {
        console.log(" Stopping background notification polling services");
        friendRequestNotificationService.stopPolling();
        roomInviteNotificationService.stopPolling();
        // Clear global subscriptions on logout
        clearAllGlobalSubscriptions();
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
    // Trigger ConversationList to update via state change
    setMessageSentTrigger({ type, id, timestamp: Date.now() });
  }, []);

  // Fetch unread counts on load and periodically
  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadCounts = async () => {
      try {
        console.log("[DASHBOARD] Fetching unread counts for all conversations");
        const newUnreadCounts = {};

        // Fetch for friends (private messages)
        const friendsRes = await friendService.getFriendsList();
        const friends = (friendsRes.data || []).map((f) =>
          f.friend.id === user.id ? f.user : f.friend
        );

        for (const friend of friends) {
          try {
            const res = await messageService.getUnreadPrivateMessageCount(
              friend.id
            );
            newUnreadCounts[`private_${friend.id}`] = res.data || 0;
          } catch (error) {
            console.error(
              `Error fetching unread count for friend ${friend.id}:`,
              error
            );
          }
        }

        // Fetch for rooms
        const roomsRes = await chatRoomService.getAllRooms();
        const rooms = roomsRes.data || [];

        for (const room of rooms) {
          try {
            const res = await messageService.getUnreadCount(room.id);
            newUnreadCounts[`room_${room.id}`] = res.data || 0;
          } catch (error) {
            console.error(
              `Error fetching unread count for room ${room.id}:`,
              error
            );
          }
        }

        console.log("[DASHBOARD] Updated unread counts:", newUnreadCounts);
        setUnreadCounts(newUnreadCounts);
      } catch (error) {
        console.error("[DASHBOARD] Error fetching unread counts:", error);
      }
    };

    fetchUnreadCounts();
    // Poll every 10 seconds
    const interval = setInterval(fetchUnreadCounts, 10000);

    return () => clearInterval(interval);
  }, [user?.id]);

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
              onMessageSent={handleMessageSent}
              messageSentTrigger={messageSentTrigger}
              unreadCounts={unreadCounts}
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

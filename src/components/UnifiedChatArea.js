import React from "react";
import ChatRoom from "./ChatRoom";
import PrivateChatConversation from "./PrivateChatConversation";
import "../styles/UnifiedChatArea.css";

const UnifiedChatArea = ({ conversation, onUnreadCleared, onMessageSent }) => {
  if (!conversation) {
    return (
      <div className="unified-chat-area empty">
        <div className="empty-state">
          <h2>👋 Welcome!</h2>
          <p>Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  // Direct message (1-1)
  if (conversation.type === "direct") {
    return (
      <div className="unified-chat-area">
        <PrivateChatConversation
          friend={conversation.friend}
          onBack={() => {}}
          onUnreadCleared={onUnreadCleared}
        />
      </div>
    );
  }

  // Group chat
  if (conversation.type === "group") {
    return (
      <div className="unified-chat-area">
        <ChatRoom
          roomId={conversation.roomId}
          roomName={conversation.displayName}
          onMessageSent={onMessageSent}
        />
      </div>
    );
  }

  return null;
};

export default UnifiedChatArea;

/**
 *  Custom Hook: useMessageNotification
 * Xử lý tất cả logic phát âm thanh và desktop notification cho tin nhắn
 *
 * Giúp ChatRoom.js sạch sẽ hơn
 */

import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { notificationAudioService } from "../services/notificationAudioService";

export const useMessageNotification = (roomId, roomName) => {
  const { user } = useAuth();
  const notifiedMessagesRef = useRef(new Set());

  /**
   * Gửi notification cho tin nhắn mới
   *
   * Kiểm tra:
   * 1. Message từ người khác?
   * 2. Message chưa đọc?
   * 3. Tab không visible?
   */
  const handleNewMessage = (newMessage) => {
    //  1. Từ người khác?
    const isFromOtherUser = newMessage.senderId !== user.id;
    if (!isFromOtherUser) {
      console.log(" Message from self, skipping notification");
      return;
    }

    //  2. Chưa đọc?
    const isUnread = !newMessage.read;
    if (!isUnread) {
      console.log(" Message already read, skipping notification");
      return;
    }

    //  3. Tránh notification trùng lặp
    const alreadyNotified = notifiedMessagesRef.current.has(newMessage.id);
    if (alreadyNotified) {
      console.log(
        ` Message ${newMessage.id} already notified, skipping duplicate`
      );
      return;
    }

    notifiedMessagesRef.current.add(newMessage.id);

    //  4. Phát âm thanh
    console.log(" Playing notification sound");
    notificationAudioService.playMessageSound();
  };

  /**
   * Xóa notified messages khi đổi phòng
   */
  useEffect(() => {
    notifiedMessagesRef.current.clear();
    console.log(" Cleared notified messages for room:", roomId);
  }, [roomId]);

  return { handleNewMessage };
};

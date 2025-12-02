import axios from "axios";

const API_BASE_URL = "http://localhost:8081/api";

// Tạo instance axios với config mặc định
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Thêm token vào mỗi request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==================== AUTH SERVICES ====================
export const authService = {
  register: (username, password, displayName = "") =>
    apiClient.post("/auth/register", { username, password, displayName }),

  login: (username, password) =>
    apiClient.post("/auth/login", { username, password }),

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },
};

// ==================== USER SERVICES ====================
export const userService = {
  getCurrentUser: () => apiClient.get("/users/me"),

  getUserProfile: (userId) => apiClient.get(`/users/${userId}`),

  getAllUsers: () => apiClient.get("/users"),

  updateUserProfile: (userId, userData) => {
    console.log("updateUserProfile called with:", userId, userData);
    // Check if userData is FormData (for file upload)
    if (userData instanceof FormData) {
      // Don't set Content-Type header, let browser set it with boundary
      return apiClient.put(`/users/${userId}`, userData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    }
    return apiClient.put(`/users/${userId}`, userData);
  },

  deleteUser: (userId) => apiClient.delete(`/users/${userId}`),

  uploadAvatar: (userId, formData) => {
    console.log("uploadAvatar called with userId:", userId);
    console.log("FormData entries:", Array.from(formData.entries()));
    // IMPORTANT: Don't set Content-Type header, let browser set multipart/form-data with boundary
    return apiClient.post(`/users/${userId}/avatar`, formData, {
      headers: {
        "Content-Type": undefined,
      },
    });
  },

  // 🆕 Tìm kiếm người dùng
  searchUsers: (query) => apiClient.get(`/friends/search?query=${query}`),
};

// ==================== CHAT ROOM SERVICES ====================
export const chatRoomService = {
  getAllRooms: () => apiClient.get("/rooms"),

  getRoomById: (roomId) => apiClient.get(`/rooms/${roomId}`),

  createRoom: (roomData) => apiClient.post("/rooms", roomData),

  updateRoom: (roomId, roomData) => apiClient.put(`/rooms/${roomId}`, roomData),

  deleteRoom: (roomId) => apiClient.delete(`/rooms/${roomId}`),

  getRoomMembers: (roomId) => apiClient.get(`/rooms/${roomId}/members`),

  getRoomMembersWithRoles: (roomId) =>
    apiClient.get(`/rooms/${roomId}/members-with-roles`),

  joinRoom: (roomId) => apiClient.post(`/rooms/${roomId}/join`, {}),

  leaveRoom: (roomId) => apiClient.delete(`/rooms/${roomId}/leave`),

  kickMember: (roomId, memberId) =>
    apiClient.delete(`/rooms/${roomId}/members/${memberId}`),

  // 🆕 Lấy danh sách phòng có thể truy cập (công khai + riêng tư của người dùng)
  getAccessibleRooms: () => apiClient.get("/rooms/accessible"),

  // 🆕 Lấy danh sách phòng của người dùng
  getMyRooms: () => apiClient.get("/rooms/my-rooms"),

  // 🆕 Cập nhật giới hạn số thành viên
  updateMaxMembers: (roomId, maxMembers) =>
    apiClient.put(`/rooms/${roomId}/max-members?maxMembers=${maxMembers}`),

  // 🆕 Lấy phòng công khai
  getPublicRooms: () => apiClient.get("/rooms/public"),
};

// ==================== MESSAGE SERVICES ====================
export const messageService = {
  // 🆕 Yêu cầu user ID khi lấy messages
  getMessages: (roomId) => apiClient.get(`/messages/room/${roomId}`),

  sendMessage: (messageData) => apiClient.post("/messages", messageData),

  deleteMessage: (messageId) => apiClient.delete(`/messages/${messageId}`),

  recallMessage: (messageId) =>
    apiClient.put(`/messages/${messageId}/recall`, {}),

  // 🆕 Lấy messages sau một ID cụ thể (với kiểm tra quyền)
  getMessagesAfter: (roomId, lastMessageId) =>
    apiClient.get(`/messages/room/${roomId}/after/${lastMessageId}`),

  // 🆕 Đánh dấu tin nhắn là đã đọc
  markAsRead: (messageId) =>
    apiClient.put(`/messages/${messageId}/mark-as-read`, {}),

  // 🆕 Lấy số tin nhắn chưa đọc trong một phòng
  getUnreadCount: (roomId) =>
    apiClient.get(`/messages/room/${roomId}/unread-count`),

  // 🆕 Lấy tổng số tin nhắn chưa đọc
  getTotalUnreadCount: () => apiClient.get(`/messages/total-unread-count`),

  // 🆕 Đánh dấu tất cả tin nhắn trong phòng là đã đọc
  markAllAsRead: (roomId) =>
    apiClient.put(`/messages/room/${roomId}/mark-all-as-read`, {}),

  // 🆕 Lấy tin nhắn riêng tư giữa 2 người dùng
  getPrivateMessages: (recipientId) =>
    apiClient.get(`/messages/private/${recipientId}`),

  // 🆕 Lấy số tin nhắn chưa đọc từ một bạn bè
  getUnreadPrivateMessageCount: (friendId) =>
    apiClient.get(`/messages/private/${friendId}/unread-count`),

  // 🆕 Đánh dấu tất cả tin nhắn riêng tư với một bạn bè là đã đọc
  markAllPrivateAsRead: (friendId) =>
    apiClient.put(`/messages/private/${friendId}/mark-all-as-read`, {}),
};

// ==================== FRIEND SERVICES ====================
export const friendService = {
  getFriendsList: () => apiClient.get("/friends"),

  sendFriendRequest: (friendId) =>
    apiClient.post("/friends/request?friendId=" + friendId),

  removeFriend: (friendshipId) => apiClient.delete(`/friends/${friendshipId}`),

  getPendingRequests: () => apiClient.get("/friends/pending"),

  acceptFriendRequest: (friendshipId) =>
    apiClient.post(`/friends/${friendshipId}/accept`, {}),

  declineFriendRequest: (friendshipId) =>
    apiClient.delete(`/friends/${friendshipId}/decline`),

  // 🆕 Tìm kiếm người dùng
  searchUsers: (query) => apiClient.get(`/friends/search?query=${query}`),
};

// ==================== NOTIFICATION SERVICES ====================
export const notificationService = {
  getNotifications: () => apiClient.get("/notifications"),

  markAsRead: (notificationId) =>
    apiClient.put(`/notifications/${notificationId}/read`, {}),

  deleteNotification: (notificationId) =>
    apiClient.delete(`/notifications/${notificationId}`),
};

// ==================== ROOM INVITE SERVICES ====================
export const roomInviteService = {
  inviteUserToRoom: (roomId, userId) =>
    apiClient.post("/room-invites", null, {
      params: { roomId, inviteeId: userId },
    }),

  getPendingInvites: () => apiClient.get("/room-invites/pending"),

  acceptInvite: (inviteId) =>
    apiClient.post(`/room-invites/${inviteId}/accept`, {}),

  declineInvite: (inviteId) =>
    apiClient.post(`/room-invites/${inviteId}/decline`, {}),

  rejectInvite: (inviteId) => apiClient.delete(`/room-invites/${inviteId}`),

  getAvailableFriendsForRoom: (roomId) =>
    apiClient.get(`/room-invites/room/${roomId}/available-friends`),

  getInvitedUsersForRoom: (roomId) =>
    apiClient.get(`/room-invites/room/${roomId}/invited-users`),
};

export default apiClient;

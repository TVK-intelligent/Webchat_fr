# 💬 Web Chat Frontend - React

Ứng dụng chat thời gian thực tích hợp đầy đủ xây dựng bằng **React**, kết nối qua **WebSocket STOMP** với backend **Spring Boot**. Cung cấp trải nghiệm chat mượt mà với các tính năng hiện đại như tin nhắn thời gian thực, thông báo push, chia sẻ hình ảnh, và quản lý bạn bè.

## 🌟 Tính Năng Chính

- **🔐 Xác thực người dùng** - Đăng nhập/Đăng ký với JWT token
- **💬 Chat Phòng** - Tham gia, tạo, và chat trong các phòng công khai/riêng tư
- **👥 Chat Riêu tư** - Nhắn tin trực tiếp với bạn bè
- **⌨️ Typing Indicators** - Hiển thị khi người khác đang gõ
- **🔔 Thông báo Push** - Nhận thông báo khi có tin nhắn mới (Desktop & Mobile)
- **🎵 Âm thanh thông báo** - Phát âm thanh khi có thông báo
- **👤 Quản lý hồ sơ** - Cập nhật thông tin, tải ảnh đại diện
- **👨‍👩‍👧 Quản lý bạn bè** - Thêm, tìm kiếm và quản lý danh sách bạn
- **🌙 Chế độ tối/sáng** - Chuyển đổi giao diện theo sở thích
- **📱 Responsive Design** - Tối ưu hóa cho mobile, tablet và desktop

## 📋 Yêu Cầu

- **Node.js** >= 14.0
- **npm** >= 6.0
- **Backend Spring Boot** chạy trên `http://localhost:8080`
- **Modern Browser** hỗ trợ WebSocket và Web Push API

## 🚀 Quick Start

### 1. Cài đặt Dependencies

```bash
cd e:\Web_chat\frontend
npm install
```

### 2. Chạy Development Server

```bash
npm start
```

Ứng dụng sẽ tự động mở ở `http://localhost:3000`

## 🔧 Cấu Hình

### API Endpoint

Cập nhật API endpoint trong `src/services/api.js`:

```javascript
const API_BASE_URL = "http://localhost:8080/api";
```

### WebSocket Connection

WebSocket được cấu hình tự động kết nối đến backend thông qua STOMP protocol.

### Push Notifications

Để sử dụng push notifications, cấu hình VAPID key trong `src/services/pushNotificationService.js`:

```javascript
const VAPID_PUBLIC_KEY = "YOUR_VAPID_PUBLIC_KEY";
```

## 📁 Cấu Trúc Thư Mục

```
frontend/
├── public/                    # Tài nguyên tĩnh
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js     # Service Worker cho push notifications
│   └── sounds/               # Âm thanh thông báo
├── src/
│   ├── components/           # React components
│   │   ├── Login.js
│   │   ├── Register.js
│   │   ├── ChatRoom.js
│   │   ├── PrivateChat.js
│   │   ├── RoomList.js
│   │   ├── Friends.js
│   │   ├── Notifications.js
│   │   ├── Profile.js
│   │   ├── Settings.js
│   │   └── Sidebar.js
│   ├── context/              # React Context API
│   │   ├── AuthContext.js    # Xác thực người dùng
│   │   └── ThemeContext.js   # Chế độ sáng/tối
│   ├── hooks/                # Custom React hooks
│   │   ├── useMessageNotification.js
│   │   ├── useNotificationListener.js
│   │   ├── usePrivateMessageListener.js
│   │   ├── usePushNotifications.js
│   │   └── useRoomMessageListener.js
│   ├── pages/                # Page components
│   │   └── Dashboard.js
│   ├── services/             # API & WebSocket services
│   │   ├── api.js
│   │   ├── websocket.js
│   │   ├── notificationWebSocket.js
│   │   ├── roomWebSocket.js
│   │   ├── pushNotificationService.js
│   │   ├── notificationAudioService.js
│   │   └── globalMessageListener.js
│   ├── utils/                # Utility functions
│   ├── styles/               # CSS files
│   ├── constants/            # Constants
│   ├── App.js               # Root component
│   └── index.js             # Entry point
├── build/                    # Production build output
├── package.json
└── README.md
```

## 🔌 Kết Nối WebSocket

Ứng dụng sử dụng **STOMP over WebSocket** để giao tiếp thời gian thực:

- **Room Messages**: `/topic/rooms/{roomId}`
- **Private Messages**: `/user/queue/messages`
- **Typing Indicators**: `/app/chat.typing`
- **Notifications**: `/user/queue/notifications`

## 🔐 Xác Thực

JWT token được lưu trong `localStorage` sau khi đăng nhập và tự động gửi kèm mỗi request:

```javascript
const token = localStorage.getItem("jwtToken");
headers: {
  "Authorization": `Bearer ${token}`
}
```

## 📱 Giao Diện Chính

| Tab              | Chức Năng                                  |
| ---------------- | ------------------------------------------ |
| 💬 **Chat**      | Danh sách phòng, tạo phòng, chat nhóm      |
| **👥 Bạn bè**    | Tìm kiếm bạn, quản lý danh sách bạn        |
| **🔔 Thông báo** | Xem tất cả thông báo (tin nhắn, lời mời)   |
| **👤 Hồ sơ**     | Cập nhật thông tin, ảnh đại diện, mật khẩu |
| **⚙️ Cài đặt**   | Tùy chỉnh ngôn ngữ, chế độ tối/sáng        |

## 🛠️ Build cho Production

```bash
npm run build
```

Thư mục `build/` sẽ được tạo với các file tối ưu hóa.

## 📦 Dependencies Chính

- **react** - UI library
- **react-dom** - React DOM binding
- **axios** - HTTP client
- **stompjs** - STOMP client
- **sockjs-client** - WebSocket polyfill

## 💡 Tips & Tricks

- Mở DevTools (F12) để xem logs console
- Kiểm tra Network tab để debug WebSocket connections
- Đảm bảo backend Spring Boot đang chạy trước khi start frontend
- Clear browser cache nếu gặp vấn đề với service worker
- JWT tokens tự động được refresh khi hết hạn (nếu có)

## 🐛 Troubleshooting

### WebSocket Connection Failed

- Kiểm tra backend có đang chạy trên port 8080
- Kiểm tra CORS settings trên backend
- Xem console logs để chi tiết lỗi

### Push Notifications Không Hoạt Động

- Browser phải hỗ trợ Push API
- Kiểm tra permission đã được cấp
- Kiểm tra Service Worker đã register thành công

### CORS Issues

- Cấu hình CORS trên backend Spring Boot
- Đảm bảo frontend URL được add vào whitelist

## 📚 Tài Liệu Liên Quan

- [PUSH_NOTIFICATIONS.md](../PUSH_NOTIFICATIONS.md) - Hướng dẫn cấu hình push notifications
- [SOLUTION_NOTES.md](../SOLUTION_NOTES.md) - Ghi chú kỹ thuật

---

**Happy Chatting!** 💬✨

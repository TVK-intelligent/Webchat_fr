# 💬 Web Chat Frontend - React

Ứng dụng chat thời gian thực với React, WebSocket, và Spring Boot Backend

## 🚀 Tính Năng

✅ **Đăng nhập/Đăng ký** - Tạo tài khoản và đăng nhập  
✅ **Chat Phòng** - Tham gia và chat trong các phòng  
✅ **Tạo Phòng** - Tạo phòng chat công khai hoặc riêng tư  
✅ **Tin nhắn Thời gian thực** - WebSocket STOMP  
✅ **Thấy khi người khác gõ** - Typing indicators  
✅ **Danh sách Bạn bè** - Quản lý bạn bè  
✅ **Thông báo** - Nhận thông báo mới  
✅ **Responsive Design** - Hoạt động trên desktop và mobile

## 📋 Yêu Cầu

- Node.js >= 14.0
- npm >= 6.0
- Backend Spring Boot chạy trên `http://localhost:8080`

## 🚀 Quick Start

### 1. Cài đặt dependencies

```bash
cd e:\Web_chat\frontend
npm install
```

### 2. Chạy development server

```bash
npm start
```

Ứng dụng sẽ mở tự động ở `http://localhost:3000`

## 🔧 Cấu Hình

Cập nhật API endpoint trong `src/services/api.js`:

```javascript
const API_BASE_URL = "http://localhost:8080/api";
```

## 📁 Cấu Trúc Thư Mục

```
frontend/
├── src/
│   ├── components/
│   │   ├── Login.js
│   │   ├── Register.js
│   │   ├── ChatRoom.js
│   │   ├── RoomList.js
│   │   ├── Friends.js
│   │   ├── Notifications.js
│   │   └── Sidebar.js
│   ├── context/
│   │   └── AuthContext.js
│   ├── pages/
│   │   └── Dashboard.js
│   ├── services/
│   │   ├── api.js
│   │   └── websocket.js
│   ├── styles/
│   │   └── *.css
│   └── App.js
└── package.json
```

## 🎯 Các Tab Chính

| Tab          | Chức Năng               |
| ------------ | ----------------------- |
| 💬 Chat      | Danh sách phòng và chat |
| 👥 Bạn bè    | Quản lý bạn bè          |
| 🔔 Thông báo | Xem thông báo           |

## 📱 Build cho Production

```bash
npm run build
```

## 💡 Tips

- Mở DevTools (F12) để xem logs
- Đảm bảo backend Spring Boot đang chạy
- JWT tokens tự động được lưu và gửi kèm requests

Happy Chatting! 💬🚀

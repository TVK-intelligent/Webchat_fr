# 🔊 Notification Sound Setup

## Hướng Dẫn Cấu Hình Âm Thanh Thông Báo

### 1. **Âm Thanh Mặc Định**

Ứng dụng đã được cấu hình để sử dụng các âm thanh từ **Mixkit** (công khai):

- **Mặc định** - Âm thanh thông báo cơ bản
- **Chuông** - Âm thanh chuông
- **Ping** - Âm thanh ping
- **Chime** - Âm thanh chime
- **Pop** - Âm thanh pop

### 2. **Cấu Hình Âm Thanh**

#### Qua Settings (⚙️):

1. Vào **Settings** (⚙️ Cài Đặt)
2. Mục **🔔 Thông Báo**
3. Bật **"Âm thanh thông báo"**
4. Chọn loại âm thanh từ danh sách
5. Điều chỉnh **âm lượng** bằng slider
6. Nhấn **"Test"** để nghe thử

#### Qua Notifications (🔔):

1. Vào **Notifications** (🔔 Thông báo)
2. Nhấn nút **🔔/🔇** ở góc trên phải
3. Nếu muốn tắt/bật âm thanh

### 3. **Tính Năng**

✅ **Phát âm thanh tự động** khi có:

- Thông báo mới chưa đọc
- Tin nhắn mới từ người khác

✅ **Cấu hình linh hoạt**:

- Bật/Tắt âm thanh nhanh chóng
- Chọn kiểu âm thanh ưa thích
- Điều chỉnh âm lượng
- Test âm thanh trước khi lưu

✅ **Lưu trữ cài đặt**:

- Tất cả cài đặt được lưu vào `localStorage`
- Khôi phục tự động khi tải lại trang

### 4. **Thêm Âm Thanh Tùy Chỉnh**

Nếu muốn thêm âm thanh riêng:

**Option 1: Thêm file MP3 vào `/public/sounds/`**

```
/public/sounds/
  ├── notification.mp3  (mặc định)
  ├── custom-1.mp3
  ├── custom-2.mp3
  └── ...
```

**Option 2: Sử dụng URL từ internet**

```javascript
// Trong constants/notificationSounds.js
export const NOTIFICATION_SOUNDS = {
  CUSTOM: "https://your-domain.com/sound.mp3",
  // ...
};
```

### 5. **Khắc Phục Sự Cố**

#### ❌ Không nghe thấy âm thanh?

- Kiểm tra xem âm thanh đã được **bật** chưa
- Kiểm tra **âm lượng** của trình duyệt
- Thử nhấn **"Test"** để kiểm tra
- Kiểm tra **trình duyệt có cho phép phát âm thanh** không

#### ❌ Âm thanh bị mất sau khi làm mới?

- Kiểm tra `localStorage` có bị xóa không
- Thử **Reset to Defaults** nếu có option này

### 6. **Quyền Hạn Trình Duyệt**

Một số trình duyệt có **autoplay policy**:

- Chỉ phát âm thanh sau khi có **tương tác người dùng**
- Nếu page mở mà không có tương tác → Âm thanh sẽ không phát

**Giải pháp**: Nhấn bất kỳ nơi nào trên trang → Âm thanh sẽ hoạt động bình thường

### 7. **Tùy Chỉnh Nâng Cao**

Edit `notificationSound.js` để tùy chỉnh:

- Âm thanh mặc định (`this.soundUrl`)
- Âm lượng mặc định (`this.volume`)
- Sử dụng Web Audio API cho hiệu ứng nâng cao

---

**Liên Hệ Hỗ Trợ**: Nếu có sự cố, vui lòng kiểm tra console (F12) để xem lỗi chi tiết.

/* global clients */
/**
 * Service Worker for Push Notifications
 * Xử lý background notifications và notification click events
 */

// Lắng nghe push notification từ server
self.addEventListener("push", (event) => {
  console.log("📬 Push event received:", event);

  if (!event.data) {
    console.warn("⚠️ Push event không có data");
    return;
  }

  try {
    const data = event.data.json();
    console.log("📩 Push notification data:", data);

    const { title, body, icon, badge, tag, notificationData } = data;

    const options = {
      body,
      icon: icon || "/logo192.png",
      badge: badge || "/logo192.png",
      tag: tag || "general",
      requireInteraction: false,
      data: notificationData || {},
    };

    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        console.log("✅ Push notification displayed");
      })
    );
  } catch (error) {
    console.error("❌ Error processing push event:", error);
  }
});

// Lắng nghe click trên notification
self.addEventListener("notificationclick", (event) => {
  console.log("🖱️ Notification clicked:", event.notification);

  event.notification.close();

  const data = event.notification.data;
  console.log("📤 Notification click data:", data);

  const { senderId, roomId, action } = data;

  // Xác định URL để mở
  let urlToOpen = "/";

  switch (action) {
    case "open_message":
      urlToOpen = `/?tab=chat&conversation=${senderId}`;
      break;
    case "open_room":
      urlToOpen = `/?tab=chat&room=${roomId}`;
      break;
    case "open_friend_requests":
      urlToOpen = "/?tab=friends";
      break;
    case "open_room_invites":
      urlToOpen = "/?tab=notifications";
      break;
    default:
      urlToOpen = "/";
  }

  console.log("🌐 Opening URL:", urlToOpen);

  // Tìm và focus tab đang mở, hoặc mở tab mới
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      console.log(`🔍 Found ${clientList.length} open windows`);

      // Kiểm tra xem có tab nào đang mở ứng dụng không
      for (let client of clientList) {
        if (client.url.includes(window.location.origin) && "focus" in client) {
          console.log("✅ Focusing existing window:", client.url);
          // Post message để tab hiện tại xử lý navigation
          client.postMessage({
            type: "NOTIFICATION_CLICK",
            data: { action, senderId, roomId },
          });
          return client.focus();
        }
      }

      // Nếu không có tab nào, mở tab mới
      if (clients.openWindow) {
        console.log("📱 Opening new window with URL:", urlToOpen);
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Lắng nghe notification close
self.addEventListener("notificationclose", (event) => {
  console.log("❌ Notification closed:", event.notification);
});

// Lắng nghe message từ client
self.addEventListener("message", (event) => {
  console.log("📨 Message from client:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker activated");
  event.waitUntil(clients.claim());
});

// Install event
self.addEventListener("install", (event) => {
  console.log("⚙️ Service Worker installing");
  self.skipWaiting();
});

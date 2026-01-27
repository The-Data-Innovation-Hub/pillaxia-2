// Pillaxia Push Notification Service Worker

self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event);

  let data = {
    title: "Pillaxia Notification",
    body: "You have a new notification",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "pillaxia-notification",
    data: {},
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    console.error("[SW] Error parsing push data:", e);
  }

  const options = {
    body: data.body,
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    tag: data.tag || "pillaxia-notification",
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification click:", event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] Push subscription changed:", event);
  // The subscription was revoked or expired - user needs to re-subscribe
});

// Pillaxia Service Worker - Offline-First with Push Notifications
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `pillaxia-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `pillaxia-dynamic-${CACHE_VERSION}`;
const API_CACHE = `pillaxia-api-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/placeholder.svg',
  '/robots.txt',
];

// API endpoints to cache with network-first strategy
const API_PATTERNS = [
  /\/rest\/v1\/medications/,
  /\/rest\/v1\/medication_schedules/,
  /\/rest\/v1\/medication_logs/,
  /\/rest\/v1\/profiles/,
  /\/rest\/v1\/symptom_entries/,
  /\/rest\/v1\/clinician_messages/,
  /\/rest\/v1\/caregiver_messages/,
  /\/rest\/v1\/notification_history/,
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith("pillaxia-") &&
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== API_CACHE
            );
          })
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Helper: Check if request is an API call
function isApiRequest(url) {
  return API_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

// Helper: Check if request is for static asset
function isStaticAsset(url) {
  return (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2")
  );
}

// Network-first strategy for API requests
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      // Clone response before caching
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("[SW] Network failed, falling back to cache:", request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline response for API requests
    return new Response(
      JSON.stringify({ offline: true, error: "You are offline" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Cache-first strategy for static assets
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("[SW] Failed to fetch:", request.url);
    return new Response("Offline", { status: 503 });
  }
}

// Stale-while-revalidate for dynamic content
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

// Fetch event - intercept network requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Skip auth endpoints - don't cache authentication
  if (url.pathname.includes("/auth/")) {
    return;
  }

  // API requests - network first
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // Static assets - cache first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Navigation requests - stale while revalidate
  if (event.request.mode === "navigate") {
    event.respondWith(
      staleWhileRevalidate(event.request, DYNAMIC_CACHE).catch(() => {
        return caches.match("/index.html");
      })
    );
    return;
  }

  // Default - stale while revalidate
  event.respondWith(staleWhileRevalidate(event.request, DYNAMIC_CACHE));
});

// Push notification handling
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
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] Push subscription changed:", event);
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync:", event.tag);
  
  if (event.tag === "sync-medication-logs") {
    event.waitUntil(syncMedicationLogs());
  }
});

// Sync medication logs when back online
async function syncMedicationLogs() {
  try {
    const db = await openIndexedDB();
    const pendingLogs = await getPendingLogs(db);
    
    for (const log of pendingLogs) {
      try {
        // Attempt to sync each pending log
        await fetch(log.url, {
          method: log.method,
          headers: log.headers,
          body: JSON.stringify(log.body),
        });
        await removePendingLog(db, log.id);
      } catch (error) {
        console.log("[SW] Failed to sync log:", log.id);
      }
    }
  } catch (error) {
    console.log("[SW] Sync failed:", error);
  }
}

// IndexedDB helpers for offline queue
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("pillaxia-offline", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pending-actions")) {
        db.createObjectStore("pending-actions", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

function getPendingLogs(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["pending-actions"], "readonly");
    const store = transaction.objectStore("pending-actions");
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removePendingLog(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["pending-actions"], "readwrite");
    const store = transaction.objectStore("pending-actions");
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

console.log("[SW] Service worker loaded - Pillaxia Offline-First v1");

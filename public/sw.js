const CACHE_NAME = "primaria-v1";
const OFFLINE_URL = "/offline";
const DB_NAME = "primaria-offline";
const DB_VERSION = 1;
const PAYMENT_STORE = "payment-queue";
const PAYMENT_API_PATH = "/api/plati/record";

const PRECACHE_ASSETS = [
  "/",
  "/login",
  "/manifest.json",
];

// ============================================================================
// IndexedDB Setup
// ============================================================================

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PAYMENT_STORE)) {
        const store = db.createObjectStore(PAYMENT_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

async function addPaymentToQueue(paymentData) {
  const db = await openDB();
  const tx = db.transaction([PAYMENT_STORE], "readwrite");
  const store = tx.objectStore(PAYMENT_STORE);

  const record = {
    ...paymentData,
    timestamp: Date.now(),
    status: "pending",
  };

  return new Promise((resolve, reject) => {
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getQueuedPayments() {
  const db = await openDB();
  const tx = db.transaction([PAYMENT_STORE], "readonly");
  const store = tx.objectStore(PAYMENT_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removePaymentFromQueue(id) {
  const db = await openDB();
  const tx = db.transaction([PAYMENT_STORE], "readwrite");
  const store = tx.objectStore(PAYMENT_STORE);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function broadcastSyncStatus(status, message) {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: "SYNC_STATUS",
      status,
      message,
    });
  });
}

async function replayQueuedPayments() {
  try {
    await broadcastSyncStatus("syncing", "Syncing queued payments...");

    const payments = await getQueuedPayments();
    if (payments.length === 0) {
      await broadcastSyncStatus("idle", "No payments to sync");
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const payment of payments) {
      try {
        const response = await fetch(PAYMENT_API_PATH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payment.data),
        });

        if (response.ok) {
          await removePaymentFromQueue(payment.id);
          successCount++;
        } else {
          failureCount++;
          console.error("Failed to sync payment:", payment.id, response.status);
        }
      } catch (error) {
        failureCount++;
        console.error("Error syncing payment:", payment.id, error);
      }
    }

    if (failureCount === 0) {
      await broadcastSyncStatus(
        "synced",
        `Successfully synced ${successCount} payment(s)`
      );
    } else {
      await broadcastSyncStatus(
        "error",
        `Synced ${successCount}, failed ${failureCount}`
      );
    }
  } catch (error) {
    console.error("Error replaying queued payments:", error);
    await broadcastSyncStatus("error", "Error syncing payments");
  }
}

// ============================================================================
// Service Worker Lifecycle
// ============================================================================

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ============================================================================
// Background Sync
// ============================================================================

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-payments") {
    event.waitUntil(replayQueuedPayments());
  }
});

// Fallback: Periodic retry for browsers without Background Sync API
let syncInterval = null;
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "START_PERIODIC_SYNC") {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(() => {
      if (self.navigator.onLine) {
        replayQueuedPayments();
      }
    }, 30000); // Check every 30 seconds
  } else if (event.data && event.data.type === "STOP_PERIODIC_SYNC") {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  } else if (event.data && event.data.type === "MANUAL_SYNC") {
    replayQueuedPayments();
  }
});

// ============================================================================
// Fetch Handler with Offline Payment Queue
// ============================================================================

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercept POST requests to payment API
  if (
    event.request.method === "POST" &&
    url.pathname === PAYMENT_API_PATH
  ) {
    event.respondWith(
      (async () => {
        try {
          // Try to send the payment immediately
          const response = await fetch(event.request.clone());
          return response;
        } catch (error) {
          // If offline, queue the payment
          const requestClone = event.request.clone();
          const paymentData = await requestClone.json();

          await addPaymentToQueue({ data: paymentData });

          // Register for background sync if supported
          if ("sync" in self.registration) {
            await self.registration.sync.register("sync-payments");
          }

          // Return a success response indicating queued
          return new Response(
            JSON.stringify({
              success: true,
              queued: true,
              message: "Payment queued for sync",
            }),
            {
              status: 202,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      })()
    );
    return;
  }

  // Handle navigation requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL).then((response) => {
          return response || caches.match("/");
        });
      })
    );
    return;
  }

  // Handle other requests with cache-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // Cache static assets
        if (
          event.request.url.includes("/_next/static/") ||
          event.request.url.includes("/icons/")
        ) {
          const cloned = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return fetchResponse;
      });
    })
  );
});

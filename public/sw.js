/**
 * Service Worker for Push Notifications
 * Handles background push events and notification clicks
 */

const CACHE_NAME = 'shield-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'Shield',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {},
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        ...data,
        ...payload,
      };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    vibrate: [100, 50, 100],
    data: data.data,
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - handle user interactions
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Determine URL based on notification type
  switch (data.type) {
    case 'call':
      // Incoming call - open app to handle call
      targetUrl = '/';
      break;
    case 'booking':
      targetUrl = data.bookingId 
        ? `/d/venue/bookings/${data.bookingId}`
        : '/d/venue/bookings';
      break;
    case 'shift':
      targetUrl = data.shiftId 
        ? `/d/personnel/shift/${data.shiftId}`
        : '/d/personnel/jobs';
      break;
    case 'message':
      targetUrl = data.conversationId
        ? `/d/messages/${data.conversationId}`
        : '/d/messages';
      break;
    default:
      targetUrl = data.url || '/';
  }

  // Handle action buttons
  if (event.action) {
    switch (event.action) {
      case 'accept':
        targetUrl = data.acceptUrl || targetUrl;
        break;
      case 'decline':
        targetUrl = data.declineUrl || targetUrl;
        break;
      case 'view':
        targetUrl = data.viewUrl || targetUrl;
        break;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: data,
              action: event.action,
            });
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // Track notification dismissal if needed
  const data = event.notification.data || {};
  if (data.trackDismiss) {
    // Could send analytics event here
  }
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Message received in SW:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

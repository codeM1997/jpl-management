importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDCaA2JSvVWcXkRZBPPJS5FTlUkkTO-8iE",
  authDomain: "football-organizer-7a1ae.firebaseapp.com",
  projectId: "football-organizer-7a1ae",
  storageBucket: "football-organizer-7a1ae.firebasestorage.app",
  messagingSenderId: "1001772577694",
  appId: "1:1001772577694:web:8149d63860441e94e79c8f"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    actions: [
      { action: 'rsvp_yes', title: 'I\'m In' },
      { action: 'rsvp_no', title: 'Decline' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');
  event.notification.close();

  if (event.action === 'rsvp_yes') {
    // Logic to handle RSVP Yes via background sync or redirect
    event.waitUntil(clients.openWindow('/?rsvp=yes'));
  } else if (event.action === 'rsvp_no') {
    event.waitUntil(clients.openWindow('/?rsvp=no'));
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, type Messaging } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCaA2JSvVWcXkRZBPPJS5FTlUkkTO-8iE",
  authDomain: "football-organizer-7a1ae.firebaseapp.com",
  projectId: "football-organizer-7a1ae",
  storageBucket: "football-organizer-7a1ae.firebasestorage.app",
  messagingSenderId: "1001772577694",
  appId: "1:1001772577694:web:8149d63860441e94e79c8f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Messaging is only supported in browsers with Service Worker and Push API support
let messaging: Messaging | null = null;
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("Firebase Messaging not supported or failed to initialize", err);
  }
}

export { messaging };

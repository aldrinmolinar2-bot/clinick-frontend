// firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAsM8U5qnOTd-JjjNuJ7W1oP2iBHA4asO4",
  authDomain: "clinick-a9439.firebaseapp.com",
  projectId: "clinick-a9439",
  storageBucket: "clinick-a9439.firebasestorage.app",
  messagingSenderId: "946636315925",
  appId: "1:946636315925:web:b60929d40d342241c85d1c",
  measurementId: "G-YVD0NVQ72W",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Request notification permission and send token to server
export const requestPermission = async () => {
  console.log("🔔 Requesting notification permission...");
  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    try {
      const token = await getToken(messaging, {
        vapidKey:
          "BHOceROaxC0lcnYIaqraDCeQ_8Z07k6BVqJOf4D4qQX4wkC0-okh7vZO_nldzahFQxIZ1N-KnrvC2yLdtSJASE4",
      });

      console.log("✅ FCM Token:", token);

      // Send the token to your backend
      await fetch(`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/save-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      return token;
    } catch (err) {
      console.error("❌ Error getting token:", err);
    }
  } else {
    console.warn("🚫 Notification permission not granted.");
  }
};

// Listen for messages while the site is open
export const listenForMessages = () => {
  onMessage(messaging, (payload) => {
    console.log("📩 Message received:", payload);
    if (payload.notification) {
      alert(`${payload.notification.title}\n${payload.notification.body || ""}`);
    }
  });
};

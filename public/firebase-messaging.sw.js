/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAsM8U5qnOTd-JjjNuJ7W1oP2iBHA4asO4",
  authDomain: "clinick-a9439.firebaseapp.com",
  projectId: "clinick-a9439",
  storageBucket: "clinick-a9439.firebasestorage.app",
  messagingSenderId: "946636315925",
  appId: "1:946636315925:web:b60929d40d342241c85d1c",
  measurementId: "G-YVD0NVQ72W",
});

const messaging = firebase.messaging();

// Background notifications
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Background message received:", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/logo192.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Optionally, if you ever need Analytics in the future:
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCbdSytUX8cCvT10lckBzFEGtApBhQSkDY",
  authDomain: "waterfall-69a46.firebaseapp.com",
  projectId: "waterfall-69a46",
  storageBucket: "waterfall-69a46.firebasestorage.app",
  messagingSenderId: "1037962320483",
  appId: "1:1037962320483:web:985367a5f986b6c690b656",
  measurementId: "G-FG6ZVYGBPZ",
};

// Initialize Firebase (avoid initializing more than once during hot reloads)
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
// Initialize Firestore (this is the only service we need right now)
const db = getFirestore();

// Optionally, initialize Analytics if needed:
// const analytics = getAnalytics(app);

export { db };

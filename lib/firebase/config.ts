import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAgfgNm_bL6dJ1waI8sXe73d05-EZFWXYI",
  authDomain: "bookworm-ai-ca43d.firebaseapp.com",
  projectId: "bookworm-ai-ca43d",
  storageBucket: "bookworm-ai-ca43d.firebasestorage.app",
  messagingSenderId: "570304013806",
  appId: "1:570304013806:web:d3c03eccaa7be5ada71aff",
  measurementId: "G-VS3B0XRK1C"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

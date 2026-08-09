import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCEWWZucjBCgA5MUCefWBQdL_9UI6cwpRE",
  authDomain: "hanultari-league.firebaseapp.com",
  projectId: "hanultari-league",
  storageBucket: "hanultari-league.firebasestorage.app",
  messagingSenderId: "760515352116",
  appId: "1:760515352116:web:90ec808a421a6d6d3d5c61"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

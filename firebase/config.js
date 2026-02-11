import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBXZRO9IoAU9ajpeG28D0duo2f_nKjeDxM",
  authDomain: "rekrooot.firebaseapp.com",
  projectId: "rekrooot",
  storageBucket: "rekrooot.firebasestorage.app",
  messagingSenderId: "319636262816",
  appId: "1:319636262816:web:442f25d5c6077630571ec5",
  measurementId: "G-5S6WHXKMBV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services with specific database IDs
const auth = getAuth(app);
const db = getFirestore(app); 
const storage = getStorage(app);

// Export services
export { auth, db, storage };
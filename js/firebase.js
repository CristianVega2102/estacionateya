import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLoLOEb4Nr3VaG5dabiIczu3yd9n3tZM0",
  authDomain: "estacionateya-68507.firebaseapp.com",
  projectId: "estacionateya-68507",
  storageBucket: "estacionateya-68507.firebasestorage.app",
  messagingSenderId: "195146358505",
  appId: "1:195146358505:web:746d34ad87f4f2d7079a78"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

import { auth, db, googleProvider } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export function observarSesion(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function registrar({ nombre, telefono, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: nombre });
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid, nombre, telefono, fechaRegistro: serverTimestamp()
  });
  return { nombre, telefono };
}

export function ingresar(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function ingresarConGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const ref = doc(db, "users", cred.user.uid);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(ref, {
      uid: cred.user.uid, nombre: cred.user.displayName || "", telefono: "",
      fechaRegistro: serverTimestamp()
    });
  }
}

export function salir() {
  return signOut(auth);
}

export async function obtenerPerfil(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function traducirError(code = "") {
  const errores = {
    "auth/invalid-email": "El email no es válido.",
    "auth/missing-password": "Escribí tu contraseña.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/email-already-in-use": "Ese email ya tiene cuenta. Tocá Ingresar.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/user-not-found": "Email o contraseña incorrectos.",
    "auth/wrong-password": "Email o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos.",
    "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication.",
    "auth/network-request-failed": "Sin conexión. Revisá tu internet."
  };
  return errores[code] || "No pudimos completar la acción. Probá de nuevo.";
}

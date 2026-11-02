import { db } from "./firebase.js";
import {
  collection, doc, setDoc, updateDoc, query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const spotsRef = collection(db, "spots");

const fecha = (s) => s.timestamp?.toMillis?.() ?? Date.now();
const masNuevoPrimero = (a, b) => fecha(b) - fecha(a);

// Guarda un spot nuevo (tipo "calle" o "garage") con estado "disponible".
export async function crearSpot(datos) {
  const ref = doc(spotsRef); // genera el id antes de guardar
  await setDoc(ref, {
    id: ref.id,
    ...datos,
    estado: "disponible",
    timestamp: serverTimestamp()
  });
  return ref.id;
}

// Escucha EN TIEMPO REAL los spots disponibles de un tipo.
// Devuelve la función para dejar de escuchar.
export function escucharSpotsDisponibles(tipo, onDatos, onError) {
  const q = query(spotsRef, where("estado", "==", "disponible"), where("tipo", "==", tipo));
  return onSnapshot(q, (snap) => {
    onDatos(snap.docs.map((d) => d.data()).sort(masNuevoPrimero));
  }, onError);
}

// Escucha las publicaciones del propio Ancla.
export function escucharMisSpots(uid, onDatos, onError) {
  const q = query(spotsRef, where("anclaId", "==", uid));
  return onSnapshot(q, (snap) => {
    onDatos(snap.docs.map((d) => d.data()).sort(masNuevoPrimero));
  }, onError);
}

export function reservarSpot(id) {
  return updateDoc(doc(db, "spots", id), { estado: "reservado" });
}

export function finalizarSpot(id) {
  return updateDoc(doc(db, "spots", id), { estado: "finalizado" });
}

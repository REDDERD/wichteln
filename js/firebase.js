// Zentrale Stelle für das Firebase SDK, damit die Version nur hier steht.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, initializeAuth, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Zweite Instanz, damit der Admin Teilnehmer-Konten anlegen und löschen kann,
// ohne dabei selbst abgemeldet zu werden.
let secondaryAuth = null;
export function getSecondaryAuth() {
  if (!secondaryAuth) {
    secondaryAuth = initializeAuth(initializeApp(firebaseConfig, 'secondary'), {
      persistence: inMemoryPersistence
    });
  }
  return secondaryAuth;
}

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

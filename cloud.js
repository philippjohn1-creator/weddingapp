/* Wedding – cloud.js
   Wird nur im Cloud-Modus per import() geladen.
   Firebase 10.14.1 als ES-Module von gstatic.com. */
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

let fbApp = null;
let fbAuth = null;
let fbDb = null;

const KONFIG_NAMEN = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

export function konfigurationOk() {
  const k = firebaseConfig || {};
  return KONFIG_NAMEN.every(function (n) {
    return typeof k[n] === 'string' && k[n].trim() !== '' && k[n].indexOf('HIER_EINFUEGEN') === -1;
  });
}

function starteFirebase() {
  if (fbApp) return;
  fbApp = initializeApp(firebaseConfig);
  fbAuth = getAuth(fbApp);
  try {
    // Offline-Cache aktivieren
    fbDb = initializeFirestore(fbApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (e) {
    // Fallback, falls der Cache nicht möglich ist
    fbDb = getFirestore(fbApp);
  }
}

function fehlerMitCode(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

function eigeneUid() {
  const u = fbAuth && fbAuth.currentUser;
  if (!u) throw fehlerMitCode('auth/no-user');
  return u.uid;
}

export function warteAufBenutzer() {
  starteFirebase();
  return new Promise(function (ok) {
    const aus = onAuthStateChanged(fbAuth, function (nutzer) {
      aus();
      ok(nutzer);
    });
  });
}

export async function anmeldenMitEmail(email, passwort) {
  starteFirebase();
  await signInWithEmailAndPassword(fbAuth, email, passwort);
}

export async function kontoErstellen(email, passwort) {
  starteFirebase();
  await createUserWithEmailAndPassword(fbAuth, email, passwort);
}

export async function resetMail(email) {
  starteFirebase();
  await sendPasswordResetEmail(fbAuth, email);
}

export async function abmeldenKonto() {
  starteFirebase();
  await signOut(fbAuth);
}

export function aktuelleUid() {
  return fbAuth && fbAuth.currentUser ? fbAuth.currentUser.uid : '';
}

export function aktuelleEmail() {
  return fbAuth && fbAuth.currentUser && fbAuth.currentUser.email ? fbAuth.currentUser.email : '';
}

/* Dokument: paare/{uid} mit den Feldern json (Text) und geaendert (Zahl) */
export async function ladeCloudDaten() {
  starteFirebase();
  const uid = eigeneUid();
  const schnappschuss = await getDoc(doc(fbDb, 'paare', uid));
  if (!schnappschuss.exists()) return null;
  const d = schnappschuss.data();
  return {
    json: typeof d.json === 'string' ? d.json : '',
    geaendert: Number(d.geaendert) || 0
  };
}

export async function speichereCloudDaten(jsonText, geaendert) {
  starteFirebase();
  const uid = eigeneUid();
  await setDoc(doc(fbDb, 'paare', uid), { json: String(jsonText), geaendert: Number(geaendert) || Date.now() });
}

// Mesma base do APK/Web Preview — sem mudanca de schema.
import { initializeApp } from "firebase/app";
import {
  collection, initializeFirestore, onSnapshot,
  query, QuerySnapshot, DocumentData,
} from "firebase/firestore";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBbeZ5M9iNgzw5382iCIDKB-G2QqKuwAes",
  authDomain: "agenda-id-seven.firebaseapp.com",
  projectId: "agenda-id-seven",
  storageBucket: "agenda-id-seven.firebasestorage.app",
  messagingSenderId: "391529908613",
  appId: "1:391529908613:web:ba62ed04ff7d0d776cdcec",
};

export const fbApp = initializeApp(FIREBASE_CONFIG);
// F3.3.10-FIX (atribuição em background) — no Electron MAIN (Node) o transporte WebChannel padrão do
// Firestore costuma entregar só o snapshot inicial e ESTAGNAR nas mudanças em tempo real → o notifier
// do main não dispara a atribuição com a janela minimizada/bandeja. Long-polling é o transporte
// confiável em Node: o notifier (que roda no main, NUNCA suspenso) passa a receber a atribuição em
// tempo real em background → Notification NATIVA. NÃO altera projeto/credenciais/regras do Firebase;
// é só o transporte do cliente. (Mesma base do APK/Web; sem mudança de schema/escrita.)
export const db = initializeFirestore(fbApp, { experimentalForceLongPolling: true });

export function listen<T extends DocumentData>(
  name: string,
  cb: (snap: QuerySnapshot<T>) => void
) {
  return onSnapshot(query(collection(db, name)) as any, (s: any) => cb(s as any));
}

// Mesma base do APK/Web Preview — sem mudanca de schema.
import { initializeApp } from "firebase/app";
import {
  collection, getFirestore, onSnapshot,
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
export const db = getFirestore(fbApp);

export function listen<T extends DocumentData>(
  name: string,
  cb: (snap: QuerySnapshot<T>) => void
) {
  return onSnapshot(query(collection(db, name)) as any, (s: any) => cb(s as any));
}

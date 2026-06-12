/**
 * Sessão persistente. Espelha a ideia do web: o "logado" é o ID do doc em `users`.
 * (O web guarda isso em localStorage "idseven_session"; aqui usamos AsyncStorage.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'idseven_session';

export async function getSessionUid(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function setSessionUid(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, uid);
  } catch {}
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {}
}

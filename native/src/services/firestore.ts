/**
 * Acesso ao MESMO Firestore do PWA (projeto agenda-id-seven), mesmas coleções.
 * O app web NÃO usa Firebase Auth — lê/escreve direto; o nativo faz igual, então
 * compartilham os dados sem quebrar o PWA. Não mudamos schema nem regras.
 */
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

export type AppUser = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  admin?: boolean;
  photo?: string;
  pass?: string;
  salt?: string;
  reminderMinutes?: number;
};

export type AppEvent = {
  id: string;
  type?: string;
  client?: string;
  title?: string;
  location?: string;
  date?: string; // "YYYY-MM-DD"
  start?: string; // "HH:MM"
  end?: string;
  owner?: string;
  ownerId?: string | null;
  notes?: string;
  done?: boolean;
  by?: string;
  createdAt?: number;
  reminderSentAt?: number;
};

// LAZY: não chamar firestore() no topo do módulo (evita crash nativo no boot,
// antes do React montar). Só inicializa quando uma função realmente é usada.
const db = () => firestore();

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const snap = await db()
    .collection('users')
    .where('email', '==', email.trim().toLowerCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return {id: d.id, ...(d.data() as object)} as AppUser;
}

export async function getUser(uid: string): Promise<AppUser | null> {
  const d = await db().collection('users').doc(uid).get();
  if (!d.exists) return null;
  return {id: d.id, ...(d.data() as object)} as AppUser;
}

export function listenEvents(
  onChange: (events: AppEvent[]) => void,
): () => void {
  return db().collection('events').onSnapshot(
    (snap: FirebaseFirestoreTypes.QuerySnapshot) => {
      const out: AppEvent[] = [];
      snap.forEach(doc => out.push({id: doc.id, ...(doc.data() as object)} as AppEvent));
      // ordena por data+hora ascendente
      out.sort((a, b) =>
        (`${a.date || ''} ${a.start || ''}`).localeCompare(`${b.date || ''} ${b.start || ''}`),
      );
      onChange(out);
    },
    () => onChange([]),
  );
}

export async function createEvent(
  data: Omit<AppEvent, 'id'>,
): Promise<string> {
  const ref = await db().collection('events').add({
    ...data,
    done: false,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateEvent(
  id: string,
  data: Partial<AppEvent>,
): Promise<void> {
  // Reagendou? limpa o estado de lembrete (mesma regra do web V64.5) p/ o Worker reenviar.
  await db().collection('events').doc(id).update({
    ...data,
    reminderSentAt: firestore.FieldValue.delete(),
  } as any);
}

export async function deleteEvent(id: string): Promise<void> {
  await db().collection('events').doc(id).delete();
}

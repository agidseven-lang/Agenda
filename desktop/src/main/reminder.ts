/**
 * ReminderScheduler — lembrete de 1h antes de compromissos do usuario logado.
 * Timer 1/min, janela [evento-60min, evento-60min+5min], dedupe local por docId.
 * NAO grava reminderSentAt no Firestore (isso e do Worker/Android; nao mexer).
 */
import { BrowserWindow } from "electron";
import { listen } from "./firebase";

type Ev = { id: string; title?: string; date?: string; start?: string; ownerId?: string; done?: boolean };
type NotifPayload = { eventType?: string; taskId?: string; taskTitle?: string; title?: string; body?: string; context?: string; createdAt?: number; severity?: "info" | "success" | "warning" | "critical"; sound?: boolean; action?: { type?: string; deep?: string }; dedupKey?: string; source?: string; providerCalled?: boolean; targetUserId?: string };
type Deliver = (p: NotifPayload) => unknown;
const MIN = 60_000;
const BEFORE_MS = 60 * MIN;
const WINDOW_MS = 5 * MIN;

function dtMs(date?: string, time?: string): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0).getTime();
}

export function startReminder(getWin: () => BrowserWindow | null, uid: string, deliver: Deliver) {
  let events: Ev[] = [];
  const fired = new Set<string>();

  const unsub = listen<Ev>("events", (snap) => {
    events = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  });

  const tick = () => {
    const now = Date.now();
    for (const e of events) {
      if (e.done) continue;
      if (e.ownerId !== uid) continue;
      const start = dtMs(e.date, e.start);
      if (!start) continue;
      const t = start - BEFORE_MS;
      if (now >= t && now < t + WINDOW_MS && !fired.has(e.id)) {
        fired.add(e.id);
        deliver({
          eventType: "event_reminder", source: "reminder", providerCalled: false,
          taskId: e.id, taskTitle: e.title || "compromisso", targetUserId: uid, createdAt: Date.now(),
          title: `Em 1h: ${e.title || "compromisso"}`,
          body: `${e.date || ""}${e.start ? " " + e.start : ""}`,
          context: "Agenda - lembrete", severity: "warning", sound: true,
          action: { type: "agenda", deep: "agenda" },
          dedupKey: `event_reminder:${e.id}`,
        });
      }
    }
  };
  const iv = setInterval(tick, MIN);
  // primeira passada apos 10s p/ pegar lembrete recem-elegivel
  const boot = setTimeout(tick, 10_000);
  return () => { unsub(); clearInterval(iv); clearTimeout(boot); };
}

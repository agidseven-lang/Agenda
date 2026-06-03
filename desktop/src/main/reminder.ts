/**
 * ReminderScheduler — lembrete de 1h antes de compromissos do usuario logado.
 * Timer 1/min, janela [evento-60min, evento-60min+5min], dedupe local por docId.
 * NAO grava reminderSentAt no Firestore (isso e do Worker/Android; nao mexer).
 */
import { Notification, BrowserWindow } from "electron";
import { listen } from "./firebase";

type Ev = { id: string; title?: string; date?: string; start?: string; ownerId?: string; done?: boolean };
const MIN = 60_000;
const BEFORE_MS = 60 * MIN;
const WINDOW_MS = 5 * MIN;

function dtMs(date?: string, time?: string): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0).getTime();
}

export function startReminder(getWin: () => BrowserWindow | null, uid: string) {
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
        const n = new Notification({
          title: `Em 1h: ${e.title || "compromisso"}`,
          body: `${e.date || ""}${e.start ? " " + e.start : ""}`,
          silent: false,
        });
        n.on("click", () => {
          const w = getWin();
          if (w) { w.show(); w.focus(); w.webContents.send("notif-open", "agenda"); }
        });
        n.show();
      }
    }
  };
  const iv = setInterval(tick, MIN);
  // primeira passada apos 10s p/ pegar lembrete recem-elegivel
  const boot = setTimeout(tick, 10_000);
  return () => { unsub(); clearInterval(iv); clearTimeout(boot); };
}

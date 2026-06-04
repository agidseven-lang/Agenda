/**
 * NotifierService — escuta Firestore em tempo real e dispara toasts nativos
 * do Windows enquanto o processo estiver vivo (janela / minimizado / tray).
 *
 * Regras (paridade com o APK, sem tocar backend):
 * - Tarefa atribuida: novo doc em `tasks` com assigneeId == meuUid e by != meuUid
 *   APOS o launch (eventos historicos sao ignorados via baseline).
 * - Compromisso para mim: novo doc em `events` com ownerId == meuUid e by != meuUid.
 * - Mensagem de chat: novo doc em qualquer subcolecao `messages` direcionada a mim
 *   (campo `to` ou `mentioned[]`), de outro remetente.
 * - Dedupe por (tipo + docId).
 */
import { Notification, BrowserWindow } from "electron";
import { listen } from "./firebase";

type Task = { id: string; title?: string; client?: string; sector?: string; assigneeId?: string; by?: string; createdAt?: number };
type Event = { id: string; title?: string; date?: string; start?: string; ownerId?: string; by?: string; createdAt?: number };

export type NotifierState = {
  uid: string;
  sinceMs: number;     // baseline — nao notifica nada anterior ao login
  seen: Set<string>;   // dedupe `${kind}:${id}`
};

export function startNotifier(getWin: () => BrowserWindow | null, uid: string) {
  const state: NotifierState = { uid, sinceMs: Date.now(), seen: new Set() };

  const fire = (kind: "task" | "event" | "chat", id: string, title: string, body: string, deep: string) => {
    const key = `${kind}:${id}`;
    if (state.seen.has(key)) return;
    state.seen.add(key);
    const n = new Notification({ title, body, silent: false });
    n.on("click", () => {
      const w = getWin();
      if (w) {
        if (w.isMinimized()) w.restore();
        w.show();
        w.focus();
        w.webContents.send("notif-open", deep);
      }
    });
    n.show();
  };

  // tasks: nova tarefa atribuida a mim
  const u1 = listen<Task>("tasks", (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type !== "added") return;
      const t = { id: ch.doc.id, ...(ch.doc.data() as any) } as Task;
      const created = Number(t.createdAt) || 0;
      if (created && created < state.sinceMs) return;          // historico
      if (!t.assigneeId || t.assigneeId !== state.uid) return; // nao e p/ mim
      if (t.by && t.by === state.uid) return;                  // eu mesmo criei
      const title = "Nova tarefa para voce";
      const body = (t.title || "Sem titulo") + (t.client ? ` - ${t.client}` : "");
      const deep = `board/${t.sector || ""}`;
      fire("task", t.id, title, body, deep);
    });
  });

  // tasks (modificadas): cronograma ENVIADO AO DESIGNER (reatribuicao) — notifica o designer.
  // Dedupe por designerAssignment.assignedAt para nao repetir em outras edicoes do doc.
  const u1b = listen<Task>("tasks", (snap) => {
    snap.docChanges().forEach((ch) => {
      // Cobre a reatribuicao ao vivo (modified) E o designer que ABRE o Desktop logo
      // apos ser escolhido (added na carga inicial). Dedupe por assignedAt garante 1
      // toast por atribuicao, sem repetir entre added/modified.
      if (ch.type !== "modified" && ch.type !== "added") return;
      const t = { id: ch.doc.id, ...(ch.doc.data() as any) } as any;
      const da = t.designerAssignment;
      if (!da || da.designerId !== state.uid) return;          // nao fui eu o designer escolhido
      if (da.assignedBy && da.assignedBy === state.uid) return;
      const at = Number(da.assignedAt) || 0;
      if (at && at < state.sinceMs) return;                    // atribuicao anterior ao login
      const key = `designer:${t.id}:${at}`;                    // 1 notificacao por atribuicao
      if (state.seen.has(key)) return;
      state.seen.add(key);
      const linha = `${t.client ? t.client + " — " : ""}${t.title || "Cronograma"}`;
      const n = new Notification({ title: "Novo cronograma atribuido", body: `${linha}\nAcesse para iniciar a producao.`, silent: false });
      n.on("click", () => { const w = getWin(); if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); w.webContents.send("notif-open", `board/${t.sector || ""}`); } });
      n.show();
    });
  });

  // events: novo compromisso para mim
  const u2 = listen<Event>("events", (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type !== "added") return;
      const e = { id: ch.doc.id, ...(ch.doc.data() as any) } as Event;
      const created = Number(e.createdAt) || 0;
      if (created && created < state.sinceMs) return;
      if (!e.ownerId || e.ownerId !== state.uid) return;
      if (e.by && e.by === state.uid) return;
      const title = "Novo compromisso";
      const body = (e.title || "Sem titulo") + (e.date ? ` - ${e.date}${e.start ? " " + e.start : ""}` : "");
      fire("event", e.id, title, body, "agenda");
    });
  });

  return () => { u1(); u1b(); u2(); };
}

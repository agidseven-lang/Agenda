/**
 * NotifierService — escuta Firestore em tempo real (READ-ONLY) e entrega eventos
 * ao HUB de notificações (main.ts), que decide TOAST in-app x NATIVA e faz dedup.
 *
 * Regras (paridade com o APK, sem tocar backend — zero write):
 * - Tarefa atribuida: novo doc em `tasks` com assigneeId == meuUid e by != meuUid
 *   APOS o launch (eventos historicos ignorados via baseline sinceMs).
 * - Cronograma atribuido ao designer: designerAssignment.designerId == meuUid.
 * - Compromisso para mim: novo doc em `events` com ownerId == meuUid e by != meuUid.
 * - Dedup por dedupKey (no HUB). NUNCA chama FCM/Web Push/WhatsApp/Firestore-write.
 */
import { BrowserWindow } from "electron";
import { listen } from "./firebase";

type Task = { id: string; title?: string; client?: string; sector?: string; assigneeId?: string; assignee?: string; assigneeName?: string; assigneePhoto?: string; by?: string; createdAt?: number };
type Event = { id: string; title?: string; date?: string; start?: string; ownerId?: string; by?: string; createdAt?: number };

export type NotifPayload = {
  eventId?: string; eventType?: string; taskId?: string; taskTitle?: string; clientName?: string;
  actorId?: string; actorName?: string; actorAvatar?: string;
  responsibleId?: string; responsibleName?: string; responsibleAvatar?: string;
  targetUserId?: string; notificationType?: string; etapa?: string; status?: string;
  title?: string; body?: string; context?: string; createdAt?: number;
  severity?: "info" | "success" | "warning" | "critical"; sound?: boolean;
  action?: { type?: string; deep?: string }; dedupKey?: string; source?: string; providerCalled?: boolean;
};
type Deliver = (p: NotifPayload) => unknown;

export type NotifierState = { uid: string; sinceMs: number };

export function startNotifier(getWin: () => BrowserWindow | null, uid: string, deliver: Deliver) {
  const state: NotifierState = { uid, sinceMs: Date.now() };

  // tasks: nova tarefa atribuida a mim
  const u1 = listen<Task>("tasks", (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type !== "added") return;
      const t = { id: ch.doc.id, ...(ch.doc.data() as any) } as Task;
      const created = Number(t.createdAt) || 0;
      if (created && created < state.sinceMs) return;          // historico
      if (!t.assigneeId || t.assigneeId !== state.uid) return; // nao e p/ mim
      if (t.by && t.by === state.uid) return;                  // eu mesmo criei
      deliver({
        eventType: "task_assigned", source: "notifier", providerCalled: false,
        taskId: t.id, taskTitle: t.title || "Sem titulo", clientName: t.client || "",
        // ATOR = quem atribuiu (criador); RESPONSAVEL = eu (assignee). IDs p/ o renderer
        // resolver foto/nome REAIS no diretorio (state.users). Avatar do toast NUNCA vem do titulo.
        actorId: t.by || "", responsibleId: t.assigneeId || "",
        responsibleName: t.assignee || t.assigneeName || "", responsibleAvatar: t.assigneePhoto || "",
        targetUserId: state.uid, createdAt: created || Date.now(),
        title: "Nova tarefa atribuida a voce",
        body: (t.title || "Sem titulo") + (t.client ? ` - ${t.client}` : ""),
        context: t.client ? `Tarefa - ${t.client}` : "Tarefa",
        severity: "info", sound: true,
        action: { type: "board", deep: `board/${t.sector || ""}` },
        dedupKey: `task_assigned:${t.id}`,
      });
    });
  });

  // tasks (added/modified): cronograma ENVIADO AO DESIGNER (atribuicao) — notifica o designer.
  // Dedup por assignedAt (1 toast por atribuicao; cobre added na carga e modified ao vivo).
  const u1b = listen<Task>("tasks", (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type !== "modified" && ch.type !== "added") return;
      const t = { id: ch.doc.id, ...(ch.doc.data() as any) } as any;
      const da = t.designerAssignment;
      if (!da || da.designerId !== state.uid) return;          // nao fui eu o designer escolhido
      if (da.assignedBy && da.assignedBy === state.uid) return;
      const at = Number(da.assignedAt) || 0;
      if (at && at < state.sinceMs) return;                    // atribuicao anterior ao login
      const linha = `${t.title || "Cronograma"}${t.client ? " — " + t.client : ""}`;
      const byName = da.assignedByName || "";
      deliver({
        eventType: "designer_assigned", source: "notifier", providerCalled: false,
        taskId: t.id, taskTitle: t.title || "Cronograma", clientName: t.client || "",
        // ATOR = Social/quem atribuiu (actorId = assignedBy p/ o renderer puxar a FOTO real);
        // RESPONSAVEL = designer (nome/foto denormalizados no proprio designerAssignment).
        actorId: da.assignedBy || "", actorName: byName, actorAvatar: da.assignedByAvatar || da.assignedByPhoto || "",
        responsibleId: da.designerId || "", responsibleName: da.designerName || "", responsibleAvatar: da.designerAvatar || da.designerPhoto || "",
        targetUserId: state.uid, createdAt: at || Date.now(), etapa: "Aguardando produção",
        // titulo nativo (app minimizado): personaliza se houver nome; o renderer reescreve no toast.
        title: byName ? `${byName} atribuiu uma tarefa` : "Nova tarefa atribuida a voce",
        body: `${linha}${da.designerName ? `\nResponsável: ${da.designerName}` : ""}\nEtapa: Aguardando produção`,
        context: t.client ? `Cronograma - ${t.client}` : "Cronograma",
        severity: "info", sound: true,
        action: { type: "board", deep: `board/${t.sector || ""}` },
        dedupKey: `designer_assigned:${t.id}:${at}`,
      });
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
      deliver({
        eventType: "event_new", source: "notifier", providerCalled: false,
        taskId: e.id, taskTitle: e.title || "Sem titulo", targetUserId: state.uid, createdAt: created || Date.now(),
        title: "Novo compromisso",
        body: (e.title || "Sem titulo") + (e.date ? ` - ${e.date}${e.start ? " " + e.start : ""}` : ""),
        context: "Agenda", severity: "info", sound: true,
        action: { type: "agenda", deep: "agenda" },
        dedupKey: `event_new:${e.id}`,
      });
    });
  });

  return () => { u1(); u1b(); u2(); };
}

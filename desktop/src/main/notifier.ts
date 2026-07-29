/**
 * NotifierService — escuta Firestore em tempo real (READ-ONLY) e entrega eventos
 * ao HUB de notificações (main.ts), que decide TOAST in-app x NATIVA e faz dedup.
 *
 * F3.5.3 — Os produtores FILTRADOS de tarefa (u1 task_assigned p/ o assignee, u1b
 * designer_assigned p/ o designer, u3 fluxo team_flow equipe+supervisão) foram
 * SUBSTITUÍDOS pelo produtor DURÁVEL da Categoria A (notifierA.ts): atribuição/
 * movimentação/conclusão/reabertura agora chegam a TODOS os usuários ativos (ator
 * incluído), com backlog/cursor/recibos persistentes — os filtros antigos que
 * impediam a entrega geral foram removidos AQUI e SOMENTE aqui (T-30/T-10 da
 * Categoria B seguem PESSOAIS em slaScheduler/slaRules/cardsRules, intocadas).
 *
 * Permanece NESTE arquivo apenas o produtor de AGENDA (event_new — novo compromisso
 * para mim), byte-equivalente ao aprovado. Read-side puro: NUNCA grava Firestore,
 * NUNCA chama FCM/Web Push/WhatsApp.
 */
import { BrowserWindow } from "electron";
import { listen } from "./firebase";
import { diag } from "./diag";

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

export function startNotifier(getWin: () => BrowserWindow | null, uid: string, deliver: Deliver, _getAuthUser?: () => ({ id: string; role?: string; admin?: boolean } | null)) {
  const state: NotifierState = { uid, sinceMs: Date.now() };
  diag("notifier.start", { uid, sinceMs: state.sinceMs, scope: "event_new-only(F3.5.3)" });

  // events: novo compromisso para mim (Agenda — fora da Categoria A; comportamento aprovado preservado)
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

  return () => { u2(); };
}

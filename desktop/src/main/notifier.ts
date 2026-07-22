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
import { diag } from "./diag";

// F3.4.4 — slaRules.js é CommonJS puro (sem .d.ts): require dinâmico (mesmo padrão do
// slaScheduler.ts); dist/main/slaRules.js é copiado pelo build (copy-renderer.js).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rules: any = require("./slaRules");

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

export function startNotifier(getWin: () => BrowserWindow | null, uid: string, deliver: Deliver, getAuthUser?: () => ({ id: string; role?: string; admin?: boolean } | null)) {
  const state: NotifierState = { uid, sinceMs: Date.now() };
  diag("notifier.start", { uid, sinceMs: state.sinceMs }); // F3.3.10-DIAG (só log)

  // F3.4.3 — DETECÇÃO POR TRANSIÇÃO (substitui o gate por horário `assignedAt < sinceMs`, que
  // HARD-DROPPAVA atribuições AO VIVO sob clock-skew entre máquinas). O produtor do MAIN passa a ser
  // AUTORITATIVO das 3 janelas (visível/minimizado/oculto). Baseline SEMEADO no 1º snapshot
  // (Firestore entrega o estado inicial como `added`): marca as atribuições EXISTENTES como vistas
  // SEM emitir; depois emite só TRANSIÇÕES novas/alteradas (mudança de designer OU novo assignedAt),
  // como o seed do renderer (notifScanAssign). NÃO hard-dropa por assignedAt ausente/incoerente.
  const lastDesignerId = new Map<string, string | null>(); // taskId -> designerId (para transição de designer)
  const lastAssignedAt = new Map<string, number>();        // taskId -> assignedAt (para re-envio ao MESMO designer)
  const lastAssigneeId = new Map<string, string | null>(); // taskId -> assigneeId (u1: task_assigned direto)
  let seededDa = false;
  let seededAsg = false;

  // tasks: TAREFA DIRETA atribuida a mim (assigneeId), sem designerAssignment p/ mim (u1b cobre esse).
  const u1 = listen<Task>("tasks", (snap) => {
    const firstRun = !seededAsg;
    snap.docChanges().forEach((ch) => {
      if (ch.type !== "added" && ch.type !== "modified" && ch.type !== "removed") return;
      if (ch.type === "removed") { lastAssigneeId.delete(ch.doc.id); return; }
      const t = { id: ch.doc.id, ...(ch.doc.data() as any) } as Task;
      const cur = (t.assigneeId != null ? String(t.assigneeId) : null);
      const prev = lastAssigneeId.has(t.id) ? lastAssigneeId.get(t.id) : undefined;
      lastAssigneeId.set(t.id, cur);
      if (firstRun) return;                                    // BASELINE SEED: marca sem emitir
      if (!cur || cur !== state.uid) return;                   // nao e p/ mim
      if (t.by && t.by === state.uid) return;                  // eu mesmo criei
      // F3.3.77A-R3 (Bloqueador 1) — PRODUTOR ÚNICO: se a tarefa já carrega um designerAssignment
      // PARA MIM, a atribuição é notificada UMA ÚNICA vez pelo ramo RICO designer_assigned (u1b).
      const _daT = (t as any).designerAssignment;
      if (_daT && _daT.designerId === state.uid) {
        diag("assignment.duplicate.blocked", { taskId: t.id, producer: "notifier.u1.task_assigned", canonical: "designer_assigned(u1b)" });
        return;
      }
      if (prev === cur) return;                                // sem transição (mesmo assignee) → não duplica
      const created = Number(t.createdAt) || 0;
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
        // F3.3.77A-R3 (FASE 4) — deep-link canônico para a TAREFA (paridade com o renderer e a azul rica).
        action: { type: "detail", deep: `detail/${t.id}` },
        dedupKey: `task_assigned:${t.id}`,
      });
    });
    if (firstRun) seededAsg = true;
  });

  // tasks (added/modified): cronograma ENVIADO AO DESIGNER (atribuicao) — notifica o designer.
  // TRANSIÇÃO de designerAssignment.designerId (ou novo assignedAt) = 1 azul por atribuição real.
  const u1b = listen<Task>("tasks", (snap) => {
    const firstRun = !seededDa;
    snap.docChanges().forEach((ch) => {
      if (ch.type !== "added" && ch.type !== "modified" && ch.type !== "removed") return;
      if (ch.type === "removed") { lastDesignerId.delete(ch.doc.id); lastAssignedAt.delete(ch.doc.id); return; }
      const t = { id: ch.doc.id, ...(ch.doc.data() as any) } as any;
      const da = t.designerAssignment || {};
      const cur = (da.designerId != null ? String(da.designerId) : null); // designer atual da tarefa
      const at = Number(da.assignedAt) || 0;
      const prev = lastDesignerId.has(t.id) ? lastDesignerId.get(t.id) : undefined;
      const prevAt = lastAssignedAt.has(t.id) ? lastAssignedAt.get(t.id) : undefined;
      lastDesignerId.set(t.id, cur);
      lastAssignedAt.set(t.id, at);
      if (firstRun) return;                                    // BASELINE SEED: marca sem emitir
      if (!cur || cur !== state.uid) return;                   // nao fui eu o designer escolhido
      if (da.assignedBy && da.assignedBy === state.uid) { diag("notifier.assign.skip", { taskId: t.id, reason: "self" }); return; }
      // NOVA/ALTERADA: mudança de designer (prev !== cur) OU novo assignedAt (re-envio ao mesmo
      // designer). Sem transição ⇒ não duplica. NÃO hard-dropa por assignedAt ausente (at pode ser 0).
      const changed = (prev !== cur) || (at !== prevAt);
      if (!changed) { diag("notifier.assign.skip", { taskId: t.id, reason: "no-change", designerId: cur, at }); return; }
      // F3.4.3 — dedupKey CANÔNICO (idêntico ao renderer quando há assignedAt): designer_assigned:
      // <taskId>:<designerId>:<assignedAtMs>; se assignedAt for falsy, cai p/ designer_assigned:
      // <taskId>:<designerId> (NÃO hard-dropa — o renderer descartava; o main, autoritativo, emite).
      const _canonKey = at ? `designer_assigned:${t.id}:${da.designerId || ""}:${at}` : `designer_assigned:${t.id}:${da.designerId || ""}`;
      diag("assignment.producer", { taskId: t.id, type: ch.type, designerId: da.designerId, assignedBy: da.assignedBy, at, producer: "notifier.u1b", dedupKey: _canonKey }); // F3.3.10-DIAG (só log)
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
        // F3.3.77A-R3 (FASE 4) — deep-link canônico p/ a TAREFA (abre o detalhe; paridade com o renderer).
        action: { type: "detail", deep: `detail/${t.id}` },
        dedupKey: _canonKey,
      });
    });
    if (firstRun) seededDa = true;
  });

  // F3.4.4 — tasks (added/modified/removed): MOVIMENTAÇÃO DE CARD (transição REAL de quadro/fase).
  // Produtor ÚNICO autoritativo no MAIN (o renderer não produz fluxo em paralelo — notifScan é no-op).
  // Contrato: fase canônica por tarefa (porte valor-idêntico em slaRules/deriveCanonicalTaskState) →
  // transição real (prev≠cur; seed do 1º snapshot NÃO emite; restart = novo seed sem histórico) →
  // identidade da TRANSIÇÃO CONCRETA (eventType:taskId:from>to:uid:carimbo autoritativo de
  // history[]/clientActions{}) → assinatura por tarefa (replay idêntico não repete; retorno B→A e
  // repetição legítima A→B SEMPRE emitem; NENHUM bloqueio vitalício por taskId) → deliver (HUB dedup).
  // Roteamento PRESERVADO (resolveNotificationTargets team_flow): equipe da tarefa + supervisão
  // (papel autenticado do main via getAuthUser — F3.4.3; sem authUser ⇒ sem privilégio vê-tudo).
  const flowDet = rules.createFlowDetector();
  const u3 = listen<Task>("tasks", (snap) => {
    const firstRun = !flowDet.isSeeded();
    snap.docChanges().forEach((ch) => {
      if (ch.type !== "added" && ch.type !== "modified" && ch.type !== "removed") return;
      if (ch.type === "removed") { flowDet.drop(ch.doc.id); return; }
      const t = { id: ch.doc.id, ...(ch.doc.data() as any) } as any;
      const ev = flowDet.scanDoc(t);                          // null durante o seed / sem transição real
      if (!ev) return;
      const au = (typeof getAuthUser === "function" ? getAuthUser() : null) || null;
      const seeAll = !!(au && rules.canSeeAllRole((au as any).role, (au as any).admin));
      const p = rules.flowEmissionFor(t, state.uid, seeAll, ev);
      diag("flow.producer", { taskId: t.id, type: ch.type, from: ev.fromPhase, to: ev.toPhase, stamp: ev.stamp, emitted: !!p, dedupKey: (p && p.dedupKey) || "", producer: "notifier.u3" });
      if (p) deliver(p as NotifPayload);
    });
    if (firstRun) flowDet.sealSeed();                         // BASELINE SEED: 1º snapshot marca sem emitir
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

  return () => { u1(); u1b(); u3(); u2(); };
}

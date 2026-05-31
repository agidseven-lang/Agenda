/* ============================================================================
   ID Seven — Cloud Functions (Firestore Trigger) — push IMEDIATO ao responsável
   ============================================================================
   Por que existe: o push imediato NÃO pode depender do app cliente chamar
   /notify-assignee (frágil: rede/Doze no aparelho de quem cria) nem só do CRON
   do Worker (latência de até ~60s). Este gatilho dispara no servidor em ~1-2s
   ao CRIAR um evento/tarefa e envia FCM de alta prioridade ao responsável.

   Escopo: somente itens criados pelo app nativo (src == "nativebeta"), para não
   duplicar com o fluxo do PWA. Dedupe via campo immediateNotifiedAt (mesmo campo
   usado pelo Worker /notify-assignee e pelo IMMEDIATE-FALLBACK), então as três
   camadas coordenam e não duplicam.

   Credenciais: usa as credenciais padrão do runtime de Functions (admin SDK).
   NENHUM segredo no código. Requer plano Blaze para deploy.
   ============================================================================ */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const TTL_MS = 600000; // 10 min — alinhado ao ttl "600s" do Worker

/* mantém 1 token por deviceId (mais recente) + dedup — igual ao Worker. */
function dedupeTokensByDevice(tokens, meta) {
  if (!Array.isArray(tokens)) return [];
  meta = (meta && typeof meta === "object") ? meta : {};
  const byDevice = {};
  const noMeta = [];
  for (const t of tokens) {
    if (!t) continue;
    const m = meta[t];
    if (m && m.deviceId) {
      const ts = (m.lastSeenAt || m.createdAt || 0);
      if (!byDevice[m.deviceId] || ts >= byDevice[m.deviceId].ts) byDevice[m.deviceId] = { token: t, ts };
    } else {
      noMeta.push(t);
    }
  }
  const out = Object.keys(byDevice).map((k) => byDevice[k].token).concat(noMeta);
  return Array.from(new Set(out.filter(Boolean)));
}

/* Monta título/corpo + data payload (strings) — compatível com o app nativo
   (AppFirebaseMessagingService lê data.deepLink / eventId / taskId). */
function buildMessageData(type, id, doc) {
  const titleBase = (type === "task") ? "Nova tarefa atribuída" : "Novo compromisso atribuído";
  const title = doc.title || doc.client || titleBase;
  const when = [doc.date || doc.dueDate, (doc.start || doc.dueTime)].filter(Boolean).join(" ");
  const body = (type === "task")
    ? ("Tarefa para você" + (when ? " · vence " + when : ""))
    : ("Compromisso para você" + (when ? " · " + when : ""));
  const responsibleId = (type === "task") ? (doc.assigneeId || "") : (doc.ownerId || "");
  const data = {
    type: type,
    eventId: (type === "event") ? id : "",
    taskId: (type === "task") ? id : "",
    title: title,
    body: body,
    responsibleId: String(responsibleId),
    createdBy: String(doc.by || ""),
    scheduledAt: String(doc.date || doc.dueDate || ""),
    // Aditivos p/ o app do responsavel agendar o lembrete premium de 1h (T-60min):
    scheduledDate: String(doc.date || doc.dueDate || ""),
    scheduledTime: String((type === "task") ? (doc.dueTime || "") : (doc.start || "")),
    deepLink: type + ":" + id,
  };
  for (const k of Object.keys(data)) data[k] = String(data[k] == null ? "" : data[k]);
  return { title, body, data };
}

/* Núcleo: notifica o responsável de um item recém-criado (idempotente). */
async function notifyResponsible(type, coll, id, doc) {
  if (!doc) return;
  if (doc.src !== "nativebeta") return;                 // só itens do app nativo (evita double com PWA)
  if (doc.immediateNotifiedAt) return;                  // dedupe (já notificado por outra camada)
  if (type === "event" && doc.done) return;
  if (type === "task" && doc.status === "concluido") return;

  const responsibleId = (type === "task") ? (doc.assigneeId || null) : (doc.ownerId || null);
  if (!responsibleId) return;

  const db = admin.firestore();
  const ref = db.collection(coll).doc(id);

  // Não notificar o próprio criador; marca p/ não reprocessar.
  if (responsibleId === (doc.by || null)) {
    await ref.set({ immediateNotifiedAt: Date.now(), immediateNotifyResult: "auto-atribuicao (skip)" }, { merge: true });
    return;
  }

  const userSnap = await db.collection("users").doc(responsibleId).get();
  const user = userSnap.exists ? userSnap.data() : null;
  const tokens = dedupeTokensByDevice(
    (user && Array.isArray(user.fcmTokens)) ? user.fcmTokens.filter(Boolean) : [],
    user && user.fcmTokenMeta
  );

  if (!tokens.length) {
    logger.warn(`[TRIGGER] ${type}/${id} -> ${responsibleId}: responsavel sem token`);
    await ref.set({ immediateNotifiedAt: Date.now(), immediateNotifyResult: "responsavel sem token" }, { merge: true });
    return;
  }

  const { data } = buildMessageData(type, id, doc);
  let sent = 0, reason = "";
  try {
    const resp = await admin.messaging().sendEachForMulticast({
      tokens: tokens,
      data: data,
      android: { priority: "high", ttl: TTL_MS },
    });
    sent = resp.successCount;
    reason = `sent ${sent}/${tokens.length}`;
  } catch (e) {
    reason = "erro FCM: " + (e && e.message ? e.message : String(e));
    logger.error(`[TRIGGER] ${type}/${id} -> ${responsibleId}: ${reason}`);
  }
  logger.info(`[TRIGGER] ${type}/${id} -> ${responsibleId}: ${reason}`);
  await ref.set({ immediateNotifiedAt: Date.now(), immediateNotifyResult: reason }, { merge: true });
}

exports.onEventCreated = onDocumentCreated("events/{eventId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  try {
    await notifyResponsible("event", "events", event.params.eventId, snap.data());
  } catch (e) {
    logger.error("[TRIGGER] onEventCreated falhou:", e && e.message);
  }
});

exports.onTaskCreated = onDocumentCreated("tasks/{taskId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  try {
    await notifyResponsible("task", "tasks", event.params.taskId, snap.data());
  } catch (e) {
    logger.error("[TRIGGER] onTaskCreated falhou:", e && e.message);
  }
});

/* ============================================================================
   CHAT — push IMEDIATO ao destinatario de uma mensagem nova
   ----------------------------------------------------------------------------
   Schema (igual ao PWA): chats/{chatId} { participants[], isGroup, ... } e
   subcolecao chats/{chatId}/messages/{messageId} { text, by, at, readBy }.
   Destinatario = participants - remetente (by). Escopo src=="nativebeta": o PWA
   ja faz o proprio push ao enviar, entao so notificamos as mensagens do app
   nativo, evitando duplicidade. Dedupe via immediateNotifiedAt na mensagem.
   ========================================================================== */

/* Previa curta e segura do corpo da notificacao (audio/midia detectados de
   forma defensiva; schema atual e texto). Preserva emoji; limita tamanho. */
function chatPreview(msg) {
  const t = String(msg.type || msg.kind || msg.mediaType || "").toLowerCase();
  if (msg.audioUrl || t.indexOf("audio") >= 0 || t === "voice") return "🎤 Enviou um áudio";
  const raw = String(msg.text || "").replace(/\s+/g, " ").trim();
  if (!raw) {
    if (msg.imageUrl || msg.mediaUrl || t.indexOf("image") >= 0) return "📷 Enviou uma imagem";
    if (msg.fileUrl || msg.attachment) return "📎 Enviou um anexo";
    return "Nova mensagem";
  }
  return raw.length > 120 ? (raw.slice(0, 120) + "…") : raw;
}

/* data payload (strings) para o app nativo. deepLink "chat:<senderId>" abre a
   conversa correta (rota chatThread/{otherId}, onde otherId = remetente). */
function buildChatData(senderName, msg, chatId, messageId, senderId) {
  const title = (senderName && senderName.trim()) ? senderName.trim() : "Nova mensagem";
  const data = {
    type: "chat",
    chatId: chatId,
    conversationId: chatId,
    messageId: messageId,
    senderId: String(senderId || ""),
    title: title,
    body: chatPreview(msg),
    sentAt: String(msg.at || ""),    // carimbo p/ o modal premium pos-clique (aditivo)
    deepLink: "chat:" + String(senderId || ""),
  };
  for (const k of Object.keys(data)) data[k] = String(data[k] == null ? "" : data[k]);
  return data;
}

async function notifyChatMessage(chatId, messageId, msg) {
  if (!msg) return;
  if (msg.src !== "nativebeta") return;      // PWA ja faz seu push; evita duplicidade
  if (msg.immediateNotifiedAt) return;       // dedupe (retry/reprocesso)
  const senderId = msg.by || null;
  if (!senderId) return;

  const db = admin.firestore();
  const msgRef = db.collection("chats").doc(chatId).collection("messages").doc(messageId);

  const chatSnap = await db.collection("chats").doc(chatId).get();
  const chat = chatSnap.exists ? chatSnap.data() : null;
  const participants = (chat && Array.isArray(chat.participants)) ? chat.participants : [];
  const recipients = participants.filter((u) => u && u !== senderId);   // ignora auto-notificacao
  if (!recipients.length) {
    await msgRef.set({ immediateNotifiedAt: Date.now(), immediateNotifyResult: "sem destinatario" }, { merge: true });
    return;
  }

  let senderName = "";
  try {
    const su = await db.collection("users").doc(senderId).get();
    if (su.exists) { const d = su.data(); senderName = String(d.name || d.nome || ""); }
  } catch (_) { /* nome e opcional */ }

  const results = [];
  for (const rid of recipients) {
    try {
      const us = await db.collection("users").doc(rid).get();
      const u = us.exists ? us.data() : null;
      const tokens = dedupeTokensByDevice(
        (u && Array.isArray(u.fcmTokens)) ? u.fcmTokens.filter(Boolean) : [],
        u && u.fcmTokenMeta
      );
      if (!tokens.length) {
        logger.warn(`[TRIGGER] chat/${messageId} -> ${rid}: sem token`);
        results.push(`${rid}: sem token`);
        continue;
      }
      const data = buildChatData(senderName, msg, chatId, messageId, senderId);
      const resp = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        data: data,
        android: { priority: "high", ttl: TTL_MS },
      });
      logger.info(`[TRIGGER] chat/${messageId} -> ${rid}: sent ${resp.successCount}/${tokens.length}`);
      results.push(`${rid}: sent ${resp.successCount}/${tokens.length}`);
    } catch (e) {
      const m = "erro FCM: " + (e && e.message ? e.message : String(e));
      logger.error(`[TRIGGER] chat/${messageId} -> ${rid}: ${m}`);
      results.push(`${rid}: ${m}`);
    }
  }
  await msgRef.set({ immediateNotifiedAt: Date.now(), immediateNotifyResult: results.join("; ") }, { merge: true });
}

exports.onChatMessageCreated = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  try {
    await notifyChatMessage(event.params.chatId, event.params.messageId, snap.data());
  } catch (e) {
    logger.error("[TRIGGER] onChatMessageCreated falhou:", e && e.message);
  }
});

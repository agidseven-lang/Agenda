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
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("node:crypto");

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

  // F3.3.20-B1.4-B — gating OPCIONAL por preferencias. SO roda com ENABLE_NOTIF_PREFS=true
  // (flag OFF => este bloco e ignorado e o comportamento e identico ao atual). Evento
  // opcional (task_assigned/event_assigned). Erro ao ler prefs => envia (fail-safe).
  // Eventos criticos NAO passam por aqui (nao sao emitidos por este trigger).
  const eventType = (type === "task") ? "task_assigned" : "event_assigned";
  if (notifFlag("ENABLE_NOTIF_PREFS")) {
    let allow = true;
    try { allow = await shouldNotifyByPrefs(responsibleId, eventType, "android"); } catch (_) { allow = true; }
    if (!allow) {
      logger.info(`[TRIGGER] ${type}/${id} -> ${responsibleId}: suprimido por prefs`);
      // preserva o dedup (immediateNotifiedAt) p/ o fallback/CRON NAO reenviar.
      await ref.set({ immediateNotifiedAt: Date.now(), immediateNotifyResult: "suprimido por prefs" }, { merge: true });
      if (notifFlag("ENABLE_NOTIF_LOG")) { try { await writeNotifLog({ taskId: (type === "task" ? id : ""), eventType: eventType, to: responsibleId, channel: "fcm", sent: 0, total: tokens.length, reason: "suppressed_by_prefs" }); } catch (_) {} }
      return;
    }
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
  if (notifFlag("ENABLE_NOTIF_LOG")) { try { await writeNotifLog({ taskId: (type === "task" ? id : ""), eventType: eventType, to: responsibleId, channel: "fcm", sent: sent, total: tokens.length, reason: reason }); } catch (_) {} }
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
      // F3.3.20-B1.4-B — gating OPCIONAL por DESTINATARIO (so com ENABLE_NOTIF_PREFS=true;
      // flag OFF => ignorado). Suprime apenas ESTE destinatario; os demais seguem normais.
      if (notifFlag("ENABLE_NOTIF_PREFS")) {
        let allowRid = true;
        try { allowRid = await shouldNotifyByPrefs(rid, "chat_message", "android"); } catch (_) { allowRid = true; }
        if (!allowRid) {
          results.push(`${rid}: suprimido por prefs`);
          if (notifFlag("ENABLE_NOTIF_LOG")) { try { await writeNotifLog({ taskId: "", eventType: "chat_message", to: rid, channel: "fcm", sent: 0, total: tokens.length, reason: "suppressed_by_prefs" }); } catch (_) {} }
          continue;
        }
      }
      const data = buildChatData(senderName, msg, chatId, messageId, senderId);
      const resp = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        data: data,
        android: { priority: "high", ttl: TTL_MS },
      });
      logger.info(`[TRIGGER] chat/${messageId} -> ${rid}: sent ${resp.successCount}/${tokens.length}`);
      results.push(`${rid}: sent ${resp.successCount}/${tokens.length}`);
      if (notifFlag("ENABLE_NOTIF_LOG")) { try { await writeNotifLog({ taskId: "", eventType: "chat_message", to: rid, channel: "fcm", sent: resp.successCount, total: tokens.length, reason: "sent " + resp.successCount + "/" + tokens.length }); } catch (_) {} }
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

/* ============================================================================
   Redefinicao AUTONOMA de senha por codigo de e-mail (1.0.39+)
   ----------------------------------------------------------------------------
   Por que existe: o app usa auth propria via Firestore (sem Firebase Auth),
   entao nao podemos usar sendPasswordResetEmail. Aqui o backend gera codigo,
   envia por e-mail (Resend), valida e troca a senha (mesmo padrao
   "s2:"+sha256Hex(salt|pw)) — tudo sem depender de admin.

   Variaveis necessarias no projeto Functions:
     - RESEND_API_KEY      (SECRET — Firebase Secret Manager)
     - RESET_EMAIL_FROM    (env, ex.: "no-reply@dominio.com.br")
     - RESET_EMAIL_FROM_NAME (env, opcional, default: "ID Seven Agenda")
     - RESET_EMAIL_PROVIDER (env, opcional, default: "resend")
   Sem RESEND_API_KEY ou RESET_EMAIL_FROM, a funcao registra erro no log
   ("config-missing") e devolve resposta GENERICA ao cliente — sem inventar
   envio falso.

   Seguranca:
     - Codigo numerico de 6 digitos, salvo APENAS como hash sha256.
     - TTL 15 minutos. Limite 5 tentativas por codigo. Rate-limit 60s/e-mail.
     - Resposta sempre generica para nao revelar existencia do e-mail.
     - Logs nao contem o codigo nem a senha em texto puro.
     - Codigos vivem em passwordResetCodes (apenas Admin SDK escreve).
   ============================================================================ */
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const RESET_EMAIL_FROM = defineString("RESET_EMAIL_FROM", { default: "" });
const RESET_EMAIL_FROM_NAME = defineString("RESET_EMAIL_FROM_NAME", { default: "ID Seven Agenda" });
const RESET_EMAIL_PROVIDER = defineString("RESET_EMAIL_PROVIDER", { default: "resend" });

const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const REQUEST_RATE_LIMIT_MS = 60 * 1000;

function sha256Hex(s) { return crypto.createHash("sha256").update(s, "utf8").digest("hex"); }
function hashPw(pw, salt) { return "s2:" + sha256Hex(`${salt}|${pw}`); }
function randSalt() { return crypto.randomBytes(16).toString("hex"); }
function genCode() {
  // 6 digitos com fonte cripto-segura uniformemente distribuida.
  // 4 bytes => 32 bits; range 0..0xFFFFFFFF. Rejeicao para evitar bias modular.
  const MAX = 0x100000000;
  const LIM = MAX - (MAX % 1000000);
  let n;
  do { n = crypto.randomBytes(4).readUInt32BE(); } while (n >= LIM);
  return String(n % 1000000).padStart(6, "0");
}
function normEmail(e) { return String(e || "").trim().toLowerCase(); }
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

async function sendResetCodeEmail({ to, code, fromAddress, fromName, apiKey }) {
  if (RESET_EMAIL_PROVIDER.value() !== "resend") {
    throw new Error(`provider "${RESET_EMAIL_PROVIDER.value()}" nao suportado`);
  }
  const subject = "Seu codigo de redefinicao de senha";
  const text =
    "Use o codigo abaixo no app ID Seven Agenda para redefinir sua senha.\n\n" +
    `Codigo: ${code}\n\n` +
    "Validade: 15 minutos.\n" +
    "Se voce nao solicitou, ignore este e-mail — sua senha permanece a mesma.";
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">' +
    '<h2 style="margin:0 0 12px">ID Seven Agenda</h2>' +
    "<p>Use o codigo abaixo no app para redefinir sua senha.</p>" +
    '<div style="font-size:32px;font-weight:700;letter-spacing:6px;padding:14px 18px;background:#f3f4f6;border-radius:8px;text-align:center">' +
    code + "</div>" +
    '<p style="color:#555;font-size:13px;margin-top:14px">Validade: <b>15 minutos</b>. ' +
    "Se voce nao solicitou, <b>ignore este e-mail</b> — sua senha permanece a mesma.</p></div>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
      to: [to], subject, text, html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`resend ${res.status}: ${detail.slice(0, 200)}`);
  }
}

const GENERIC_REQUEST_OK = { ok: true, message: "Se o e-mail estiver cadastrado, enviaremos um codigo de redefinicao." };

// Busca o codigo de reset mais recente de um e-mail SEM exigir indice composto.
// Query so por igualdade em `email` (campo auto-indexado) e ordena em memoria.
// Evita FAILED_PRECONDITION por falta de indice (email ASC + createdAt DESC),
// que era a causa do app cair no addOnFailureListener.
async function latestResetCodeDoc(db, email) {
  const snap = await db.collection("passwordResetCodes").where("email", "==", email).get();
  if (snap.empty) return null;
  let best = null;
  for (const doc of snap.docs) {
    const c = doc.get("createdAt") || 0;
    if (!best || c > best.c) best = { doc, c };
  }
  return best ? best.doc : null;
}

exports.requestPasswordReset = onCall(
  { secrets: [RESEND_API_KEY], region: "us-central1", maxInstances: 5 },
  async (req) => {
    // Validacao severa de payload pode lancar (cliente trata). Todo o resto eh
    // blindado: qualquer erro tecnico vira log + retorno generico, para o app
    // NUNCA cair no addOnFailureListener por causa controlavel.
    const email = normEmail(req && req.data && req.data.email);
    if (!isValidEmail(email)) throw new HttpsError("invalid-argument", "E-mail invalido.");

    try {
      const apiKey = RESEND_API_KEY.value();
      const fromAddress = RESET_EMAIL_FROM.value();
      const PLACEHOLDER = "PLACEHOLDER_NOT_CONFIGURED_RUN_setup_password_reset_provider";
      if (!apiKey || !fromAddress || apiKey === PLACEHOLDER) {
        logger.error("password-reset:config-missing", {
          hasApiKey: !!apiKey,
          apiKeyIsPlaceholder: apiKey === PLACEHOLDER,
          hasFrom: !!fromAddress,
          hint: "Rode o job CI setup_password_reset_provider (push com [setup-reset]) com as vars protegidas RESEND_API_KEY e RESET_EMAIL_FROM no GitLab.",
        });
        return GENERIC_REQUEST_OK;
      }

      const db = admin.firestore();
      const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (usersSnap.empty) {
        logger.info("password-reset:not-found", { email });
        return GENERIC_REQUEST_OK;
      }
      const userDoc = usersSnap.docs[0];
      const status = userDoc.get("status");
      if (status === "removido" || status === "excluido" || status === "pendente") {
        logger.info("password-reset:user-not-eligible", { email, status });
        return GENERIC_REQUEST_OK;
      }

      // Rate-limit por e-mail: 60s desde o ultimo codigo gerado (sem indice composto).
      const last = await latestResetCodeDoc(db, email);
      if (last) {
        const lastAt = last.get("createdAt") || 0;
        if (Date.now() - lastAt < REQUEST_RATE_LIMIT_MS) {
          logger.warn("password-reset:rate-limited", { email });
          return GENERIC_REQUEST_OK;
        }
      }

      const code = genCode();
      const now = Date.now();
      await db.collection("passwordResetCodes").add({
        email, userId: userDoc.id, codeHash: sha256Hex(code),
        createdAt: now, expiresAt: now + CODE_TTL_MS,
        usedAt: null, attempts: 0, status: "pending", source: "nativebeta",
      });

      try {
        await sendResetCodeEmail({
          to: email, code, fromAddress,
          fromName: RESET_EMAIL_FROM_NAME.value(), apiKey,
        });
        logger.info("password-reset:email-sent", { email });
      } catch (e) {
        // Resend rejeitou (dominio nao verificado, remetente invalido, etc).
        logger.error("password-reset:resend-rejected", { error: String(e && e.message).slice(0, 300) });
      }
      return GENERIC_REQUEST_OK;
    } catch (e) {
      // Erro tecnico inesperado (Firestore/indice/permissao): loga e responde
      // generico — o usuario nao ve detalhe e o app nao cai no failure listener.
      logger.error("password-reset:function-error", { error: String(e && e.message).slice(0, 300) });
      return GENERIC_REQUEST_OK;
    }
  }
);

exports.confirmPasswordReset = onCall(
  { region: "us-central1", maxInstances: 5 },
  async (req) => {
    const d = (req && req.data) || {};
    const email = normEmail(d.email);
    const code = String(d.code || "").trim();
    const newPassword = String(d.newPassword || "");
    if (!isValidEmail(email)) throw new HttpsError("invalid-argument", "E-mail invalido.");
    if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Codigo invalido. Verifique o e-mail.");
    if (newPassword.length < 6) throw new HttpsError("invalid-argument", "A nova senha precisa ter pelo menos 6 caracteres.");

    const db = admin.firestore();
    let codeDoc;
    try {
      codeDoc = await latestResetCodeDoc(db, email); // sem indice composto
    } catch (e) {
      logger.error("password-reset:function-error", { phase: "confirm-query", error: String(e && e.message).slice(0, 300) });
      throw new HttpsError("internal", "Não foi possível redefinir a senha agora. Tente novamente em instantes.");
    }
    if (!codeDoc) throw new HttpsError("not-found", "Codigo nao encontrado. Solicite um novo.");
    const data = codeDoc.data() || {};

    if (data.usedAt) throw new HttpsError("failed-precondition", "Codigo ja utilizado. Solicite um novo.");
    if ((data.attempts || 0) >= CODE_MAX_ATTEMPTS) {
      throw new HttpsError("resource-exhausted", "Limite de tentativas atingido. Solicite um novo codigo.");
    }
    if (Date.now() > (data.expiresAt || 0)) {
      throw new HttpsError("deadline-exceeded", "Codigo expirado. Solicite um novo.");
    }
    if (data.codeHash !== sha256Hex(code)) {
      await codeDoc.ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
      throw new HttpsError("permission-denied", "Codigo incorreto.");
    }

    const userRef = db.collection("users").doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError("not-found", "Conta nao encontrada.");
    const status = userSnap.get("status");
    if (status === "removido" || status === "excluido") {
      throw new HttpsError("failed-precondition", "Conta inativa.");
    }

    const salt = randSalt();
    const pass = hashPw(newPassword, salt);
    await userRef.update({
      pass, salt,
      mustChangePassword: false,
      passwordChangedAt: Date.now(),
    });
    await codeDoc.ref.update({ usedAt: Date.now(), status: "used" });
    logger.info("password-reset:confirmed", { email });
    return { ok: true };
  }
);

/* ============================================================================
   Endpoints HTTPS onRequest (1.0.42+) — fluxo de reset usado pelo APP.
   ----------------------------------------------------------------------------
   Motivo: o app caia no addOnFailureListener da Callable (transporte/invoker
   Gen2 sem Firebase Auth). Endpoints onRequest com HttpURLConnection no Android
   eliminam o protocolo callable. Mesma logica/seguranca; respostas JSON
   controladas com HTTP 200 para nao enumerar usuario.
   URLs:
     POST https://us-central1-agenda-id-seven.cloudfunctions.net/requestPasswordResetHttp
     POST https://us-central1-agenda-id-seven.cloudfunctions.net/confirmPasswordResetHttp
   ============================================================================ */
function applyCommonHeaders(res) {
  res.set("Content-Type", "application/json; charset=utf-8");
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}
function readJsonBody(req) {
  // onRequest ja faz body-parsing de application/json em req.body;
  // fallback defensivo para string.
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

exports.requestPasswordResetHttp = onRequest(
  { secrets: [RESEND_API_KEY], region: "us-central1", maxInstances: 5, cors: true },
  async (req, res) => {
    applyCommonHeaders(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED" }); return; }

    const body = readJsonBody(req);
    const email = normEmail(body.email);
    if (!isValidEmail(email)) {
      // Amigavel e generico; nao revela nada. 200 para o app nunca "quebrar".
      res.status(200).json({ ok: true, delivered: false });
      return;
    }

    try {
      const apiKey = RESEND_API_KEY.value();
      const fromAddress = RESET_EMAIL_FROM.value();
      const PLACEHOLDER = "PLACEHOLDER_NOT_CONFIGURED_RUN_setup_password_reset_provider";
      if (!apiKey || !fromAddress || apiKey === PLACEHOLDER) {
        logger.error("password-reset:config-missing", {
          hasApiKey: !!apiKey, apiKeyIsPlaceholder: apiKey === PLACEHOLDER, hasFrom: !!fromAddress,
          hint: "Rode setup_password_reset_provider (push [setup-reset]) com RESEND_API_KEY e RESET_EMAIL_FROM no GitLab.",
        });
        res.status(200).json({ ok: true, delivered: false });
        return;
      }

      const db = admin.firestore();
      const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (usersSnap.empty) {
        logger.info("password-reset:not-found", { email });
        res.status(200).json({ ok: true, delivered: false });
        return;
      }
      const userDoc = usersSnap.docs[0];
      const status = userDoc.get("status");
      if (status === "removido" || status === "excluido" || status === "pendente") {
        logger.info("password-reset:user-not-eligible", { email, status });
        res.status(200).json({ ok: true, delivered: false });
        return;
      }

      const last = await latestResetCodeDoc(db, email);
      if (last) {
        const lastAt = last.get("createdAt") || 0;
        if (Date.now() - lastAt < REQUEST_RATE_LIMIT_MS) {
          logger.warn("password-reset:rate-limited", { email });
          res.status(200).json({ ok: true, delivered: false });
          return;
        }
      }

      const code = genCode();
      const now = Date.now();
      await db.collection("passwordResetCodes").add({
        email, userId: userDoc.id, codeHash: sha256Hex(code),
        createdAt: now, expiresAt: now + CODE_TTL_MS,
        usedAt: null, attempts: 0, status: "pending", source: "nativebeta",
      });

      try {
        await sendResetCodeEmail({
          to: email, code, fromAddress, fromName: RESET_EMAIL_FROM_NAME.value(), apiKey,
        });
        logger.info("password-reset:email-sent", { email });
        res.status(200).json({ ok: true, delivered: true });
      } catch (e) {
        logger.error("password-reset:resend-rejected", { error: String(e && e.message).slice(0, 300) });
        res.status(200).json({ ok: true, delivered: false });
      }
    } catch (e) {
      logger.error("password-reset:function-error", { error: String(e && e.message).slice(0, 300) });
      res.status(200).json({ ok: true, delivered: false });
    }
  }
);

exports.confirmPasswordResetHttp = onRequest(
  { region: "us-central1", maxInstances: 5, cors: true },
  async (req, res) => {
    applyCommonHeaders(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED" }); return; }

    const body = readJsonBody(req);
    const email = normEmail(body.email);
    const code = String(body.code || "").trim();
    const newPassword = String(body.newPassword || "");
    if (!isValidEmail(email)) { res.status(200).json({ ok: false, code: "INVALID_EMAIL", message: "E-mail inválido." }); return; }
    if (!/^\d{6}$/.test(code)) { res.status(200).json({ ok: false, code: "INVALID_CODE", message: "Código inválido. Verifique o e-mail." }); return; }
    if (newPassword.length < 6) { res.status(200).json({ ok: false, code: "WEAK_PASSWORD", message: "A nova senha precisa ter pelo menos 6 caracteres." }); return; }

    try {
      const db = admin.firestore();
      const codeDoc = await latestResetCodeDoc(db, email);
      if (!codeDoc) { res.status(200).json({ ok: false, code: "NO_CODE", message: "Código não encontrado. Solicite um novo." }); return; }
      const data = codeDoc.data() || {};

      if (data.usedAt) { res.status(200).json({ ok: false, code: "USED", message: "Código já utilizado. Solicite um novo." }); return; }
      if ((data.attempts || 0) >= CODE_MAX_ATTEMPTS) { res.status(200).json({ ok: false, code: "TOO_MANY", message: "Limite de tentativas atingido. Solicite um novo código." }); return; }
      if (Date.now() > (data.expiresAt || 0)) { res.status(200).json({ ok: false, code: "EXPIRED", message: "Código expirado. Solicite um novo." }); return; }
      if (data.codeHash !== sha256Hex(code)) {
        await codeDoc.ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
        res.status(200).json({ ok: false, code: "INVALID_CODE", message: "Código incorreto." });
        return;
      }

      const userRef = db.collection("users").doc(data.userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) { res.status(200).json({ ok: false, code: "NO_USER", message: "Conta não encontrada." }); return; }
      const status = userSnap.get("status");
      if (status === "removido" || status === "excluido") { res.status(200).json({ ok: false, code: "INACTIVE", message: "Conta inativa." }); return; }

      const salt = randSalt();
      const pass = hashPw(newPassword, salt);
      await userRef.update({ pass, salt, mustChangePassword: false, passwordChangedAt: Date.now() });
      await codeDoc.ref.update({ usedAt: Date.now(), status: "used" });
      logger.info("password-reset:confirmed", { email });
      res.status(200).json({ ok: true });
    } catch (e) {
      logger.error("password-reset:function-error", { phase: "confirm-http", error: String(e && e.message).slice(0, 300) });
      res.status(200).json({ ok: false, code: "INTERNAL", message: "Não foi possível redefinir a senha agora. Tente novamente em instantes." });
    }
  }
);

/* ============================================================================
   Higiene de passwordResetCodes (1.0.45+, backend-only, NAO toca o app).
   ----------------------------------------------------------------------------
   Apaga apenas codigos JA consumidos/expirados ha mais que a janela de
   retencao. Codigos pendentes ainda validos sao PRESERVADOS.
     - usados:    apaga quando usedAt    < agora - RETENTION_MS
     - expirados: apaga quando expiresAt < agora - RETENTION_MS
   Idempotente (re-rodar nao causa efeito colateral). Lote limitado por
   execucao (custo previsivel). Logs SO com contadores — sem e-mail/codigo/
   hash/uid. Agenda diaria 03:30 America/Fortaleza.

   Modo dry-run: defina a env CLEANUP_DRY_RUN=true (NAO apaga; so conta) — usado
   pelo smoke test local scripts/cleanup-dry-run.mjs.
   ============================================================================ */
const CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000; // 24h
const CLEANUP_MAX_DOCS = 500;                      // teto por execucao

// Logica pura, testavel: decide se um doc deve ser apagado dada a hora atual.
// Exportada para o dry-run. NAO recebe/loga dado sensivel (so timestamps/status).
function shouldDeleteResetCode(data, now, retentionMs) {
  if (!data) return false;
  const cutoff = now - retentionMs;
  const usedAt = typeof data.usedAt === "number" ? data.usedAt : null;
  const expiresAt = typeof data.expiresAt === "number" ? data.expiresAt : null;
  // usado ha mais que a retencao
  if (usedAt !== null && usedAt < cutoff) return true;
  // expirado ha mais que a retencao (e nao usado, ou usado sem timestamp)
  if (expiresAt !== null && expiresAt < cutoff) return true;
  return false;
}

async function runCleanup({ dryRun }) {
  const db = admin.firestore();
  const now = Date.now();
  const snap = await db.collection("passwordResetCodes").limit(CLEANUP_MAX_DOCS).get();
  let scanned = 0; let deleted = 0; let skipped = 0; let errors = 0;
  let batch = db.batch(); let pending = 0;
  for (const doc of snap.docs) {
    scanned++;
    let del = false;
    try {
      del = shouldDeleteResetCode(doc.data(), now, CLEANUP_RETENTION_MS);
    } catch (_) { errors++; continue; }
    if (!del) { skipped++; continue; }
    if (dryRun) { deleted++; continue; }
    batch.delete(doc.ref); pending++; deleted++;
    if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
  }
  if (!dryRun && pending > 0) await batch.commit();
  // Logs SO com contadores (sem dados sensiveis).
  logger.info("cleanup-reset-codes", { dryRun: !!dryRun, scanned, deleted, skipped, errors, retentionHours: 24, max: CLEANUP_MAX_DOCS });
  return { scanned, deleted, skipped, errors };
}

exports.cleanupPasswordResetCodes = onSchedule(
  { schedule: "30 3 * * *", timeZone: "America/Fortaleza", region: "us-central1", maxInstances: 1 },
  async () => {
    const dryRun = String(process.env.CLEANUP_DRY_RUN || "").toLowerCase() === "true";
    try {
      await runCleanup({ dryRun });
    } catch (e) {
      logger.error("cleanup-reset-codes:error", { error: String(e && e.message).slice(0, 200) });
    }
  }
);

// Exporta logica pura para o smoke test local (nao afeta o runtime das Functions).
exports._shouldDeleteResetCode = shouldDeleteResetCode;

/* ============================================================================
   F3.3.20-B1.1-A — BASE SERVER-SIDE DORMENTE p/ notifPrefs / notifLog.
   ----------------------------------------------------------------------------
   Objetivo: estabelecer helpers server-side (service account / admin SDK) para,
   no FUTURO, respeitar preferencias de notificacao (notifPrefs/{uid}) e gravar
   auditoria de envio (notifLog/{autoId}) — SEM mudar o comportamento atual.

   SEGURANCA / DORMENCIA:
   - Flags OFF por padrao: ENABLE_NOTIF_PREFS / ENABLE_NOTIF_LOG. Qualquer valor
     diferente de "true" (case-insensitive) = OFF.
   - Com as flags OFF: getNotifPrefs => null, shouldNotifyByPrefs => true,
     writeNotifLog => no-op. Ou seja, comportamento atual 100% identico.
   - Estes helpers NAO sao chamados por nenhum trigger/relay nesta fase (base
     dormente). A integracao real fica para uma fase futura (autorizada).
   - Best-effort: nunca lancam; nunca bloqueiam envio nem fluxo de negocio.
   - Nao usam request.auth.uid (rodam por service account / admin SDK).
   - Nao tocam fcmTokens / fcmTokenMeta / clientPushSubs nem o dedup por deviceId
     (dedupeTokensByDevice). So LEEM notifPrefs e GRAVAM notifLog server-side.
   - Escrita client-side continua barrada pelas Firestore Rules Opcao B; estes
     helpers rodam server-side (admin SDK ignora rules).
   ============================================================================ */
function notifFlag(name) {
  // Defensivo: somente "true" (case-insensitive) liga a flag; qualquer outra coisa = OFF.
  return String((typeof process !== "undefined" && process.env && process.env[name]) || "").toLowerCase() === "true";
}
// Indirecao p/ o Firestore (testabilidade). Em producao = admin.firestore().
function notifDb() { return admin.firestore(); }

// (1) Le notifPrefs/{uid}. Dormente: flag OFF => null. Sem doc => null.
//     Erro de leitura => null (fallback seguro). null SEMPRE significa
//     "comportamento atual preservado" para quem consome.
async function getNotifPrefs(uid) {
  if (!notifFlag("ENABLE_NOTIF_PREFS")) return null;
  if (!uid) return null;
  try {
    const snap = await notifDb().collection("notifPrefs").doc(String(uid)).get();
    if (!snap || !snap.exists) return null;
    return snap.data() || null;
  } catch (e) {
    try { logger.warn("[notifPrefs] leitura falhou (fallback seguro)", { uid: String(uid), err: e && e.message }); } catch (_) {}
    return null;
  }
}

// (2) Decide se deve notificar conforme as prefs. Defaults SEGUROS:
//     - flag OFF          => true (nunca suprime; comportamento atual)
//     - sem doc           => true (comportamento atual preservado)
//     - erro              => true (nunca bloqueia)
//     - enabled === false => false (opt-out explicito; SO com a flag ON)
//   Schema canonico do writer (notifValidatePrefs/updateNotifPrefs):
//     - byEvent[eventType]   === false => false (suprime aquele evento)
//     - byPlatform[platform] === false => false (suprime aquela plataforma)
//   Fallback legacy defensivo (docs antigos; nao dominante):
//     - mutedEvents[eventType] === true  => false
//     - platforms[platform]    === false => false
//   Campo/chave ausente => permissivo (nao suprime). quietHours NAO e aplicado
//   nesta fase (exige timezone; fase futura B1.7-E-QUIETHOURS) — ignorado de
//   forma permissiva/segura.
async function shouldNotifyByPrefs(uid, eventType, platform) {
  if (!notifFlag("ENABLE_NOTIF_PREFS")) return true;
  let prefs = null;
  try { prefs = await getNotifPrefs(uid); } catch (_) { return true; }
  if (!prefs) return true;
  if (prefs.enabled === false) return false;
  // schema canonico (writer)
  if (eventType && prefs.byEvent && prefs.byEvent[eventType] === false) return false;
  if (platform && prefs.byPlatform && prefs.byPlatform[platform] === false) return false;
  // fallback legacy (docs antigos)
  if (eventType && prefs.mutedEvents && prefs.mutedEvents[eventType] === true) return false;
  if (platform && prefs.platforms && prefs.platforms[platform] === false) return false;
  return true;
}

// (3) Grava notifLog/{autoId} best-effort. Dormente: flag OFF => no-op.
//     NUNCA lanca; NUNCA bloqueia envio/fluxo. Retorna {written, skipped?}.
//     Payload normalizado: so IDs tecnicos + contadores (sem PII sensivel).
async function writeNotifLog(entry) {
  if (!notifFlag("ENABLE_NOTIF_LOG")) return { written: false, skipped: "flag_off" };
  try {
    const e = entry || {};
    const atMs = (e.at != null ? e.at : Date.now());
    const doc = {
      taskId:    String(e.taskId    != null ? e.taskId    : ""),
      eventType: String(e.eventType != null ? e.eventType : ""),
      to:        String(e.to        != null ? e.to        : ""),
      channel:   String(e.channel   != null ? e.channel   : ""),
      sent:      Number.isFinite(+e.sent)  ? +e.sent  : 0,
      total:     Number.isFinite(+e.total) ? +e.total : 0,
      reason:    String(e.reason     != null ? e.reason   : ""),
      at:        atMs,
      expireAt:  admin.firestore.Timestamp.fromMillis(atMs + NOTIF_LOG_TTL_MS),   // B1.7-E: Timestamp (TTL nativo do Firestore exige Timestamp); retencao 30 dias
    };
    await notifDb().collection("notifLog").add(doc);
    return { written: true };
  } catch (e) {
    try { logger.warn("[notifLog] gravacao falhou (best-effort, ignorada)", { err: e && e.message }); } catch (_) {}
    return { written: false, skipped: "error" };
  }
}

// Exporta logica pura para o harness local (NAO afeta o runtime; helpers ficam
// dormentes — nenhum trigger os chama nesta fase).
exports._notifFlag = notifFlag;
exports._getNotifPrefs = getNotifPrefs;
exports._shouldNotifyByPrefs = shouldNotifyByPrefs;
exports._writeNotifLog = writeNotifLog;

/* ============================================================================
   F3.3.20-B1.5-B — HARDENING (ainda DORMENTE; prepara deploy seguro).
   ----------------------------------------------------------------------------
   - NOTIF_PREFS_SECRET via Secret Manager (defineSecret), bound SOMENTE em
     updateNotifPrefs/issueNotifPrefsToken. Sem o segredo => process.env vazio
     => 503 (dormente). notifPrefsSecret()/notifFlag() continuam lendo process.env
     (v2 injeta o segredo bound em process.env; harness seta process.env).
   - Flags continuam via process.env: DEFAULT OFF garantido (ausente/≠"true" => false).
     NUNCA "true" no codigo; ativacao so via env de runtime no deploy controlado.
   - notifLog ganha expireAt (retencao 30 dias, server-side) p/ TTL nativo do Firestore.
   - Rate-limit IN-MEMORY (best-effort, por instancia; SEM Firestore; sem PII) do
     emissor: por uid+IP, NOTIF_RL_MAX falhas invalidas / janela => bloqueio temporario.
   ============================================================================ */
const NOTIF_PREFS_SECRET = defineSecret("NOTIF_PREFS_SECRET");
// B1.7-E — CORS allowlist (origins reais do app; SEM wildcard). Browser/PWA precisa de
// preflight; Electron/native nao (CORS so e imposto pelo browser). Usado pelos endpoints
// notifPrefs e auth/fcm (onRequest cors:); nao toca triggers, flags, secret binding nem Web Push.
// F3.3.34 — inclui canais de PREVIEW do Firebase Hosting via RegExp ANCORADA (^...$), casando
// SOMENTE https://agenda-id-seven--<channel>.web.app (channel = [a-z0-9-]+). Sem wildcard: nao
// casa dominios parecidos (ex.: ...web.app.evil.com), http://, subdominios extras nem outros
// hosts. O framework (onRequest cors) reflete SO o origin casado e aplica a TODAS as respostas.
const NOTIF_CORS_ORIGINS = ["https://agendaidseven.com.br", "https://agenda-id-seven.web.app", "https://agenda-id-seven.firebaseapp.com", /^https:\/\/agenda-id-seven--[a-z0-9-]+\.web\.app$/];
const NOTIF_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 dias
const NOTIF_RL_MAX = 5;                               // tentativas invalidas
const NOTIF_RL_WINDOW_MS = 5 * 60 * 1000;            // janela de contagem
const NOTIF_RL_BLOCK_MS = 15 * 60 * 1000;           // bloqueio/backoff
const __notifRlState = new Map();                    // key -> {fails, first, until} (volatil; sem PII)
function notifRlBlocked(key, now) { const s = __notifRlState.get(key); return !!(s && s.until && now < s.until); }
function notifRlFail(key, now) {
  let s = __notifRlState.get(key);
  if (!s || (now - s.first) >= NOTIF_RL_WINDOW_MS) s = { fails: 0, first: now };
  s.fails += 1;
  if (s.fails >= NOTIF_RL_MAX) s.until = now + NOTIF_RL_BLOCK_MS;
  __notifRlState.set(key, s);
}
function notifRlClear(key) { __notifRlState.delete(key); }

/* ============================================================================
   F3.3.20-B1.2 — ENDPOINT server-side AUTENTICADO p/ notifPrefs/{uid}.
   ----------------------------------------------------------------------------
   - Autenticacao por TOKEN ASSINADO (HMAC-SHA256). Usa onRequest (NAO onCall) =>
     NAO depende de request.auth.uid; o uid vem do token verificado, nao do corpo.
   - Gate de dormencia: sem NOTIF_PREFS_SECRET no ambiente => 503 (inerte). Em
     producao o segredo NAO esta setado e a funcao NAO esta deployada nesta fase.
   - Escreve SOMENTE em notifPrefs/{uid} (merge). NUNCA toca users/{uid},
     fcmTokens, fcmTokenMeta, clientPushSubs nem o dedup por deviceId.
   - notifPrefs continua SEM efeito em producao enquanto ENABLE_NOTIF_PREFS=OFF
     (shouldNotifyByPrefs da B1.1-A retorna true). Gravar pref e inocuo ate ligar.
   - Cliente NAO grava direto (Rules Opcao B barram). Usuario nao altera prefs de
     outro uid (token.uid != alvo => 403), salvo token com admin:true (server).
   - NAO integrado ao Desktop; SEM UI. So a base do endpoint + validacao/normalizacao.
   ============================================================================ */
function notifPrefsSecret() {
  return String((typeof process !== "undefined" && process.env && process.env.NOTIF_PREFS_SECRET) || "");
}
// Verifica "payloadB64url.sigB64url" (HMAC-SHA256 sobre o payloadB64url).
// Retorna {ok:true, uid, admin} ou {ok:false, code, error}. NAO usa request.auth.uid.
function notifVerifyToken(authHeader, secret, nowMs) {
  if (!secret) return { ok: false, code: 503, error: "endpoint_disabled" };
  const m = /^Bearer\s+(.+)$/.exec(String(authHeader || "").trim());
  if (!m) return { ok: false, code: 401, error: "missing_token" };
  const parts = m[1].split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, code: 401, error: "malformed_token" };
  let expected, got;
  try {
    expected = crypto.createHmac("sha256", secret).update(parts[0]).digest();
    got = Buffer.from(parts[1], "base64url");
  } catch (_) { return { ok: false, code: 401, error: "bad_sig" }; }
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return { ok: false, code: 401, error: "bad_sig" };
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch (_) { return { ok: false, code: 401, error: "bad_claims" }; }
  if (!claims || typeof claims.uid !== "string" || !claims.uid) return { ok: false, code: 401, error: "no_uid" };
  if (typeof claims.exp === "number" && nowMs > claims.exp) return { ok: false, code: 401, error: "expired" };
  return { ok: true, uid: claims.uid, admin: claims.admin === true };
}
// Valida + normaliza o corpo. Campos aceitos: enabled(bool), byEvent(map bool),
// byPlatform(map bool), quietHours({start,end} "HH:MM" | null). updatedAt e SEMPRE
// server-side (ignora o do cliente). Retorna {ok:true, value} ou {ok:false, error}.
function notifValidatePrefs(input, nowMs) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "body_not_object" };
  const ALLOWED = ["enabled", "byEvent", "byPlatform", "quietHours"];
  const keys = Object.keys(input).filter((k) => k !== "uid");
  const unknown = keys.filter((k) => ALLOWED.indexOf(k) < 0);
  if (unknown.length) return { ok: false, error: "unknown_fields:" + unknown.join(",") };
  if (!keys.length) return { ok: false, error: "empty_update" };
  const isBoolMap = (o) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).every((k) => typeof o[k] === "boolean");
  const out = {};
  if ("enabled" in input) {
    if (typeof input.enabled !== "boolean") return { ok: false, error: "enabled_not_boolean" };
    out.enabled = input.enabled;
  }
  if ("byEvent" in input) { if (!isBoolMap(input.byEvent)) return { ok: false, error: "byEvent_invalid" }; out.byEvent = Object.assign({}, input.byEvent); }
  if ("byPlatform" in input) { if (!isBoolMap(input.byPlatform)) return { ok: false, error: "byPlatform_invalid" }; out.byPlatform = Object.assign({}, input.byPlatform); }
  if ("quietHours" in input) {
    const q = input.quietHours;
    if (q === null) { out.quietHours = null; }
    else {
      const hhmm = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
      if (!q || typeof q !== "object" || Array.isArray(q) || !hhmm(q.start) || !hhmm(q.end)) return { ok: false, error: "quietHours_invalid" };
      out.quietHours = { start: q.start, end: q.end };
    }
  }
  out.updatedAt = (typeof nowMs === "number" ? nowMs : Date.now());
  return { ok: true, value: out };
}
// Orquestra a atualizacao. ctx = {method, authHeader, body, now}. Escreve SO em
// notifPrefs/{uid}. Retorna {status, json}. Erros sempre controlados (sem throw).
async function handleNotifPrefsUpdate(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  if (ctx.method && String(ctx.method).toUpperCase() !== "POST") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  const auth = notifVerifyToken(ctx.authHeader, notifPrefsSecret(), now);
  if (!auth.ok) return { status: auth.code, json: { ok: false, error: auth.error } };
  const body = ctx.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, json: { ok: false, error: "body_not_object" } };
  const targetUid = (typeof body.uid === "string" && body.uid) ? body.uid : auth.uid;
  if (targetUid !== auth.uid && !auth.admin) return { status: 403, json: { ok: false, error: "forbidden_uid" } };
  const val = notifValidatePrefs(body, now);
  if (!val.ok) return { status: 400, json: { ok: false, error: val.error } };
  try {
    await notifDb().collection("notifPrefs").doc(String(targetUid)).set(val.value, { merge: true });
  } catch (e) {
    try { logger.error("[updateNotifPrefs] gravacao falhou", { uid: String(targetUid), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "write_failed" } };
  }
  return { status: 200, json: { ok: true, uid: targetUid, prefs: val.value } };
}

// Wrapper HTTPS (onRequest => NAO usa request.auth.uid). DORMENTE: sem
// NOTIF_PREFS_SECRET => 503. NAO deployado nesta fase; NAO integrado ao Desktop/UI.
exports.updateNotifPrefs = onRequest({ secrets: [NOTIF_PREFS_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // B1.7-E preflight: sem auth, sem segredo, sem Firestore
  try {
    const out = await handleNotifPrefsUpdate({
      method: req.method,
      authHeader: (req.get && req.get("authorization")) || "",
      body: req.body,
      now: Date.now(),
    });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[updateNotifPrefs] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});

// Exporta logica pura p/ o harness (NAO afeta runtime; endpoint dormente/sem deploy).
exports._notifVerifyToken = notifVerifyToken;
exports._notifValidatePrefs = notifValidatePrefs;
exports._handleNotifPrefsUpdate = handleNotifPrefsUpdate;

/* ============================================================================
   F3.3.20-B1.3-B — EMISSOR server-side de TOKEN HMAC p/ notifPrefs (dormente).
   ----------------------------------------------------------------------------
   - Em Functions (NAO no Worker => Worker/Cloudflare permanece diff-zero).
   - HTTPS onRequest (NAO onCall) => NAO depende de request.auth.uid.
   - Prova de identidade = a SENHA REAL do usuario interno (mesmo modelo do login):
     "s2:" + SHA-256(salt|senha) atual + djb2 legado; comparacao em tempo constante.
   - ACESSO (corrigido): qualquer usuario INTERNO VALIDO emite token p/ SI MESMO —
     Social, Designer e Admin. NAO ha gate de role (nao bloqueia Designer). Cliente
     externo/link publico NAO entra (nao possui users/{uid} com senha). Usuario
     inativo (status pendente/removido/excluido) e rejeitado.
   - Token: payloadB64url.sigB64url (HMAC-SHA256 sobre o payloadB64url) — formato
     IDENTICO ao verificado pela B1.2. Claims: {uid, admin, scope, iat, exp}.
   - admin:true SOMENTE se o registro do proprio usuario marca admin===true.
   - DORMENTE: sem NOTIF_PREFS_SECRET => 503. So LE o registro do usuario; NAO escreve
     no Firestore. NUNCA persiste/loga a senha; NUNCA loga o token completo nem o segredo.
   ============================================================================ */
const NOTIF_TOKEN_TTL_MS = 15 * 60 * 1000;   // 15 min (TTL curto; acao interativa)
function notifMaskUid(v) { const s = String(v || ""); return s ? (s.slice(0, 3) + "…") : "(vazio)"; }
function notifDjb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return "h" + (h >>> 0); }
// Comparacao em tempo constante: digere ambos os lados (=> mesmo tamanho, sem early-exit).
function notifTimingSafeEq(a, b) {
  const da = crypto.createHash("sha256").update(String(a)).digest();
  const db = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(da, db);
}
// Espelha o verifyPw do app: "s2:"+SHA-256(salt|senha) atual; djb2 legado. Nunca loga a senha.
function notifVerifyPassword(pass, salt, pw) {
  if (!pass) return false;
  if (salt && String(pass).startsWith("s2:")) {
    const h = "s2:" + crypto.createHash("sha256").update(String(salt) + "|" + String(pw)).digest("hex");
    return notifTimingSafeEq(pass, h);
  }
  return notifTimingSafeEq(pass, notifDjb2(String(pw)));   // credenciais legadas (djb2)
}
// Assina o token no MESMO formato que a B1.2 (notifVerifyToken) verifica.
function notifSignToken(claims, secret) {
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const s = crypto.createHmac("sha256", secret).update(p).digest().toString("base64url");
  return p + "." + s;
}
// Orquestra a emissao. ctx = {method, body, now}. So LE users/{uid} (sem escrita).
async function handleIssueNotifPrefsToken(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  if (ctx.method && String(ctx.method).toUpperCase() !== "POST") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  if (!notifPrefsSecret()) return { status: 503, json: { ok: false, error: "endpoint_disabled" } };
  const body = ctx.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, json: { ok: false, error: "body_not_object" } };
  const uid = (typeof body.uid === "string") ? body.uid.trim() : "";
  const password = (typeof body.password === "string") ? body.password : "";
  if (!uid) return { status: 400, json: { ok: false, error: "missing_uid" } };
  if (!password) return { status: 400, json: { ok: false, error: "missing_password" } };
  // B1.5-B — rate-limit IN-MEMORY (best-effort; SEM Firestore) por uid + IP.
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ["u:" + uid].concat(ip ? ["i:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  let snap;
  try { snap = await notifDb().collection("users").doc(uid).get(); }
  catch (e) {
    try { logger.error("[issueNotifPrefsToken] leitura falhou", { uid: notifMaskUid(uid), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "lookup_failed" } };
  }
  // uid desconhecido OU senha errada => MESMO 401 generico (nao revela existencia do uid).
  if (!snap || !snap.exists) { rlKeys.forEach((k) => notifRlFail(k, now)); return { status: 401, json: { ok: false, error: "invalid_credentials" } }; }
  const u = snap.data() || {};
  if (!notifVerifyPassword(u.pass, u.salt, password)) { rlKeys.forEach((k) => notifRlFail(k, now)); return { status: 401, json: { ok: false, error: "invalid_credentials" } }; }
  // Inativo => 403 (checado SO apos a senha correta, p/ nao vazar estado a quem nao a tem).
  const st = String(u.status || "");
  if (st === "pendente" || st === "removido" || st === "excluido") return { status: 403, json: { ok: false, error: "user_inactive" } };
  rlKeys.forEach((k) => notifRlClear(k));   // sucesso de credenciais: zera o rate-limit do uid/IP
  // Token p/ o PROPRIO uid provado (nunca aceita uid alvo). admin:true so se o registro marcar.
  const isAdmin = (u.admin === true);
  const claims = { uid: uid, admin: isAdmin, scope: "notifPrefs:write", iat: now, exp: now + NOTIF_TOKEN_TTL_MS };
  const token = notifSignToken(claims, notifPrefsSecret());
  try { logger.info("[issueNotifPrefsToken] emitido", { uid: notifMaskUid(uid), admin: isAdmin, exp: claims.exp }); } catch (_) {}
  return { status: 200, json: { ok: true, token: token, uid: uid, admin: isAdmin, scope: claims.scope, exp: claims.exp } };
}

// Wrapper HTTPS (onRequest => NAO usa request.auth.uid). DORMENTE: sem NOTIF_PREFS_SECRET
// => 503. NAO deployado nesta fase; NAO integrado ao Desktop/UI.
exports.issueNotifPrefsToken = onRequest({ secrets: [NOTIF_PREFS_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // B1.7-E preflight: sem auth, sem segredo, sem Firestore
  try {
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleIssueNotifPrefsToken({ method: req.method, body: req.body, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[issueNotifPrefsToken] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});

// Exporta logica pura p/ o harness (NAO afeta runtime; emissor dormente/sem deploy).
exports._notifVerifyPassword = notifVerifyPassword;
exports._notifSignToken = notifSignToken;
exports._handleIssueNotifPrefsToken = handleIssueNotifPrefsToken;

/* ============================================================================
   F3.3.20-B1.7-E — SELF-READ allowlisted de notifPrefs/{uid} (getNotifPrefs).
   ----------------------------------------------------------------------------
   - onRequest (NAO onCall) => uid vem SO do token HMAC verificado (mesmo token de
     updateNotifPrefs; notifVerifyToken nao exige scope). NUNCA do body/query.
   - Le SOMENTE notifPrefs/{token.uid}. NUNCA le users/{uid}; NUNCA retorna campos
     sensiveis do usuario (tokens de push, telefone, hash de senha, e-mail, papel)
     nem o uid. Saida = allowlist EXPLICITA (campo a campo; nunca espalha o doc cru).
   - INDEPENDENTE de ENABLE_NOTIF_PREFS (a flag governa SUPRESSAO de envio, nao a
     visualizacao). Por isso NAO reusa getNotifPrefs(uid) interno (flag-gated).
   - Dormente sem NOTIF_PREFS_SECRET => 503. Cache-Control: no-store. Log sem PII.
   ============================================================================ */
function notifProjectPrefsOut(d) {
  const src = (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
  const out = {};
  if (typeof src.enabled === "boolean") out.enabled = src.enabled;
  const pickBoolMap = (o) => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const m = {}; for (const k of Object.keys(o)) { if (typeof o[k] === "boolean") m[k] = o[k]; } return m;
  };
  const be = pickBoolMap(src.byEvent); if (be) out.byEvent = be;
  const bp = pickBoolMap(src.byPlatform); if (bp) out.byPlatform = bp;
  if (src.quietHours === null) out.quietHours = null;
  else if (src.quietHours && typeof src.quietHours === "object" && !Array.isArray(src.quietHours)
           && typeof src.quietHours.start === "string" && typeof src.quietHours.end === "string") {
    out.quietHours = { start: src.quietHours.start, end: src.quietHours.end };
  }
  if (typeof src.updatedAt === "number") out.updatedAt = src.updatedAt;
  else if (src.updatedAt && typeof src.updatedAt.toMillis === "function") { try { out.updatedAt = src.updatedAt.toMillis(); } catch (_) {} }
  return out;
}
// Orquestra a LEITURA self-read. ctx = {method, authHeader, uid?(defensivo), ip?, now}.
// Le SO notifPrefs/{token.uid}. Erros sempre controlados (sem throw).
async function handleNotifPrefsRead(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  if (ctx.method && String(ctx.method).toUpperCase() !== "GET") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  const ipKey = (typeof ctx.ip === "string" && ctx.ip) ? ("r:" + ctx.ip) : null;
  if (ipKey && notifRlBlocked(ipKey, now)) return { status: 429, json: { ok: false, error: "rate_limited" } };
  const auth = notifVerifyToken(ctx.authHeader, notifPrefsSecret(), now);
  if (!auth.ok) { if (ipKey) notifRlFail(ipKey, now); return { status: auth.code, json: { ok: false, error: auth.error } }; }
  if (ipKey) notifRlClear(ipKey);
  // Cross-read impossivel por contrato: alvo = token.uid. Parametro defensivo opcional:
  const askedUid = (typeof ctx.uid === "string" && ctx.uid) ? ctx.uid : null;
  if (askedUid && askedUid !== auth.uid) return { status: 403, json: { ok: false, error: "forbidden_uid" } };
  let snap;
  try { snap = await notifDb().collection("notifPrefs").doc(String(auth.uid)).get(); }
  catch (e) {
    try { logger.error("[getNotifPrefs] leitura falhou", { err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "read_failed" } };
  }
  if (!snap || !snap.exists) return { status: 200, json: { ok: true, exists: false, prefs: {} } };
  return { status: 200, json: { ok: true, exists: true, prefs: notifProjectPrefsOut(snap.data() || {}) } };
}
// Wrapper HTTPS (onRequest). DORMENTE: sem NOTIF_PREFS_SECRET => 503 (via notifVerifyToken).
// Self-read allowlisted; NAO toca users/{uid}; Cache-Control: no-store; NAO loga token/segredo/PII.
exports.getNotifPrefs = onRequest({ secrets: [NOTIF_PREFS_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo, sem Firestore
  const t0 = Date.now();
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleNotifPrefsRead({
      method: req.method,
      authHeader: (req.get && req.get("authorization")) || "",
      uid: (req.query && typeof req.query.uid === "string") ? req.query.uid : null,
      ip: clientIp,
      now: Date.now(),
    });
    try { logger.info("[getNotifPrefs]", { status: out.status, exists: !!(out.json && out.json.exists), durationMs: Date.now() - t0, error: (out.json && out.json.ok === false) ? out.json.error : "" }); } catch (_) {}
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[getNotifPrefs] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});

// Exporta logica pura p/ o harness (NAO afeta runtime; endpoint dormente/sem deploy).
exports._handleNotifPrefsRead = handleNotifPrefsRead;
exports._notifProjectPrefsOut = notifProjectPrefsOut;

/* ============================================================================
   F3.3.20-B1.7-E — LOGIN server-side (Slice 1): exports.loginUser.
   ----------------------------------------------------------------------------
   - Migra a VERIFICACAO DE SENHA do cliente para o servidor (mesmo modelo do
     emissor B1.3-B): prova = a senha real do usuario ("s2:"+SHA-256(salt|senha)
     atual + djb2 legado), comparacao em tempo constante (notifVerifyPassword).
     onRequest (NAO onCall) => NAO depende de request.auth.uid.
   - Lookup ESPELHA o cliente: e-mail (lowercase) OU telefone (somente digitos),
     normalizando AMBOS os lados em memoria (Firestore where nao replica
     toLowerCase()/replace(\D)). Le a colecao users (igual ao onSnapshot do app).
   - Anti-enumeracao: identifier inexistente / multiplos matches (colisao) / senha
     errada => MESMO 401 generico ("invalid_credentials"). Status inativo
     (pendente/removido/excluido) => 403 SO apos a senha correta (nao vaza estado
     a quem nao tem a senha).
   - Rate-limit IN-MEMORY (best-effort, por instancia; SEM Firestore; sem PII) por
     identifier + IP (chaves namespaced; isoladas das chaves dos endpoints notif).
   - Token de SESSAO assinado HMAC-SHA256 (MESMO formato/notifSignToken). Claims
     {uid, admin, role, scope:"session", iat, exp}; TTL 24h em MS (mesma unidade da
     B1.3-B; notifVerifyToken compara ms). NAO altera notifVerifyToken nesta fase.
   - Projecao SEGURA (allowlist EXPLICITA campo a campo): SO {id,name,role,admin,
     status,photo,color}. NUNCA retorna pass/salt/fcmTokens/phone/email/token
     interno/doc cru/campos desconhecidos via spread. So LE users; NUNCA escreve
     no Firestore. NUNCA loga senha/token/segredo/identifier.
   - DORMENTE: sem AUTH_SESSION_SECRET no ambiente => 503 (inerte). Em producao o
     segredo NAO esta setado e a funcao NAO esta deployada nesta fase. Secret
     SEPARADO do NOTIF_PREFS_SECRET (isolamento de escopo). Slice 1 = SO o backend
     + testes: NAO integra a UI, NAO fecha users, NAO cria usersPublic, NAO mexe Rules.
   ============================================================================ */
const AUTH_SESSION_SECRET = defineSecret("AUTH_SESSION_SECRET");
const AUTH_SESSION_TTL_MS = 24 * 60 * 60 * 1000;   // 24h (sessao)
function authSessionSecret() {
  return String((typeof process !== "undefined" && process.env && process.env.AUTH_SESSION_SECRET) || "");
}
// Projecao SEGURA do usuario (allowlist EXPLICITA; nunca espalha o doc cru).
function authUserPublicOut(id, d) {
  const src = (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
  const str = (v) => (typeof v === "string" ? v : "");
  return {
    id: String(id),
    name: str(src.name),
    role: str(src.role),
    admin: src.admin === true,
    status: str(src.status),
    photo: str(src.photo),
    color: str(src.color),
  };
}
// Orquestra o login. ctx = {method, body, ip, now}. So LE users (sem escrita).
// Retorna {status, json}. Erros sempre controlados (sem throw).
async function handleLoginUser(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  if (ctx.method && String(ctx.method).toUpperCase() !== "POST") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  if (!authSessionSecret()) return { status: 503, json: { ok: false, error: "endpoint_disabled" } };
  const body = ctx.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, json: { ok: false, error: "body_not_object" } };
  const identifier = (typeof body.identifier === "string") ? body.identifier.trim() : "";
  const password = (typeof body.password === "string") ? body.password : "";
  if (!identifier) return { status: 400, json: { ok: false, error: "missing_identifier" } };
  if (!password) return { status: 400, json: { ok: false, error: "missing_password" } };
  if (identifier.length > 320 || password.length > 1024) return { status: 400, json: { ok: false, error: "oversized_input" } };
  // rate-limit IN-MEMORY por identifier + IP (chaves namespaced; isoladas dos endpoints notif).
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const idLower = identifier.toLowerCase();
  const idDigits = identifier.replace(/\D/g, "");
  const rlKeys = ["lu:" + idLower].concat(ip ? ["li:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  let snap;
  try { snap = await notifDb().collection("users").get(); }
  catch (e) {
    try { logger.error("[loginUser] leitura falhou", { err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "lookup_failed" } };
  }
  // Match ESPELHA o cliente: email (lowercase) OU phone (digitos). Normaliza ambos os lados.
  const matches = [];
  try {
    snap.forEach((doc) => {
      const d = (doc && typeof doc.data === "function") ? (doc.data() || {}) : {};
      const email = (typeof d.email === "string" ? d.email : "").toLowerCase();
      const phone = (typeof d.phone === "string" ? d.phone : "").replace(/\D/g, "");
      if ((email && email === idLower) || (idDigits && phone && phone === idDigits)) {
        matches.push({ id: doc.id, d: d });
      }
    });
  } catch (_) { /* snapshot defensivo */ }
  // inexistente OU multiplos matches (colisao) => MESMO 401 generico (nao revela existencia/colisao).
  if (matches.length !== 1) { rlKeys.forEach((k) => notifRlFail(k, now)); return { status: 401, json: { ok: false, error: "invalid_credentials" } }; }
  const u = matches[0];
  // senha errada => MESMO 401 generico (indistinguivel de inexistente).
  if (!notifVerifyPassword(u.d.pass, u.d.salt, password)) { rlKeys.forEach((k) => notifRlFail(k, now)); return { status: 401, json: { ok: false, error: "invalid_credentials" } }; }
  // inativo => 403 (checado SO apos a senha correta, p/ nao vazar estado a quem nao a tem).
  const st = String(u.d.status || "");
  if (st === "pendente" || st === "removido" || st === "excluido") return { status: 403, json: { ok: false, error: "user_inactive" } };
  rlKeys.forEach((k) => notifRlClear(k));   // sucesso de credenciais: zera o rate-limit do identifier/IP
  const isAdmin = (u.d.admin === true);
  const role = (typeof u.d.role === "string") ? u.d.role : "";
  const claims = { uid: u.id, admin: isAdmin, role: role, scope: "session", iat: now, exp: now + AUTH_SESSION_TTL_MS };
  const token = notifSignToken(claims, authSessionSecret());
  try { logger.info("[loginUser] sessao emitida", { uid: notifMaskUid(u.id), admin: isAdmin, role: role, exp: claims.exp }); } catch (_) {}
  return { status: 200, json: { ok: true, session: { token: token, expiresAt: claims.exp }, user: authUserPublicOut(u.id, u.d) } };
}

// Wrapper HTTPS (onRequest => NAO usa request.auth.uid). DORMENTE: sem AUTH_SESSION_SECRET
// => 503. NAO deployado nesta fase; NAO integrado a UI (Slice 1 = so o backend + testes).
exports.loginUser = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo, sem Firestore
  try {
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleLoginUser({ method: req.method, body: req.body, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[loginUser] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});

// Exporta logica pura p/ o harness (NAO afeta runtime; endpoint dormente/sem deploy).
exports._handleLoginUser = handleLoginUser;
exports._authUserPublicOut = authUserPublicOut;

/* ============================================================================
   F3.3.20-B1.7-E — Verificador ESTRITO de token de SESSAO (authVerifySessionToken).
   ----------------------------------------------------------------------------
   - Hardening de escopo: REUTILIZA notifVerifyToken (Bearer/HMAC/uid/exp-se-presente/
     503) e impoe camada ESTRITA propria: exp OBRIGATORIO (numero), scope==="session",
     uid string nao-vazia; retorna tambem role e scope. notifVerifyToken NAO e alterado
     (fluxos notifPrefs antigos preservados; ele segue scope-agnostic p/ a B1.2).
   - O secret e PARAMETRO (caller passa authSessionSecret() = AUTH_SESSION_SECRET).
     NUNCA chama .value() aqui; NUNCA toca Firestore; NUNCA loga token/payload/segredo.
   - Erro UNIFORME { ok:false, error:"invalid_session" } (sem enumerar a causa).
   - ADITIVO/INERTE: ainda NAO consumido por nenhuma Function publicada; sem deploy.
     Sera usado por slices futuros (getUserContact/userMutate/registerUser) antes da UI.
   ============================================================================ */
function authVerifySessionToken(authHeader, secret, nowMs) {
  // 1) Reuso: assinatura HMAC + uid basico + exp-se-presente + dormencia (sem secret => 503).
  const base = notifVerifyToken(authHeader, secret, nowMs);
  if (!base.ok) return { ok: false, error: "invalid_session" };
  // 2) Camada ESTRITA: re-decodifica o payload (assinatura JA verificada acima) e impoe escopo/exp.
  let claims;
  try {
    const m = /^Bearer\s+(.+)$/.exec(String(authHeader || "").trim());
    claims = JSON.parse(Buffer.from(m[1].split(".")[0], "base64url").toString("utf8"));
  } catch (_) { return { ok: false, error: "invalid_session" }; }
  if (typeof claims.exp !== "number") return { ok: false, error: "invalid_session" };   // exp OBRIGATORIO (fecha o gap)
  if (claims.scope !== "session") return { ok: false, error: "invalid_session" };        // scope ESTRITO
  if (typeof claims.uid !== "string" || !claims.uid) return { ok: false, error: "invalid_session" };
  return { ok: true, uid: claims.uid, admin: claims.admin === true, role: (typeof claims.role === "string" ? claims.role : ""), scope: "session" };
}

// Exporta logica pura p/ o harness (NAO afeta runtime; NAO e CloudFunction; sem deploy).
exports._authVerifySessionToken = authVerifySessionToken;

/* ============================================================================
   F3.3.20-B1.7-E — SLICE 2: getUserContact (leitura AUTENTICADA de contato).
   ----------------------------------------------------------------------------
   - Primeiro CONSUMIDOR de authVerifySessionToken: substitui a exposicao direta de
     phone/email por endpoint autenticado. onRequest (NAO onCall) => uid do requester
     vem SO do token de sessao verificado; NUNCA de Firebase Auth/request.auth.
   - Autorizacao MINIMA: self (session.uid === uid) OU admin (session.admin === true).
     Nao-self e nao-admin => 403 ANTES de revelar existencia (anti-enumeracao).
   - Projecao SEGURA: retorna SOMENTE { phone, email } em `contact`. NUNCA pass/salt/
     fcmTokens/fcmTokenMeta/admin/role/status/photo/color/doc cru/campos extras.
   - So LE users/{uid} (um doc; nunca a colecao inteira); NUNCA escreve no Firestore.
   - Rate-limit IN-MEMORY por session.uid + IP. Logs sem token/Authorization/PII
     (so uids mascarados). Dormente sem AUTH_SESSION_SECRET => sessao invalida (401).
   - ADITIVO/INERTE: ainda NAO consumido pela UI; sem deploy nesta fase.
   ============================================================================ */
async function handleGetUserContact(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "GET" && method !== "POST") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  // Autenticacao de SESSAO estrita (assinatura + exp + scope=session via AUTH_SESSION_SECRET).
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { status: 401, json: { ok: false, error: "invalid_session" } };
  // Rate-limit por requester (uid da sessao) + IP.
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ["c:" + auth.uid].concat(ip ? ["ci:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  // Alvo.
  const targetUid = (typeof ctx.uid === "string") ? ctx.uid.trim() : "";
  if (!targetUid) return { status: 400, json: { ok: false, error: "missing_uid" } };
  if (targetUid.length > 200) return { status: 400, json: { ok: false, error: "bad_uid" } };
  // Autorizacao: self OU admin. 403 ANTES de ler o doc (nao revela existencia a quem nao pode).
  const isSelf = (targetUid === auth.uid);
  const isAdmin = (auth.admin === true);
  if (!isSelf && !isAdmin) { rlKeys.forEach((k) => notifRlFail(k, now)); return { status: 403, json: { ok: false, error: "forbidden" } }; }
  let snap;
  try { snap = await notifDb().collection("users").doc(targetUid).get(); }
  catch (e) {
    try { logger.error("[getUserContact] leitura falhou", { uid: notifMaskUid(targetUid), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "lookup_failed" } };
  }
  if (!snap || !snap.exists) return { status: 404, json: { ok: false, error: "not_found" } };
  const d = snap.data() || {};
  rlKeys.forEach((k) => notifRlClear(k));
  try { logger.info("[getUserContact] ok", { requester: notifMaskUid(auth.uid), target: notifMaskUid(targetUid), self: isSelf, admin: isAdmin }); } catch (_) {}
  // Projecao SEGURA: SOMENTE phone/email.
  return { status: 200, json: { ok: true, uid: targetUid, contact: { phone: (typeof d.phone === "string" ? d.phone : ""), email: (typeof d.email === "string" ? d.email : "") } } };
}

// Wrapper HTTPS (onRequest => NAO usa request.auth.uid). DORMENTE: sem AUTH_SESSION_SECRET
// => sessao invalida (401 via authVerifySessionToken). NAO deployado nesta fase; sem UI.
exports.getUserContact = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo, sem Firestore
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const uid = (String(req.method).toUpperCase() === "POST")
      ? ((req.body && typeof req.body === "object" && typeof req.body.uid === "string") ? req.body.uid : "")
      : ((req.query && typeof req.query.uid === "string") ? req.query.uid : "");
    const out = await handleGetUserContact({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", uid: uid, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[getUserContact] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});

// Exporta logica pura p/ o harness (NAO afeta runtime; NAO e CloudFunction; sem deploy).
exports._handleGetUserContact = handleGetUserContact;

/* ============================================================================
   F3.3.21-B3.1 — getUserSelf (leitura AUTENTICADA do PROPRIO usuario).
   ----------------------------------------------------------------------------
   - Session-gated (authVerifySessionToken). Le SOMENTE users/<session.uid> (nunca a
     colecao; nunca outro uid). NUNCA retorna pass/salt/hash/fcmTokens/fcmTokenMeta/
     phone/email (contato segue via getUserContact). Retorna campos de exibicao +
     preferencia + CONTADORES seguros (hasFcmToken/fcmTokensCount) — nunca o token.
   - onRequest (NAO usa request.auth.uid; uid vem SO do token de sessao verificado).
     Rate-limit IN-MEMORY por session.uid + IP. Logs sem token/PII (uid mascarado).
   - DORMENTE sem AUTH_SESSION_SECRET => 401 (via authVerifySessionToken). ADITIVO/
     INERTE: ainda NAO consumido pela UI como fonte unica; sem deploy nesta fase.
   ============================================================================ */
async function handleGetUserSelf(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "GET" && method !== "POST") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  // Autenticacao de SESSAO estrita (assinatura + exp + scope=session via AUTH_SESSION_SECRET).
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { status: 401, json: { ok: false, error: "invalid_session" } };
  // Rate-limit por requester (uid da sessao) + IP. Chaves namespaced (isoladas dos outros endpoints).
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ["s:" + auth.uid].concat(ip ? ["si:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  // Le SOMENTE o proprio doc (auth.uid); nunca a colecao, nunca outro uid.
  let snap;
  try { snap = await notifDb().collection("users").doc(auth.uid).get(); }
  catch (e) {
    try { logger.error("[getUserSelf] leitura falhou", { uid: notifMaskUid(auth.uid), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "lookup_failed" } };
  }
  if (!snap || !snap.exists) return { status: 404, json: { ok: false, error: "not_found" } };
  const d = snap.data() || {};
  rlKeys.forEach((k) => notifRlClear(k));
  const str = (v) => (typeof v === "string" ? v : "");
  const fcm = Array.isArray(d.fcmTokens) ? d.fcmTokens.filter(Boolean) : [];
  try { logger.info("[getUserSelf] ok", { uid: notifMaskUid(auth.uid), admin: auth.admin === true }); } catch (_) {}
  // Projecao SEGURA do PROPRIO usuario: exibicao + preferencia + contadores. NUNCA pass/salt/fcmTokens/phone/email.
  return { status: 200, json: { ok: true, uid: auth.uid, self: {
    id: String(auth.uid),
    name: str(d.name), role: str(d.role), admin: d.admin === true, status: str(d.status),
    photo: str(d.photo), color: str(d.color),
    reminderMinutes: (typeof d.reminderMinutes === "number" ? d.reminderMinutes : null),
    hasFcmToken: fcm.length > 0, fcmTokensCount: fcm.length,
  } } };
}

// Wrapper HTTPS (onRequest => NAO usa request.auth.uid). DORMENTE: sem AUTH_SESSION_SECRET
// => sessao invalida (401 via authVerifySessionToken). NAO deployado nesta fase; sem UI.
exports.getUserSelf = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo, sem Firestore
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleGetUserSelf({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[getUserSelf] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});

// Exporta logica pura p/ o harness (NAO afeta runtime; NAO e CloudFunction; sem deploy).
exports._handleGetUserSelf = handleGetUserSelf;

/* ============================================================================
   F3.3.21-B3.20 — registerFcmToken / removeMyFcmToken (FCM token do PROPRIO usuario).
   ----------------------------------------------------------------------------
   - Base server-side para MIGRAR a gestao de fcmTokens/fcmTokenMeta que hoje o
     cliente faz lendo/escrevendo users/<uid> direto (tx.get + tx.set + doc.get).
     Session-gated (authVerifySessionToken): opera SOMENTE no proprio usuario
     (session.uid); NUNCA outro uid. onRequest (NAO usa request.auth.uid).
   - Admin SDK (notifDb) em TRANSACAO: le users/<uid>, faz dedup por deviceId
     (espelha a logica atual do cliente) e grava fcmTokens + fcmTokenMeta. NUNCA
     retorna fcmTokens/fcmTokenMeta; SO contadores seguros (saved/hasToken/count).
   - NUNCA loga o FCM token nem o session token (token mascarado; uid mascarado).
     NUNCA retorna/loga pass/salt/hash/phone/email.
   - DORMENTE sem AUTH_SESSION_SECRET => 401 (via authVerifySessionToken). ADITIVO/
     INERTE: NAO deployado, NAO integrado a UI como fonte; sem deploy nesta fase.
   - Handlers PUROS testaveis: ctx.db injetavel (mock); sem Firestore real nos testes.
   ============================================================================ */
const FCM_TOKEN_MAX_LEN = 4096;
const FCM_DEVICE_MAX_LEN = 200;
const FCM_PLATFORM_MAX_LEN = 64;
// Mascara para LOGS (nunca o token inteiro). Token FCM e longo (>100 chars).
function authMaskFcmToken(t) {
  const s = String(t || "");
  if (!s) return "(vazio)";
  return s.length >= 16 ? (s.slice(0, 6) + "…" + s.slice(-4)) : "***";
}
// Normaliza lista/meta atuais do doc (defensivo) — espelha o shape do cliente.
function authFcmReadState(d) {
  const src = (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
  const tokens = Array.isArray(src.fcmTokens) ? src.fcmTokens.filter((t) => typeof t === "string" && t) : [];
  const meta = (src.fcmTokenMeta && typeof src.fcmTokenMeta === "object" && !Array.isArray(src.fcmTokenMeta)) ? src.fcmTokenMeta : {};
  return { tokens: tokens, meta: meta };
}
// REGISTRA/atualiza o token FCM do PROPRIO usuario (dedup por deviceId). So escreve users/<uid>.
async function handleRegisterFcmToken(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { status: 401, json: { ok: false, error: "invalid_session" } };
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ["fcm:" + auth.uid].concat(ip ? ["fcmi:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  const body = ctx.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, json: { ok: false, error: "body_not_object" } };
  const token = (typeof body.token === "string") ? body.token.trim() : "";
  if (!token) return { status: 400, json: { ok: false, error: "missing_token" } };
  if (token.length > FCM_TOKEN_MAX_LEN) return { status: 400, json: { ok: false, error: "oversized_token" } };
  const deviceId = (typeof body.deviceId === "string") ? body.deviceId.slice(0, FCM_DEVICE_MAX_LEN) : "";
  const platform = (typeof body.platform === "string") ? body.platform.slice(0, FCM_PLATFORM_MAX_LEN) : "";
  const db = (ctx && ctx.db) || notifDb();
  let count = 0;
  try {
    const ref = db.collection("users").doc(auth.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap || snap.exists === false) { const e = new Error("not_found"); e.__code = 404; throw e; }
      const st = authFcmReadState(typeof snap.data === "function" ? snap.data() : {});
      const meta = Object.assign({}, st.meta);
      // Dedup por deviceId: remove tokens antigos do MESMO aparelho (token != atual). Espelha o cliente.
      let tokens = st.tokens.slice();
      if (deviceId) {
        tokens = tokens.filter((t) => !(meta[t] && meta[t].deviceId === deviceId && t !== token));
        Object.keys(meta).forEach((t) => { if (meta[t] && meta[t].deviceId === deviceId && t !== token) delete meta[t]; });
      }
      if (tokens.indexOf(token) < 0) tokens.push(token);
      const prevCreated = (meta[token] && typeof meta[token].createdAt === "number") ? meta[token].createdAt : now;
      meta[token] = { token: token, deviceId: deviceId, platform: platform, createdAt: prevCreated, lastSeenAt: now };
      tokens = tokens.filter(Boolean);
      count = tokens.length;
      tx.set(ref, { fcmTokens: tokens, fcmTokenMeta: meta }, { merge: true });
    });
  } catch (e) {
    if (e && e.__code === 404) return { status: 404, json: { ok: false, error: "not_found" } };
    try { logger.error("[registerFcmToken] gravacao falhou", { uid: notifMaskUid(auth.uid), token: authMaskFcmToken(token), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "save_failed" } };
  }
  rlKeys.forEach((k) => notifRlClear(k));
  try { logger.info("[registerFcmToken] ok", { uid: notifMaskUid(auth.uid), token: authMaskFcmToken(token), count: count }); } catch (_) {}
  // Resposta SEGURA: NUNCA fcmTokens/fcmTokenMeta. So contadores.
  return { status: 200, json: { ok: true, saved: true, tokenMasked: true, hasToken: count > 0, count: count } };
}
// REMOVE um token FCM do PROPRIO usuario. So escreve users/<uid>.
async function handleRemoveFcmToken(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { status: 401, json: { ok: false, error: "invalid_session" } };
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ["fcmr:" + auth.uid].concat(ip ? ["fcmri:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  const body = ctx.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, json: { ok: false, error: "body_not_object" } };
  const token = (typeof body.token === "string") ? body.token.trim() : "";
  if (!token) return { status: 400, json: { ok: false, error: "missing_token" } };
  if (token.length > FCM_TOKEN_MAX_LEN) return { status: 400, json: { ok: false, error: "oversized_token" } };
  const db = (ctx && ctx.db) || notifDb();
  let count = 0, removed = false;
  try {
    const ref = db.collection("users").doc(auth.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap || snap.exists === false) { const e = new Error("not_found"); e.__code = 404; throw e; }
      const st = authFcmReadState(typeof snap.data === "function" ? snap.data() : {});
      const meta = Object.assign({}, st.meta);
      const before = st.tokens.length;
      const tokens = st.tokens.filter((t) => t !== token);
      if (meta[token]) delete meta[token];
      removed = tokens.length !== before;
      count = tokens.length;
      tx.set(ref, { fcmTokens: tokens, fcmTokenMeta: meta }, { merge: true });
    });
  } catch (e) {
    if (e && e.__code === 404) return { status: 404, json: { ok: false, error: "not_found" } };
    try { logger.error("[removeMyFcmToken] gravacao falhou", { uid: notifMaskUid(auth.uid), token: authMaskFcmToken(token), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "save_failed" } };
  }
  rlKeys.forEach((k) => notifRlClear(k));
  try { logger.info("[removeMyFcmToken] ok", { uid: notifMaskUid(auth.uid), token: authMaskFcmToken(token), removed: removed, count: count }); } catch (_) {}
  return { status: 200, json: { ok: true, saved: true, removed: removed, tokenMasked: true, hasToken: count > 0, count: count } };
}
// Wrappers HTTPS (onRequest => NAO usa request.auth.uid). DORMENTE sem AUTH_SESSION_SECRET
// => 401. NAO deployado nesta fase; NAO integrado a UI como fonte.
exports.registerFcmToken = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo, sem Firestore
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleRegisterFcmToken({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[registerFcmToken] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});
exports.removeMyFcmToken = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo, sem Firestore
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleRemoveFcmToken({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[removeMyFcmToken] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});
// Exporta logica pura p/ o harness (NAO afeta runtime; endpoints dormentes/sem deploy).
exports._handleRegisterFcmToken = handleRegisterFcmToken;
exports._handleRemoveFcmToken = handleRemoveFcmToken;
exports._authMaskFcmToken = authMaskFcmToken;
exports._authFcmReadState = authFcmReadState;

/* ============================================================================
   F3.3.48 — checkUserExists (duplicate-check de CADASTRO, server-side).
   ----------------------------------------------------------------------------
   - Move o duplicate-check de email/phone que hoje o cliente faz lendo `users`
     cru (db.collection("users").get()) para o servidor. O Admin SDK (notifDb)
     ignora Rules, entao continua funcionando quando users read for fechado.
   - NAO-autenticado por natureza (o cadastro e PRE-login/PRE-sessao). Rate-limit
     IN-MEMORY por IP (anti-abuso/enumeracao). CORS restrito (NOTIF_CORS_ORIGINS),
     sem wildcard. NAO expoe informacao nova: o app legado ja revela "ja existe"
     no proprio formulario de cadastro; aqui a resposta e um booleano minimo.
   - Resposta MINIMA: SOMENTE { ok, exists, field? }. field ∈ {"email","phone"}
     apenas quando exists=true. NUNCA retorna pass/salt/fcmTokens/fcmTokenMeta/
     token/doc cru/phone/email de ninguem/qualquer PII.
   - So LE users (server-side); NUNCA escreve. Normaliza email (trim+lowercase) e
     phone (so digitos), espelhando exatamente o duplicate-check legado do cliente.
   - Handler PURO testavel: ctx.db injetavel (mock); helper puro dupCheckAgainstUsers
     testado sem Firestore real. DORMENTE: NAO deployado; sem UI ligada com flag OFF.
   ============================================================================ */
const DUPCHECK_EMAIL_MAX_LEN = 254;   // RFC 5321 addr-spec
const DUPCHECK_PHONE_MAX_DIGITS = 32;
// PURO: dado email/phone JA normalizados e a lista de docs {email,phone}, decide
// duplicidade. email tem prioridade (espelha a ordem das mensagens do cliente).
function dupCheckAgainstUsers(email, phone, docs) {
  const e = String(email || "").trim().toLowerCase();
  const p = String(phone || "").replace(/\D/g, "");
  const list = Array.isArray(docs) ? docs : [];
  if (e) {
    for (let i = 0; i < list.length; i++) {
      const u = list[i] || {};
      if (String(u.email || "").trim().toLowerCase() === e) return { exists: true, field: "email" };
    }
  }
  if (p) {
    for (let i = 0; i < list.length; i++) {
      const u = list[i] || {};
      if (String(u.phone || "").replace(/\D/g, "") === p) return { exists: true, field: "phone" };
    }
  }
  return { exists: false, field: "unknown" };
}
async function handleCheckUserExists(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "method_not_allowed" } };
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : {};
  const email = (typeof body.email === "string") ? body.email.trim().toLowerCase() : "";
  const phone = (typeof body.phone === "string") ? body.phone.replace(/\D/g, "") : "";
  if (!email && !phone) return { status: 400, json: { ok: false, error: "missing_fields" } };
  if (email.length > DUPCHECK_EMAIL_MAX_LEN || phone.length > DUPCHECK_PHONE_MAX_DIGITS) return { status: 400, json: { ok: false, error: "bad_input" } };
  // Rate-limit por IP (endpoint nao-autenticado). Chave namespaced ("d:") isolada.
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ip ? ["d:" + ip] : [];
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  const db = (ctx && ctx.db) || notifDb();
  let docs;
  try {
    const snap = await db.collection("users").get();
    docs = (snap && Array.isArray(snap.docs)) ? snap.docs.map((d) => (typeof d.data === "function" ? (d.data() || {}) : {})) : [];
  } catch (e) {
    try { logger.error("[checkUserExists] leitura falhou", { err: e && e.message }); } catch (_) {}
    rlKeys.forEach((k) => notifRlFail(k, now));
    return { status: 500, json: { ok: false, error: "lookup_failed" } };
  }
  const r = dupCheckAgainstUsers(email, phone, docs);
  rlKeys.forEach((k) => notifRlClear(k));
  // Log sem PII: so o resultado agregado (existe? qual campo?), nunca o email/phone consultado.
  try { logger.info("[checkUserExists] ok", { exists: r.exists, field: (r.exists ? r.field : "none") }); } catch (_) {}
  // Resposta MINIMA: SOMENTE {ok,exists,field?}. NUNCA doc/PII/credencial.
  return { status: 200, json: (r.exists ? { ok: true, exists: true, field: r.field } : { ok: true, exists: false }) };
}
// Wrapper HTTPS (onRequest). SEM secret (nao-autenticado; pre-cadastro). DORMENTE: NAO
// deployado nesta fase; a UI so chama com users_read_hardening=ON (flag OFF por padrao).
exports.checkUserExists = onRequest({ region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleCheckUserExists({ method: req.method, body: req.body, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[checkUserExists] erro", { err: e && e.message }); } catch (_) {}
    res.status(500).json({ ok: false, error: "internal" });
  }
});
// Exporta logica pura p/ o harness (NAO afeta runtime; endpoint dormente/sem deploy).
exports._handleCheckUserExists = handleCheckUserExists;
exports._dupCheckAgainstUsers = dupCheckAgainstUsers;

/* ============================================================================
   F3.3.49 — changePassword (troca de senha do PROPRIO usuario, server-side).
   ----------------------------------------------------------------------------
   - Move a troca de senha que hoje o cliente faz lendo me.pass/me.salt, validando
     a senha antiga (verifyPw) e gerando hash/salt no client, para o servidor.
   - Session-gated (authVerifySessionToken): opera SOMENTE no proprio usuario
     (session.uid); NUNCA outro uid (nao ha uid no body — o alvo e sempre auth.uid).
   - Valida a senha ATUAL no servidor (notifVerifyPassword, timing-safe, s2:+legado),
     gera novo salt/hash no MESMO esquema (hashPw/randSalt) e atualiza SOMENTE pass/salt
     via .update() (NUNCA admin/role/status/email/phone/fcmTokens). So escreve users/<uid>.
   - Rate-limit IN-MEMORY por session.uid + IP (falha conta; sucesso limpa). NUNCA loga
     oldPassword/newPassword/hash/salt/token (so uid mascarado). Nao emite sessao nova nem
     invalida as existentes (sem politica de revogacao definida).
   - Request: { oldPassword, newPassword }. Response: { ok:true } | { ok:false, error }.
     error ∈ {invalid_current_password, weak_password, unauthorized, bad_request, rate_limited}.
     NUNCA retorna pass/salt/hash/token/doc/PII.
   - Handler PURO testavel: ctx.db injetavel (mock). DORMENTE sem AUTH_SESSION_SECRET => 401.
     NAO deployado; a UI so chama com users_read_hardening=ON (flag OFF por padrao).
   ============================================================================ */
const CHPW_MIN_LEN = 6;               // espelha o minimo do app (setSavePass: "Minimo 6 caracteres")
const CHPW_MAX_LEN = 512;             // teto defensivo (anti-DoS de hashing)
async function handleChangePassword(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  // Autenticacao de SESSAO estrita (assinatura + exp + scope=session via AUTH_SESSION_SECRET).
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { status: 401, json: { ok: false, error: "unauthorized" } };
  // Rate-limit por requester (uid da sessao) + IP. Chaves namespaced ("pw:"/"pwi:") isoladas.
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ["pw:" + auth.uid].concat(ip ? ["pwi:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  // Body.
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : {};
  const oldPw = (typeof body.oldPassword === "string") ? body.oldPassword : "";
  const newPw = (typeof body.newPassword === "string") ? body.newPassword : "";
  if (!oldPw || !newPw) return { status: 400, json: { ok: false, error: "bad_request" } };
  if (oldPw.length > CHPW_MAX_LEN || newPw.length > CHPW_MAX_LEN) return { status: 400, json: { ok: false, error: "bad_request" } };
  if (newPw.length < CHPW_MIN_LEN) return { status: 400, json: { ok: false, error: "weak_password" } };
  const db = (ctx && ctx.db) || notifDb();
  // Le SOMENTE o proprio doc (auth.uid) p/ validar a senha atual no servidor.
  let snap;
  try { snap = await db.collection("users").doc(auth.uid).get(); }
  catch (e) {
    try { logger.error("[changePassword] leitura falhou", { uid: notifMaskUid(auth.uid), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "internal" } };
  }
  if (!snap || !snap.exists) return { status: 401, json: { ok: false, error: "unauthorized" } };
  const d = (typeof snap.data === "function" ? snap.data() : null) || {};
  // Valida a senha ATUAL no servidor (timing-safe). Falha => conta no rate-limit.
  if (!notifVerifyPassword(d.pass, d.salt, oldPw)) {
    rlKeys.forEach((k) => notifRlFail(k, now));
    return { status: 401, json: { ok: false, error: "invalid_current_password" } };
  }
  // Gera novo salt/hash no MESMO esquema (server-side). NUNCA logados.
  const newSalt = randSalt();
  const newHash = hashPw(newPw, newSalt);
  // Atualiza SOMENTE pass/salt do proprio usuario (merge parcial; nao toca outros campos).
  try { await db.collection("users").doc(auth.uid).update({ pass: newHash, salt: newSalt }); }
  catch (e) {
    try { logger.error("[changePassword] update falhou", { uid: notifMaskUid(auth.uid), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "internal" } };
  }
  rlKeys.forEach((k) => notifRlClear(k));
  try { logger.info("[changePassword] ok", { uid: notifMaskUid(auth.uid) }); } catch (_) {}   // NUNCA senha/hash/salt/token
  return { status: 200, json: { ok: true } };
}
// Wrapper HTTPS (onRequest => NAO usa request.auth.uid). Session-gated: precisa de
// AUTH_SESSION_SECRET p/ verificar o token. DORMENTE sem o secret => 401. NAO deployado.
exports.changePassword = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleChangePassword({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[changePassword] erro", { err: e && e.message }); } catch (_) {}   // NUNCA body/senha
    res.status(500).json({ ok: false, error: "internal" });
  }
});
// Exporta logica pura p/ o harness (NAO afeta runtime; endpoint dormente/sem deploy).
exports._handleChangePassword = handleChangePassword;

/* ============================================================================
   F3.3.61-C — Endpoints Admin SDK p/ MIGRAR os writes client-side de /users
   (rumo a Opcao C: /users create/update/delete = false no cliente).
   ----------------------------------------------------------------------------
   - TODOS session-gated (authVerifySessionToken; scope=session; sem Firebase Auth).
     Os endpoints ADMIN usam authRequireAdminSession: RE-CARREGA users/{callerUid}
     e exige admin===true (NUNCA confia no claim do token nem no cliente).
   - Admin SDK (bypassa Rules). Allowlist ESTRITA de campos: qualquer chave fora da
     allowlist => 400 (NUNCA grava admin/status/pass/salt/fcmTokens por endpoint self).
   - NUNCA retorna pass/salt/fcmTokens (respostas via authUserPublicOut / {ok:true}).
     NUNCA loga senha/hash/salt/token (so uid mascarado + nomes de campos).
   - Handlers PUROS testaveis: ctx.db injetavel. DORMENTE sem AUTH_SESSION_SECRET => 401.
     ADITIVO/INERTE: sem deploy, sem cutover do cliente, sem tocar Rules nesta fase.
   - syncUsersPublic (trigger) propaga qualquer write server-side de users -> usersPublic.
   ============================================================================ */
const USER_SELF_UPDATE_KEYS = ["color", "photo", "reminderMinutes"];
const USER_ADMIN_UPDATE_KEYS = ["name", "role", "email", "phone", "color", "photo", "reminderMinutes"];
const USER_STATUS_VALUES = ["ativo", "inativo", "pendente"];
function uwValidColor(v) { return typeof v === "string" && (v === "" || /^#[0-9a-fA-F]{6}$/.test(v)); }
function uwValidPhoto(v) { return typeof v === "string" && v.length <= 4096; }
function uwValidReminder(v) { return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1440; }
function uwValidStr(v, max) { return typeof v === "string" && v.length <= (max || 200); }
function uwTargetId(v) { const s = (typeof v === "string") ? v.trim() : ""; return (s && s.length <= 200) ? s : ""; }

// RBAC: valida sessao E exige admin (re-carrega o doc do caller; nao confia no token).
// Retorna {ok:true, uid, data, db} OU {ok:false, status, json}. 401 sessao; 403 nao-admin/inativo.
async function authRequireAdminSession(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { ok: false, status: 401, json: { ok: false, error: "unauthorized" } };
  const db = (ctx && ctx.db) || notifDb();
  let snap;
  try { snap = await db.collection("users").doc(auth.uid).get(); }
  catch (e) { try { logger.error("[authRequireAdmin] leitura falhou", { uid: notifMaskUid(auth.uid), err: e && e.message }); } catch (_) {} return { ok: false, status: 500, json: { ok: false, error: "internal" } }; }
  if (!snap || !snap.exists) return { ok: false, status: 403, json: { ok: false, error: "forbidden" } };
  const d = (typeof snap.data === "function" ? snap.data() : null) || {};
  const st = String(d.status || "");
  if (st === "pendente" || st === "removido" || st === "excluido" || d.disabled === true) return { ok: false, status: 403, json: { ok: false, error: "forbidden" } };
  if (d.admin !== true) return { ok: false, status: 403, json: { ok: false, error: "forbidden" } };
  return { ok: true, uid: auth.uid, data: d, db: db };
}
exports._authRequireAdminSession = authRequireAdminSession;

// updateUserSelf — substitui os writes client-side do PROPRIO perfil (color/photo/reminderMinutes).
// STRICT: qualquer campo fora da allowlist => 400 (NUNCA admin/status/pass/salt/fcmTokens/etc.).
async function handleUpdateUserSelf(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { status: 401, json: { ok: false, error: "unauthorized" } };
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ["us:" + auth.uid].concat(ip ? ["usi:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : null;
  if (!body) return { status: 400, json: { ok: false, error: "bad_request" } };
  const keys = Object.keys(body);
  if (!keys.length) return { status: 400, json: { ok: false, error: "empty_patch" } };
  for (const k of keys) { if (USER_SELF_UPDATE_KEYS.indexOf(k) < 0) return { status: 400, json: { ok: false, error: "forbidden_field" } }; }
  const patch = {};
  if ("color" in body) { if (!uwValidColor(body.color)) return { status: 400, json: { ok: false, error: "bad_color" } }; patch.color = body.color; }
  if ("photo" in body) { if (!uwValidPhoto(body.photo)) return { status: 400, json: { ok: false, error: "bad_photo" } }; patch.photo = body.photo; }
  if ("reminderMinutes" in body) { if (!uwValidReminder(body.reminderMinutes)) return { status: 400, json: { ok: false, error: "bad_reminder" } }; patch.reminderMinutes = body.reminderMinutes; }
  if (!Object.keys(patch).length) return { status: 400, json: { ok: false, error: "empty_patch" } };
  const db = (ctx && ctx.db) || notifDb();
  try { await db.collection("users").doc(auth.uid).update(patch); }
  catch (e) { try { logger.error("[updateUserSelf] update falhou", { uid: notifMaskUid(auth.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  rlKeys.forEach((k) => notifRlClear(k));
  try { logger.info("[updateUserSelf] ok", { uid: notifMaskUid(auth.uid), fields: Object.keys(patch) }); } catch (_) {}
  return { status: 200, json: { ok: true } };
}
exports.updateUserSelf = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleUpdateUserSelf({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) { try { logger.error("[updateUserSelf] erro", { err: e && e.message }); } catch (_) {} res.status(500).json({ ok: false, error: "internal" }); }
});
exports._handleUpdateUserSelf = handleUpdateUserSelf;

// touchUserLastSeen — presenca do PROPRIO usuario (grava SO lastSeen). Body deve ser vazio.
// Sem rate-limit (presenca e frequente; self-scoped e baixo risco). Substitui o write client-side de lastSeen.
async function handleTouchUserLastSeen(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { status: 401, json: { ok: false, error: "unauthorized" } };
  const body = ctx.body;
  if (body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length) return { status: 400, json: { ok: false, error: "no_fields_allowed" } };
  const db = (ctx && ctx.db) || notifDb();
  try { await db.collection("users").doc(auth.uid).update({ lastSeen: now }); }
  catch (e) { try { logger.error("[touchUserLastSeen] update falhou", { uid: notifMaskUid(auth.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  return { status: 200, json: { ok: true } };
}
exports.touchUserLastSeen = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  try {
    res.set("Cache-Control", "no-store");
    const out = await handleTouchUserLastSeen({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) { try { logger.error("[touchUserLastSeen] erro", { err: e && e.message }); } catch (_) {} res.status(500).json({ ok: false, error: "internal" }); }
});
exports._handleTouchUserLastSeen = handleTouchUserLastSeen;

// adminCreateUser — criacao controlada via Admin SDK (gera salt/hash server-side). NUNCA retorna pass/salt.
async function handleAdminCreateUser(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  const adm = await authRequireAdminSession(ctx);
  if (!adm.ok) return { status: adm.status, json: adm.json };
  const db = adm.db;
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : null;
  if (!body) return { status: 400, json: { ok: false, error: "bad_request" } };
  const name = (typeof body.name === "string") ? body.name.trim() : "";
  const role = (typeof body.role === "string") ? body.role.trim() : "";
  const email = (typeof body.email === "string") ? normEmail(body.email) : "";
  const phone = (typeof body.phone === "string") ? body.phone.trim() : "";
  const status = (typeof body.status === "string" && body.status.trim()) ? body.status.trim() : "ativo";
  const initialPassword = (typeof body.senhaInicial === "string") ? body.senhaInicial : ((typeof body.initialPassword === "string") ? body.initialPassword : "");
  if (!uwValidStr(name, 200) || !name) return { status: 400, json: { ok: false, error: "bad_name" } };
  if (!uwValidStr(role, 80)) return { status: 400, json: { ok: false, error: "bad_role" } };
  if (email && !isValidEmail(email)) return { status: 400, json: { ok: false, error: "bad_email" } };
  if (!uwValidStr(phone, 40)) return { status: 400, json: { ok: false, error: "bad_phone" } };
  if (USER_STATUS_VALUES.indexOf(status) < 0) return { status: 400, json: { ok: false, error: "bad_status" } };
  if (initialPassword.length < CHPW_MIN_LEN || initialPassword.length > CHPW_MAX_LEN) return { status: 400, json: { ok: false, error: "weak_password" } };
  const salt = randSalt();
  const pass = hashPw(initialPassword, salt);
  const doc = { name: name, role: role, email: email, phone: phone, status: status, admin: false, pass: pass, salt: salt, mustChangePassword: true, createdAt: now, createdBy: adm.uid };
  let ref;
  try { ref = await db.collection("users").add(doc); }
  catch (e) { try { logger.error("[adminCreateUser] add falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  const newId = (ref && ref.id) || "";
  try { logger.info("[adminCreateUser] ok", { by: notifMaskUid(adm.uid), created: notifMaskUid(newId), role: role, status: status }); } catch (_) {}
  return { status: 200, json: { ok: true, id: newId, user: authUserPublicOut(newId, doc) } };   // NUNCA pass/salt
}
exports.adminCreateUser = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  try {
    res.set("Cache-Control", "no-store");
    const out = await handleAdminCreateUser({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) { try { logger.error("[adminCreateUser] erro", { err: e && e.message }); } catch (_) {} res.status(500).json({ ok: false, error: "internal" }); }
});
exports._handleAdminCreateUser = handleAdminCreateUser;

// adminUpdateUser — edicao administrativa de campos NAO sensiveis (allowlist). Proibe pass/salt/fcmTokens/admin/status.
async function handleAdminUpdateUser(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  const adm = await authRequireAdminSession(ctx);
  if (!adm.ok) return { status: adm.status, json: adm.json };
  const db = adm.db;
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : null;
  if (!body) return { status: 400, json: { ok: false, error: "bad_request" } };
  const targetId = uwTargetId(body.targetId);
  if (!targetId) return { status: 400, json: { ok: false, error: "bad_target" } };
  const p = (body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)) ? body.patch : null;
  if (!p) return { status: 400, json: { ok: false, error: "bad_request" } };
  const pkeys = Object.keys(p);
  if (!pkeys.length) return { status: 400, json: { ok: false, error: "empty_patch" } };
  for (const k of pkeys) { if (USER_ADMIN_UPDATE_KEYS.indexOf(k) < 0) return { status: 400, json: { ok: false, error: "forbidden_field" } }; }
  const patch = {};
  if ("name" in p) { if (!uwValidStr(p.name, 200)) return { status: 400, json: { ok: false, error: "bad_name" } }; patch.name = p.name; }
  if ("role" in p) { if (!uwValidStr(p.role, 80)) return { status: 400, json: { ok: false, error: "bad_role" } }; patch.role = p.role; }
  if ("email" in p) { const em = normEmail(p.email); if (em && !isValidEmail(em)) return { status: 400, json: { ok: false, error: "bad_email" } }; patch.email = em; }
  if ("phone" in p) { if (!uwValidStr(p.phone, 40)) return { status: 400, json: { ok: false, error: "bad_phone" } }; patch.phone = p.phone; }
  if ("color" in p) { if (!uwValidColor(p.color)) return { status: 400, json: { ok: false, error: "bad_color" } }; patch.color = p.color; }
  if ("photo" in p) { if (!uwValidPhoto(p.photo)) return { status: 400, json: { ok: false, error: "bad_photo" } }; patch.photo = p.photo; }
  if ("reminderMinutes" in p) { if (!uwValidReminder(p.reminderMinutes)) return { status: 400, json: { ok: false, error: "bad_reminder" } }; patch.reminderMinutes = p.reminderMinutes; }
  if (!Object.keys(patch).length) return { status: 400, json: { ok: false, error: "empty_patch" } };
  let snap;
  try { snap = await db.collection("users").doc(targetId).get(); }
  catch (e) { try { logger.error("[adminUpdateUser] leitura falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  if (!snap || !snap.exists) return { status: 404, json: { ok: false, error: "not_found" } };
  try { await db.collection("users").doc(targetId).update(patch); }
  catch (e) { try { logger.error("[adminUpdateUser] update falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  try { logger.info("[adminUpdateUser] ok", { by: notifMaskUid(adm.uid), target: notifMaskUid(targetId), fields: Object.keys(patch) }); } catch (_) {}
  return { status: 200, json: { ok: true } };
}
exports.adminUpdateUser = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  try {
    res.set("Cache-Control", "no-store");
    const out = await handleAdminUpdateUser({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) { try { logger.error("[adminUpdateUser] erro", { err: e && e.message }); } catch (_) {} res.status(500).json({ ok: false, error: "internal" }); }
});
exports._handleAdminUpdateUser = handleAdminUpdateUser;

// adminSetUserStatus — substitui o write client-side de status (ativo/inativo/pendente).
async function handleAdminSetUserStatus(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  const adm = await authRequireAdminSession(ctx);
  if (!adm.ok) return { status: adm.status, json: adm.json };
  const db = adm.db;
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : null;
  if (!body) return { status: 400, json: { ok: false, error: "bad_request" } };
  const targetId = uwTargetId(body.targetId);
  if (!targetId) return { status: 400, json: { ok: false, error: "bad_target" } };
  const status = (typeof body.status === "string") ? body.status.trim() : "";
  if (USER_STATUS_VALUES.indexOf(status) < 0) return { status: 400, json: { ok: false, error: "bad_status" } };
  let snap;
  try { snap = await db.collection("users").doc(targetId).get(); }
  catch (e) { try { logger.error("[adminSetUserStatus] leitura falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  if (!snap || !snap.exists) return { status: 404, json: { ok: false, error: "not_found" } };
  try { await db.collection("users").doc(targetId).update({ status: status }); }
  catch (e) { try { logger.error("[adminSetUserStatus] update falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  try { logger.info("[adminSetUserStatus] ok", { by: notifMaskUid(adm.uid), target: notifMaskUid(targetId), status: status }); } catch (_) {}
  return { status: 200, json: { ok: true } };
}
exports.adminSetUserStatus = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  try {
    res.set("Cache-Control", "no-store");
    const out = await handleAdminSetUserStatus({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) { try { logger.error("[adminSetUserStatus] erro", { err: e && e.message }); } catch (_) {} res.status(500).json({ ok: false, error: "internal" }); }
});
exports._handleAdminSetUserStatus = handleAdminSetUserStatus;

// adminSetUserAdmin — substitui o toggle de admin. GUARD: nao remover o ULTIMO admin (409).
async function handleAdminSetUserAdmin(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  const adm = await authRequireAdminSession(ctx);
  if (!adm.ok) return { status: adm.status, json: adm.json };
  const db = adm.db;
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : null;
  if (!body) return { status: 400, json: { ok: false, error: "bad_request" } };
  const targetId = uwTargetId(body.targetId);
  if (!targetId) return { status: 400, json: { ok: false, error: "bad_target" } };
  if (typeof body.admin !== "boolean") return { status: 400, json: { ok: false, error: "bad_admin" } };
  const makeAdmin = body.admin;
  let snap;
  try { snap = await db.collection("users").doc(targetId).get(); }
  catch (e) { try { logger.error("[adminSetUserAdmin] leitura falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  if (!snap || !snap.exists) return { status: 404, json: { ok: false, error: "not_found" } };
  if (makeAdmin === false) {
    // GUARD ultimo-admin: se o alvo e admin e e o UNICO, rebaixar deixaria o sistema sem admin.
    let adminIds = [];
    try {
      const adminsSnap = await db.collection("users").where("admin", "==", true).get();
      adminsSnap.forEach((doc) => { adminIds.push(doc.id); });
    } catch (e) { try { logger.error("[adminSetUserAdmin] contagem falhou", { err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
    if (adminIds.length <= 1 && adminIds.indexOf(targetId) >= 0) return { status: 409, json: { ok: false, error: "last_admin" } };
  }
  try { await db.collection("users").doc(targetId).update({ admin: makeAdmin }); }
  catch (e) { try { logger.error("[adminSetUserAdmin] update falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  try { logger.info("[adminSetUserAdmin] ok", { by: notifMaskUid(adm.uid), target: notifMaskUid(targetId), admin: makeAdmin }); } catch (_) {}
  return { status: 200, json: { ok: true } };
}
exports.adminSetUserAdmin = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  try {
    res.set("Cache-Control", "no-store");
    const out = await handleAdminSetUserAdmin({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) { try { logger.error("[adminSetUserAdmin] erro", { err: e && e.message }); } catch (_) {} res.status(500).json({ ok: false, error: "internal" }); }
});
exports._handleAdminSetUserAdmin = handleAdminSetUserAdmin;

// disableUser — desativa SEM delete (status=inativo, disabled=true; preserva dados). Guards: nao-self; nao ultimo-admin.
async function handleDisableUser(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  const adm = await authRequireAdminSession(ctx);
  if (!adm.ok) return { status: adm.status, json: adm.json };
  const db = adm.db;
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : null;
  if (!body) return { status: 400, json: { ok: false, error: "bad_request" } };
  const targetId = uwTargetId(body.targetId);
  if (!targetId) return { status: 400, json: { ok: false, error: "bad_target" } };
  if (targetId === adm.uid) return { status: 409, json: { ok: false, error: "cannot_disable_self" } };
  let snap;
  try { snap = await db.collection("users").doc(targetId).get(); }
  catch (e) { try { logger.error("[disableUser] leitura falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  if (!snap || !snap.exists) return { status: 404, json: { ok: false, error: "not_found" } };
  const td = (typeof snap.data === "function" ? snap.data() : null) || {};
  if (td.admin === true) {
    // GUARD: desativar o ULTIMO admin deixaria o sistema sem admin ativo.
    let adminIds = [];
    try {
      const adminsSnap = await db.collection("users").where("admin", "==", true).get();
      adminsSnap.forEach((doc) => { adminIds.push(doc.id); });
    } catch (e) { try { logger.error("[disableUser] contagem falhou", { err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
    if (adminIds.length <= 1 && adminIds.indexOf(targetId) >= 0) return { status: 409, json: { ok: false, error: "last_admin" } };
  }
  try { await db.collection("users").doc(targetId).update({ status: "inativo", disabled: true, disabledAt: now, disabledBy: adm.uid }); }
  catch (e) { try { logger.error("[disableUser] update falhou", { by: notifMaskUid(adm.uid), err: e && e.message }); } catch (_) {} return { status: 500, json: { ok: false, error: "internal" } }; }
  try { logger.info("[disableUser] ok", { by: notifMaskUid(adm.uid), target: notifMaskUid(targetId) }); } catch (_) {}
  return { status: 200, json: { ok: true } };
}
exports.disableUser = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  try {
    res.set("Cache-Control", "no-store");
    const out = await handleDisableUser({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) { try { logger.error("[disableUser] erro", { err: e && e.message }); } catch (_) {} res.status(500).json({ ok: false, error: "internal" }); }
});
exports._handleDisableUser = handleDisableUser;
// FIM F3.3.61-C

/* ============================================================================
   F3.3.50-B — sendPush (push MULTIUSUARIO server-side; Functions-only).
   ----------------------------------------------------------------------------
   - Remove o blocker: hoje o client (sendPushToUsers) le users/<uid>.get() p/ obter
     fcmTokens de TERCEIROS. Com users read fechado isso quebra. Aqui o lookup de tokens
     + envio FCM + limpeza de dead tokens ficam no servidor.
   - Session-gated (authVerifySessionToken): so um usuario autenticado dispara. Recebe
     { targetUids:[], payload:{...} }. Busca fcmTokens server-side (Admin SDK; dedupe por
     device), envia via admin.messaging().sendEachForMulticast e remove dead tokens
     (arrayRemove). NAO usa o Worker (cloudflare-worker.js intocado); NAO toca Card/Desktop.
   - PRESERVA o comportamento do sendPushToUsers do client (envio direto, SEM gating de
     prefs): as prefs seguem aplicadas pelas TRIGGERS server-side (notifyResponsible) p/
     eventos de criacao. Assim ON == OFF na entrega (diferenca documentada).
   - Formato da mensagem espelha o que o SW (firebase-messaging-sw.js) renderiza:
     notification:{title,body} + data:{tag,url,icon,...}. android priority high, ttl=TTL_MS.
   - Resposta MINIMA { ok, sent, failed, total }. NUNCA retorna fcmTokens/token/doc/PII.
     NUNCA loga token FCM/session token/payload sensivel (so uid mascarado + contadores).
   - Handler PURO testavel: ctx.db e ctx.messaging injetaveis (mock). DORMENTE sem
     AUTH_SESSION_SECRET => 401. NAO deployado; a UI so chama com users_read_hardening=ON.
   ============================================================================ */
const SENDPUSH_MAX_TARGETS = 100;         // teto de destinatarios por request
const SENDPUSH_FCM_BATCH = 500;           // limite do sendEachForMulticast
const SENDPUSH_PAYLOAD_KEYS = ["tag", "url", "icon", "type", "eventType", "source", "taskId", "eventId", "chatId"];
// PURO: monta o `data` (strings) a partir do payload, so com chaves da allowlist. Sem PII.
function sendPushBuildData(payload) {
  const p = (payload && typeof payload === "object" && !Array.isArray(payload)) ? payload : {};
  const data = {};
  for (const k of SENDPUSH_PAYLOAD_KEYS) { if (typeof p[k] === "string" && p[k]) data[k] = String(p[k]); }
  return data;
}
async function handleSendPush(ctx) {
  ctx = ctx || {};
  const now = (typeof ctx.now === "number" ? ctx.now : Date.now());
  const method = String(ctx.method || "").toUpperCase();
  if (method && method !== "POST") return { status: 405, json: { ok: false, error: "bad_request" } };
  const auth = authVerifySessionToken(ctx.authHeader, authSessionSecret(), now);
  if (!auth.ok) return { status: 401, json: { ok: false, error: "unauthorized" } };
  const ip = (typeof ctx.ip === "string") ? ctx.ip : "";
  const rlKeys = ["sp:" + auth.uid].concat(ip ? ["spi:" + ip] : []);
  if (rlKeys.some((k) => notifRlBlocked(k, now))) return { status: 429, json: { ok: false, error: "rate_limited" } };
  const body = (ctx.body && typeof ctx.body === "object" && !Array.isArray(ctx.body)) ? ctx.body : {};
  if (!Array.isArray(body.targetUids)) return { status: 400, json: { ok: false, error: "bad_request" } };
  let uids = body.targetUids.filter((u) => typeof u === "string" && u);
  uids = Array.from(new Set(uids));                       // dedup server-side
  if (!uids.length) return { status: 400, json: { ok: false, error: "no_targets" } };
  if (uids.length > SENDPUSH_MAX_TARGETS) uids = uids.slice(0, SENDPUSH_MAX_TARGETS);   // cap
  const payload = (body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)) ? body.payload : {};
  const title = (typeof payload.title === "string" && payload.title) ? payload.title : "ID Seven";
  const bodyText = (typeof payload.body === "string") ? payload.body : "";
  const data = sendPushBuildData(payload);
  const db = (ctx && ctx.db) || notifDb();
  // Lookup de tokens SERVER-SIDE (Admin SDK). Mapeia token -> uid p/ cleanup direcionado.
  const tokenToUid = {};
  const tokens = [];
  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i];
    let snap;
    try { snap = await db.collection("users").doc(uid).get(); }
    catch (e) { try { logger.warn("[sendPush] lookup falhou", { uid: notifMaskUid(uid) }); } catch (_) {} continue; }
    if (!snap || !snap.exists) continue;
    const d = (typeof snap.data === "function" ? snap.data() : null) || {};
    const toks = dedupeTokensByDevice(Array.isArray(d.fcmTokens) ? d.fcmTokens.filter(Boolean) : [], d.fcmTokenMeta);
    for (let j = 0; j < toks.length; j++) { const t = toks[j]; if (t && !(t in tokenToUid)) { tokenToUid[t] = uid; tokens.push(t); } }
  }
  const total = tokens.length;
  if (!total) {
    try { logger.info("[sendPush] sem tokens", { requester: notifMaskUid(auth.uid), targets: uids.length }); } catch (_) {}
    rlKeys.forEach((k) => notifRlClear(k));
    return { status: 200, json: { ok: true, sent: 0, failed: 0, total: 0 } };
  }
  const messaging = (ctx && ctx.messaging) || admin.messaging();
  let sent = 0, failed = 0;
  const dead = [];    // { token, uid } — tokens invalidos p/ cleanup
  try {
    for (let b = 0; b < tokens.length; b += SENDPUSH_FCM_BATCH) {
      const batch = tokens.slice(b, b + SENDPUSH_FCM_BATCH);
      const resp = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: title, body: bodyText },
        data: data,
        android: { priority: "high", ttl: TTL_MS },
      });
      sent += (typeof resp.successCount === "number" ? resp.successCount : 0);
      failed += (typeof resp.failureCount === "number" ? resp.failureCount : 0);
      const responses = Array.isArray(resp.responses) ? resp.responses : [];
      for (let r = 0; r < responses.length; r++) {
        const rr = responses[r] || {};
        if (rr.success) continue;
        const code = String((rr.error && (rr.error.code || (rr.error.errorInfo && rr.error.errorInfo.code))) || "");
        if (/registration-token-not-registered|invalid-registration-token|invalid-argument/i.test(code)) {
          const tk = batch[r]; if (tk && tokenToUid[tk]) dead.push({ token: tk, uid: tokenToUid[tk] });
        }
      }
    }
  } catch (e) {
    try { logger.error("[sendPush] envio falhou", { requester: notifMaskUid(auth.uid), err: e && e.message }); } catch (_) {}
    rlKeys.forEach((k) => notifRlFail(k, now));
    return { status: 500, json: { ok: false, error: "send_failed" } };
  }
  // Cleanup de dead tokens SERVER-SIDE (arrayRemove por uid; best-effort, nao falha o request).
  if (dead.length) {
    const byUid = {};
    for (const x of dead) { (byUid[x.uid] = byUid[x.uid] || []).push(x.token); }
    for (const uid of Object.keys(byUid)) {
      try { await db.collection("users").doc(uid).update({ fcmTokens: admin.firestore.FieldValue.arrayRemove.apply(null, byUid[uid]) }); }
      catch (_) { /* best-effort; permissao/erro ignorado */ }
    }
  }
  rlKeys.forEach((k) => notifRlClear(k));
  try { logger.info("[sendPush] ok", { requester: notifMaskUid(auth.uid), targets: uids.length, sent: sent, failed: failed, total: total, cleaned: dead.length }); } catch (_) {}
  return { status: 200, json: { ok: true, sent: sent, failed: failed, total: total } };
}
// Wrapper HTTPS (onRequest => NAO usa request.auth.uid). Session-gated: precisa de
// AUTH_SESSION_SECRET. DORMENTE sem o secret => 401. NAO deployado nesta fase.
exports.sendPush = onRequest({ secrets: [AUTH_SESSION_SECRET], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS }, async (req, res) => {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }   // preflight: sem auth, sem segredo
  try {
    res.set("Cache-Control", "no-store");
    const ipHdr = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const clientIp = String(ipHdr).split(",")[0].trim() || (req.ip ? String(req.ip) : "");
    const out = await handleSendPush({ method: req.method, authHeader: (req.get && req.get("authorization")) || "", body: req.body, ip: clientIp, now: Date.now() });
    res.status(out.status).json(out.json);
  } catch (e) {
    try { logger.error("[sendPush] erro", { err: e && e.message }); } catch (_) {}   // NUNCA body/tokens
    res.status(500).json({ ok: false, error: "send_failed" });
  }
});
// Exporta logica pura p/ o harness (NAO afeta runtime; endpoint dormente/sem deploy).
exports._handleSendPush = handleSendPush;
exports._sendPushBuildData = sendPushBuildData;

/* ============================================================================
   F3.3.20-B1.7-E — SLICE 2: projecao publica segura (projectUserPublicOut).
   ----------------------------------------------------------------------------
   - Helper PURO de projeccao para a futura colecao usersPublic: allowlist EXPLICITA
     {id,name,role,admin,status,photo,color} — campos de EXIBICAO. NUNCA copia PII
     (phone/email) nem credenciais (pass/salt/fcmTokens/fcmTokenMeta) nem doc cru
     nem campos desconhecidos (sem spread). phone/email continuam via getUserContact.
   - Consistente com authUserPublicOut (mesmo shape/normalizacao); helper SEPARADO
     (NAO altera authUserPublicOut, ja deployado em loginUser). Um teste prova a
     shape-equality entre os dois.
   - ADITIVO/INERTE nesta fase: SEM trigger (syncUsersPublic), SEM backfill, SEM
     deploy, SEM Firestore, SEM UI. So o helper + testes.
   ============================================================================ */
function projectUserPublicOut(id, d) {
  const src = (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
  const str = (v) => (typeof v === "string" ? v : "");
  return {
    id: String(id),
    name: str(src.name),
    role: str(src.role),
    admin: src.admin === true,
    status: str(src.status),
    photo: str(src.photo),
    color: str(src.color),
  };
}

// Exporta logica pura p/ o harness (NAO afeta runtime; NAO e CloudFunction; sem deploy).
exports._projectUserPublicOut = projectUserPublicOut;

/* ============================================================================
   F3.3.20-B1.7-E — SLICE 2: trigger syncUsersPublic (sincroniza usersPublic).
   ----------------------------------------------------------------------------
   - onDocumentWritten("users/{uid}") gen2. CREATE/UPDATE => SET COMPLETO da projecao
     allowlist (projectUserPublicOut) em usersPublic/{uid} (sem merge => sem chaves
     remanescentes). DELETE (after ausente/!exists) => DELETE usersPublic/{uid}.
   - So toca usersPublic/{uid}: NUNCA escreve em users/{uid}, notifPrefs, fcmTokens,
     nem outro doc. NUNCA copia PII (phone/email) nem credenciais (pass/salt/fcmTokens):
     a projecao e allowlist. Logs mascaram uid; nunca logam doc/PII.
   - Erro em set/delete: loga generico (uid mascarado) e RELANCA (retry da Function);
     nunca engole erro.
   - Handler PURO testavel via deps {db, logger, maskUid}; testes com mocks (sem
     Firestore real). ADITIVO; NAO deployado nesta fase (sem backfill, sem UI, sem Rules).
   ============================================================================ */
async function handleSyncUsersPublic(event, deps) {
  deps = deps || {};
  const db = deps.db || notifDb();
  const log = deps.logger || logger;
  const mask = deps.maskUid || notifMaskUid;
  const uid = String((event && event.params && event.params.uid) || "");
  const after = event && event.data && event.data.after;
  const exists = !!(after && after.exists === true);
  const target = db.collection("usersPublic").doc(uid);
  try {
    if (!exists) { await target.delete(); return { op: "delete", uid: uid }; }
    const data = (typeof after.data === "function" ? (after.data() || {}) : {});
    await target.set(projectUserPublicOut(uid, data));   // SET COMPLETO: substitui o doc (1 arg, sem opcoes)
    return { op: "set", uid: uid };
  } catch (e) {
    try { log.error("[syncUsersPublic] erro", { uid: mask(uid), op: exists ? "set" : "delete", err: e && e.message }); } catch (_) {}
    throw e;   // relanca p/ retry (nunca engole)
  }
}

// Trigger Firestore (onDocumentWritten => NAO usa request.auth). NAO deployada nesta fase.
exports.syncUsersPublic = onDocumentWritten({ document: "users/{uid}", region: "us-central1", maxInstances: 10 }, async (event) => {
  return handleSyncUsersPublic(event);
});

// Exporta logica pura p/ o harness (NAO afeta runtime; testavel com mocks; sem deploy).
exports._handleSyncUsersPublic = handleSyncUsersPublic;

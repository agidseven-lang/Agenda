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
//     - mutedEvents[eventType] === true => false (granular opcional)
//     - platforms[platform] === false   => false (granular opcional)
async function shouldNotifyByPrefs(uid, eventType, platform) {
  if (!notifFlag("ENABLE_NOTIF_PREFS")) return true;
  let prefs = null;
  try { prefs = await getNotifPrefs(uid); } catch (_) { return true; }
  if (!prefs) return true;
  if (prefs.enabled === false) return false;
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
    const doc = {
      taskId:    String(e.taskId    != null ? e.taskId    : ""),
      eventType: String(e.eventType != null ? e.eventType : ""),
      to:        String(e.to        != null ? e.to        : ""),
      channel:   String(e.channel   != null ? e.channel   : ""),
      sent:      Number.isFinite(+e.sent)  ? +e.sent  : 0,
      total:     Number.isFinite(+e.total) ? +e.total : 0,
      reason:    String(e.reason     != null ? e.reason   : ""),
      at:        (e.at != null ? e.at : Date.now()),
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
exports.updateNotifPrefs = onRequest({ region: "us-central1", maxInstances: 10 }, async (req, res) => {
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
  let snap;
  try { snap = await notifDb().collection("users").doc(uid).get(); }
  catch (e) {
    try { logger.error("[issueNotifPrefsToken] leitura falhou", { uid: notifMaskUid(uid), err: e && e.message }); } catch (_) {}
    return { status: 500, json: { ok: false, error: "lookup_failed" } };
  }
  // uid desconhecido OU senha errada => MESMO 401 generico (nao revela existencia do uid).
  if (!snap || !snap.exists) return { status: 401, json: { ok: false, error: "invalid_credentials" } };
  const u = snap.data() || {};
  if (!notifVerifyPassword(u.pass, u.salt, password)) return { status: 401, json: { ok: false, error: "invalid_credentials" } };
  // Inativo => 403 (checado SO apos a senha correta, p/ nao vazar estado a quem nao a tem).
  const st = String(u.status || "");
  if (st === "pendente" || st === "removido" || st === "excluido") return { status: 403, json: { ok: false, error: "user_inactive" } };
  // Token p/ o PROPRIO uid provado (nunca aceita uid alvo). admin:true so se o registro marcar.
  const isAdmin = (u.admin === true);
  const claims = { uid: uid, admin: isAdmin, scope: "notifPrefs:write", iat: now, exp: now + NOTIF_TOKEN_TTL_MS };
  const token = notifSignToken(claims, notifPrefsSecret());
  try { logger.info("[issueNotifPrefsToken] emitido", { uid: notifMaskUid(uid), admin: isAdmin, exp: claims.exp }); } catch (_) {}
  return { status: 200, json: { ok: true, token: token, uid: uid, admin: isAdmin, scope: claims.scope, exp: claims.exp } };
}

// Wrapper HTTPS (onRequest => NAO usa request.auth.uid). DORMENTE: sem NOTIF_PREFS_SECRET
// => 503. NAO deployado nesta fase; NAO integrado ao Desktop/UI.
exports.issueNotifPrefsToken = onRequest({ region: "us-central1", maxInstances: 10 }, async (req, res) => {
  try {
    const out = await handleIssueNotifPrefsToken({ method: req.method, body: req.body, now: Date.now() });
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

/**
 * F3.5.3A — actorProfile.js — RESOLVEDOR CANÔNICO do PERFIL DO ATOR (CommonJS, PURO).
 * =====================================================================================
 * Contrato único usado pelo produtor da Categoria A (notifierA → notifEvents) para que o
 * MESMO eventId produza o MESMO ator (id, nome e FOTO) para TODOS os destinatários, em
 * TODAS as superfícies (toast, bg-window, backlog), independente de role/máquina/janela.
 *
 * Prioridade de fonte (somente fontes COMPROVADAS):
 *   1. foto DENORMALIZADA persistida no próprio doc/evento (designerAssignment.assignedByAvatar/
 *      assignedByPhoto, designerAvatar/designerPhoto, assigneePhoto) — quando VÁLIDA;
 *   2. perfil usersPublic correspondente ao actorId (projeção PII-free; campo `photo`);
 *   3. INICIAIS do nome (fallback neutro) — NUNCA logomarca, NUNCA foto de outro usuário.
 *
 * Segurança da imagem (sanitizePhotoUrl): aceita SOMENTE `https://…` ou `data:image/…;base64,`
 * (com limite de tamanho). Rejeita javascript:, file:, http:, blob:, caminhos locais (não são
 * compartilháveis entre computadores), HTML e qualquer outro esquema. Nunca lança; nunca loga
 * a URL inteira (diagnóstico sanitizado por categoria).
 *
 * Estados explícitos: ResolvedWithPhoto | ResolvedWithInitials | ActorNotFound |
 * PhotoMissing | PhotoInvalid (os dois últimos qualificam o ResolvedWithInitials).
 * PURO: sem Electron, sem rede, sem relógio.
 */
'use strict';

var DATA_IMAGE_MAX = 512 * 1024; // data:image inline até 512KB (evita payload IPC gigante)

var STATE = Object.freeze({
  ResolvedWithPhoto: 'ResolvedWithPhoto',
  ResolvedWithInitials: 'ResolvedWithInitials',
  ActorNotFound: 'ActorNotFound',
  PhotoMissing: 'PhotoMissing',
  PhotoInvalid: 'PhotoInvalid'
});

/** Valida a ORIGEM da foto. Retorna a URL segura ou '' (nunca lança). */
function sanitizePhotoUrl(u) {
  try {
    var s = String(u == null ? '' : u).trim();
    if (!s) return '';
    if (/[\u0000-\u001f<>"'\\]/.test(s)) return '';                    // controle/HTML/aspas ⇒ inválida
    if (/^https:\/\/[^\s]+$/i.test(s)) return s;                        // https absoluta
    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(s)) {
      return s.length <= DATA_IMAGE_MAX ? s : '';                       // data:image limitada
    }
    return '';                                                          // file:/http:/javascript:/blob:/relativa ⇒ fora
  } catch (_e) { return ''; }
}

/** Iniciais neutras do nome (1-2 letras, acentos preservados). */
function initialsOf(name) {
  try {
    var p = String(name == null ? '' : name).trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    var a = p[0].charAt(0) || '';
    var b = p.length > 1 ? (p[p.length - 1].charAt(0) || '') : '';
    return (a + b).toUpperCase();
  } catch (_e) { return ''; }
}

/**
 * Resolve o perfil canônico do ATOR de um evento.
 * @param {{actorId?:string, nameDenorm?:string, photoDenorm?:string}} ev
 * @param {(id:string)=>({name?:string, photo?:string}|null|undefined)} lookup  diretório usersPublic por id
 * @returns {{state:string, reason:string, actorId:string, name:string, photo:string, initials:string}}
 *  - photo:'' ⇒ superfícies exibem INICIAIS (nunca logo, nunca foto de terceiro).
 */
function resolveNotificationActorProfile(ev, lookup) {
  ev = ev || {};
  var id = String(ev.actorId == null ? '' : ev.actorId).trim();
  var dir = null;
  try { if (id && typeof lookup === 'function') dir = lookup(id) || null; } catch (_e) { dir = null; }

  var name = (dir && dir.name) ? String(dir.name) : String(ev.nameDenorm == null ? '' : ev.nameDenorm);
  var ini = initialsOf(name);

  // 1) foto persistida no próprio evento/doc (denormalizada pelo escritor da ação)
  var rawDenorm = String(ev.photoDenorm == null ? '' : ev.photoDenorm).trim();
  var denorm = sanitizePhotoUrl(rawDenorm);
  if (denorm) return { state: STATE.ResolvedWithPhoto, reason: 'event_denorm', actorId: id, name: name, photo: denorm, initials: ini };

  // 2) usersPublic pelo actorId (fonte canônica compartilhável)
  var rawDir = dir ? String(dir.photo == null ? '' : dir.photo).trim() : '';
  var pub = sanitizePhotoUrl(rawDir);
  if (pub) return { state: STATE.ResolvedWithPhoto, reason: 'usersPublic', actorId: id, name: name, photo: pub, initials: ini };

  // 3) INICIAIS — diferenciando ausência real de inválida/ator desconhecido (diagnóstico sanitizado)
  var reason;
  if (rawDenorm || rawDir) reason = STATE.PhotoInvalid;                 // havia valor, mas origem não permitida
  else if (!id || (!dir && !ev.nameDenorm)) reason = STATE.ActorNotFound;
  else reason = STATE.PhotoMissing;                                     // ausência real de foto cadastrada
  return { state: STATE.ResolvedWithInitials, reason: reason, actorId: id, name: name, photo: '', initials: ini };
}

module.exports = {
  STATE: STATE, DATA_IMAGE_MAX: DATA_IMAGE_MAX,
  sanitizePhotoUrl: sanitizePhotoUrl, initialsOf: initialsOf,
  resolveNotificationActorProfile: resolveNotificationActorProfile
};

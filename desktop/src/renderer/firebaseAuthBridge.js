/**
 * F4.2F — Bridge de Firebase Auth SILENCIOSO (Desktop), módulo PURO e testável.
 *
 * Orquestra: sessão server-side já concluída → issueFirebaseAuthToken (Bearer, no MAIN) →
 * signInWithCustomToken (no MESMO app Firebase do renderer que faz as operações Firestore) →
 * confirma currentUser.uid == UID da sessão → segue o carregamento normal.
 *
 * Migração ADITIVA em produção: a autenticação atual continua sendo a AUTORIDADE do login.
 * Flags:
 *   enabled  (DESKTOP_FIREBASE_AUTH_ENABLED=true)  — liga o bridge silencioso.
 *   required (DESKTOP_FIREBASE_AUTH_REQUIRED=false) — quando false, falha TRANSITÓRIA do bridge
 *            NUNCA bloqueia a Desktop (fail-open). Segurança (uid divergente / usuário desativado /
 *            sessão inválida) é SEMPRE fail-closed, independente de `required`.
 *
 * Este arquivo é UMD: carrega como <script> no renderer (global FirebaseAuthBridge) e é
 * require()-ado pelos testes .mjs/.cjs com dependências mockadas. NÃO importa firebase/electron —
 * tudo entra por injeção. O Custom Token NUNCA é logado/persistido: fica só no argumento de signIn.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FirebaseAuthBridge = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Flags canônicas (fonte única). O renderer lê FirebaseAuthBridge.FLAGS; os testes injetam.
  var FLAGS = { enabled: true, required: false };

  var DEFAULTS = { maxAttempts: 5, baseDelayMs: 4000, maxDelayMs: 60000 };

  // Estados de diagnóstico permitidos (sanitizados — nunca token/senha/uid completo).
  // firebaseAuthBridge.started / .success / .retry / .signedOut / .uidMismatch / .disabled / .giveUp
  function maskUid(uid) {
    var s = String(uid || "");
    if (!s) return "";
    if (s.length <= 6) return s.slice(0, 2) + "…";
    return s.slice(0, 3) + "…" + s.slice(-2);
  }

  /**
   * Cria um bridge. `deps` (todas injetáveis p/ teste):
   *   flags:        { enabled, required }
   *   issueToken(): Promise<{ ok, token?, uid?, transient?, fatal?, reason? }>   (MAIN via IPC)
   *   signIn(tok):  Promise<{ ok, uid?, transient?, mismatch?, reason? }>        (firebase.auth do renderer)
   *   signOut():    Promise<void>                                               (firebase.auth().signOut)
   *   onFailClosed(reason): void                                               (voltar ao login + limpar sessão)
   *   onSuccess(uid): void                                                     (opcional)
   *   log(state, data?): void                                                  (diag sanitizado)
   *   now(): number                                                            (default Date.now)
   *   setTimer(fn, ms): handle / clearTimer(handle)                            (default setTimeout)
   *   maxAttempts / baseDelayMs / maxDelayMs
   */
  function createFirebaseAuthBridge(deps) {
    deps = deps || {};
    var flags = deps.flags || FLAGS;
    var log = typeof deps.log === "function" ? deps.log : function () {};
    var now = typeof deps.now === "function" ? deps.now : function () { return Date.now(); };
    var setTimer = typeof deps.setTimer === "function" ? deps.setTimer : function (fn, ms) { return setTimeout(fn, ms); };
    var clearTimer = typeof deps.clearTimer === "function" ? deps.clearTimer : function (h) { try { clearTimeout(h); } catch (_) {} };
    var maxAttempts = deps.maxAttempts || DEFAULTS.maxAttempts;
    var baseDelayMs = deps.baseDelayMs || DEFAULTS.baseDelayMs;
    var maxDelayMs = deps.maxDelayMs || DEFAULTS.maxDelayMs;

    var running = false;   // impede corridas / loops paralelos
    var stopped = false;   // logout/teardown cancela retries pendentes
    var timer = null;

    function backoff(attempt) {
      var d = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
      return Math.min(d, maxDelayMs);
    }
    function wait(ms) {
      return new Promise(function (resolve) {
        timer = setTimer(function () { timer = null; resolve(); }, ms);
      });
    }

    async function attemptOnce() {
      // 1) Custom Token (MAIN, Bearer da sessão). O token só existe no retorno + no argumento de signIn.
      var tok = await deps.issueToken();
      if (!tok || !tok.ok) {
        if (tok && tok.fatal) {
          // sessão inválida (401) / usuário desativado (403) → SEGURANÇA: fail-closed.
          return { done: true, outcome: "fail_closed", reason: (tok && tok.reason) || "token_fatal" };
        }
        // rede/timeout/5xx/indisponível/resposta inválida → TRANSITÓRIA: fail-open (retry).
        return { done: false, reason: (tok && tok.reason) || "token_unavailable" };
      }
      // 2) signInWithCustomToken no app Firebase REAL do renderer. Token usado IMEDIATAMENTE.
      var si = await deps.signIn(tok.token);
      if (si && si.ok) {
        var expected = String(tok.uid || (typeof deps.expectedUid === "function" ? deps.expectedUid() : "") || "");
        var got = String(si.uid || "");
        if (got && expected && got === expected) {
          return { done: true, outcome: "success", uid: got };
        }
        if (got && expected && got !== expected) {
          // uid NÃO-VAZIO e divergente → identidade CONFIRMADA de outro usuário: fail-closed.
          return { done: true, outcome: "fail_closed", reason: "uid_mismatch", expected: expected, got: got };
        }
        // currentUser nulo / uid não-confirmável → NÃO É prova de outra identidade: transitória
        // (fail-open, retry). Nunca deslogar por um glitch de SDK (REQUIRED=false).
        return { done: false, reason: "uid_unconfirmed" };
      }
      // sign-in falhou
      if (si && si.mismatch) {
        // auth/custom-token-mismatch → identidade pertence a outro usuário: fail-closed.
        return { done: true, outcome: "fail_closed", reason: "token_mismatch" };
      }
      // network/internal/invalid-custom-token → transitória (fail-open): retry limitado.
      return { done: false, reason: (si && si.reason) || "signin_unavailable" };
    }

    async function run(reason) {
      if (!flags || !flags.enabled) { log("firebaseAuthBridge.disabled", {}); return { outcome: "disabled" }; }
      if (running) { return { outcome: "already_running" }; }
      running = true; stopped = false;
      log("firebaseAuthBridge.started", { reason: String(reason || "") });
      try {
        // BOOTSTRAP — "obter novo Custom Token SOMENTE quando necessário": se o SDK já tem um
        // currentUser persistido com o uid da sessão, a identidade já está restaurada → sucesso
        // sem cunhar novo token. (uid divergente NÃO faz atalho: cai no fluxo normal que re-cunha
        // p/ o usuário correto, trocando o anterior.)
        if (typeof deps.currentUid === "function" && typeof deps.expectedUid === "function") {
          var cur = String(deps.currentUid() || "");
          var exp0 = String(deps.expectedUid() || "");
          if (cur && exp0 && cur === exp0) {
            log("firebaseAuthBridge.success", { uid: maskUid(cur), cached: true });
            if (typeof deps.onSuccess === "function") { try { deps.onSuccess(cur); } catch (_) {} }
            return { outcome: "success", cached: true };
          }
        }
        var attempt = 0;
        // Loop com backoff exponencial capado e TETO de tentativas (sem loop infinito).
        // Sai em: success | fail_closed | teto de tentativas (transient_giveup).
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (stopped) return { outcome: "stopped" };
          attempt++;
          var res;
          try { res = await attemptOnce(); }
          catch (e) { res = { done: false, reason: "exception" }; } // fail-open: exceção nunca bloqueia
          if (stopped) return { outcome: "stopped" };

          if (res.done && res.outcome === "success") {
            log("firebaseAuthBridge.success", { uid: maskUid(res.uid) });
            if (typeof deps.onSuccess === "function") { try { deps.onSuccess(res.uid); } catch (_) {} }
            return { outcome: "success" };
          }
          if (res.done && res.outcome === "fail_closed") {
            log("firebaseAuthBridge.uidMismatch", res.reason === "uid_mismatch"
              ? { expected: maskUid(res.expected), got: maskUid(res.got) }
              : { reason: res.reason });
            try { await deps.signOut(); } catch (_) {}
            log("firebaseAuthBridge.signedOut", { reason: res.reason });
            if (typeof deps.onFailClosed === "function") { try { deps.onFailClosed(res.reason); } catch (_) {} }
            return { outcome: "fail_closed", reason: res.reason };
          }
          // transitória → fail-open. Se `required`, ainda assim NÃO bloqueia nesta fase (REQUIRED=false),
          // mas o teto/attempt garante convergência (sem loop).
          if (attempt >= maxAttempts) {
            log("firebaseAuthBridge.giveUp", { attempts: attempt, reason: res.reason });
            return { outcome: "transient_giveup", reason: res.reason };
          }
          var delay = backoff(attempt);
          log("firebaseAuthBridge.retry", { attempt: attempt, delayMs: delay, reason: res.reason });
          await wait(delay);
        }
      } finally {
        running = false;
      }
    }

    function stop() {
      stopped = true;
      if (timer) { clearTimer(timer); timer = null; }
    }

    return { run: run, stop: stop, _maskUid: maskUid, _backoff: backoff };
  }

  return { createFirebaseAuthBridge: createFirebaseAuthBridge, FLAGS: FLAGS, maskUid: maskUid };
});

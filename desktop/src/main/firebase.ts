// Mesma base do APK/Web Preview — sem mudanca de schema.
import { initializeApp } from "firebase/app";
import {
  collection, initializeFirestore, onSnapshot,
  query, QuerySnapshot, DocumentData,
} from "firebase/firestore";
import { diag } from "./diag";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBbeZ5M9iNgzw5382iCIDKB-G2QqKuwAes",
  authDomain: "agenda-id-seven.firebaseapp.com",
  projectId: "agenda-id-seven",
  storageBucket: "agenda-id-seven.firebasestorage.app",
  messagingSenderId: "391529908613",
  appId: "1:391529908613:web:ba62ed04ff7d0d776cdcec",
};

export const fbApp = initializeApp(FIREBASE_CONFIG);
// F3.3.10-FIX (atribuição em background) — no Electron MAIN (Node) o transporte WebChannel padrão do
// Firestore costuma entregar só o snapshot inicial e ESTAGNAR nas mudanças em tempo real → o notifier
// do main não dispara a atribuição com a janela minimizada/bandeja. Long-polling é o transporte
// confiável em Node: o notifier (que roda no main, NUNCA suspenso) passa a receber a atribuição em
// tempo real em background → Notification NATIVA. NÃO altera projeto/credenciais/regras do Firebase;
// é só o transporte do cliente. (Mesma base do APK/Web; sem mudança de schema/escrita.)
export const db = initializeFirestore(fbApp, { experimentalForceLongPolling: true });

// F3.5.4N — OBSERVADOR DE SAÚDE (aditivo; NÃO altera a entrega/re-attach existentes). O main
// (listenerWatchdog) assina para reagir a SINAIS REAIS do Firestore: attach/snapshot/error/rearm,
// com a geração da assinatura. Nunca interrompe a assinatura; só observa. Falha do observador
// jamais derruba a entrega (try/catch em cada emissão).
export type ListenHealth = { col: string; event: "attach" | "snapshot" | "error" | "rearm"; attempt: number; generation: number; size?: number; changes?: number; err?: string };
let _healthObserver: ((h: ListenHealth) => void) | null = null;
export function setListenHealthObserver(cb: ((h: ListenHealth) => void) | null): void { _healthObserver = cb; }
let _genCounter = 0;
function _emitHealth(h: ListenHealth): void { try { if (_healthObserver) _healthObserver(h); } catch { /* observador nunca derruba a entrega */ } }

export function listen<T extends DocumentData>(
  name: string,
  cb: (snap: QuerySnapshot<T>) => void
) {
  const generation = ++_genCounter; // identidade REAL desta assinatura (nova a cada re-attach externo)
  // F3.3.10-DIAG — loga cada snapshot recebido pelo MAIN (prova se o realtime chega em background)
  // + erros de transporte.
  // F3.4.7 — AUTO-CURA: quando o callback de ERRO do onSnapshot dispara, o SDK do Firestore
  // ENCERRA o listener em definitivo (ele não volta sozinho). Sem reanexar, o main fica surdo
  // para sempre (Desktop vive dias na bandeja): tarefa nova/prazo alterado nunca entram no mapa
  // do slaScheduler e NENHUMA amarela/vermelha é emitida em NENHUM estado de janela, enquanto o
  // timer de segurança segue reavaliando um mapa CONGELADO (parece vivo no log). Correção:
  // re-attach com backoff exponencial capado (5s→60s), resetado no primeiro snapshot saudável.
  let stopped = false;
  let unsub: (() => void) | null = null;
  let rearmTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  const attach = (): void => {
    if (stopped) return;
    diag("firestore.listen.attach", { col: name, attempt });
    _emitHealth({ col: name, event: "attach", attempt, generation });
    unsub = onSnapshot(
      query(collection(db, name)) as any,
      (s: any) => {
        attempt = 0; // stream saudável ⇒ backoff volta ao início
        let changes = 0; try { changes = (s.docChanges && s.docChanges() || []).length; } catch { /* */ }
        try { diag("firestore.snapshot", { col: name, size: s.size, changes }); } catch { /* */ }
        _emitHealth({ col: name, event: "snapshot", attempt: 0, generation, size: Number(s.size) || 0, changes });
        cb(s as any);
      },
      (err: any) => {
        const emsg = String((err && err.message) || err);
        try { diag("firestore.error", { col: name, err: emsg }); } catch { /* */ }
        _emitHealth({ col: name, event: "error", attempt, generation, err: emsg });
        try { if (unsub) unsub(); } catch { /* */ }
        unsub = null;
        if (stopped) return;
        attempt++;
        const delayMs = Math.min(5000 * Math.pow(2, attempt - 1), 60000);
        try { diag("firestore.listen.rearm", { col: name, attempt, delayMs }); } catch { /* */ }
        _emitHealth({ col: name, event: "rearm", attempt, generation });
        rearmTimer = setTimeout(attach, delayMs);
      }
    );
  };
  attach();
  return () => {
    stopped = true;
    try { if (rearmTimer) { clearTimeout(rearmTimer); rearmTimer = null; } } catch { /* */ }
    try { if (unsub) unsub(); } catch { /* */ }
    unsub = null;
  };
}

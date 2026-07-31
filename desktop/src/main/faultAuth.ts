/**
 * F3.5.4N — faultAuth.ts — AUTORIZAÇÃO ASSINADA (Ed25519) do fault-injection de teste.
 * =====================================================================================
 * O mecanismo de fault-injection (interromper de verdade a assinatura para provar a autocorreção)
 * fica PRESENTE no binário porém INACESSÍVEL por padrão. Só é liberado por um TOKEN:
 *   - assinado por uma chave PRIVADA que vive FORA do aplicativo (com o owner, offline);
 *   - o app embute SOMENTE a chave PÚBLICA (verificação; NÃO é segredo, não mina tokens);
 *   - vinculado ao deviceId da máquina autorizada;
 *   - com expiração (exp) curta;
 *   - de uso único por nonce (o chamador registra o nonce consumido).
 * Assim: NÃO há segredo reutilizável nem senha fixa no cliente (reforço #8); usuário comum ou
 * ambiente de produção NÃO conseguem ativar (sem a chave privada, nenhum token válido existe);
 * e os MESMOS bytes testados vão para produção (o hook é inerte sem token — reforço #5/#18).
 *
 * Formato do token: base64url(JSON(payload)) + "." + base64url(assinatura Ed25519 do JSON(payload)).
 *   payload = { action:"listener.fault-injection", deviceId, exp:<ms epoch>, nonce }
 */
import crypto from "crypto";

// Chave PÚBLICA de verificação (SPKI PEM). NÃO é segredo. A chave PRIVADA correspondente é gerada
// EXCLUSIVAMENTE na máquina Windows controlada da ID Seven (ferramenta local independente
// tools/f354n-fault-authorizer) e permanece SOMENTE com o owner — NUNCA entra no app/repo/log/chat.
// ATÉ o owner gerar e me enviar a PÚBLICA DEFINITIVA, esta constante é um PLACEHOLDER e o
// fault-injection fica FAIL-CLOSED (verifyFaultToken devolve ok:false / no_pubkey_provisioned):
// nenhuma assinatura é interrompida, nenhum botão admin aparece, nenhum IPC executa a ação.
export const FAULT_INJECTION_PUBLIC_KEY_PEM = "__F354N_FAULT_PUBLIC_KEY_PLACEHOLDER__";

/** Há chave pública DEFINITIVA provisionada? (PEM real, não o placeholder) */
export function faultPublicKeyProvisioned(pem?: string): boolean {
  const p = String(pem || FAULT_INJECTION_PUBLIC_KEY_PEM || "");
  return p.indexOf("BEGIN PUBLIC KEY") >= 0;
}

export type FaultAuthResult = { ok: boolean; reason?: string; exp?: number; nonce?: string };

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/**
 * Verifica um token de fault-injection. NÃO tem efeito colateral (não consome nonce): o chamador
 * é responsável por rejeitar nonce já usado. Retorna ok=false com reason sanitizado em qualquer
 * divergência (assinatura inválida, deviceId, expirado, ação, formato).
 */
export function verifyFaultToken(token: string, deviceId: string, nowMs: number, publicKeyPem?: string): FaultAuthResult {
  try {
    const t = String(token || "");
    const dot = t.indexOf(".");
    if (dot <= 0 || dot >= t.length - 1) return { ok: false, reason: "format" };
    const payloadRaw = b64urlDecode(t.slice(0, dot));
    const sig = b64urlDecode(t.slice(dot + 1));
    let payload: any;
    try { payload = JSON.parse(payloadRaw.toString("utf8")); } catch { return { ok: false, reason: "payload" }; }
    if (!payload || payload.action !== "listener.fault-injection") return { ok: false, reason: "action" };
    if (String(payload.deviceId || "") !== String(deviceId || "") || !deviceId) return { ok: false, reason: "device" };
    const exp = Number(payload.exp || 0);
    if (!exp || nowMs >= exp) return { ok: false, reason: "expired" };
    if (!payload.nonce) return { ok: false, reason: "nonce" };
    const pem = publicKeyPem || FAULT_INJECTION_PUBLIC_KEY_PEM;
    if (!faultPublicKeyProvisioned(pem)) return { ok: false, reason: "no_pubkey_provisioned" }; // FAIL-CLOSED até a pública definitiva
    let pub: crypto.KeyObject;
    try { pub = crypto.createPublicKey(pem); } catch { return { ok: false, reason: "pubkey" }; }
    const good = crypto.verify(null, payloadRaw, pub, sig);
    if (!good) return { ok: false, reason: "signature" };
    return { ok: true, exp, nonce: String(payload.nonce) };
  } catch (e) {
    return { ok: false, reason: "error" };
  }
}

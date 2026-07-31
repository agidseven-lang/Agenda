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

// Chave PÚBLICA de verificação (SPKI PEM). NÃO é segredo. A privada correspondente NUNCA entra
// no app/repo — fica offline com o owner (entregue no runbook). Para trocar de custódia, basta
// substituir esta constante pela pública do owner.
export const FAULT_INJECTION_PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MCowBQYDK2VwAyEAc1F2Rpw2HrdIjF6O9lzbIB0a4rLvp7YhTqDM9w8nypc=\n" +
  "-----END PUBLIC KEY-----\n";

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
    let pub: crypto.KeyObject;
    try { pub = crypto.createPublicKey(publicKeyPem || FAULT_INJECTION_PUBLIC_KEY_PEM); } catch { return { ok: false, reason: "pubkey" }; }
    const good = crypto.verify(null, payloadRaw, pub, sig);
    if (!good) return { ok: false, reason: "signature" };
    return { ok: true, exp, nonce: String(payload.nonce) };
  } catch (e) {
    return { ok: false, reason: "error" };
  }
}

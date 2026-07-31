#!/usr/bin/env node
/**
 * F3.5.4N — AUTORIZADOR LOCAL do fault-injection (FERRAMENTA INDEPENDENTE — NÃO faz parte do Agenda).
 * =====================================================================================
 * Roda na MÁQUINA WINDOWS CONTROLADA da ID Seven. NÃO é distribuída aos usuários, NÃO é empacotada
 * no aplicativo (vive em tools/, fora de desktop/). Sem dependências externas (só Node "crypto").
 *
 * A CHAVE PRIVADA é gerada e permanece EXCLUSIVAMENTE nesta máquina. NUNCA a envie por chat, log,
 * repositório, release, artifact ou app. Envie ao Claude SOMENTE a CHAVE PÚBLICA (para embutir no
 * app) — a pública não é segredo (só verifica; não mina tokens).
 *
 * Comandos:
 *   node authorize.mjs keygen [--out <dir>]
 *       Gera o par Ed25519. Grava a PRIVADA (f354n-fault-private.pem, permissão restrita) e a
 *       PÚBLICA (f354n-fault-public.pem). Imprime a PÚBLICA para você enviar ao Claude.
 *
 *   node authorize.mjs pubkey --key <private.pem>
 *       Reimprime a PÚBLICA derivada da PRIVADA (caso precise reenviar).
 *
 *   node authorize.mjs sign --key <private.pem> --device <deviceId> [--ttl <minutos=15>]
 *       Emite UMA autorização assinada, vinculada ao deviceId, com expiração curta e nonce único.
 *       Imprime o TOKEN (cole no campo "Autorização administrativa" do app, na máquina de teste).
 *       Cada execução gera um nonce novo (uso único — o app rejeita nonce repetido).
 *
 * O TOKEN autoriza a AÇÃO "listener.fault-injection" (interromper de verdade a assinatura ativa
 * para provar a autocorreção). Sem token válido/assinado/não expirado/vinculado ao deviceId, o app
 * mantém o fault-injection INACESSÍVEL.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ACTION = "listener.fault-injection";
const args = process.argv.slice(2);
const cmd = args[0];
function opt(name, def) { const i = args.indexOf("--" + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; }
function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

function keygen() {
  const outDir = path.resolve(opt("out", "."));
  fs.mkdirSync(outDir, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privPath = path.join(outDir, "f354n-fault-private.pem");
  const pubPath = path.join(outDir, "f354n-fault-public.pem");
  fs.writeFileSync(privPath, privPem, { mode: 0o600 });
  try { fs.chmodSync(privPath, 0o600); } catch { /* Windows ignora chmod POSIX */ }
  fs.writeFileSync(pubPath, pubPem);
  console.log("== PAR Ed25519 GERADO (SOMENTE nesta máquina) ==");
  console.log("PRIVADA: " + privPath + "  <-- NUNCA envie/compartilhe. Guarde offline.");
  console.log("PÚBLICA: " + pubPath);
  console.log("\n== CHAVE PÚBLICA (envie ISTO ao Claude para embutir no app) ==");
  process.stdout.write(pubPem.endsWith("\n") ? pubPem : pubPem + "\n");
}

function pubkey() {
  const keyPath = opt("key", "");
  if (!keyPath) { console.error("uso: pubkey --key <private.pem>"); process.exit(2); }
  const priv = crypto.createPrivateKey(fs.readFileSync(keyPath, "utf8"));
  const pub = crypto.createPublicKey(priv);
  process.stdout.write(pub.export({ type: "spki", format: "pem" }).toString());
}

function sign() {
  const keyPath = opt("key", "");
  const device = opt("device", "");
  const ttlMin = Math.max(1, Math.min(120, Number(opt("ttl", "15")) || 15));
  if (!keyPath || !device) { console.error("uso: sign --key <private.pem> --device <deviceId> [--ttl <min>]"); process.exit(2); }
  const priv = crypto.createPrivateKey(fs.readFileSync(keyPath, "utf8"));
  const payload = { action: ACTION, deviceId: String(device), exp: Date.now() + ttlMin * 60000, nonce: crypto.randomBytes(12).toString("hex") };
  const payloadBuf = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = crypto.sign(null, payloadBuf, priv);
  const token = b64url(payloadBuf) + "." + b64url(sig);
  console.log("== AUTORIZAÇÃO DE FAULT-INJECTION (uso único) ==");
  console.log("deviceId : " + payload.deviceId);
  console.log("expira   : " + new Date(payload.exp).toISOString() + " (" + ttlMin + " min)");
  console.log("nonce    : " + payload.nonce);
  console.log("\nTOKEN (cole no app, campo Autorização administrativa):");
  console.log(token);
}

try {
  if (cmd === "keygen") keygen();
  else if (cmd === "pubkey") pubkey();
  else if (cmd === "sign") sign();
  else { console.log("F3.5.4N fault authorizer\ncomandos: keygen | pubkey --key <pem> | sign --key <pem> --device <id> [--ttl <min>]"); process.exit(cmd ? 1 : 0); }
} catch (e) { console.error("erro:", (e && e.message) || e); process.exit(1); }

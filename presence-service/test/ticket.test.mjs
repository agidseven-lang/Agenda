#!/usr/bin/env node
/* Testes puros do ticket (Web Crypto; roda em Node e no Worker). */
import { signTicket, verifyTicket } from "../src/core.mjs";

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };
const SECRET = "test-presence-secret-0123456789";
const AUD = "idseven-presence";

(async () => {
  const now = 1_000_000_000_000;
  const base = { aud: AUD, sub: "u1", name: "Real Name", role: "Designer", photo: "p", admin: false, deviceId: "d1", nonce: "n1", iat: now, exp: now + 60000 };

  const tok = await signTicket(base, SECRET);
  ok("1 assina + verifica (roundtrip) devolve o mesmo sub", (await verifyTicket(tok, SECRET, { aud: AUD, nowMs: now })).sub === "u1");
  ok("2 ticket expirado é rejeitado (now >= exp)", (await verifyTicket(tok, SECRET, { aud: AUD, nowMs: now + 60001 })) === null);
  ok("3 reuso após expirar é rejeitado", (await verifyTicket(tok, SECRET, { aud: AUD, nowMs: now + 120000 })) === null);
  ok("4 audience errado é rejeitado", (await verifyTicket(tok, SECRET, { aud: "outra", nowMs: now })) === null);
  ok("5 assinatura adulterada é rejeitada", (await verifyTicket(tok + "x", SECRET, { aud: AUD, nowMs: now })) === null);
  ok("6 secret errado é rejeitado", (await verifyTicket(tok, "secret-errado", { aud: AUD, nowMs: now })) === null);

  // payload adulterado (troca sub) sem re-assinar
  const parts = tok.split(".");
  const forged = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  forged.sub = "u2";
  const forgedB64 = Buffer.from(JSON.stringify(forged)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const forgedTok = parts[0] + "." + forgedB64 + "." + parts[2];
  ok("7 payload adulterado (sub trocado) é rejeitado (assinatura não confere)", (await verifyTicket(forgedTok, SECRET, { aud: AUD, nowMs: now })) === null);

  ok("8 emitido no futuro (iat >> now) é rejeitado", (await verifyTicket(await signTicket({ ...base, iat: now + 300000, exp: now + 360000 }, SECRET), SECRET, { aud: AUD, nowMs: now })) === null);
  ok("9 sem exp é rejeitado", (await verifyTicket(await signTicket({ ...base, exp: undefined }, SECRET), SECRET, { aud: AUD, nowMs: now })) === null);

  console.log(`\nticket.test: PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

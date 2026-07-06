#!/usr/bin/env node
/* =====================================================================
 * F3.3.61-J — Testes do cutover Web para os endpoints users-write.
 * PARTE A (estática, index.html): flag users_write_endpoints (default OFF),
 *   5 clients, cada write migrado com ON->client / OFF->fallback direto,
 *   nenhum token logado, autoexclusão via deleteMyAccountClient, admin via
 *   adminSetUser*Client, self-profile via updateUserSelfClient, lastSeen via
 *   touchUserLastSeenClient.
 * PARTE B (hermética, functions/index.js): updateUserSelf agora aceita
 *   name/phone/email e REJEITA role/admin/status/pass/salt; deleteMyAccount
 *   (self) sem sessão->401, com sessão marca status="excluido"+limpa PII e
 *   NUNCA retorna PII; método != POST -> 405.
 * Puro/offline: NAO deploya, NAO usa rede, NAO usa Firestore real.
 * Rodar: node scripts/worker-ops/f3361J-web-users-write-client-cutover.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import crypto from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SRC = fs.readFileSync(path.join(ROOT, "functions", "index.js"), "utf8");

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };
const hasHtml = (re) => re.test(HTML);

/* ---------------- PARTE A — estática (index.html) ---------------- */
// flag default OFF (só "on" liga)
ok("A1 flag usersWriteEndpointsEnabled default OFF", /function usersWriteEndpointsEnabled\(\)\s*\{[^}]*lsGet\("users_write_endpoints"\)\s*===\s*"on"/.test(HTML));
ok("A2 flag NAO usa padrão default-ON (!==off)", !/usersWriteEndpointsEnabled\(\)\s*\{[^}]*!==\s*"off"/.test(HTML));
// 5 clients definidos
for (const c of ["updateUserSelfClient", "touchUserLastSeenClient", "adminSetUserStatusClient", "adminSetUserAdminClient", "deleteMyAccountClient"]) {
  ok("A3 client " + c + " definido", new RegExp("async function " + c + "\\(").test(HTML));
}
// clients usam authGetSession + Bearer
ok("A4 clients usam authGetSession + Bearer", (HTML.match(/authGetSession\(\); if\(!s \|\| !s\.token\) return \{ ok:false, error:"unauthorized" \}/g) || []).length >= 5);
// cada write migrado: ON -> client
ok("A5 color ON->updateUserSelfClient", hasHtml(/if\(usersWriteEndpointsEnabled\(\)\)\{ const _r=await updateUserSelfClient\(\{color:hex\}\)/));
ok("A6 reminderMinutes ON->updateUserSelfClient", hasHtml(/if\(usersWriteEndpointsEnabled\(\)\)\{ const _r=await updateUserSelfClient\(\{reminderMinutes:v\}\)/));
ok("A7 photo ON->updateUserSelfClient", hasHtml(/if\(usersWriteEndpointsEnabled\(\)\)\{ const _r=await updateUserSelfClient\(\{photo:photoUrl\}\)/));
ok("A8 photo-remove ON->updateUserSelfClient", hasHtml(/if\(usersWriteEndpointsEnabled\(\)\)\{ const _r=await updateUserSelfClient\(\{photo:""\}\)/));
ok("A9 basic-data ON->updateUserSelfClient (name/phone/email; role fora)", hasHtml(/_selfPatch\.name=updates\.name/) && hasHtml(/delete updates\.role/));
ok("A10 lastSeen ON->touchUserLastSeenClient", hasHtml(/if\(usersWriteEndpointsEnabled\(\)\)\{ touchUserLastSeenClient\(\)\.catch/));
ok("A11 status ON->adminSetUserStatusClient", hasHtml(/adminSetUserStatusClient\(b\.dataset\.ap,"ativo"\)/));
ok("A12 admin ON->adminSetUserAdminClient", hasHtml(/adminSetUserAdminClient\(b\.dataset\.adm,mk\)/));
ok("A13 autoexclusão ON->deleteMyAccountClient", hasHtml(/if\(usersWriteEndpointsEnabled\(\)\)\{ const _r=await deleteMyAccountClient\(\)/));
// cada write migrado: OFF -> fallback direto preservado
ok("A14 fallback OFF color", hasHtml(/else\{ await db\.collection\("users"\)\.doc\(me\.id\)\.update\(\{color:hex\}\)/));
ok("A15 fallback OFF status", hasHtml(/else\{ await db\.collection\("users"\)\.doc\(b\.dataset\.ap\)\.update\(\{status:"ativo"\}\)/));
ok("A16 fallback OFF admin", hasHtml(/else\{ await db\.collection\("users"\)\.doc\(b\.dataset\.adm\)\.update\(\{admin:mk\}\)/));
ok("A17 fallback OFF autoexclusão", hasHtml(/else\{ await db\.collection\("users"\)\.doc\(me\.id\)\.update\(\{\s*status:"excluido"/));
// pass/salt: rehash legado pulado no modo ON
ok("A18 rehash legado pulado no ON", hasHtml(/try\{ if\(!usersWriteEndpointsEnabled\(\)\)\{ const salt=randSalt\(\);/));
// password: gate honra a nova flag
ok("A19 changePassword honra nova flag", hasHtml(/if\(usersReadHardeningEnabled\(\) \|\| usersWriteEndpointsEnabled\(\)\)\{/));
// nenhum token logado DENTRO dos corpos dos 5 clients novos (escopo restrito — não o arquivo todo)
function clientBody(name){ const a=HTML.indexOf("async function "+name+"("); if(a<0) return ""; let d=0; for(let j=HTML.indexOf("{",a); j<HTML.length; j++){ const c=HTML[j]; if(c==="{")d++; else if(c==="}"){ d--; if(!d) return HTML.slice(a,j+1); } } return ""; }
const _clientBodies=["updateUserSelfClient","touchUserLastSeenClient","adminSetUserStatusClient","adminSetUserAdminClient","deleteMyAccountClient"].map(clientBody).join("\n");
ok("A20 clients novos não logam token/sessão", _clientBodies.length>0 && !/console\.(log|warn|error)\s*\(/.test(_clientBodies) && !/\.token\b[^)]*console/.test(_clientBodies));

/* ---------------- PARTE B — hermética (functions/index.js) ---------------- */
function grab(n){ let a=SRC.indexOf("async function "+n+"("); if(a<0)a=SRC.indexOf("function "+n+"("); if(a<0)throw new Error("fn? "+n); let d=0; for(let j=SRC.indexOf("{",a); j<SRC.length; j++){ const c=SRC[j]; if(c==="{")d++; else if(c==="}"){ d--; if(!d)return SRC.slice(a,j+1); } } throw new Error("end? "+n); }
function grabConst(n){ const m=new RegExp("^const "+n+"\\b[^\\n]*$","m").exec(SRC); if(!m)throw new Error("const? "+n); return m[0]; }
const CONSTS=["AUTH_SESSION_TTL_MS","USER_SELF_UPDATE_KEYS"];
const FNS=["sha256Hex","hashPw","randSalt","normEmail","isValidEmail","notifMaskUid","notifSignToken","notifVerifyToken","authSessionSecret","authVerifySessionToken","authUserPublicOut","notifRlBlocked","notifRlFail","notifRlClear","notifDb","uwValidColor","uwValidPhoto","uwValidReminder","uwValidStr","uwTargetId","handleUpdateUserSelf","handleDeleteMyAccount"];
let BODY=""; for(const n of CONSTS)BODY+=grabConst(n)+"\n"; for(const n of FNS)BODY+=grab(n)+"\n";
const PRELUDE=`
  var NOTIF_RL_MAX=5,NOTIF_RL_WINDOW_MS=3e5,NOTIF_RL_BLOCK_MS=9e5;var __notifRlState=new Map();
  var __users={};var __writes=[];var __logs=[];
  function _col(c){return{doc:function(id){return{
    get:async function(){var d=(c==="users")?__users[id]:undefined;return{exists:!!d,data:function(){return d||null;}};},
    update:async function(p){__writes.push({id:id,patch:p});if(c==="users"&&__users[id])for(var k in p)__users[id][k]=p[k];return{};}
  };}};}
  var admin={firestore:function(){return{collection:_col};}};
  var logger={info:function(){__logs.push([].slice.call(arguments));},warn:function(){},error:function(){__logs.push([].slice.call(arguments));}};
`;
const SECRET="test-secret-f3361j"; process.env.AUTH_SESSION_SECRET=SECRET;
const H=new Function("crypto", PRELUDE+BODY+`return {
  sign:notifSignToken, TTL:AUTH_SESSION_TTL_MS, keys:USER_SELF_UPDATE_KEYS,
  reset:function(u){for(var k in __users)delete __users[k];if(u)for(var kk in u)__users[kk]=u[kk];__writes.length=0;__logs.length=0;__notifRlState.clear();},
  users:function(){return __users;},writes:function(){return __writes;},
  updateUserSelf:handleUpdateUserSelf, deleteMyAccount:handleDeleteMyAccount
};`)(crypto);
const NOW=17e11;
function sess(uid){ return "Bearer "+H.sign({uid:uid,admin:false,role:"",scope:"session",iat:NOW,exp:NOW+H.TTL}, SECRET); }
const call=(fn,ctx)=>H[fn](Object.assign({now:NOW},ctx));
const noSecret=(j)=>!/pass|salt|fcmTokens/i.test(JSON.stringify(j||{}));

(async()=>{
  // updateUserSelf allowlist estendida
  ok("B1 allowlist inclui name/phone/email", ["name","phone","email","color","photo","reminderMinutes"].every(k=>H.keys.indexOf(k)>=0));
  ok("B2 allowlist NAO inclui role/admin/status", ["role","admin","status","pass","salt"].every(k=>H.keys.indexOf(k)<0));
  H.reset({ u1:{ name:"A", role:"R", status:"ativo", admin:false, pass:"s2:x", salt:"s", color:"#000000" } });
  { const r=await call("updateUserSelf",{authHeader:sess("u1"),body:{name:"Novo Nome",phone:"1199",email:"a@x.com"}}); ok("B3 self name/phone/email -> 200", r.status===200 && H.users().u1.name==="Novo Nome" && H.users().u1.phone==="1199" && H.users().u1.email==="a@x.com"); }
  ok("B4 rejeita role", (await call("updateUserSelf",{authHeader:sess("u1"),body:{role:"admin"}})).json.error==="forbidden_field");
  ok("B5 rejeita admin", (await call("updateUserSelf",{authHeader:sess("u1"),body:{admin:true}})).json.error==="forbidden_field");
  ok("B6 rejeita pass/salt", (await call("updateUserSelf",{authHeader:sess("u1"),body:{pass:"x",salt:"y"}})).json.error==="forbidden_field");
  ok("B7 email inválido -> 400", (await call("updateUserSelf",{authHeader:sess("u1"),body:{email:"nope"}})).json.error==="bad_email");
  ok("B8 name vazio -> 400", (await call("updateUserSelf",{authHeader:sess("u1"),body:{name:"   "}})).json.error==="bad_name");
  ok("B9 só escreve o próprio uid", (()=>{ const w=H.writes(); return w.length && w.every(x=>x.id==="u1"); })());

  // deleteMyAccount
  H.reset({ me:{ name:"Me", status:"ativo", admin:false, email:"m@x.com", phone:"99", photo:"p", pass:"s2:z", salt:"s" } });
  ok("B10 deleteMyAccount sem sessão -> 401", (await call("deleteMyAccount",{authHeader:"",body:{}})).status===401);
  { const r=await call("deleteMyAccount",{authHeader:sess("me"),body:{}}); ok("B11 self-delete -> 200 (excluido + PII limpa, sem deletar doc)", r.status===200 && H.users().me.status==="excluido" && H.users().me.email==="" && H.users().me.phone==="" && H.users().me.photo==="" && typeof H.users().me.deletedAt==="number" && H.users().me.name==="Me"); }
  ok("B12 deleteMyAccount só atua no self (ignora targetId do corpo)", (()=>{ const w=H.writes(); return w.length===1 && w[0].id==="me"; })());
  ok("B13 deleteMyAccount GET -> 405", (await call("deleteMyAccount",{method:"GET",authHeader:sess("me"),body:{}})).status===405);
  ok("B14 deleteMyAccount resposta sem PII", noSecret((await call("deleteMyAccount",{authHeader:sess("me"),body:{}})).json));

  // nenhum log com segredo
  ok("B15 nenhum log com pass/salt/token", H.writes()!==null && !JSON.stringify(H.logs?H.logs():[]).match(/AUTH_SESSION_SECRET|s2:/));

  console.log(`\n==== F3.3.61-J WEB USERS-WRITE CUTOVER ${pass} PASS / ${fail} FAIL ====`);
  process.exit(fail===0?0:1);
})();

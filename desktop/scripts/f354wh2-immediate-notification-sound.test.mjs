// F3.5.4W-H2 — CONTRATO do som das notificações imediatas (autoridade única por superfície).
// Causa provada na auditoria: a janela premium (desfocado/minimizado/tray) NUNCA teve som
// (visual-only; cadeia de som byte-idêntica 1.0.211→1.0.213→1.0.215); a nativa (som do Windows,
// silent:false) só dispara como FALLBACK quando a premium não renderiza. Este contrato trava:
// premium toca beep IDÊNTICO ao toast aprovado SÓ no 1º render (once por dedupKey); update de
// grupo NUNCA toca; toast preservado; nativa preservada; observabilidade sanitizada; sem CDN/arquivo.
// Suporta SRC=/BG_SRC=/MAIN_SRC=/BGM_SRC= para rodar contra o EMPACOTADO (app.asar).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p, env) => fs.readFileSync(process.env[env] || path.resolve(__dirname, '..', p), 'utf8');
const idx = R('src/renderer/index.html', 'SRC');
const bgn = R('src/renderer/bgnotify.html', 'BG_SRC');
const main = R('src/main/main.ts', 'MAIN_SRC');
const bgm = R('src/main/bgNotify.ts', 'BGM_SRC');
let n = 0, fail = 0;
const ok = (t, c) => { n++; if (c) console.log('  ✓', n, t); else { fail++; console.error('  ✗', n, t); } };

console.log('— A) Autoridade de som da PREMIUM (bgnotify.html) —');
ok('bgSound definido na premium', /function bgSound\(sev\)\{/.test(bgn));
ok('WebAudio (AudioContext) — sem arquivo/CDN', /window\.AudioContext\|\|window\.webkitAudioContext/.test(bgn));
const SEQ = "sev==='critical'?[[880,0],[660,0.12],[880,0.24]]:(sev==='warning'?[[740,0],[600,0.12]]:[[660,0]])";
ok('frequências/sequência IDÊNTICAS ao beep aprovado do toast', bgn.includes(SEQ) && idx.includes(SEQ));
ok('envelope idêntico (0.16 / 0.02 / 0.18)', bgn.includes('exponentialRampToValueAtTime(0.16,t0+0.02)') && bgn.includes('exponentialRampToValueAtTime(0.0001,t0+0.18)'));
ok('resume() com Promise tratada na premium', /var rp=ac\.resume\(\); if\(rp&&rp\.catch\) rp\.catch\(function\(\)\{\}\);/.test(bgn));
ok('som gated por p.sound===false ⇒ suppressed_by_payload', /p\.sound===false\)\{ _snd='suppressed_by_payload'/.test(bgn));
ok('once por dedupKey ⇒ duplicate_prevented', /_bgSndSeen\[key\]\)\{ _snd='duplicate_prevented'/.test(bgn) && /_bgSndSeen\[key\]=1/.test(bgn));
ok('som ocorre no RENDER (mesmo bloco do ACK bgnotify-rendered)', bgn.indexOf("_snd=bgSound(sev)") < bgn.indexOf("bgAPI.rendered({dedupKey:key") && /sound:_snd/.test(bgn));
const rgu = bgn.slice(bgn.indexOf('function renderGroupUpdate'));
ok('renderGroupUpdate NUNCA toca (sem bgSound/notifSound no corpo)', !/bgSound\(|notifSound\(/.test(rgu));
const cspTag = (bgn.match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
ok('CSP da premium INALTERADA (default-src none; sem media-src na TAG)', cspTag === "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'" && !cspTag.includes('media-src'));
ok('sem new Audio()/CDN/URL externa de som na premium', !/new Audio\(|https?:\/\/[^"']*\.(wav|mp3|ogg)/.test(bgn));
ok('resultado sanitizado (played/started_state_/failed:name)', /'played'/.test(bgn) && /'started_state_'\+String\(ac\.state\)/.test(bgn) && /'failed:'\+String\(\(e&&e\.name\)\|\|'err'\)/.test(bgn));

console.log('— B) TOAST in-app preservado (index.html) —');
ok('notifSound preservado (mesmas frequências)', idx.includes(SEQ));
ok('call-site do toast segue gated por p.sound!==false', /if\(p\.sound!==false\)\{ var _sr=notifSound\(sev\);/.test(idx));
ok('resume() com Promise tratada no toast', /var _rp=ac\.resume\(\); if\(_rp&&_rp\.catch\) _rp\.catch\(function\(\)\{\}\);/.test(idx));
const ngu = idx.slice(idx.indexOf('function notifGroupUpdate'), idx.indexOf('function notifGroupUpdate') + 6000);
ok('notifGroupUpdate NUNCA toca (comentário + ausência de chamada)', !/notifSound\(sev\)/.test(ngu));
ok('observabilidade do toast: playback com playbackResult', /ncDiag\('notification\.sound\.playback',\{eventType:String\(p\.eventType\|\|''\),deliverySurface:'toast'/.test(idx));
ok('observabilidade do toast: suppressed_by_payload', /ncDiag\('notification\.sound\.suppressed_by_payload'/.test(idx));
ok('notifSound continua sendo ÚNICA via de som do toast (definição + 1 call-site)', (idx.match(/notifSound\(sev\)/g) || []).length === 2 && (idx.match(/var _sr=notifSound\(sev\)/g) || []).length === 1);

console.log('— C) MAIN preservado + observabilidade —');
ok('nativa preservada: silent: p.sound === false (som do Windows no fallback)', main.includes('silent: p.sound === false,'));
ok('roteamento intacto: toast focado via notif-toast', main.includes('mainWin?.webContents.send("notif-toast", p);'));
ok('roteamento intacto: premium via showBgNotify + fallback nativo', main.includes('const bgOk = showBgNotify(p, () => {'));
ok('suppressed_by_grouping no early-return do grupo', main.includes('diag("notification.sound.suppressed_by_grouping"'));
ok('native_fallback observado no nativeNotify', main.includes('diag("notification.sound.native_fallback"'));
ok('bgNotify.ts: som da premium observado no ACK (playbackResult)', bgm.includes('diag("notification.sound.premium"') && bgm.includes('playbackResult: String(inf.sound || "")'));
ok('grupo continua SEM som no main (comentário SEM som preservado)', /SEM som, SEM roubar/.test(main));

console.log('— D) Privacidade dos eventos de som (campos permitidos) —');
for (const [name, seg] of [['toast', idx.slice(idx.indexOf("ncDiag('notification.sound.playback'"), idx.indexOf("ncDiag('notification.sound.playback'") + 420)], ['premium', bgm.slice(bgm.indexOf('notification.sound.premium'), bgm.indexOf('notification.sound.premium') + 420)], ['grouping', main.slice(main.indexOf('notification.sound.suppressed_by_grouping'), main.indexOf('notification.sound.suppressed_by_grouping') + 320)], ['native', main.slice(main.indexOf('notification.sound.native_fallback'), main.indexOf('notification.sound.native_fallback') + 320)]]) {
  ok(`evento ${name} SEM título/cliente/uid/token/body/caminho`, !/title|clientName|actorName|taskTitle|uid|token|body|homedir|C:\\\\/i.test(seg));
}
ok('payload de som NÃO registra dedupKey/conteúdo copiado', !/dedupKey/.test(idx.slice(idx.indexOf("ncDiag('notification.sound.playback'"), idx.indexOf("ncDiag('notification.sound.playback'") + 420)));

console.log('— E) SLA/check-in intocados —');
ok('slaReminderSounds preservado (warning/critical)', main.includes('soundFor: (lvl) => (lvl === "critical" ? slaReminderSounds.critical : slaReminderSounds.warning),'));
ok('loadReminderSounds preservado', main.includes('slaReminderSounds = loadReminderSounds();'));
ok('wav do SLA existe no fonte (sla-warning/sla-critical)', fs.existsSync(path.resolve(__dirname, '..', 'src', 'assets', 'sla-warning.wav')) || /read\("sla-warning\.wav"\)/.test(fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'slaReminderWindow.ts'), 'utf8')));
ok('nenhuma mudança em slaReminder no main (enqueue intacto)', main.includes('const r = slaReminderCtl.enqueue(p);'));

console.log('— F) Versão 1.0.216 —');
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
ok('package.json version 1.0.223 (pin atualizado pela F3.5.5D)', pkg.version === '1.0.223');
ok('description da candidata F3.5.5C (custom-script-quantity-rich-editor)', /1\.0\.220-custom-script-quantity-rich-editor/.test(pkg.description || ''));
console.log(`\nf354wh2: ${n - fail}/${n} verdes`);
if (fail) process.exit(1);

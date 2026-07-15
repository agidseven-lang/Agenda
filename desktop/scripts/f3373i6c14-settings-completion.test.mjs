#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C14 — Testes HERMÉTICOS (texto/fonte) da CONCLUSÃO do módulo
   Configurações no Desktop 1.0.164:
     - os 8 placeholders "Em breve" não prontos SAÍRAM da UI (2FA, Sessões e
       dispositivos, Notificações de tarefas, Limpar cache, Otimizar uso de
       dados, Outros idiomas/moeda, Atualizar dados pessoais, Assinatura/plano);
     - Aparência CLIENT-SIDE real: Tema claro / Tamanho da fonte / Alto
       contraste — aplica na hora, persiste em localStorage (sem Firestore/
       Functions/rede), fallback seguro escuro/100%/desligado, aplicado no boot;
     - rótulo legado "Login custom (s2 / SHA-256)" corrigido;
     - ações existentes preservadas (testar notificação, tray, admin e-mail,
       trocar senha/e-mail, sair da conta) + Agenda/Board/exclusão intocados.
   Lê index.html/package.json como TEXTO — NÃO abre Electron, NÃO rede, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const PJ = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I6C14 — Configurações 100% (Desktop 1.0.164)');

/* ── A: versão ── */
ok('A1 versão 1.0.164+', PJ.version.startsWith('1.0.') && parseInt(PJ.version.split('.')[2], 10) >= 164);

/* ── B: os 8 placeholders "Em breve" saíram da UI ── */
const GONE = ['Atualizar dados pessoais', 'Assinatura / plano', 'Autenticação em duas etapas (2FA)',
  'Sessões e dispositivos', 'Notificações de tarefas', 'Limpar cache', 'Otimizar uso de dados', 'Outros idiomas e moeda'];
GONE.forEach((l, i) => ok('B' + (i + 1) + ' placeholder oculto: "' + l + '"', !HTML.includes("soon('" + l + "')") && !HTML.includes('>' + l + '<')));
ok('B9 helper soon() segue DEFINIDO (padrão K1/d3r10b; reuso futuro) mas SEM usos',
  /const soon=l=>'<div class="settrow"/.test(HTML) && (HTML.match(/soon\('/g) || []).length === 0);

/* ── C: Aparência client-side (tema/fonte/contraste) ── */
ok('C1 chave local idseven.desktop.appearance + save via localStorage',
  /const APPEAR_KEY='idseven\.desktop\.appearance';/.test(HTML) && /localStorage\.setItem\(APPEAR_KEY,JSON\.stringify\(\{theme:a\.theme,font:a\.font,hc:a\.hc\}\)\)/.test(HTML));
ok('C2 appearLoad com fallback seguro (escuro/100%/desligado; catch idem)',
  /return\{theme:a\.theme==='light'\?'light':'dark',font:\(APPEAR_FONTS\[a\.font\]!==undefined\)\?a\.font:'std',hc:a\.hc===true\};/.test(HTML) &&
  /catch\(_\)\{return\{theme:'dark',font:'std',hc:false\};\}/.test(HTML));
ok('C3 applyAppearance alterna body.light/body.hc + zoom da fonte',
  /classList\.toggle\('light',a\.theme==='light'\)/.test(HTML) && /classList\.toggle\('hc',a\.hc===true\)/.test(HTML) &&
  /document\.body\.style\.zoom=APPEAR_FONTS\[a\.font\]\|\|''/.test(HTML));
ok('C4 aplicado no BOOT (sobrevive a fechar/reabrir)', /try\{applyAppearance\(\);\}catch\(_\)\{\}/.test(HTML));
ok('C5 chips de Tema (Escuro/Claro) construídos no renderConfig',
  HTML.includes("seg('data-cfgtheme','dark',ap.theme,'Escuro')") && HTML.includes("seg('data-cfgtheme','light',ap.theme,'Claro')"));
ok('C6 chips de Fonte (std/lg/xl = 100/110/125%)',
  HTML.includes("seg('data-cfgfont','std',ap.font,'Padrão')") && HTML.includes("seg('data-cfgfont','lg',ap.font,'Grande')") &&
  HTML.includes("seg('data-cfgfont','xl',ap.font,'Extra')") && /std:'',lg:'1\.1',xl:'1\.25'/.test(HTML));
ok('C7 chips de Alto contraste (on/off)',
  HTML.includes("seg('data-cfghc','off',(ap.hc?'on':'off'),'Desligado')") && HTML.includes("seg('data-cfghc','on',(ap.hc?'on':'off'),'Ligado')"));
ok('C8 handlers delegados aplicam e persistem (appearSet)',
  /if\(el=g\('\[data-cfgtheme\]'\)\)\{appearSet\(\{theme:el\.dataset\.cfgtheme==='light'\?'light':'dark'\}\);return;\}/.test(HTML) &&
  /if\(el=g\('\[data-cfgfont\]'\)\)\{appearSet\(\{font:\(el\.dataset\.cfgfont==='lg'\|\|el\.dataset\.cfgfont==='xl'\)\?el\.dataset\.cfgfont:'std'\}\);return;\}/.test(HTML) &&
  /if\(el=g\('\[data-cfghc\]'\)\)\{appearSet\(\{hc:el\.dataset\.cfghc==='on'\}\);return;\}/.test(HTML));
ok('C9 CSS escopado: body.light + body.hc + body.light.hc (tema escuro :root intacto)',
  /body\.light\{color-scheme:light;/.test(HTML) && /body\.hc\{--ink:#FFFFFF;/.test(HTML) && /body\.light\.hc\{--ink:#000000;/.test(HTML) &&
  /:root\{\s*color-scheme: dark;/.test(HTML));
ok('C10 bloco de aparência é 100% local (sem Firestore/rede/Functions)',
  (function(){ const i = HTML.indexOf("const APPEAR_KEY"); const j = HTML.indexOf('function renderConfig'); if (i < 0 || j < 0 || j <= i) return false;
    const B = HTML.slice(i, j); return !/collection\(|\.set\(|\.add\(|fetch\(|workers\.dev|https:\/\//.test(B); })());

/* ── D: rótulo legado corrigido ── */
ok('D1 "Login custom (s2 / SHA-256)" REMOVIDO', !HTML.includes('Login custom (s2 / SHA-256)'));
ok('D2 novo subtítulo honesto server-side (Configurações + tela de Perfil)',
  HTML.includes("settRow('gear','Segurança da sessão','Sessão protegida por autenticação server-side','seguranca')") &&
  HTML.includes("settRow('person','Segurança','Sessão protegida por autenticação server-side','seguranca')"));

/* ── E: ações existentes preservadas ── */
ok('E1 Testar notificação preservado', /data-cfgnotiftest="1"/.test(HTML) && /if\(el=g\('\[data-cfgnotiftest\]'\)\)/.test(HTML));
ok('E2 Bandeja: status + Recriar ícone preservados', /data-cfgtrayrecreate="1"/.test(HTML) && HTML.includes('Recriar ícone da bandeja'));
ok('E3 Admin e-mail preservado e gated por admin', /if\(u\.admin\)\{h\+='<div style="height:18px"><\/div><div class="lbl">Administração<\/div>/.test(HTML) && /data-cfgadminemail="1"/.test(HTML));
ok('E4 Conta/Segurança sheets + trocar senha/e-mail + Sair da conta preservados',
  HTML.includes("settRow('person','Conta','Seus dados','conta')") && HTML.includes(",'seguranca')") &&
  /data-chpw="1"/.test(HTML) && /data-chemail="1"/.test(HTML) && /data-logout="1"/.test(HTML));
ok('E5 estrutura D9R2 preservada (cfg-head/cfg-wrap + 8 espaçadores de seção)',
  HTML.includes('<div class="scr-head cfg-head">') && (HTML.match(/<div style="height:18px"><\/div><div class="lbl">/g) || []).length === 8);

/* ── F: regressões fora de Configurações ── */
ok('F1 box-sizing global único (CSS de tema não criou outro reset)', (HTML.match(/\*\{box-sizing:border-box/g) || []).length === 1);
ok('F2 Agenda realtime + exclusão definitiva intocadas',
  /collection\('events'\)\.onSnapshot\(/.test(HTML) && (HTML.match(/collection\('events'\)\.doc\(id\)\.delete\(\)/g) || []).length === 1);
ok('F3 Board/Chat/Copywriting preservados',
  /const STATUS=\[[\s\S]{0,400}key:'afazer'/.test(HTML) && !/TABS=\[[^\]]*\{k:'chat'/.test(HTML) && /SECTORS\.filter\(s=>!s\.descontinuado\)/.test(HTML));
ok('F4 logout/boot de auth intocados (diagnóstico C11 preservado)',
  /window\.desktopAPI\.authLogout\(\)/.test(HTML) && /diagLog\('boot\.authSelf'/.test(HTML));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);

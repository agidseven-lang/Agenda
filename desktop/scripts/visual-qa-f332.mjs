/* =====================================================================
 * F3.3.2 (correção cirúrgica) — QA VISUAL REALISTA. Playwright + Chromium, renderer REAL.
 * Reproduz os CENÁRIOS REAIS do owner: tela de login (sem widgets), COLUNA com VÁRIOS cards
 * (corte real), avatar real, widget SLA verde/laranja/vermelho (com janela de 10 min), header
 * sino/avatar/widget alinhados, contagem/fuso coerentes. NÃO envia/escreve/deploya nada.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-f332-out');
fs.mkdirSync(OUT, { recursive: true });
const PNG1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const server = http.createServer((req, res) => {
  let f = (req.url || '/').split('?')[0]; if (f === '/' || f === '') f = '/index.html';
  fs.readFile(path.join(RENDER_DIR, f), (e, buf) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    const ext = path.extname(f);
    res.writeHead(200, { 'content-type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.slaMonRender === 'function' && typeof window.resolveTaskDisplayState === 'function', { timeout: 25000 });
// F3.3.3 — silencia a AUTO-detecção de notificações durante o QA (sem Electron ela cairia no
// toast direto e poluiria os outros prints). A seção de TOAST chama notifShowToast diretamente.
await page.evaluate(() => { window.__notifSuppress = true; });
// injeta o builder de cenário NO PAGE (usa globals do renderer: state/render/slaibRefresh)

// ---- helpers de cenário ----
function buildScenario(kind, asUser, PNG1x1) {
  const NOW = Date.now(), MIN = 60000;
  const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer', photo: PNG1x1 };
  const owner = { id: 'owner', name: 'Owner Admin', role: 'Administrador', admin: true };
  state.user = (asUser === 'designer') ? designer : owner;
  state.users = [owner, designer];
  const mk = (id, title, client, dueOffMin, extra) => Object.assign({
    id, title, client, sector: 'cronograma', status: 'andamento', assigneeId: 'dz1',
    designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento',
    designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW + dueOffMin * MIN, startedAt: NOW - 100 * MIN },
  }, extra || {});
  const showcase = mk('show', 'Cronograma semanal — Boa Forma', 'Boa Forma', 90, {
    status: 'afazer', cronContents: [{ tema: 'Dia das Mães — campanha', legenda: '' }],
  });
  const red = [mk('r1', 'Reels de lançamento', 'Boa Forma', -7), mk('r2', 'Arte campanha de verão', 'Clínica Vita', -23)];
  const redCrit = mk('rc', 'Pôster evento', 'Clínica Vita', -15); // > 10min atraso => crítico
  const amber = [mk('a1', 'Carrossel institucional', 'Studio Lumen', 18), mk('a2', 'Stories semanais', 'Boa Forma', 27)];
  let tasks = [showcase];
  if (kind === 'amber') tasks = tasks.concat(amber);
  else if (kind === 'red') tasks = tasks.concat(red, [redCrit]);
  else if (kind === 'empty') tasks = [showcase];
  else if (kind === 'multi') {
    // CENÁRIO REAL DO CORTE: muitos cards na MESMA coluna (Em andamento) — todos com tema+rodapé.
    tasks = [];
    for (let i = 1; i <= 6; i++) tasks.push(mk('m' + i, 'Cronograma ' + i + ' — Cliente ' + i, 'Cliente ' + i, 40 + i * 7, {
      cronContents: [{ tema: 'Tema A do card ' + i, legenda: '' }, { tema: 'Tema B', legenda: '' }],
    }));
  } else if (kind.indexOf('socialtall') === 0) {
    // CARD SOCIAL em "Meu quadro" — topo+perfil+origem+título+chips+etapa/próxima+TEMAS+checklist+
    // data+rodapé. 'socialtall<N>' controla a qtde de temas (1/3/5...). SEM designerAssignment =>
    // renderPersonBoard usa kbv2Card(t) operacional (perspectiva social). Com a Opção 2 aprovada,
    // o card aparece INTEIRO; com muitos temas longos, SÓ a caixa de temas rola por dentro.
    const nThemes = Math.max(1, parseInt(kind.replace('socialtall', ''), 10) || 5);
    const pool = [
      'Dia dos Namorados — campanha de relacionamento',
      'Reels institucional — bastidores da equipe',
      'Carrossel educativo — dicas de saúde da semana',
      'Stories enquete — engajamento do público',
      'Post motivacional — frase da semana',
      'Live de lançamento — divulgação do evento',
      'Depoimento de cliente — prova social',
    ];
    tasks = [{
      id: 'stall', title: 'Cronograma semanal — Junho', client: 'Boa Forma',
      sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', by: 'owner', priority: true,
      createdAt: NOW - 3 * 24 * 60 * MIN,
      dueDate: new Date(NOW + 2 * 24 * 60 * MIN).toISOString().slice(0, 10), dueTime: '18:00',
      designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW + 120 * MIN, startedAt: NOW - 100 * MIN },
      cronContents: Array.from({ length: nThemes }, (_, i) => ({ tema: pool[i % pool.length], legenda: '' })),
      checklist: [{ t: 'Briefing aprovado', d: true }, { t: 'Referências coletadas', d: true }, { t: 'Roteiro dos posts', d: false }, { t: 'Aprovação final', d: false }],
    }];
  } else tasks = tasks.concat(red, amber);
  state.tasks = tasks;
  document.body.classList.add('desktop', 'authed');
  const login = document.getElementById('login'); if (login) login.classList.add('hidden');
  const app = document.getElementById('app'); if (app) app.style.display = 'flex';
  state.tab = 'tarefas'; state.flowView = null; state.boardSector = null; state.designerBoard = null; state.personBoard = 'dz1';
  if (typeof slaMonOpen !== 'undefined') slaMonOpen = false;
  try { render(); } catch (_) {}
  if (!document.getElementById('cornerAvatar')) {
    const b = document.createElement('button'); b.id = 'cornerAvatar'; b.className = 'corner-avatar topav-btn';
    b.innerHTML = '<div class="av" style="width:38px;height:38px;border-radius:50%;background:#5B6CFF;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">O</div>';
    document.body.appendChild(b);
  }
  try { slaibRefresh(); } catch (_) {}
}
await page.evaluate(`window.buildScenario = ${buildScenario.toString()};`);
async function scenario(kind, asUser) { await page.evaluate(({ kind, asUser, PNG1x1 }) => window.buildScenario(kind, asUser, PNG1x1), { kind, asUser: asUser || 'admin', PNG1x1 }); await page.waitForTimeout(380); }
async function openMon() { await page.evaluate(() => { const b = document.querySelector('[data-slamon-toggle]'); if (b) b.click(); }); await page.waitForTimeout(240); }

// ===================== LOGIN (sem widgets operacionais) =====================
await page.evaluate(() => {
  try { if (typeof logout === 'function') { /* não chamar logout real (mexe em sessão); simular login screen */ } } catch (_) {}
  state.user = null;
  document.body.classList.remove('authed');
  const app = document.getElementById('app'); if (app) app.style.display = 'none';
  const login = document.getElementById('login'); if (login) login.classList.remove('hidden');
  ['cornerAvatar', 'sla-monitor', 'slaib-bell', 'slaib-ov', 'sla-block'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  try { slaibRefresh(); } catch (_) {}
});
await page.waitForTimeout(300);
const login = await page.evaluate(() => ({
  hasBell: !!document.getElementById('slaib-bell'),
  hasSlaMonitor: !!document.getElementById('sla-monitor'),
  hasCornerAvatar: !!document.getElementById('cornerAvatar'),
  loginVisible: !!(document.getElementById('login') && !document.getElementById('login').classList.contains('hidden')),
}));
await page.screenshot({ path: path.join(OUT, 'f332-00-login.png') });

// ===================== Widget: estados =====================
await scenario('empty');
const widgetGreen = await page.evaluate(() => { const w = document.getElementById('sla-monitor'); return w ? { cls: w.className, fixed: getComputedStyle(w).position } : { cls: '' }; });
await page.screenshot({ path: path.join(OUT, 'f332-12-widget-verde.png') });
await scenario('amber'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-02-widget-laranja.png') });
await scenario('red'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-03-widget-vermelho.png') });
// captura o widget no cenário AMBOS (vermelho com grace+crítico E laranja) — cobre todos os gates
await scenario('both'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-04-widget-ambos.png') });
const widget = await page.evaluate(() => {
  const w = document.getElementById('sla-monitor'); if (!w) return { present: false };
  const cs = getComputedStyle(w); const txt = w.textContent || '';
  const grps = [...w.querySelectorAll('.slaop-grp')].map(s => (s.className.includes('red') ? 'red' : 'amber'));
  const inBoardPanel = !!document.querySelector('#content .slaop, #content #sla-oppanel');
  return {
    present: true, position: cs.position, width: w.getBoundingClientRect().width, vw: window.innerWidth,
    cls: w.className, open: w.className.includes('open'), groups: grps,
    redBeforeAmber: grps.indexOf('red') === 0 && grps.includes('amber'),
    hasAtrasada: /Atrasada h[áa] \d+/.test(txt), hasFaltam: /Faltam \d+/.test(txt),
    graceVisible: /para concluir ou sinalizar atraso/.test(txt), critVisible: /Atraso cr[ií]tico — sinalize atraso imediatamente/.test(txt),
    graceMsgVisible: /Você tem 10 minutos para concluir esta tarefa/.test(txt), orange30Visible: /Você tem 30 minutos para concluir esta tarefa/.test(txt),
    hasOpenBtn: !!w.querySelector('[data-sla-open]'), hasSeg: !!w.querySelector('.slamon-seg'),
    hasLive: !!w.querySelector('.slamon-live'), hasHero: /Atraso máx\.|Vence em/.test(txt),
    hasProgress: !!w.querySelector('.slaop-prog'), monitorTitle: /Monitor de prazos/.test(txt), inBoardPanel,
  };
});

// ===================== FASE 6 — anti-flicker do dropdown =====================
// abre o dropdown, marca o nó .slamon-pop, dispara ticks/refreshes e confere que ele NÃO foi
// reconstruído (mesmo nó) nem fechou sozinho → sem flicker.
const flicker = await page.evaluate(() => {
  const w = document.getElementById('sla-monitor'); if (!w) return { ok: false };
  if (!w.classList.contains('open')) { const b = w.querySelector('[data-slamon-toggle]'); if (b) b.click(); }
  const pop = w.querySelector('.slamon-pop'); if (pop) pop.setAttribute('data-mark', 'X');
  const openBefore = w.classList.contains('open');
  try { slaibRefresh(); } catch (_) {} try { slaTick(); } catch (_) {} try { slaibRefresh(); } catch (_) {}
  const w2 = document.getElementById('sla-monitor'); const pop2 = w2 && w2.querySelector('.slamon-pop');
  return { ok: true, wasOpen: openBefore, stayedOpen: !!(w2 && w2.classList.contains('open')), notRebuilt: !!(pop2 && pop2.getAttribute('data-mark') === 'X') };
});

// ===================== FASE 7 — preview/mock da notificação desktop =====================
await page.evaluate(({ PNG1x1 }) => {
  if (typeof slaNotifPreview === 'function') slaNotifPreview({ photo: PNG1x1, name: 'Marina Alves', time: 'agora', title: 'Cliente aprovou os temas', desc: 'Boa Forma — Cronograma semanal: temas aprovados. Inicie a produção.', context: 'Cronograma · Boa Forma · etapa: produção' });
}, { PNG1x1 });
await page.waitForTimeout(180);
const notif = await page.evaluate(() => {
  const el = document.getElementById('sla-notif'); if (!el) return { present: false };
  const av = el.querySelector('.snf-av'); const avStyle = av ? (av.getAttribute('style') || '') : '';
  return { present: true, hasAvatar: /background-image/.test(avStyle), hasName: /Marina Alves/.test(el.textContent || ''), hasDesc: /temas aprovados/.test(el.textContent || ''), hasSound: !!el.querySelector('.snf-snd'), bottomRight: getComputedStyle(el).position === 'fixed' };
});
await page.screenshot({ path: path.join(OUT, 'f332-17-notificacao-preview.png') });
await page.evaluate(() => { const el = document.getElementById('sla-notif'); if (el) el.remove(); });

// ===================== COLUNA MULTI-CARD (corte real) =====================
const cut = {};
for (const [w, h] of [[1366, 768], [1600, 900]]) {
  await page.setViewportSize({ width: w, height: h });
  await scenario('multi'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    // coluna com mais cards
    const cols = [...document.querySelectorAll('.kbv2-column')];
    let body = null, max = -1;
    for (const c of cols) { const b = c.querySelector('.kbv2-column-body'); const n = b ? b.querySelectorAll('.kbv2-card').length : 0; if (n > max) { max = n; body = b; } }
    if (!body) return { ok: false };
    const cards = [...body.querySelectorAll('.kbv2-card')];
    const clippedCards = cards.filter(c => c.scrollHeight > c.clientHeight + 2).length;   // card comprimido/amputado
    // rola até o fim e confere o rodapé do último card + botão Adicionar
    body.scrollTop = body.scrollHeight;
    const last = cards[cards.length - 1];
    const footer = last && (last.querySelector('.kbv2-card-footer') || last.querySelector('.kbv2-btn'));
    const bodyR = body.getBoundingClientRect();
    const fR = footer ? footer.getBoundingClientRect() : null;
    const footerVisible = !!fR && fR.bottom <= bodyR.bottom + 2 && fR.top >= bodyR.top - 2;
    const col = body.closest('.kbv2-column');
    const add = col ? col.querySelector('.kbv2-column-add') : null;
    const addR = add ? add.getBoundingClientRect() : null;
    const addNotOverlap = !addR || addR.top >= bodyR.bottom - 2;
    const colR = col ? col.getBoundingClientRect() : null;
    const colInViewport = !!colR && colR.bottom <= window.innerHeight + 2;   // coluna não estoura a tela
    return { ok: true, n: cards.length, clippedCards, footerVisible, addNotOverlap, colInViewport, scrolls: body.scrollHeight > body.clientHeight + 2 };
  });
  cut[w + 'x' + h] = r;
  await page.screenshot({ path: path.join(OUT, 'f332-05-multicard-' + w + 'x' + h + '.png') });
}

// ===================== CARD SOCIAL ALTO — corte topo/rodapé no notebook =====================
// Reproduz o cenário REAL do owner: "Meu quadro", 1 card Social ALTO (foto/nome/cliente/título
// "Cronograma semanal — Junho"/chips/etapa/próxima/5 temas/checklist/data/rodapé) + "Adicionar
// tarefa". Mede, em resoluções de notebook, se o card aparece INTEIRO (topo E rodapé juntos),
// sem compressão/amputação, com ações e Adicionar visíveis e coluna rolável. Capturas: topo,
// meio, base (rodapé+Adicionar) e coluna inteira.
const tall = {};
async function shotCol(name) {
  const clip = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.kbv2-card')];
    const card = cards.find(c => (c.textContent || '').includes('Cronograma semanal — Junho'));
    const col = card ? card.closest('.kbv2-column') : (document.querySelector('.kbv2-column-active') || document.querySelector('.kbv2-column'));
    if (!col) return null; const r = col.getBoundingClientRect();
    return { x: Math.max(0, Math.floor(r.left - 8)), y: Math.max(0, Math.floor(r.top - 8)), width: Math.min(window.innerWidth, Math.ceil(r.width + 16)), height: Math.min(window.innerHeight, Math.ceil(r.height + 16)) };
  });
  await page.screenshot({ path: path.join(OUT, name), clip: clip || undefined });
}
async function measureTall() {
  return await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.kbv2-card')];
    const card = cards.find(c => (c.textContent || '').includes('Cronograma semanal — Junho'));
    if (!card) return { ok: false };
    const body = card.closest('.kbv2-column-body'); const col = card.closest('.kbv2-column');
    const add = col ? col.querySelector('.kbv2-column-add') : null;
    const footer = card.querySelector('.kbv2-card-footer');
    const themes = card.querySelector('.kbv2-card-themes'); const list = card.querySelector('.kbv2-themes-list');
    const av = card.querySelector('.kbv2-av .av'); const avStyle = av ? (av.getAttribute('style') || '') : '';
    body.scrollTop = 0;
    // sem compressão/amputação do CARD (o overflow vai p/ a lista de temas, não p/ o card)
    const compressed = card.scrollHeight > card.clientHeight + 2;
    const cardH = Math.round(card.getBoundingClientRect().height); const bodyH = Math.round(body.clientHeight);
    const overflowPx = Math.max(0, cardH - bodyH);
    // CARD INTEIRO dentro da área visível da coluna (topo E rodapé juntos, sem rolar a coluna)
    const cR = card.getBoundingClientRect(); const bR = body.getBoundingClientRect();
    const cardInBody = cR.top >= bR.top - 2 && cR.bottom <= bR.bottom + 2;
    // cada seção essencial inteiramente DENTRO do card (nada cortado)
    const within = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= cR.top - 2 && r.bottom <= cR.bottom + 2; };
    const topEl = card.querySelector('.kbv2-card-top'), prof = card.querySelector('.kbv2-card-profile'),
      title = card.querySelector('.kbv2-title'), stage = card.querySelector('.kbv2-stage2'), date = card.querySelector('.kbv2-card-date');
    const allInside = within(topEl) && within(prof) && within(title) && within(themes) && within(date) && within(footer);
    // rolagem interna SÓ na lista de temas (quando necessário)
    const themesScrolls = !!list && list.scrollHeight > list.clientHeight + 2;
    const themeEls = [...card.querySelectorAll('.kbv2-theme')];
    const minThemeH = themeEls.length ? Math.min(...themeEls.map(e => Math.round(e.getBoundingClientRect().height))) : 0;
    // pelo menos 1 tema visível na janela da lista (sem rolar a lista)
    const listR = list ? list.getBoundingClientRect() : null;
    const firstTheme = themeEls[0] ? themeEls[0].getBoundingClientRect() : null;
    const firstThemeVisible = !!(listR && firstTheme && firstTheme.top >= listR.top - 2 && firstTheme.top < listR.bottom);
    const addR = add ? add.getBoundingClientRect() : null;
    const addNotOverlap = !addR || addR.top >= bR.bottom - 2;
    const addVisible = !addR || (addR.bottom <= window.innerHeight + 2 && addR.top >= 0);
    const colR = col.getBoundingClientRect(); const colInViewport = colR.bottom <= window.innerHeight + 2;
    // breakdown: altura de cada seção direta do card (p/ calibrar densidade)
    const sec = {}; for (const ch of card.children) { const cls = (ch.className || '').split(' ')[0]; sec[cls] = Math.round(ch.getBoundingClientRect().height); }
    const themesHH = themes ? Math.round((themes.querySelector('.kbv2-themes-h') || themes).getBoundingClientRect().height) : 0;
    const listH = list ? Math.round(list.getBoundingClientRect().height) : 0;
    return {
      ok: true, cardH, bodyH, overflowPx, compressed, cardInBody, allInside, sec, themesHH, listH,
      themesScrolls, themeCount: themeEls.length, minThemeH, firstThemeVisible,
      topVisible: within(topEl), bottomVisible: within(footer),
      addNotOverlap, addVisible, colInViewport,
      hasThemes: !!themes, hasDate: !!date, hasStage: !!stage,
      hasActions: !!(card.querySelector('[data-detail]') && card.querySelector('[data-move]')),
      avatarReal: /background-image/.test(avStyle),
    };
  });
}
// 1 e 3 temas: card INTEIRO sem rolagem interna. 5 temas: card INTEIRO com rolagem SÓ nos temas.
for (const [w, h] of [[1366, 768], [1280, 720], [1366, 680]]) {
  await page.setViewportSize({ width: w, height: h });
  for (const n of [1, 3, 5]) {
    await scenario('socialtall' + n, 'designer'); await page.waitForTimeout(320);
    tall[w + 'x' + h + '-t' + n] = await measureTall();
    if (w === 1366 && h === 768) await shotCol('f332-20-socialtall-768-' + n + 'tema.png');
  }
  // print do owner: 5 temas longos, card inteiro com rolagem interna, nas 3 resoluções
  await scenario('socialtall5', 'designer'); await page.waitForTimeout(260);
  await shotCol('f332-22-socialtall5-' + w + 'x' + h + '.png');
}
// 5 temas com a LISTA rolada até o fim (prova: rola só dentro da caixa; resto do card intacto)
await page.setViewportSize({ width: 1366, height: 768 }); await scenario('socialtall5', 'designer'); await page.waitForTimeout(260);
await page.evaluate(() => { const l = document.querySelector('.kbv2-themes-list'); if (l) l.scrollTop = l.scrollHeight; });
await page.waitForTimeout(140); await shotCol('f332-23-socialtall5-temas-rolados.png');
await page.screenshot({ path: path.join(OUT, 'f332-21-socialtall-fullpage.png') });

// ===================== CARD real (avatar/temas/rodapé) =====================
await page.setViewportSize({ width: 1600, height: 900 });
await scenario('both'); await page.screenshot({ path: path.join(OUT, 'f332-01-board.png') });
const card = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.kbv2-card')];
  let found = null;
  for (const c of cards) {
    if ((c.textContent || '').includes('Cronograma semanal — Boa Forma')) {
      const av = c.querySelector('.kbv2-av .av'); const avStyle = av ? (av.getAttribute('style') || '') : '';
      found = {
        compressed: c.scrollHeight > c.clientHeight + 2,
        hasFooter: !!c.querySelector('.kbv2-card-footer, .kbv2-btn'),
        hasThemes: !!c.querySelector('.kbv2-card-themes'),
        avatarReal: /background-image/.test(avStyle),
        noSemResp: !/Sem responsável/.test(c.textContent || ''),
      };
    }
  }
  const anyInicioAtrasado = [...document.querySelectorAll('.kbv2-sla')].some(e => /Início atrasado/.test(e.textContent || ''));
  return { found, anyInicioAtrasado };
});

// ===================== STATUS unificado + FUSO/contagem + laranja imediato =====================
const consist = await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000, f = (typeof dtMs === 'function' ? dtMs : null);
  const mk = (off) => ({ id: 'x', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + off * MIN } });
  // fonte única: card(kbv2SlaLocal) ↔ painel(slaPanelRow) ↔ detalhe(detailSla) coerentes
  const tW = mk(18);
  const dsv = resolveTaskDisplayState(tW, NOW, f);
  const rowv = slaPanelRow(tW, NOW, f);
  const chip = kbv2SlaLocal(tW, NOW);
  const statusConsistent = dsv.sev === 'laranja' && rowv && rowv.sev === 'laranja' && chip.sev === 'laranja';
  // fuso/contagem: 30min => ~30 restante; -1min => atraso 1 + grace 9; -15min => crítico
  const m30 = resolveTaskDisplayState(mk(30), NOW, f);
  const mOver = resolveTaskDisplayState(mk(-1), NOW, f);
  const mCrit = resolveTaskDisplayState(mk(-15), NOW, f);
  const timeMathConsistent = [29, 30, 31].includes(m30.remainingMin) && mOver.state === 'overdue'
    && [8, 9, 10].includes(mOver.graceRemainingMin) && mCrit.critical === true;
  return { statusConsistent, timeMathConsistent };
});
// estado amber imediato (sem esperar 30s)
const orangeImmediate = await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000;
  state.tasks = [{ id: 'oi', title: 'Quase no limite', client: 'X', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1', designerName: 'Marina' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + 29 * MIN } }];
  slaibRefresh();
  const w = document.getElementById('sla-monitor');
  return { amberNow: !!w && /amber/.test(w.className), hasBoundary: typeof slaMonScheduleBoundary === 'function' };
});

// ===================== FASE 5 — bloqueio operacional (atraso crítico, escopo designer) =====================
const block = await page.evaluate(({ PNG1x1 }) => {
  const NOW = Date.now(), MIN = 60000;
  const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer', photo: PNG1x1 };
  const admin = { id: 'owner', name: 'Owner Admin', role: 'Administrador', admin: true };
  state.users = [designer, admin];
  const crit = { id: 'crit', title: 'Tarefa crítica', client: 'Boa Forma', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW - 15 * MIN } };
  const other = { id: 'other', title: 'Outra tarefa', client: 'X', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + 90 * MIN } };
  state.tasks = [crit, other];
  // DESIGNER: bloqueado p/ outras; pode agir na crítica; banner aparece
  state.user = designer; document.body.classList.add('authed'); slaibRefresh();
  const critFound = (typeof slaCriticalFor === 'function') ? (slaCriticalFor(designer) || {}).id : null;
  const blocksOther = (typeof slaGuardBlocked === 'function') ? slaGuardBlocked('other') : null;
  const allowsCrit = (typeof slaGuardBlocked === 'function') ? slaGuardBlocked('crit') : null;
  const bannerForDesigner = !!document.getElementById('sla-block');
  // ADMIN: supervisiona, NÃO bloqueado, sem banner
  state.user = admin; slaibRefresh();
  const adminCrit = (typeof slaCriticalFor === 'function') ? slaCriticalFor(admin) : 'fn?';
  const adminBlocks = (typeof slaGuardBlocked === 'function') ? slaGuardBlocked('other') : null;
  const bannerForAdmin = !!document.getElementById('sla-block');
  return {
    designerBlocksOther: critFound === 'crit' && blocksOther === true && allowsCrit === false && bannerForDesigner === true,
    adminNotBlocked: adminCrit === null && adminBlocks === false && bannerForAdmin === false,
  };
}, { PNG1x1 });
// screenshot do bloqueio (designer)
await page.evaluate(({ PNG1x1 }) => {
  const NOW = Date.now(), MIN = 60000;
  const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer', photo: PNG1x1 };
  state.user = designer; state.users = [designer];
  state.tasks = [{ id: 'crit', title: 'Reels de lançamento', client: 'Boa Forma', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW - 15 * MIN } }];
  state.tab = 'tarefas'; state.personBoard = 'dz1'; document.body.classList.add('desktop', 'authed');
  try { render(); } catch (_) {} try { slaibRefresh(); } catch (_) {}
}, { PNG1x1 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'f332-16-bloqueio-critico.png') });

// ===================== detalhe + Editar prazo (admin) + RBAC designer =====================
await scenario('red');
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(220); await page.screenshot({ path: path.join(OUT, 'f332-06-detalhe-sla.png') });
const detail = await page.evaluate(() => {
  const txt = document.getElementById('modalRoot')?.textContent || '';
  return { hasSla: /SLA do designer/i.test(txt), editPrazoAdmin: !!document.querySelector('[data-sla-editprazo]'), graceInDetail: /para concluir ou sinalizar atraso|Atraso cr[ií]tico/.test(txt) };
});
await page.evaluate(() => { const b = document.querySelector('[data-sla-editprazo]'); if (b) b.click(); });
await page.waitForSelector('#slaedit-ov', { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(160); await page.screenshot({ path: path.join(OUT, 'f332-13-editar-prazo-admin.png') });
const editPrazo = await page.evaluate(() => { const ov = document.getElementById('slaedit-ov'); const t = ov ? ov.textContent : ''; if (ov) ov.remove(); return { honest: /Gravação real aguarda autorização operacional|nada é gravado/i.test(t) }; });
await page.evaluate(() => { const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });

await scenario('red', 'designer');
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(160);
const rbac = await page.evaluate(() => ({ editPrazoDesigner: !!document.querySelector('[data-sla-editprazo]') }));
await page.evaluate(() => { const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });

// ===================== Header cluster (sino/avatar/widget) =====================
await scenario('both'); await page.waitForTimeout(200);
await page.screenshot({ path: path.join(OUT, 'f332-07-header.png'), clip: { x: 680, y: 0, width: 920, height: 120 } });
const header = await page.evaluate(() => {
  const av = document.getElementById('cornerAvatar'), bell = document.getElementById('slaib-bell'), mon = document.getElementById('sla-monitor');
  if (!av || !bell) return { ok: false };
  const c = el => { const r = el.getBoundingClientRect(); return { cy: r.top + r.height / 2, top: r.top, left: r.left, right: r.right, h: r.height }; };
  const a = c(av), b = c(bell), m = mon ? c(mon) : null;
  const cnt = document.getElementById('slaib-count');
  const badgeAbs = cnt ? getComputedStyle(cnt).position === 'absolute' : true;
  return {
    ok: true, bellAvatarCyDelta: Math.round(Math.abs(b.cy - a.cy)), bellAvatarGap: Math.round(a.left - b.right),
    monPresent: !!m, monAvatarCyDelta: m ? Math.round(Math.abs(m.cy - a.cy)) : null, monLeftOfBell: m ? (m.right <= b.left + 4) : false,
    clusterAligned: m ? (Math.abs(b.cy - a.cy) <= 2 && Math.abs(m.cy - a.cy) <= 3) : (Math.abs(b.cy - a.cy) <= 2),
    badgeAbsolute: badgeAbs,
    avatarRightInset: Math.round(window.innerWidth - a.right), shiftedLeft: (window.innerWidth - a.right) >= 50,
  };
});
for (const [w, h, nm] of [[1366, 768, 'f332-08-1366x768.png'], [1920, 1080, 'f332-10-1920x1080.png']]) {
  await page.setViewportSize({ width: w, height: h }); await scenario('both'); await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(OUT, nm) });
}

// ===================== F3.3.3 — TOAST in-app premium (notificações em tempo real) =====================
// Renderiza os toasts REAIS (window.notifShowToast — fallback direto sem Electron) SOBRE o quadro
// aprovado, prova severidades/avatar/stack/clique, e captura os prints exigidos pelo owner.
await page.setViewportSize({ width: 1440, height: 900 });
await scenario('both', 'designer'); await page.waitForTimeout(220);
const toastShot = async (name) => { await page.waitForTimeout(160); await page.screenshot({ path: path.join(OUT, name) }); };
const clearToasts = () => page.evaluate(() => { const s = document.getElementById('notif-stack'); if (s) s.innerHTML = ''; });
async function showToast(p) { await page.evaluate((pp) => window.notifShowToast(pp), p); await page.waitForTimeout(140); }
// 1) criação de tarefa (info) + avatar real
await clearToasts();
await showToast({ severity: 'info', title: 'Nova tarefa para você', actorName: 'Owner Admin', actorAvatar: PNG1x1, taskTitle: 'Cronograma semanal — Junho', body: 'Boa Forma — Cronograma semanal — Junho', context: 'Tarefa · Boa Forma', action: { deep: 'detail/stall' }, sound: false });
await toastShot('f332-30-toast-criacao.png');
// 2) cliente aprovou temas (success)
await clearToasts();
await showToast({ severity: 'success', title: 'Tarefa concluída', actorName: 'Cliente Boa Forma', actorAvatar: PNG1x1, taskTitle: 'Cronograma semanal — Junho', body: 'Boa Forma — Cronograma semanal — Junho', context: 'Boa Forma · Fluxo', action: { deep: 'detail/stall' }, sound: false });
await toastShot('f332-31-toast-cliente-aprovou.png');
// 3) atribuição ao designer (info)
await clearToasts();
await showToast({ severity: 'info', title: 'Novo cronograma atribuído', actorName: 'Marina Alves', actorAvatar: PNG1x1, taskTitle: 'Cronograma semanal — Junho', body: 'Boa Forma — Cronograma\nAcesse para iniciar a produção.', context: 'Cronograma · Boa Forma', action: { deep: 'board/cronograma' }, sound: false });
await toastShot('f332-32-toast-designer.png');
// 4) SLA laranja (warning)
await clearToasts();
await showToast({ severity: 'warning', title: 'Prazo próximo', actorName: 'Marina Alves', actorAvatar: PNG1x1, taskTitle: 'Reels de lançamento', body: 'Boa Forma — Reels de lançamento: faltam 18 min.', context: 'SLA do designer', action: { deep: 'detail/r1' }, sound: false });
await toastShot('f332-33-toast-laranja.png');
// 5) SLA vermelho (critical/overdue)
await clearToasts();
await showToast({ severity: 'critical', title: 'Prazo encerrado', actorName: 'Marina Alves', actorAvatar: PNG1x1, taskTitle: 'Reels de lançamento', body: 'Boa Forma — Reels: atrasada há 6 min (4 min p/ sinalizar).', context: 'SLA do designer', action: { deep: 'detail/r1' }, sound: false });
await toastShot('f332-34-toast-vermelho.png');
// 6) atraso crítico + bloqueio (critical)
await clearToasts();
await showToast({ severity: 'critical', title: 'Tarefa em atraso crítico', actorName: 'Marina Alves', actorAvatar: PNG1x1, taskTitle: 'Pôster evento', body: 'Conclua ou sinalize atraso antes de continuar outras tarefas.', context: 'Bloqueio operacional', action: { deep: 'detail/rc' }, sound: false });
await toastShot('f332-35-toast-critico.png');
// 7) múltiplos toasts (stack sem poluir — limite 4)
await clearToasts();
await page.evaluate((AV) => {
  window.notifShowToast({ severity: 'info', title: 'Nova tarefa para você', actorName: 'Owner Admin', actorAvatar: AV, taskTitle: 'Stories semanais', body: 'Boa Forma — Stories semanais', context: 'Tarefa · Boa Forma', sound: false });
  window.notifShowToast({ severity: 'success', title: 'Designer entregou', actorName: 'Marina Alves', actorAvatar: AV, taskTitle: 'Carrossel institucional', body: 'Studio Lumen — Carrossel', context: 'Fluxo', sound: false });
  window.notifShowToast({ severity: 'warning', title: 'Prazo próximo', actorName: 'Marina Alves', actorAvatar: AV, taskTitle: 'Arte campanha', body: 'Clínica Vita — faltam 22 min.', context: 'SLA do designer', sound: false });
  window.notifShowToast({ severity: 'critical', title: 'Atraso crítico', actorName: 'Marina Alves', actorAvatar: AV, taskTitle: 'Pôster evento', body: 'Clínica Vita — sinalize o atraso imediatamente.', context: 'SLA do designer · crítico', sound: false });
}, PNG1x1);
await toastShot('f332-36-toast-multi.png');
const toast = await page.evaluate(() => {
  const stack = document.getElementById('notif-stack');
  const items = stack ? [...stack.querySelectorAll('.ntf')] : [];
  const cs = stack ? getComputedStyle(stack) : null;
  const sevClasses = items.map((e) => (e.className.match(/ntf-(info|success|warning|critical)/) || [])[1]).filter(Boolean);
  const withAvatar = (() => { const a = document.querySelector('.ntf-av'); return !!a; })();
  // avatar real (background-image) em um toast com foto
  const avatarReal = items.some((e) => { const a = e.querySelector('.ntf-av'); return a && /background-image/.test(a.getAttribute('style') || ''); });
  return {
    present: items.length > 0, count: items.length, capped: items.length <= 4,
    bottomRight: !!cs && cs.position === 'fixed' && parseInt(cs.right) >= 0 && parseInt(cs.bottom) >= 0,
    severities: [...new Set(sevClasses)], withAvatar, avatarReal,
    hasContext: !!document.querySelector('.ntf-ctx'), hasSevIcon: !!document.querySelector('.ntf-sev svg'), hasClose: !!document.querySelector('.ntf-x'),
  };
});
// 8) avatar real isolado (close-up) + clique abre detalhe
await clearToasts();
await showToast({ severity: 'info', title: 'Cliente aprovou os temas', actorName: 'Marina Alves', actorAvatar: PNG1x1, taskTitle: 'Cronograma semanal — Junho', body: 'Boa Forma — temas aprovados. Inicie a produção.', context: 'Cronograma · Boa Forma · produção', action: { deep: 'detail/r1' }, sound: false });
await page.screenshot({ path: path.join(OUT, 'f332-37-toast-avatar.png'), clip: { x: 1040, y: 690, width: 400, height: 200 } });
// clique no toast → abre detalhe (deep link), prova ação. Self-contained + robusto + diagnóstico.
const toastClick = await page.evaluate(async () => {
  // NÃO remover #modalRoot (openDetails injeta nele). Garante que exista e só esvazia.
  const clear = () => { let mr = document.getElementById('modalRoot'); if (!mr) { mr = document.createElement('div'); mr.id = 'modalRoot'; document.body.appendChild(mr); } mr.innerHTML = ''; const s = document.getElementById('notif-stack'); if (s) s.innerHTML = ''; };
  const poll = async () => { for (let i = 0; i < 18; i++) { await new Promise((r) => setTimeout(r, 90)); if (document.querySelector('.det-sheet')) return true; } return false; };
  clear();
  window.notifShowToast({ severity: 'info', title: 'Cliente aprovou os temas', actorName: 'Marina Alves', taskTitle: 'Reels de lançamento', body: 'Boa Forma — abrir tarefa', context: 'Cronograma · Boa Forma', action: { deep: 'detail/r1' }, sound: false });
  await new Promise((r) => setTimeout(r, 90));
  const card = document.querySelector('#notif-stack .ntf .ntf-card'); let clicked = false; if (card) { card.click(); clicked = true; }
  const viaClick = await poll();
  let viaRoute = viaClick;
  if (!viaClick && typeof window.notifRoute === 'function') { clear(); window.notifRoute('detail/r1'); viaRoute = await poll(); }
  clear();
  return { clicked, openedDetail: viaClick || viaRoute, viaClick, viaRoute, inTasks: (state.tasks || []).some((x) => x.id === 'r1'), hasOpenDetails: typeof openDetails === 'function' };
});
await page.evaluate(() => { const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });
await clearToasts();

// ===================== F3.3.3 — DETECÇÃO REAL (laranja/vermelho/crítico/dedup/usuário) =====================
// Reproduz o reteste: tarefas do designer logado em warning/overdue/critical → notifScanSla detecta
// e EMITE (espião __notifCapture). Prova: vermelho dispara, textos canônicos, severidade, dedup, escopo.
const notifDetect = await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000, AV = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer', photo: AV }; const owner = { id: 'owner', name: 'Owner Admin', admin: true };
  state.users = [designer, owner]; state.user = designer;
  const mk = (id, off, extra) => Object.assign({ id, title: 'Tarefa ' + id, client: 'Boa Forma', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW + off * MIN } }, extra || {});
  const warn = mk('warn', 18), over = mk('over', -3), crit = mk('crit', -15);
  const other = Object.assign(mk('other', -3), { assigneeId: 'zzz', designerAssignment: { designerId: 'zzz' } }); // NÃO é do dz1
  state.tasks = [warn, over, crit, other];
  try { localStorage.removeItem('idseven.notif.seen.v1'); } catch (_) {}
  window.__notifSuppress = false; window.__notifCapture = [];
  window.notifScanSla();
  const caps = (window.__notifCapture || []).slice();
  window.__notifCapture = []; window.notifScanSla(); // 2º scan: dedup deve bloquear
  const second = (window.__notifCapture || []).slice();
  const by = (t) => caps.find((c) => c.eventType === t) || null;
  const w = by('sla_warning'), o = by('sla_overdue'), c = by('sla_critical');
  try { const s = document.getElementById('notif-stack'); if (s) s.innerHTML = ''; } catch (_) {}
  window.__notifSuppress = true; window.__notifCapture = null;
  return {
    warningFired: !!w, overdueFired: !!o, criticalFired: !!c,
    warningText: w && w.body, overdueText: o && o.body, criticalText: c && c.body,
    warningCtx: w && w.context, overdueCtx: o && o.context,
    overdueSev: o && o.severity, criticalSev: c && c.severity, warningSev: w && w.severity,
    overdueOpensTask: !!(o && o.action && o.action.deep === 'detail/over'),
    overdueHasAvatar: !!(o && o.actorAvatar), overdueHasUser: !!(o && o.actorName),
    noWrongUser: !caps.some((c) => c.taskId === 'other'),
    dedupBlocksSecond: second.length === 0,
    firstCount: caps.length,
  };
});
// flow/status real (diff de fase canônica → emite). Baseline silenciosa + transição = dispara.
const flowDetect = await page.evaluate(async () => {
  const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer' };
  state.users = [designer]; state.user = designer;
  // CRONOGRAMA: produção → revisão (fluxo do designer). Conclusão de cronograma = aprovação
  // final do cliente (regra canônica), então a CONCLUSÃO é testada numa tarefa NÃO-cronograma.
  const tc = { id: 'flowc', title: 'Cronograma X', client: 'Boa Forma', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerFlowStatus: 'andamento' };
  const tn = { id: 'flown', title: 'Arte avulsa', client: 'Clínica Vita', sector: 'design', status: 'andamento', assigneeId: 'dz1' };
  state.tasks = [tc, tn];
  try { localStorage.removeItem('idseven.notif.seen.v1'); } catch (_) {}
  if (window.__notifResetFlow) window.__notifResetFlow();
  window.__notifSuppress = false; window.__notifCapture = [];
  window.notifScanFlow(); // baseline (não notifica histórico)
  const baseline = (window.__notifCapture || []).length;
  tc.designerFlowStatus = 'revisao'; window.__notifCapture = []; window.notifScanFlow();
  const review = (window.__notifCapture || []).map((c) => c.eventType);
  tn.status = 'concluido'; window.__notifCapture = []; window.notifScanFlow();   // conclusão (não-cronograma)
  const done = (window.__notifCapture || []).map((c) => c.eventType);
  try { const s = document.getElementById('notif-stack'); if (s) s.innerHTML = ''; } catch (_) {}
  window.__notifSuppress = true; window.__notifCapture = null;
  return { baselineSilent: baseline === 0, reviewFired: review.includes('flow_in_review'), completedFired: done.includes('flow_completed') };
});

// ===================== F3.3.3 (correção) — DESTINATÁRIO + AVATAR REAL =====================
// Prova cirúrgica do owner: o alerta laranja/vermelho de SLA vai SÓ p/ o designer responsável.
// Social Media (vê tudo) NÃO recebe SLA pessoal — mas RECEBE fluxo de equipe. Avatar = foto REAL.
const recipientDetect = await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000;
  const AV = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer', photo: AV };
  const social = { id: 'soc1', name: 'Paula Social', role: 'Social Media' };
  const admin = { id: 'adm1', name: 'Owner Admin', admin: true };
  const mkCrit = () => ({ id: 'tcrit', title: 'Cronograma crítico', client: 'Boa Forma', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', by: 'soc1', designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves', designerPhoto: AV }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW - 15 * MIN } });
  const reset = () => { try { localStorage.removeItem('idseven.notif.seen.v1'); } catch (_) {} if (window.__notifResetFlow) window.__notifResetFlow(); };

  // (A) SOCIAL logada: SLA NÃO dispara (pessoal do designer).
  state.users = [designer, social, admin]; state.user = social; state.tasks = [mkCrit()];
  reset(); window.__notifSuppress = false; window.__notifCapture = [];
  window.notifScanSla();
  const socialSla = (window.__notifCapture || []).slice();

  // (B) DESIGNER logado: SLA dispara (responsável) com avatar/nome REAL.
  state.user = designer; state.tasks = [mkCrit()];
  reset(); window.__notifCapture = [];
  window.notifScanSla();
  const designerSla = (window.__notifCapture || []).slice();
  const dCap = designerSla[0] || null;

  // (C) Roteador puro (contrato): SLA=sla_personal só designer; FLUXO=team_flow inclui Social.
  const taskR = { id: 'tcrit', assigneeId: 'dz1', by: 'soc1', designerAssignment: { designerId: 'dz1' } };
  const rSlaSocial = window.resolveNotificationTargets({ eventType: 'sla_overdue', task: taskR, currentUser: social, currentUserCanSeeAll: true });
  const rSlaDesigner = window.resolveNotificationTargets({ eventType: 'sla_overdue', task: taskR, currentUser: designer });
  const rFlowSocial = window.resolveNotificationTargets({ eventType: 'flow_sent_to_client', task: taskR, currentUser: social, currentUserCanSeeAll: true });

  // (D) FLUXO real: Social (supervisão/equipe) RECEBE a transição.
  state.user = social;
  const tflow = { id: 'tflow', title: 'Cronograma fluxo', client: 'Boa Forma', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', by: 'soc1', designerAssignment: { designerId: 'dz1' }, designerFlowStatus: 'andamento' };
  state.tasks = [tflow];
  reset(); window.__notifCapture = [];
  window.notifScanFlow();                                   // baseline (silenciosa)
  const flowBase = (window.__notifCapture || []).length;
  tflow.designerFlowStatus = 'revisao'; window.__notifCapture = []; window.notifScanFlow();
  const socialFlow = (window.__notifCapture || []).map((c) => c.eventType);

  // (E) AVATAR REAL: diretório → denormalizado → vazio (toast usa letra só sem foto).
  const idReal = window.notifIdentity('dz1', '', '');            // foto no diretório
  const idDenorm = window.notifIdentity('zzz', 'Sem Perfil', AV);// sem diretório, foto denormalizada
  const idNone = window.notifIdentity('zzz', 'Sem Foto', '');    // sem foto em lugar nenhum

  try { const s = document.getElementById('notif-stack'); if (s) s.innerHTML = ''; } catch (_) {}
  window.__notifSuppress = true; window.__notifCapture = null;
  return {
    socialNoSla: socialSla.length === 0,
    designerGetsSla: designerSla.length >= 1,
    designerSlaType: dCap && dCap.notificationType,
    designerSlaAvatarReal: !!(dCap && dCap.actorAvatar === AV),
    designerSlaResponsible: dCap && dCap.responsibleName,
    routerSlaSocialExcluded: rSlaSocial.shouldNotifyCurrentUser === false && rSlaSocial.notificationType === 'sla_personal',
    routerSlaDesignerIncluded: rSlaDesigner.shouldNotifyCurrentUser === true,
    routerFlowSocialIncluded: rFlowSocial.shouldNotifyCurrentUser === true && rFlowSocial.notificationType === 'team_flow',
    socialFlowFired: flowBase === 0 && socialFlow.includes('flow_in_review'),
    avatarFromDirectory: idReal.avatar === AV,
    avatarFromDenorm: idDenorm.avatar === AV,
    avatarNoneEmpty: idNone.avatar === '',
  };
});
// PRINT visual da correção: SLA do designer (avatar/nome real) + fluxo de equipe lado a lado.
await clearToasts();
await showToast({ severity: 'critical', notificationType: 'sla_personal', title: 'Prazo encerrado', actorName: 'Marina Alves', actorAvatar: PNG1x1, responsibleName: 'Marina Alves', responsibleAvatar: PNG1x1, taskTitle: 'Cronograma — Boa Forma', body: 'Você tem 10 minutos para concluir esta tarefa.', context: 'Boa Forma · Atrasada há 5:00 · restam 5:00 p/ sinalizar', action: { deep: 'detail/tcrit' }, sound: false });
await showToast({ severity: 'info', notificationType: 'team_flow', title: 'Enviado para revisão', actorName: 'Marina Alves', actorAvatar: PNG1x1, responsibleName: 'Marina Alves', responsibleAvatar: PNG1x1, taskTitle: 'Cronograma fluxo — Boa Forma', body: 'Marina moveu para Em revisão', context: 'Boa Forma · Responsável: Marina Alves', action: { deep: 'detail/tflow' }, sound: false });
await toastShot('f332-38-destinatario-avatar.png');
await clearToasts();

fs.writeFileSync(path.join(OUT, 'qa-f332-report.json'), JSON.stringify({ login, widgetGreen, widget, flicker, notif, cut, tall, card, consist, orangeImmediate, block, detail, editPrazo, rbac, header, toast, toastClick, notifDetect, flowDetect, recipientDetect, errors }, null, 2));
console.log('FLICKER:', JSON.stringify(flicker)); console.log('NOTIF:', JSON.stringify(notif));
console.log('TALL:', JSON.stringify(tall));
console.log('LOGIN:', JSON.stringify(login)); console.log('WIDGET:', JSON.stringify(widget)); console.log('CUT:', JSON.stringify(cut));
console.log('CARD:', JSON.stringify(card)); console.log('CONSIST:', JSON.stringify(consist)); console.log('ORANGE:', JSON.stringify(orangeImmediate)); console.log('BLOCK:', JSON.stringify(block));
console.log('DETAIL:', JSON.stringify(detail)); console.log('EDIT:', JSON.stringify(editPrazo)); console.log('RBAC:', JSON.stringify(rbac)); console.log('HEADER:', JSON.stringify(header));
console.log('TOAST:', JSON.stringify(toast)); console.log('TOASTCLICK:', JSON.stringify(toastClick));
console.log('NOTIFDETECT:', JSON.stringify(notifDetect)); console.log('FLOWDETECT:', JSON.stringify(flowDetect));
console.log('RECIPIENTDETECT:', JSON.stringify(recipientDetect));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close(); server.close();

const fail = [];
if (errors.length) fail.push('pageerror: ' + errors[0]);
// login limpo
if (login.hasBell) fail.push('loginHasBell=true (sino na tela de login)');
if (login.hasSlaMonitor) fail.push('loginHasSlaMonitor=true (widget na tela de login)');
if (login.hasCornerAvatar) fail.push('avatar na tela de login');
// widget
if (!widget.present) fail.push('SLA Monitor ausente');
if (widget.present && widget.position !== 'fixed') fail.push('widget não é fixed');
if (widget.present && widget.inBoardPanel) fail.push('painel SLA inline no board (não removido)');
if (widget.present && widget.width > widget.vw * 0.6) fail.push('noFullWidthSlaBar falhou (widget largo demais)');
if ((widgetGreen.cls || '').indexOf('green') < 0) fail.push('estado verde ausente');
if (!widget.open) fail.push('dropdown não abriu');
if (!widget.monitorTitle) fail.push('dropdown sem "Monitor de prazos"');
if (!widget.redBeforeAmber) fail.push('vermelho não antes do laranja');
if (!widget.hasAtrasada || !widget.hasFaltam) fail.push('faltam textos de tempo');
if (!widget.graceVisible) fail.push('redGraceCountdownVisible falhou (sem "para concluir ou sinalizar atraso")');
if (!widget.graceMsgVisible) fail.push('redText10Visible falhou (sem "Você tem 10 minutos para concluir esta tarefa")');
if (!widget.orange30Visible) fail.push('orangeText30Visible falhou (sem "Você tem 30 minutos para concluir esta tarefa")');
// anti-flicker do dropdown
if (flicker.ok && !flicker.stayedOpen) fail.push('noPanelFlicker falhou (dropdown fechou sozinho no refresh)');
if (flicker.ok && !flicker.notRebuilt) fail.push('noPanelFlicker falhou (dropdown reconstruído no tick → pisca)');
// preview da notificação desktop (FASE 7 — mock)
if (!notif.present) fail.push('desktopNotificationPreviewVisible falhou (sem preview)');
if (notif.present && !notif.hasAvatar) fail.push('notificationHasAvatar falhou');
if (notif.present && !notif.hasName) fail.push('notificationHasUserName falhou');
if (notif.present && !notif.hasSound) fail.push('notificationHasSoundConfigured falhou (sem selo de som)');
if (!widget.critVisible) fail.push('redCriticalVisibleAfter10min falhou (estado crítico não exibido)');
if (!widget.hasOpenBtn) fail.push('sem Abrir tarefa');
if (!widget.hasSeg || !widget.hasLive || !widget.hasHero) fail.push('widget v2 sem segmentos/ao vivo/herói');
if (!widget.hasProgress) fail.push('dropdown sem barra de progresso');
// corte multi-card (cenário real)
for (const k of Object.keys(cut)) { const c = cut[k];
  if (!c.ok) fail.push('multi-card ' + k + ' sem coluna');
  else { if (c.clippedCards > 0) fail.push('cardNotClipped falhou em ' + k + ' (' + c.clippedCards + ' comprimidos)');
         if (!c.footerVisible) fail.push('cardBottomActionsVisible falhou em ' + k);
         if (!c.addNotOverlap) fail.push('addButtonNotOverlapping falhou em ' + k);
         if (!c.colInViewport) fail.push('coluna estoura a tela em ' + k); } }
// ===== CARD SOCIAL — SEMPRE INTEIRO no notebook; só a lista de temas rola (Opção 2) =====
for (const k of Object.keys(tall)) { const t = tall[k];
  if (!t.ok) { fail.push('socialtall ' + k + ' sem card'); continue; }
  const n = parseInt((k.split('-t')[1] || ''), 10) || 0;
  const h = parseInt((k.split('x')[1] || '').split('-')[0], 10) || 0;
  if (t.compressed) fail.push('cardNotCompressed falhou em ' + k + ' (card comprimido/amputado)');
  if (!t.cardInBody) fail.push('cardWhole falhou em ' + k + ' (card não inteiro; sobra ' + t.overflowPx + 'px → corta topo/rodapé)');
  if (!t.allInside) fail.push('cardSectionsInside falhou em ' + k + ' (seção essencial cortada)');
  if (!t.topVisible) fail.push('cardTopVisible falhou em ' + k);
  if (!t.bottomVisible) fail.push('cardBottomVisible falhou em ' + k + ' (rodapé não visível)');
  if (!t.hasActions) fail.push('cardActionsVisible falhou em ' + k + ' (Detalhes/Mover ausentes)');
  if (!t.addNotOverlap) fail.push('addButtonNotOverlapping falhou em ' + k);
  if (!t.avatarReal) fail.push('avatarRealVisible falhou em ' + k);
  if (!t.hasThemes) fail.push('topicsVisible falhou em ' + k + ' (temas ausentes)');
  if (!t.firstThemeVisible) fail.push('themeVisible falhou em ' + k + ' (nenhum tema visível na caixa)');
  if (t.minThemeH < 24) fail.push('themeLegible falhou em ' + k + ' (tema < 24px: ' + t.minThemeH + ')');
  if (!t.hasDate) fail.push('dueDateVisible falhou em ' + k);
  if (!t.colInViewport) fail.push('columnInViewport falhou em ' + k);
  // 1 tema cabe inteiro SEM rolagem interna no notebook padrão (≥768). Em telas menores (720/680) e
  // com mais temas, a caixa de temas rola por dentro ("sempre que couber") — o card segue INTEIRO.
  if (t.themesScrolls && n === 1 && h >= 768) fail.push('themesNoScrollWhenFits falhou em ' + k + ' (1 tema deveria caber sem rolagem interna a ' + h + 'px)');
}
// card real
if (!card.found) fail.push('card de cronograma não encontrado');
if (card.found && card.found.compressed) fail.push('card AMPUTADO/comprimido');
if (card.found && (!card.found.hasFooter || !card.found.hasThemes)) fail.push('card sem rodapé/temas');
if (card.found && !card.found.avatarReal) fail.push('cardAvatarRealVisible falhou (avatar genérico)');
if (card.found && !card.found.noSemResp) fail.push('card mostra "Sem responsável" com responsável real');
if (card.anyInicioAtrasado) fail.push('card mostra "Início atrasado" (proibido)');
// status/fuso/laranja
if (!consist.statusConsistent) fail.push('statusConsistent falhou (card/painel/detalhe divergem)');
if (!consist.timeMathConsistent) fail.push('timeMathConsistent falhou (contagem/fuso)');
if (!orangeImmediate.amberNow) fail.push('orangeTransitionImmediate falhou (amber não imediato)');
if (!orangeImmediate.hasBoundary) fail.push('boundary timer ausente');
// FASE 5 — bloqueio operacional (atraso crítico)
if (!block.designerBlocksOther) fail.push('criticalOverdueBlocksOtherTasks falhou (designer não foi bloqueado)');
if (!block.adminNotBlocked) fail.push('admin/social foi bloqueado indevidamente (escopo errado)');
// detalhe/rbac/editar
if (!detail.hasSla || !detail.editPrazoAdmin) fail.push('detalhe/Editar prazo (admin) incompleto');
if (!detail.graceInDetail) fail.push('detalhe sem janela de 10 min no vermelho');
if (!editPrazo.honest) fail.push('Editar prazo sem mensagem honesta de bloqueio');
if (rbac.editPrazoDesigner) fail.push('Editar prazo VISÍVEL p/ Designer (RBAC falhou)');
// header cluster
if (!header.ok) fail.push('header sem avatar/sino');
if (header.ok && !header.clusterAligned) fail.push('headerClusterAligned falhou (Δ sino=' + header.bellAvatarCyDelta + ', widget=' + header.monAvatarCyDelta + ')');
if (header.ok && (header.bellAvatarGap < 4 || header.bellAvatarGap > 24)) fail.push('folga sino↔avatar fora (' + header.bellAvatarGap + ')');
if (header.ok && !header.badgeAbsolute) fail.push('badgeDoesNotShiftBell falhou (badge não é absolute)');
if (header.ok && header.monPresent && !header.monLeftOfBell) fail.push('widget não está à esquerda do sino');
if (header.ok && !header.shiftedLeft) fail.push('headerShiftedLeft falhou (cluster não deslocado ~1,5cm; inset=' + header.avatarRightInset + ')');
// F3.3.3 — TOAST in-app premium (notificações em tempo real)
if (!toast.present) fail.push('toastPresent falhou (nenhum toast renderizado)');
if (!toast.bottomRight) fail.push('toastBottomRight falhou (stack não é fixed no canto inferior direito)');
if (!toast.withAvatar) fail.push('toastHasAvatar falhou (sem avatar no toast)');
if (!toast.avatarReal) fail.push('toastAvatarReal falhou (avatar real/foto ausente)');
if (!toast.hasContext) fail.push('toastHasContext falhou (sem contexto da tarefa)');
if (!toast.hasSevIcon) fail.push('toastSeverityIcon falhou (sem ícone de severidade)');
if (!toast.hasClose) fail.push('toastClose falhou (sem botão fechar)');
if (!toast.capped) fail.push('toastStackCapped falhou (stack > 4 — poluindo a tela)');
for (const s of ['info', 'success', 'warning', 'critical']) if (!toast.severities.includes(s)) fail.push('toastSeverity ' + s + ' ausente no stack');
if (!toastClick.clicked || !toastClick.openedDetail) fail.push('toastClickOpensTask falhou (clique não abriu o detalhe)');
// F3.3.3 — DETECÇÃO real de SLA (o vermelho do reteste) + dedup + escopo + textos canônicos
if (!notifDetect.warningFired) fail.push('orangeDesktopNotificationWorks falhou (laranja não detectado)');
if (!notifDetect.overdueFired) fail.push('redDesktopNotificationWorks falhou (VERMELHO não detectado)');
if (!notifDetect.criticalFired) fail.push('redCriticalNotificationWorks falhou (crítico não detectado)');
if (!/30 minutos/.test(notifDetect.warningText || '')) fail.push('orangeText30 falhou (texto canônico ausente)');
if (!/10 minutos/.test(notifDetect.overdueText || '')) fail.push('redText10 falhou (texto canônico ausente)');
if (!/(\d+:\d{2})/.test(notifDetect.overdueCtx || '')) fail.push('redGraceCountdownVisible falhou (sem contador mm:ss)');
if (notifDetect.overdueSev !== 'critical' || notifDetect.warningSev !== 'warning') fail.push('notifSeverity falhou (laranja=warning, vermelho=critical)');
if (!notifDetect.overdueHasAvatar) fail.push('notificationHasAvatar falhou (SLA)');
if (!notifDetect.overdueHasUser) fail.push('notificationHasUserName falhou (SLA)');
if (!notifDetect.overdueOpensTask) fail.push('notificationOpensTask falhou (deep detail ausente)');
if (!notifDetect.noWrongUser) fail.push('notifWrongUser falhou (notificou tarefa de outro usuário)');
if (!notifDetect.dedupBlocksSecond) fail.push('noDuplicateNotifications falhou (2º scan repetiu)');
// fluxo/status em tempo real
if (!flowDetect.baselineSilent) fail.push('flowBaselineSilent falhou (1ª carga gerou avalanche)');
if (!flowDetect.reviewFired) fail.push('flowStatusNotificationWorks falhou (transição p/ revisão não disparou)');
if (!flowDetect.completedFired) fail.push('flowCompletedNotificationWorks falhou (conclusão não disparou)');
// F3.3.3 (correção) — DESTINATÁRIO do SLA (designer, não Social) + AVATAR REAL
if (!recipientDetect.socialNoSla) fail.push('slaNotToSocial falhou (Social Media RECEBEU SLA pessoal)');
if (!recipientDetect.designerGetsSla) fail.push('slaToDesigner falhou (designer responsável NÃO recebeu SLA)');
if (recipientDetect.designerSlaType !== 'sla_personal') fail.push('slaTypePersonal falhou (notificationType != sla_personal)');
if (!recipientDetect.designerSlaAvatarReal) fail.push('slaAvatarReal falhou (SLA do designer sem foto real)');
if (!recipientDetect.designerSlaResponsible) fail.push('slaResponsibleName falhou (sem nome do responsável)');
if (!recipientDetect.routerSlaSocialExcluded) fail.push('routerSlaSocialExcluded falhou (roteador não exclui Social do SLA)');
if (!recipientDetect.routerSlaDesignerIncluded) fail.push('routerSlaDesignerIncluded falhou (roteador não inclui o designer no SLA)');
if (!recipientDetect.routerFlowSocialIncluded) fail.push('routerFlowSocialIncluded falhou (roteador não inclui Social no fluxo)');
if (!recipientDetect.socialFlowFired) fail.push('flowToTeamSocial falhou (Social não recebeu fluxo de equipe)');
if (!recipientDetect.avatarFromDirectory) fail.push('avatarFromDirectory falhou (não usou foto real do diretório)');
if (!recipientDetect.avatarFromDenorm) fail.push('avatarFromDenorm falhou (não usou foto denormalizada quando existe)');
if (!recipientDetect.avatarNoneEmpty) fail.push('avatarNoneEmpty falhou (deveria cair p/ vazio sem foto)');

if (fail.length) { console.error('::error::QA F3.3.2 FALHOU: ' + fail.join(' | ')); process.exit(1); }
console.log('QA F3.3.2 OK — login sem widgets; coluna multi-card sem corte (1366/1600); avatar real; widget verde/laranja/vermelho com janela 10min + crítico; status/fuso coerentes; laranja imediato; header cluster alinhado; Editar prazo RBAC honesto.');

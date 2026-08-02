/**
 * F3.5.4U — PROVA VISUAL do APP EMPACOTADO (Electron REAL).
 *
 * Este arquivo é o `main` de um app.asar de PROVA. Ele NÃO renderiza HTML por conta própria:
 * ele CARREGA e EXECUTA o módulo REAL de produção `dist/main/bgNotify.js` (o mesmo que vai no
 * app.asar oficial do Windows — byte-idêntico, verificado por cmp), que cria a janela premium
 * REAL (BrowserWindow bottom-right, transparent, focusable:false, showInactive, alwaysOnTop),
 * carrega o renderer REAL `src/renderer/bgnotify.html` DE DENTRO do app.asar via o preload REAL
 * `dist/preload/bgnotify-preload.js`, e recebe o payload REAL via IPC (`webContents.send`).
 *
 * Os payloads são gerados pelo produtor REAL `dist/main/notifEvents.js::buildCategoryAPayload`
 * (mesma forma da produção). O carimbo `_premiumCommon` reproduz EXATAMENTE o que o
 * `deliverNotification` (main.ts) faz com a flag premiumCommonNotificationsEnabled ON/OFF.
 *
 * A captura é feita por `win.capturePage()` (pixels REAIS da janela real). Isto é o app real
 * empacotado sendo controlado/automatizado — NÃO é file://, NÃO é page.setContent, NÃO é HTML
 * montado, NÃO é navegador comum, NÃO é IA/mockup. A identidade (versão 1.0.209 + app.asar +
 * processo Electron) é asseverada em runtime abaixo.
 *
 * Config via env: PROOF_OUT (dir saída), PROOF_TAG (prefixo), PROOF_SCENES ("all" ou lista),
 * PROOF_SCALE (informativo, o scale real vem do --force-device-scale-factor do Chromium/Electron).
 */
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const fs = require("fs");
const path = require("path");

const OUT = process.env.PROOF_OUT || path.join(process.cwd(), "docs", "f354u-qa");
const TAG = process.env.PROOF_TAG || "std";
const WANT = String(process.env.PROOF_SCENES || "all");
const SCALE_HINT = process.env.PROOF_SCALE || "";
fs.mkdirSync(OUT, { recursive: true });

function fail(msg) { console.error("PROOF_FATAL: " + msg); try { app.exit(1); } catch (_) { process.exit(1); } }

// ── ACK/coleta de eventos REAIS vindos do renderer real (via preload real) ──
const renderAcks = [];      // {dedupKey, eventType, count}
const openEvents = [];      // deep-links clicados
const resizeEvents = [];    // alturas reportadas (prova de redimensionamento real)
ipcMain.on("bgnotify-rendered", (_e, info) => { try { renderAcks.push(info || {}); } catch (_) {} });
ipcMain.on("bgnotify-open", (_e, deep) => { try { openEvents.push(String(deep || "")); } catch (_) {} });
ipcMain.on("bgnotify-resize", (_e, h) => { try { resizeEvents.push(Number(h) || 0); } catch (_) {} });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitAck(dedupKey, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeoutMs || 4000)) {
    if (renderAcks.some((a) => String(a.dedupKey) === String(dedupKey))) return true;
    await wait(40);
  }
  return false;
}
function bgWindow() {
  const all = BrowserWindow.getAllWindows();
  return all.find((w) => { try { return w.getTitle() === "Agenda ID Seven — Notificacao"; } catch (_) { return false; } }) || all[0] || null;
}

// ── fixtures de perfil (nome/foto) — resolveProfile REAL do notifierA aceita {name,photo} ──
const AVATAR_DATA = "data:image/svg+xml;base64," + Buffer.from(
  "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='#2563eb'/><circle cx='32' cy='24' r='12' fill='#bfdbfe'/><rect x='14' y='40' width='36' height='20' rx='10' fill='#bfdbfe'/></svg>"
).toString("base64");

// sanitiza o payload p/ o manifesto (telemetria) — NUNCA grava nome/título/cliente/foto/token.
function sanitize(p) {
  return {
    eventType: p.eventType || "", _premiumCommon: p._premiumCommon === true,
    hasAvatar: !!(p.actorAvatar && String(p.actorAvatar).length), actorNameLength: String(p.actorName || "").length,
    taskTitleLength: String(p.taskTitle || "").length, fromStatus: p.fromStatus || "", toStatus: p.toStatus || "",
    hasSector: !!p.sector, hasClient: !!p.clientName, hasBody: !!p.body, hasContext: !!p.context,
    severity: p.severity || "", deep: (p.action && p.action.deep) || ""
  };
}

app.whenReady().then(async () => {
  // ══ IDENTIDADE (asserções em runtime — o app real, empacotado, 1.0.209) ══
  const appPath = app.getAppPath();
  const version = app.getVersion();
  const isAsar = /\.asar$/.test(appPath);
  const ident = {
    executable: process.execPath, appPath, isAsar, version,
    electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node,
    processType: process.type, pid: process.pid, platform: process.platform, arch: process.arch,
    scaleHint: SCALE_HINT
  };
  console.log("PROOF_IDENT " + JSON.stringify(ident));
  const EXPECT_VERSION = process.env.PROOF_VERSION || "1.0.210";
  if (version !== EXPECT_VERSION) return fail("versão do app.asar != " + EXPECT_VERSION + " (=" + version + ")");
  if (!isAsar) return fail("appPath não é .asar (=" + appPath + ") — não está rodando do app.asar");

  // ══ CARREGA os módulos REAIS de produção DE DENTRO do app.asar ══
  let bg, notif;
  try {
    bg = require(path.join(appPath, "dist", "main", "bgNotify.js"));
    notif = require(path.join(appPath, "dist", "main", "notifEvents.js"));
  } catch (e) { return fail("falha ao require módulos reais do asar: " + (e && e.message)); }
  if (typeof bg.showBgNotify !== "function" || typeof bg.updateBgGroup !== "function" || typeof bg.initBgNotify !== "function")
    return fail("bgNotify.js real não expõe showBgNotify/updateBgGroup/initBgNotify");
  if (typeof notif.buildCategoryAPayload !== "function") return fail("notifEvents.js real não expõe buildCategoryAPayload");

  // callback de deep-link REAL (o mesmo contrato do main.ts: reabrir + navegar) — aqui só registramos.
  bg.initBgNotify((deep) => { openEvents.push("cb:" + String(deep || "")); });

  const resolveProfile = (id) => {
    const M = { u_ana: { name: "Ana Souza", photo: "" }, u_bru: { name: "Bruno Lima", photo: "" },
                u_ava: { name: "Marina Alvarenga", photo: AVATAR_DATA }, u_long: { name: "Miercohévisk Niheb Ferreira Nascimento Carlôto de Albuquerque Santos", photo: "" } };
    return M[id] || null;
  };
  const stampPremium = (p, on) => { p._premiumCommon = on !== false; return p; }; // mimetiza deliverNotification (flag ON/OFF)
  const mkEv = (o) => Object.assign({ eventId: "ev_" + o.type + "_" + (o.tag || "x"), at: 1738368000000, taskId: "t_" + (o.tag || "x") }, o);

  // ══ CENAS (payload REAL via buildCategoryAPayload) ══
  const scenes = [
    { name: "01-move-premium", kind: "single", premium: true,
      ev: mkEv({ tag: "mv", type: "task_moved", actorId: "u_ana", taskTitle: "Edição do Reels Institucional", fromStatus: "afazer", toStatus: "andamento", sector: "Vídeo" }), client: "Hospital Visão" },
    { name: "02-completed-premium", kind: "single", premium: true,
      ev: mkEv({ tag: "cp", type: "task_completed", actorId: "u_bru", taskTitle: "Card Institucional de Agosto", fromStatus: "andamento", toStatus: "concluido", sector: "Design" }) },
    { name: "03-assign-premium", kind: "single", premium: true,
      ev: mkEv({ tag: "as", type: "task_assigned", actorId: "u_ana", assignedDesignerId: "u_bru", taskTitle: "Roteiro Semanal", sector: "Roteiro" }) },
    { name: "04-updated-no-transition", kind: "single", premium: true,
      ev: mkEv({ tag: "up", type: "task_updated", actorId: "u_ana", taskTitle: "Cronograma Hospital Visão", dueChanged: true, prevDueDate: "01/08", prevDueTime: "12:00", newDueDate: "02/08", newDueTime: "18:00", sector: "Cronograma" }) },
    { name: "05-long-name", kind: "single", premium: true,
      ev: mkEv({ tag: "ln", type: "task_moved", actorId: "u_long", taskTitle: "Edição do Reels Institucional", fromStatus: "afazer", toStatus: "andamento", sector: "Vídeo" }) },
    { name: "06-long-title", kind: "single", premium: true,
      ev: mkEv({ tag: "lt", type: "task_moved", actorId: "u_ana", taskTitle: "Edição completa do Reels institucional do Hospital Visão para a campanha de conscientização de agosto com legendas e trilha", fromStatus: "afazer", toStatus: "andamento", sector: "Vídeo" }), client: "Hospital Visão" },
    { name: "07-avatar-real", kind: "single", premium: true,
      ev: mkEv({ tag: "av", type: "task_moved", actorId: "u_ava", taskTitle: "Thumbnail do Episódio 12", fromStatus: "andamento", toStatus: "revisao", sector: "Design" }) },
    { name: "08-avatar-fallback", kind: "single", premium: true,
      ev: mkEv({ tag: "af", type: "task_moved", actorId: "u_ana", taskTitle: "Legenda do Post Semanal", fromStatus: "afazer", toStatus: "andamento", sector: "Social" }) },
    { name: "09-group-premium", kind: "group", premium: true,
      ev: mkEv({ tag: "g4", type: "task_moved", actorId: "u_ana", taskTitle: "Edição do Reels Institucional", fromStatus: "afazer", toStatus: "andamento", sector: "Vídeo" }),
      group: { count: 4, primaryId: "u_long", items: [{ actorName: "Miercohévisk", title: "Tarefa movimentada" }, { actorName: "Ana", title: "Tarefa atualizada" }, { actorName: "João", title: "Tarefa movimentada" }], extraCount: 1 } },
    { name: "10-group-overflow", kind: "group", premium: true,
      ev: mkEv({ tag: "g7", type: "task_moved", actorId: "u_ana", taskTitle: "Edição do Reels Institucional", fromStatus: "afazer", toStatus: "andamento", sector: "Vídeo" }),
      group: { count: 7, primaryId: "u_ana", items: [{ actorName: "Ana", title: "Tarefa movimentada" }, { actorName: "João", title: "Tarefa atualizada" }, { actorName: "Bruno", title: "Tarefa movimentada" }, { actorName: "Rafa", title: "Tarefa movimentada" }, { actorName: "Léo", title: "Tarefa atualizada" }], extraCount: 2 } },
    { name: "11-fallback-flag-off", kind: "single", premium: false,
      ev: mkEv({ tag: "fo", type: "task_moved", actorId: "u_ana", taskTitle: "Edição do Reels Institucional", fromStatus: "afazer", toStatus: "andamento", sector: "Vídeo" }), client: "Hospital Visão" },
    { name: "12-click-deeplink", kind: "click", premium: true,
      ev: mkEv({ tag: "ck", type: "task_moved", actorId: "u_ana", taskTitle: "Aprovação do Roteiro", fromStatus: "andamento", toStatus: "revisao", sector: "Roteiro" }) }
  ];

  const pick = WANT === "all" ? scenes : scenes.filter((s) => WANT.split(",").indexOf(s.name) >= 0);
  const manifest = { tag: TAG, ident, generatedScenes: [], scale: SCALE_HINT };
  let failures = 0;

  for (const sc of pick) {
    try {
      try { bg.stopBgNotify(); } catch (_) {}      // isola: 1 card por cena (janela recriada limpa)
      await wait(120);
      renderAcks.length = 0; openEvents.length = 0; resizeEvents.length = 0;

      const p = notif.buildCategoryAPayload(sc.ev, "u_viewer", resolveProfile);
      if (sc.client) p.clientName = sc.client;
      // agrupamento: o 1º card precisa carregar data-group (=groupKey) p/ o renderGroupUpdate morfar (F3.5.4O)
      if (sc.kind === "group") p.groupKey = "grp_" + sc.ev.taskId;
      stampPremium(p, sc.premium);

      const ok = bg.showBgNotify(p, () => {});      // ENTREGA REAL à janela premium (IPC real)
      if (!ok) { console.error("scene " + sc.name + ": showBgNotify=false"); failures++; continue; }
      const acked = await waitAck(p.dedupKey, 5000);

      if (sc.kind === "group") {
        const prim = resolveProfile(sc.group.primaryId) || { name: "", photo: "" };
        const view = { _premiumCommon: sc.premium !== false, groupKey: p.groupKey, taskTitle: p.taskTitle,
          count: sc.group.count, items: sc.group.items, extraCount: sc.group.extraCount,
          primaryName: prim.name, primaryAvatar: prim.photo, severity: p.severity, deep: (p.action && p.action.deep) || "" };
        bg.updateBgGroup(view);                     // ATUALIZAÇÃO DE GRUPO REAL (bg-group-update via IPC)
        // espera o card de grupo (mais alto) reportar novo resize e a janela crescer antes de capturar
        const hBefore = (bgWindow() && bgWindow().getBounds().height) || 0;
        const t0 = Date.now();
        while (Date.now() - t0 < 1600) { const w2 = bgWindow(); if (w2 && w2.getBounds().height > hBefore) break; await wait(50); }
        await wait(500);
      } else {
        await wait(350);
      }

      const win = bgWindow();
      if (!win || win.isDestroyed()) { console.error("scene " + sc.name + ": sem janela premium"); failures++; continue; }
      await wait(250);
      const img = await win.capturePage();
      const png = img.toPNG();
      const file = TAG + "-" + sc.name + ".png";
      fs.writeFileSync(path.join(OUT, file), png);

      let clickResult = null;
      if (sc.kind === "click") {
        // CLIQUE REAL no card → dispara bgAPI.open(deep) no renderer → "bgnotify-open" no main (deep-link real)
        // o handler de abertura está em .ntfp-cta ("Abrir tarefa") e no próprio .ntf-card (bgnotify.html:174-175)
        try { await win.webContents.executeJavaScript("(function(){var c=document.querySelector('.ntfp-cta')||document.querySelector('.ntf-card');if(c){c.click();return true;}return false;})()"); } catch (_) {}
        await wait(300);
        clickResult = { openReceived: openEvents.length > 0, deep: openEvents[0] || "", expected: (p.action && p.action.deep) || "" };
        // recaptura pós-clique não é necessária; o card faz dismiss após abrir (comportamento real).
      }

      const b = win.getBounds();
      const rec = {
        scene: sc.name, file, kind: sc.kind, surface: "premium_window",
        appVersion: version, appPath, executable: process.execPath, electron: process.versions.electron,
        scale: SCALE_HINT, pngBytes: png.length, imgSize: img.getSize(),
        window: { width: b.width, height: b.height, x: b.x, y: b.y, focusable: win.isFocusable(), visible: win.isVisible(), alwaysOnTop: win.isAlwaysOnTop() },
        renderAck: acked, resizeReported: resizeEvents.slice(-1)[0] || 0,
        payloadSanitized: sanitize(p), click: clickResult
      };
      manifest.generatedScenes.push(rec);
      console.log("PROOF_SCENE " + JSON.stringify({ scene: sc.name, w: b.width, h: b.height, focusable: win.isFocusable(), alwaysOnTop: win.isAlwaysOnTop(), ack: acked, bytes: png.length, click: clickResult }));
      if (png.length < 2000) { console.error("scene " + sc.name + ": PNG suspeito (<2000b)"); failures++; }
      if (sc.kind === "click" && !(clickResult && clickResult.openReceived)) { console.error("scene " + sc.name + ": deep-link NÃO recebido"); failures++; }
    } catch (e) { console.error("scene " + sc.name + " ERRO: " + (e && e.message)); failures++; }
  }

  fs.writeFileSync(path.join(OUT, TAG + "-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("PROOF_DONE tag=" + TAG + " scenes=" + manifest.generatedScenes.length + " failures=" + failures);
  try { bg.stopBgNotify(); } catch (_) {}
  app.exit(failures > 0 ? 1 : 0);
}).catch((e) => fail("whenReady: " + (e && e.message)));

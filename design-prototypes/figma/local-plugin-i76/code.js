// I7.6 — Composition B Builder — classic local Figma plugin (zero-cost, Figma Desktop).
// Writes "B — Balanced Workspace" into the OFFICIAL file (Agenda ID Seven — Product Design,
// fileKey aG7NXRdpCaiRDMeBiT8EKu). Reuses the existing Composition B frame (6:2) + sidebar (6:3)
// + Card B component (4:2). Does NOT recreate Foundations / tokens / cards / sidebar. Run once.
// Converted from design-prototypes/figma/i76_compB.js: the ONLY incompatible helper was
// figma.createAutoLayout(...) (a use_figma-only helper) — replaced by the classic AL() helper below.
(async () => {
  try {
    // ---------- helpers ----------
    // AL: classic-API equivalent of use_figma's createAutoLayout(dir, {name,itemSpacing}).
    function AL(dir, props) {
      const f = figma.createFrame();
      f.layoutMode = dir;
      f.primaryAxisSizingMode = "AUTO";
      f.counterAxisSizingMode = "AUTO";
      f.clipsContent = false;
      f.fills = [];
      if (props) { if (props.name) f.name = props.name; if (props.itemSpacing != null) f.itemSpacing = props.itemSpacing; }
      return f;
    }
    function icon(p, c, s) {
      const n = figma.createNodeFromSvg('<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>');
      n.resize(s, s); return n;
    }

    // ---------- locate Composition B frame ----------
    let B = null;
    try { B = await figma.getNodeByIdAsync("6:2"); } catch (e) { B = null; }
    if (!B || B.type !== "FRAME" || !/Balanced/i.test(B.name)) {
      try { const hit = figma.currentPage.findOne(n => n.type === "FRAME" && n.name === "B — Balanced Workspace"); if (hit) B = hit; } catch (e) {}
    }
    if (!B || B.type !== "FRAME") {
      figma.closePlugin("I7.6 ABORTADO: frame 'B — Balanced Workspace' (6:2) não encontrado. Abra o arquivo oficial 'Agenda ID Seven — Product Design' e a página 'Design'.");
      return;
    }

    // ---------- switch to B's page ----------
    let page = B; while (page && page.type !== "PAGE") page = page.parent;
    if (page && figma.currentPage !== page) { try { await figma.setCurrentPageAsync(page); } catch (e) {} }

    // ---------- idempotency ----------
    if (B.children.some(n => n.name === "header")) {
      figma.currentPage.selection = [B];
      figma.viewport.scrollAndZoomIntoView([B]);
      figma.closePlugin("I7.6 COMPOSITION B ALREADY EXISTS — nada a fazer (frame já contém 'header').");
      return;
    }

    // ---------- fonts ----------
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });

    // ---------- locate Card B component (reuse; fallback to inline) ----------
    let cardB = null;
    try { cardB = await figma.getNodeByIdAsync("4:2"); } catch (e) { cardB = null; }
    if (!cardB || cardB.type !== "COMPONENT") {
      try { const hit = figma.currentPage.findOne(n => n.type === "COMPONENT" && /Task Card \/ B/i.test(n.name)); if (hit) cardB = hit; } catch (e) {}
    }

    // ---------- colors (token-matched hex; no new tokens/collections created) ----------
    const INK = { r: 0.086, g: 0.137, b: 0.231 }, INK2 = { r: 0.259, g: 0.314, b: 0.420 }, INK3 = { r: 0.482, g: 0.529, b: 0.616 },
      W = { r: 1, g: 1, b: 1 }, LINE = { r: 0.863, g: 0.890, b: 0.925 }, S0 = { r: 0.906, g: 0.933, b: 0.957 },
      S3 = { r: 0.886, g: 0.914, b: 0.945 }, S4 = { r: 0.929, g: 0.949, b: 0.965 }, TEAL = { r: 0.051, g: 0.580, b: 0.533 },
      TEALBG = { r: 0.914, g: 0.969, b: 0.961 }, TEALD = { r: 0.055, g: 0.451, b: 0.412 }, GREEN = { r: 0.133, g: 0.773, b: 0.369 },
      TODO = { r: 0.357, g: 0.424, b: 1.0 }, TODOBG = { r: 0.929, g: 0.933, b: 1.0 }, TODOTX = { r: 0.310, g: 0.275, b: 0.898 },
      DOING = { r: 0.961, g: 0.620, b: 0.043 }, REVIEW = { r: 0.545, g: 0.361, b: 0.965 }, DONE = { r: 0.133, g: 0.773, b: 0.369 },
      AMBBG = { r: 0.996, g: 0.953, b: 0.886 }, AMBTX = { r: 0.706, g: 0.325, b: 0.035 };
    const SHADOW = { type: "DROP_SHADOW", color: { r: 0.059, g: 0.165, b: 0.235, a: 0.06 }, offset: { x: 0, y: 1 }, radius: 2, spread: 0, visible: true, blendMode: "NORMAL" };

    // ---------- HEADER ----------
    const hd = figma.createFrame(); hd.name = "header"; hd.resize(1672, 60); hd.layoutMode = "HORIZONTAL"; hd.primaryAxisSizingMode = "FIXED"; hd.counterAxisSizingMode = "FIXED"; hd.primaryAxisAlignItems = "SPACE_BETWEEN"; hd.counterAxisAlignItems = "CENTER"; hd.paddingLeft = 24; hd.paddingRight = 24; hd.itemSpacing = 20; hd.fills = [{ type: "SOLID", color: { r: 0.949, g: 0.965, b: 0.980 } }]; hd.strokes = [{ type: "SOLID", color: LINE }]; hd.strokeAlign = "INSIDE"; hd.strokeTopWeight = 0; hd.strokeLeftWeight = 0; hd.strokeRightWeight = 0; hd.strokeBottomWeight = 1;
    B.appendChild(hd); hd.x = 248; hd.y = 0;
    const ctx = AL("VERTICAL", { name: "context", itemSpacing: 2 }); ctx.fills = []; hd.appendChild(ctx);
    const t1 = figma.createText(); t1.fontName = { family: "Inter", style: "Bold" }; t1.characters = "Meu quadro"; t1.fontSize = 16.5; t1.letterSpacing = { unit: "PERCENT", value: -1 }; t1.fills = [{ type: "SOLID", color: INK }]; ctx.appendChild(t1);
    const t2 = figma.createText(); t2.fontName = { family: "Inter", style: "Medium" }; t2.characters = "Visão operacional · 2 tarefas ativas"; t2.fontSize = 11.5; t2.fills = [{ type: "SOLID", color: INK3 }]; ctx.appendChild(t2);
    const seg = AL("HORIZONTAL", { name: "viewtabs", itemSpacing: 2 }); seg.paddingTop = 3; seg.paddingBottom = 3; seg.paddingLeft = 3; seg.paddingRight = 3; seg.cornerRadius = 10; seg.fills = [{ type: "SOLID", color: S0 }]; seg.counterAxisAlignItems = "CENTER"; hd.appendChild(seg);
    function tab(label, active) { const p = AL("HORIZONTAL", { name: "tab/" + label }); p.paddingTop = 6; p.paddingBottom = 6; p.paddingLeft = 14; p.paddingRight = 14; p.cornerRadius = 8; p.primaryAxisAlignItems = "CENTER"; p.counterAxisAlignItems = "CENTER"; p.fills = active ? [{ type: "SOLID", color: W }] : []; if (active) p.effects = [{ type: "DROP_SHADOW", color: { r: 0.059, g: 0.165, b: 0.235, a: 0.10 }, offset: { x: 0, y: 1 }, radius: 2, spread: 0, visible: true, blendMode: "NORMAL" }]; const t = figma.createText(); t.fontName = { family: "Inter", style: active ? "Semi Bold" : "Medium" }; t.characters = label; t.fontSize = 12.5; t.fills = [{ type: "SOLID", color: active ? INK : INK3 }]; p.appendChild(t); seg.appendChild(p); }
    tab("Quadro", true); tab("Timeline", false); tab("Lista", false);
    const rg = AL("HORIZONTAL", { name: "actions", itemSpacing: 12 }); rg.fills = []; rg.counterAxisAlignItems = "CENTER"; hd.appendChild(rg);
    const sf = AL("HORIZONTAL", { name: "search", itemSpacing: 9 }); sf.paddingLeft = 12; sf.paddingRight = 12; sf.cornerRadius = 9; sf.counterAxisAlignItems = "CENTER"; sf.fills = [{ type: "SOLID", color: W }]; sf.strokes = [{ type: "SOLID", color: LINE }]; sf.resize(230, 36); sf.primaryAxisSizingMode = "FIXED"; sf.counterAxisSizingMode = "FIXED"; rg.appendChild(sf);
    sf.appendChild(icon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', "#7B879D", 16));
    const sp = figma.createText(); sp.fontName = { family: "Inter", style: "Regular" }; sp.characters = "Buscar tarefas, clientes…"; sp.fontSize = 12.5; sp.fills = [{ type: "SOLID", color: INK3 }]; sf.appendChild(sp);
    const sla = AL("HORIZONTAL", { name: "sla", itemSpacing: 7 }); sla.paddingTop = 6; sla.paddingBottom = 6; sla.paddingLeft = 10; sla.paddingRight = 12; sla.cornerRadius = 8; sla.counterAxisAlignItems = "CENTER"; sla.fills = [{ type: "SOLID", color: TEALBG }]; rg.appendChild(sla);
    const sd = figma.createEllipse(); sd.resize(7, 7); sd.fills = [{ type: "SOLID", color: GREEN }]; sla.appendChild(sd);
    const stt = figma.createText(); stt.fontName = { family: "Inter", style: "Semi Bold" }; stt.characters = "SLA no prazo"; stt.fontSize = 11.5; stt.fills = [{ type: "SOLID", color: TEALD }]; sla.appendChild(stt);
    const bell = AL("HORIZONTAL", { name: "notif" }); bell.resize(36, 36); bell.cornerRadius = 9; bell.primaryAxisAlignItems = "CENTER"; bell.counterAxisAlignItems = "CENTER"; bell.fills = [{ type: "SOLID", color: W }]; bell.strokes = [{ type: "SOLID", color: LINE }]; rg.appendChild(bell);
    bell.appendChild(icon('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', "#42506B", 18));
    const av0 = AL("HORIZONTAL", { name: "avatar" }); av0.resize(34, 34); av0.cornerRadius = 17; av0.primaryAxisAlignItems = "CENTER"; av0.counterAxisAlignItems = "CENTER"; av0.fills = [{ type: "SOLID", color: TEAL }]; rg.appendChild(av0);
    const ai0 = figma.createText(); ai0.fontName = { family: "Inter", style: "Bold" }; ai0.characters = "CE"; ai0.fontSize = 11; ai0.fills = [{ type: "SOLID", color: W }]; av0.appendChild(ai0);

    // ---------- VIEW CONTROLS ----------
    const cb = figma.createFrame(); cb.name = "view-controls"; cb.resize(1672, 48); cb.layoutMode = "HORIZONTAL"; cb.primaryAxisSizingMode = "FIXED"; cb.counterAxisSizingMode = "FIXED"; cb.primaryAxisAlignItems = "SPACE_BETWEEN"; cb.counterAxisAlignItems = "CENTER"; cb.paddingLeft = 24; cb.paddingRight = 24; cb.fills = [];
    B.appendChild(cb); cb.x = 248; cb.y = 60;
    const cbl = AL("HORIZONTAL", { name: "cbl", itemSpacing: 10 }); cbl.fills = []; cbl.counterAxisAlignItems = "CENTER"; cb.appendChild(cbl);
    function chip(build) { const c = AL("HORIZONTAL", { name: "chip", itemSpacing: 7 }); c.paddingTop = 6; c.paddingBottom = 6; c.paddingLeft = 9; c.paddingRight = 10; c.cornerRadius = 9; c.counterAxisAlignItems = "CENTER"; c.fills = [{ type: "SOLID", color: W }]; c.strokes = [{ type: "SOLID", color: LINE }]; cbl.appendChild(c); build(c); return c; }
    chip(c => { const a = AL("HORIZONTAL"); a.resize(20, 20); a.cornerRadius = 10; a.primaryAxisAlignItems = "CENTER"; a.counterAxisAlignItems = "CENTER"; a.fills = [{ type: "SOLID", color: TEAL }]; c.appendChild(a); const at = figma.createText(); at.fontName = { family: "Inter", style: "Bold" }; at.characters = "CE"; at.fontSize = 8.5; at.fills = [{ type: "SOLID", color: W }]; a.appendChild(at); const tx = figma.createText(); tx.fontName = { family: "Inter", style: "Medium" }; tx.characters = "Carlos Eduardo"; tx.fontSize = 12; tx.fills = [{ type: "SOLID", color: INK2 }]; c.appendChild(tx); c.appendChild(icon('<path d="m6 9 6 6 6-6"/>', "#7B879D", 14)); });
    chip(c => { const tx = figma.createText(); tx.fontName = { family: "Inter", style: "Medium" }; tx.characters = "Equipe: Todos"; tx.fontSize = 12; tx.fills = [{ type: "SOLID", color: INK2 }]; c.appendChild(tx); c.appendChild(icon('<path d="m6 9 6 6 6-6"/>', "#7B879D", 14)); });
    chip(c => { c.appendChild(icon('<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>', "#42506B", 15)); const tx = figma.createText(); tx.fontName = { family: "Inter", style: "Medium" }; tx.characters = "Filtros"; tx.fontSize = 12; tx.fills = [{ type: "SOLID", color: INK2 }]; c.appendChild(tx); });
    const cbr = figma.createText(); cbr.fontName = { family: "Inter", style: "Medium" }; cbr.characters = "2 tarefas nesta visão"; cbr.fontSize = 12; cbr.fills = [{ type: "SOLID", color: INK3 }]; cb.appendChild(cbr);

    // ---------- BOARD ----------
    function makeTodoCard() {
      const c = AL("VERTICAL", { name: "card/todo", itemSpacing: 8 }); c.paddingTop = 13; c.paddingBottom = 13; c.paddingLeft = 15; c.paddingRight = 14; c.cornerRadius = 12; c.fills = [{ type: "SOLID", color: W }]; c.strokes = [{ type: "SOLID", color: LINE }]; c.effects = [SHADOW];
      const eye = figma.createText(); eye.fontName = { family: "Inter", style: "Semi Bold" }; eye.characters = "SUNSET WEAR"; eye.fontSize = 9; eye.letterSpacing = { unit: "PERCENT", value: 8 }; eye.fills = [{ type: "SOLID", color: INK3 }]; c.appendChild(eye);
      const ti = figma.createText(); ti.fontName = { family: "Inter", style: "Bold" }; ti.characters = "Reels de lançamento"; ti.fontSize = 14; ti.lineHeight = { unit: "PERCENT", value: 128 }; ti.fills = [{ type: "SOLID", color: INK }]; c.appendChild(ti); ti.layoutSizingHorizontal = "FILL";
      const chp = AL("HORIZONTAL"); chp.paddingTop = 3; chp.paddingBottom = 3; chp.paddingLeft = 8; chp.paddingRight = 8; chp.cornerRadius = 8; chp.fills = [{ type: "SOLID", color: TODOBG }]; c.appendChild(chp);
      const cht = figma.createText(); cht.fontName = { family: "Inter", style: "Semi Bold" }; cht.characters = "A fazer"; cht.fontSize = 10; cht.fills = [{ type: "SOLID", color: TODOTX }]; chp.appendChild(cht);
      const foot = AL("HORIZONTAL", { name: "foot", itemSpacing: 8 }); foot.fills = []; foot.counterAxisAlignItems = "CENTER"; c.appendChild(foot); foot.layoutSizingHorizontal = "FILL"; foot.primaryAxisAlignItems = "SPACE_BETWEEN";
      const meta = figma.createText(); meta.fontName = { family: "Inter", style: "Medium" }; meta.characters = "Não iniciada · vence 26/08"; meta.fontSize = 11; meta.fills = [{ type: "SOLID", color: INK3 }]; foot.appendChild(meta);
      const av = AL("HORIZONTAL"); av.resize(22, 22); av.cornerRadius = 11; av.primaryAxisAlignItems = "CENTER"; av.counterAxisAlignItems = "CENTER"; av.fills = [{ type: "SOLID", color: TEAL }]; foot.appendChild(av); const ai = figma.createText(); ai.fontName = { family: "Inter", style: "Bold" }; ai.characters = "CE"; ai.fontSize = 9; ai.fills = [{ type: "SOLID", color: W }]; av.appendChild(ai);
      const bar = figma.createRectangle(); bar.resize(3, 50); bar.fills = [{ type: "SOLID", color: TODO }]; bar.topLeftRadius = 12; bar.bottomLeftRadius = 12; c.appendChild(bar); bar.layoutPositioning = "ABSOLUTE"; bar.constraints = { horizontal: "MIN", vertical: "STRETCH" }; bar.x = 0; bar.y = 0;
      return c;
    }
    function makeInformCard() { // fallback if Card B component (4:2) is not found
      const c = AL("VERTICAL", { name: "card/inform", itemSpacing: 9 }); c.paddingTop = 13; c.paddingBottom = 13; c.paddingLeft = 15; c.paddingRight = 14; c.cornerRadius = 12; c.fills = [{ type: "SOLID", color: W }]; c.strokes = [{ type: "SOLID", color: LINE }]; c.effects = [SHADOW];
      const eye = figma.createText(); eye.fontName = { family: "Inter", style: "Semi Bold" }; eye.characters = "SUNSET WEAR"; eye.fontSize = 9; eye.letterSpacing = { unit: "PERCENT", value: 8 }; eye.fills = [{ type: "SOLID", color: INK3 }]; c.appendChild(eye);
      const ti = figma.createText(); ti.fontName = { family: "Inter", style: "Bold" }; ti.characters = "Cronograma Sunset Wear"; ti.fontSize = 14; ti.lineHeight = { unit: "PERCENT", value: 128 }; ti.fills = [{ type: "SOLID", color: INK }]; c.appendChild(ti); ti.layoutSizingHorizontal = "FILL";
      const chp = AL("HORIZONTAL"); chp.paddingTop = 3; chp.paddingBottom = 3; chp.paddingLeft = 8; chp.paddingRight = 8; chp.cornerRadius = 8; chp.fills = [{ type: "SOLID", color: AMBBG }]; c.appendChild(chp);
      const cht = figma.createText(); cht.fontName = { family: "Inter", style: "Semi Bold" }; cht.characters = "Em andamento"; cht.fontSize = 10; cht.fills = [{ type: "SOLID", color: AMBTX }]; chp.appendChild(cht);
      const track = figma.createFrame(); track.name = "progress"; track.resize(240, 5); track.cornerRadius = 3; track.fills = [{ type: "SOLID", color: S3 }]; track.clipsContent = true; c.appendChild(track); track.layoutSizingHorizontal = "FILL";
      const fill = figma.createRectangle(); fill.resize(150, 5); fill.cornerRadius = 3; fill.fills = [{ type: "SOLID", color: DOING }]; track.appendChild(fill); fill.x = 0; fill.y = 0;
      const foot = AL("HORIZONTAL", { name: "foot", itemSpacing: 8 }); foot.fills = []; foot.counterAxisAlignItems = "CENTER"; c.appendChild(foot); foot.layoutSizingHorizontal = "FILL"; foot.primaryAxisAlignItems = "SPACE_BETWEEN";
      const meta = figma.createText(); meta.fontName = { family: "Inter", style: "Medium" }; meta.characters = "60% · vence hoje 22:00"; meta.fontSize = 11; meta.fills = [{ type: "SOLID", color: INK3 }]; foot.appendChild(meta);
      const av = AL("HORIZONTAL"); av.resize(22, 22); av.cornerRadius = 11; av.primaryAxisAlignItems = "CENTER"; av.counterAxisAlignItems = "CENTER"; av.fills = [{ type: "SOLID", color: TEAL }]; foot.appendChild(av); const ai = figma.createText(); ai.fontName = { family: "Inter", style: "Bold" }; ai.characters = "CE"; ai.fontSize = 9; ai.fills = [{ type: "SOLID", color: W }]; av.appendChild(ai);
      const bar = figma.createRectangle(); bar.resize(3, 50); bar.fills = [{ type: "SOLID", color: DOING }]; bar.topLeftRadius = 12; bar.bottomLeftRadius = 12; c.appendChild(bar); bar.layoutPositioning = "ABSOLUTE"; bar.constraints = { horizontal: "MIN", vertical: "STRETCH" }; bar.x = 0; bar.y = 0;
      return c;
    }
    const well = figma.createFrame(); well.name = "board"; well.layoutMode = "HORIZONTAL"; well.itemSpacing = 12; well.paddingTop = 14; well.paddingBottom = 14; well.paddingLeft = 14; well.paddingRight = 14; well.cornerRadius = 16; well.fills = [{ type: "SOLID", color: S3 }];
    B.appendChild(well); well.x = 268; well.y = 128; well.resize(1252, 430); well.primaryAxisSizingMode = "FIXED"; well.counterAxisSizingMode = "AUTO"; well.counterAxisAlignItems = "STRETCH";
    const stages = [{ n: "A Fazer", c: TODO, k: 1, t: "todo" }, { n: "Em andamento", c: DOING, k: 1, t: "doing" }, { n: "Revisão", c: REVIEW, k: 0, t: "empty" }, { n: "Finalizado", c: DONE, k: 0, t: "empty" }];
    function makeEmpty() {
      const e = AL("VERTICAL", { name: "empty", itemSpacing: 7 }); e.primaryAxisAlignItems = "CENTER"; e.counterAxisAlignItems = "CENTER"; e.paddingTop = 26; e.paddingBottom = 26; e.paddingLeft = 12; e.paddingRight = 12; e.cornerRadius = 11; e.fills = []; e.strokes = [{ type: "SOLID", color: { r: 0.820, g: 0.855, b: 0.898 } }]; e.dashPattern = [5, 5];
      e.appendChild(icon('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>', "#9AA6B8", 22));
      const q1 = figma.createText(); q1.fontName = { family: "Inter", style: "Semi Bold" }; q1.characters = "Sem tarefas"; q1.fontSize = 11.5; q1.fills = [{ type: "SOLID", color: INK3 }]; e.appendChild(q1);
      const q2 = figma.createText(); q2.fontName = { family: "Inter", style: "Medium" }; q2.characters = "Arraste ou crie aqui"; q2.fontSize = 10; q2.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.65, b: 0.72 } }]; e.appendChild(q2);
      return e;
    }
    for (const s of stages) {
      const col = AL("VERTICAL", { name: "col/" + s.n, itemSpacing: 9 }); col.paddingTop = 10; col.paddingBottom = 12; col.paddingLeft = 10; col.paddingRight = 10; col.cornerRadius = 14; col.fills = [{ type: "SOLID", color: S4 }];
      well.appendChild(col); col.layoutSizingHorizontal = "FILL"; col.minHeight = 430;
      const h = AL("HORIZONTAL", { name: "colhead" }); h.fills = []; h.counterAxisAlignItems = "CENTER"; h.primaryAxisAlignItems = "SPACE_BETWEEN"; h.paddingLeft = 4; h.paddingRight = 2; h.paddingTop = 2; h.paddingBottom = 2; col.appendChild(h); h.layoutSizingHorizontal = "FILL";
      const hl = AL("HORIZONTAL", { name: "hl", itemSpacing: 8 }); hl.fills = []; hl.counterAxisAlignItems = "CENTER"; h.appendChild(hl);
      const dot = figma.createEllipse(); dot.resize(8, 8); dot.fills = [{ type: "SOLID", color: s.c }]; hl.appendChild(dot);
      const ht = figma.createText(); ht.fontName = { family: "Inter", style: "Semi Bold" }; ht.characters = s.n; ht.fontSize = 12.5; ht.fills = [{ type: "SOLID", color: INK }]; hl.appendChild(ht);
      const cpp = AL("HORIZONTAL"); cpp.paddingLeft = 7; cpp.paddingRight = 7; cpp.paddingTop = 2; cpp.paddingBottom = 2; cpp.cornerRadius = 8; cpp.fills = [{ type: "SOLID", color: S0 }]; cpp.counterAxisAlignItems = "CENTER"; h.appendChild(cpp);
      const cptx = figma.createText(); cptx.fontName = { family: "Inter", style: "Bold" }; cptx.characters = String(s.k); cptx.fontSize = 10.5; cptx.fills = [{ type: "SOLID", color: INK3 }]; cpp.appendChild(cptx);
      if (s.t === "doing") {
        if (cardB && cardB.type === "COMPONENT") { const inst = cardB.createInstance(); col.appendChild(inst); inst.layoutSizingHorizontal = "FILL"; }
        else { const cd = makeInformCard(); col.appendChild(cd); cd.layoutSizingHorizontal = "FILL"; }
      } else if (s.t === "todo") { const cd = makeTodoCard(); col.appendChild(cd); cd.layoutSizingHorizontal = "FILL"; }
      else { const es = makeEmpty(); col.appendChild(es); es.layoutSizingHorizontal = "FILL"; }
      const add = AL("HORIZONTAL", { name: "add", itemSpacing: 6 }); add.counterAxisAlignItems = "CENTER"; add.paddingTop = 7; add.paddingBottom = 7; add.paddingLeft = 8; add.paddingRight = 8; add.cornerRadius = 8; add.fills = []; col.appendChild(add); add.layoutSizingHorizontal = "FILL";
      add.appendChild(icon('<path d="M12 5v14M5 12h14"/>', "#7B879D", 15)); const at = figma.createText(); at.fontName = { family: "Inter", style: "Medium" }; at.characters = "Adicionar tarefa"; at.fontSize = 11.5; at.fills = [{ type: "SOLID", color: INK3 }]; add.appendChild(at);
    }

    // ---------- CONTEXT RAIL ----------
    const rail = AL("VERTICAL", { name: "context-rail", itemSpacing: 12 }); rail.fills = []; B.appendChild(rail); rail.x = 1540; rail.y = 128; rail.resize(360, 10); rail.primaryAxisSizingMode = "AUTO"; rail.counterAxisSizingMode = "FIXED";
    function panel(title) { const p = AL("VERTICAL", { name: "panel/" + title, itemSpacing: 12 }); p.paddingTop = 16; p.paddingBottom = 16; p.paddingLeft = 16; p.paddingRight = 16; p.cornerRadius = 14; p.fills = [{ type: "SOLID", color: W }]; p.strokes = [{ type: "SOLID", color: LINE }]; rail.appendChild(p); p.layoutSizingHorizontal = "FILL"; const t = figma.createText(); t.fontName = { family: "Inter", style: "Semi Bold" }; t.characters = title; t.fontSize = 12.5; t.fills = [{ type: "SOLID", color: INK }]; p.appendChild(t); return p; }
    const p1 = panel("Resumo da visão");
    const grid = AL("VERTICAL", { name: "grid", itemSpacing: 9 }); grid.fills = []; p1.appendChild(grid); grid.layoutSizingHorizontal = "FILL";
    function tileRow(a, b) { const r = AL("HORIZONTAL", { name: "r", itemSpacing: 9 }); r.fills = []; grid.appendChild(r); r.layoutSizingHorizontal = "FILL";[a, b].forEach(o => { const t = AL("VERTICAL", { name: "tile", itemSpacing: 3 }); t.paddingTop = 11; t.paddingBottom = 11; t.paddingLeft = 12; t.paddingRight = 12; t.cornerRadius = 10; t.fills = [{ type: "SOLID", color: S0 }]; r.appendChild(t); t.layoutSizingHorizontal = "FILL"; const v = figma.createText(); v.fontName = { family: "Inter", style: "Bold" }; v.characters = o.v; v.fontSize = 18; v.fills = [{ type: "SOLID", color: o.c }]; t.appendChild(v); const l = figma.createText(); l.fontName = { family: "Inter", style: "Medium" }; l.characters = o.l; l.fontSize = 10.5; l.fills = [{ type: "SOLID", color: INK3 }]; t.appendChild(l); }); }
    tileRow({ v: "2", l: "Total", c: INK }, { v: "1", l: "Em andamento", c: DOING });
    tileRow({ v: "1", l: "A fazer", c: TODO }, { v: "0", l: "Concluídas", c: DONE });
    const p2 = panel("SLA da visão");
    const slarow = AL("HORIZONTAL", { name: "slarow" }); slarow.fills = []; slarow.primaryAxisAlignItems = "SPACE_BETWEEN"; slarow.counterAxisAlignItems = "CENTER"; p2.appendChild(slarow); slarow.layoutSizingHorizontal = "FILL";
    const slaL = AL("VERTICAL", { name: "slal", itemSpacing: 2 }); slaL.fills = []; slarow.appendChild(slaL);
    const slv = figma.createText(); slv.fontName = { family: "Inter", style: "Bold" }; slv.characters = "Hoje · 22:00"; slv.fontSize = 15; slv.fills = [{ type: "SOLID", color: INK }]; slaL.appendChild(slv);
    const sll = figma.createText(); sll.fontName = { family: "Inter", style: "Medium" }; sll.characters = "Próximo vencimento"; sll.fontSize = 10.5; sll.fills = [{ type: "SOLID", color: INK3 }]; slaL.appendChild(sll);
    const badge = AL("HORIZONTAL", { name: "badge", itemSpacing: 6 }); badge.paddingTop = 5; badge.paddingBottom = 5; badge.paddingLeft = 9; badge.paddingRight = 10; badge.cornerRadius = 8; badge.fills = [{ type: "SOLID", color: TEALBG }]; badge.counterAxisAlignItems = "CENTER"; slarow.appendChild(badge);
    const bd = figma.createEllipse(); bd.resize(6, 6); bd.fills = [{ type: "SOLID", color: GREEN }]; badge.appendChild(bd);
    const bt = figma.createText(); bt.fontName = { family: "Inter", style: "Semi Bold" }; bt.characters = "No prazo"; bt.fontSize = 11; bt.fills = [{ type: "SOLID", color: TEALD }]; badge.appendChild(bt);
    const sub = figma.createText(); sub.fontName = { family: "Inter", style: "Medium" }; sub.characters = "Cronograma Sunset Wear"; sub.fontSize = 11; sub.fills = [{ type: "SOLID", color: INK3 }]; p2.appendChild(sub); sub.layoutSizingHorizontal = "FILL";
    const p3 = panel("Equipe");
    function member(txt, color, name, role, count) { const m = AL("HORIZONTAL", { name: "m", itemSpacing: 10 }); m.fills = []; m.counterAxisAlignItems = "CENTER"; m.primaryAxisAlignItems = "SPACE_BETWEEN"; p3.appendChild(m); m.layoutSizingHorizontal = "FILL"; const left = AL("HORIZONTAL", { name: "l", itemSpacing: 10 }); left.fills = []; left.counterAxisAlignItems = "CENTER"; m.appendChild(left); const a = AL("HORIZONTAL"); a.resize(30, 30); a.cornerRadius = 15; a.primaryAxisAlignItems = "CENTER"; a.counterAxisAlignItems = "CENTER"; a.fills = [{ type: "SOLID", color: color }]; left.appendChild(a); const ai = figma.createText(); ai.fontName = { family: "Inter", style: "Bold" }; ai.characters = txt; ai.fontSize = 10; ai.fills = [{ type: "SOLID", color: W }]; a.appendChild(ai); const nn = AL("VERTICAL", { name: "nn", itemSpacing: 1 }); nn.fills = []; left.appendChild(nn); const n1 = figma.createText(); n1.fontName = { family: "Inter", style: "Semi Bold" }; n1.characters = name; n1.fontSize = 12; n1.fills = [{ type: "SOLID", color: INK }]; nn.appendChild(n1); const n2 = figma.createText(); n2.fontName = { family: "Inter", style: "Medium" }; n2.characters = role; n2.fontSize = 10; n2.fills = [{ type: "SOLID", color: INK3 }]; nn.appendChild(n2); const cc = figma.createText(); cc.fontName = { family: "Inter", style: "Bold" }; cc.characters = count; cc.fontSize = 11; cc.fills = [{ type: "SOLID", color: INK3 }]; m.appendChild(cc); }
    member("CE", TEAL, "Carlos Eduardo", "CEO · Operações", "2");
    member("MK", REVIEW, "Marina Klein", "Designer", "0");

    // ---------- finish ----------
    figma.currentPage.selection = [B];
    figma.viewport.scrollAndZoomIntoView([B]);
    figma.closePlugin("I7.6 — Composition B (Balanced Workspace) criada com sucesso.");
  } catch (err) {
    figma.closePlugin("I7.6 ERRO: " + (err && err.message ? err.message : String(err)));
  }
})();

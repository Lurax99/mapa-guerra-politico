/* ═══════════════════════════════════════════════════════════
   app.js · estado, interfaz y orquestación
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const W = window.WAR, M = window.WarMap, S = window.WarStream;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const nf = n => Number(n).toLocaleString("es-ES");
  const hhmmss = ts => new Date(ts).toLocaleTimeString("es-ES", { hour12: false });

  /* ── estado ─────────────────────────────────────────────── */
  const st = {
    total: 0, viral: 0,
    party: {}, region: {}, regionParty: {}, regionTag: {},
    heat: {}, hidden: new Set(), search: "",
    selected: null, paused: false, sens: 1,
    series: [], acc: {}, stamps: [],
    alerts: [], trend: null, mode: "sim"
  };
  W.PARTIES.forEach(p => { st.party[p.id] = 0; st.acc[p.id] = 0; });
  W.REGIONS.forEach(r => {
    st.region[r.id] = 0; st.regionParty[r.id] = {}; st.regionTag[r.id] = {}; st.heat[r.id] = 0;
    W.PARTIES.forEach(p => st.regionParty[r.id][p.id] = 0);
  });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ═════════ MAPA ═════════ */
  const mapApi = M.init({
    svg: $("#map"), canvas: $("#fx"), wrap: $("#mapWrap"),
    onClick: id => selectRegion(st.selected === id ? null : id),
    onHover: null
  });

  /* ═════════ LEYENDA ═════════ */
  const legend = $("#legend");
  W.PARTIES.forEach(p => {
    const row = document.createElement("div");
    row.className = "lg"; row.dataset.party = p.id;
    row.style.setProperty("--c", p.color);
    row.title = "Ocultar / mostrar " + p.name;
    row.innerHTML =
      '<div class="lg-top"><span class="lg-sw"></span><span class="lg-n">' + esc(p.name) + '</span>' +
      '<span class="lg-v" data-v>0</span><span class="lg-p" data-p>0 %</span></div>' +
      '<div class="lg-bar"><i></i></div>';
    row.addEventListener("click", () => toggleParty(p.id));
    legend.appendChild(row);
  });

  const chips = $("#chips");
  W.PARTIES.forEach(p => {
    const c = document.createElement("button");
    c.className = "chip"; c.dataset.party = p.id;
    c.style.setProperty("--c", p.color);
    c.textContent = p.name;
    c.addEventListener("click", () => toggleParty(p.id));
    chips.appendChild(c);
  });

  function toggleParty(id) {
    if (st.hidden.has(id)) st.hidden.delete(id); else st.hidden.add(id);
    syncFilters();
  }
  function syncFilters() {
    $$(".lg").forEach(n => n.classList.toggle("off", st.hidden.has(n.dataset.party)));
    $$(".chip").forEach(n => n.classList.toggle("off", st.hidden.has(n.dataset.party)));
    $$("#feed .tw").forEach(n => n.classList.toggle("hide", st.hidden.has(n.dataset.party)));
    refreshAllRegions(); refreshLegend(); refreshDetail(); drawChart();
  }

  /* ═════════ SELECCIÓN DE SECTOR ═════════ */
  function selectRegion(id) {
    st.selected = id;
    M.select(id);
    refreshDetail();
  }

  function dominantParty(rid) {
    const c = st.regionParty[rid];
    let best = null, v = 0;
    for (const p of W.PARTIES) {
      if (st.hidden.has(p.id)) continue;
      if (c[p.id] > v) { v = c[p.id]; best = p.id; }
    }
    return v > 0 ? best : null;
  }

  /* ═════════ LLEGADA DE UN TWEET ═════════ */
  function onTweet(tw) {
    if (st.paused || !tw || !tw.party) return;
    const party = W.PARTY_MAP[tw.party];
    const hidden = st.hidden.has(tw.party);
    const rid = tw.region && W.REGION_MAP[tw.region] ? tw.region : "madrid";
    const now = Date.now();

    const viral = tw.viral || (tw.engagement && tw.engagement.likes > 1100 / st.sens);

    /* contadores */
    st.total++; st.party[tw.party]++; st.region[rid]++; st.regionParty[rid][tw.party]++;
    st.acc[tw.party]++;
    st.stamps.push(now);
    (tw.hashtags || []).forEach(h => {
      const k = h.toUpperCase();
      st.regionTag[rid][k] = (st.regionTag[rid][k] || 0) + 1;
    });
    st.heat[rid] = Math.min(1, st.heat[rid] + (viral ? .55 : .16) + (tw.engagement.likes > 300 ? .08 : 0));
    if (viral && !hidden) st.viral++;

    /* efectos en el mapa (no se disparan para partidos ocultos) */
    const realPos = realCentroid(rid);
    if (!hidden) {
      M.ping(realPos[0], realPos[1], party.color, viral);
      M.chip(realPos[0], realPos[1], "+" + (viral ? "⚡" : "1"), party.color);
      if (viral) {
        M.burst(realPos[0], realPos[1], party.color, Math.min(1.6, .7 + tw.engagement.likes / 1400));
        const cap = realCentroid("madrid");
        if (rid !== "madrid") M.tracer(realPos[0], realPos[1], cap[0], cap[1], party.color);
        flash(realPos[0], realPos[1]);
        addAlert('<b class="v">⚡ VIRAL</b> ' + esc(party.name) + " en " + esc(W.REGION_MAP[rid].label) + " · " +
          nf(tw.engagement.likes) + " me gusta — «" + esc(tw.text.slice(0, 90)) + (tw.text.length > 90 ? "…" : "") + "»");
      }
    }

    refreshRegion(rid);
    pushFeed(tw, party);
    if (st.selected) refreshDetail();
    refreshLegend();
  }

  /* posición real del centroide del sector */
  function realCentroid(rid) {
    const r = M.regions().find(x => x.id === rid);
    return r ? [r.cx, r.cy] : M.labelPos(rid);
  }

  function flash(x, y) {
    const box = $("#mapWrap").getBoundingClientRect();
    const vb = M.viewBox();
    const s = Math.min(box.width / vb.w, box.height / vb.h);
    const px = (box.width - vb.w * s) / 2 + x * s;
    const py = (box.height - vb.h * s) / 2 + y * s;
    const f = $("#flash");
    f.style.setProperty("--x", (px / box.width * 100).toFixed(1) + "%");
    f.style.setProperty("--y", (py / box.height * 100).toFixed(1) + "%");
    f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
    const mw = $("#mapWrap");
    mw.classList.remove("shake"); void mw.offsetWidth; mw.classList.add("shake");
  }

  /* ═════════ ACTUALIZACIÓN POR SECTOR ═════════ */
  function refreshRegion(rid) {
    const dom = dominantParty(rid);
    M.update(rid, st.region[rid], dom, st.heat[rid]);
  }
  function refreshAllRegions() { Object.keys(st.region).forEach(refreshRegion); }

  /* ═════════ FLUJO (FEED) ═════════ */
  const feed = $("#feed");
  let feedItems = 0;

  function pushFeed(tw, party) {
    if (st.hidden.has(tw.party)) return;
    if (st.search) {
      const q = st.search.toLowerCase();
      const hay = (tw.text + " " + (tw.hashtags || []).join(" ") + " " + W.REGION_MAP[tw.region].label).toLowerCase();
      if (hay.indexOf(q) < 0) return;
    }
    if (!feedItems) feed.innerHTML = "";
    const tags = (tw.hashtags || []).map(h => {
      const isP = W.PARTIES.some(p => p.tags.some(t => t.toUpperCase() === h.toUpperCase()));
      return isP ? "<mark>" + esc(h) + "</mark>" : '<span class="ht">' + esc(h) + "</span>";
    }).join(" ");
    const e = tw.engagement || { likes: 0, rts: 0, replies: 0 };
    const sent = tw.sentiment === "neg" ? '<span class="b neg">😠 CRÍTICO</span>'
      : tw.sentiment === "pos" ? '<span class="b pos">😊 FAVORABLE</span>'
        : '<span class="b neu">😐 NEUTRO</span>';
    const txt = esc(tw.text).replace(/(#[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]+)/g, m =>
      tagsRaw(tw).indexOf(m.toUpperCase()) >= 0 ? '<mark>' + m + "</mark>" : m);

    const node = document.createElement("article");
    node.className = "tw" + (tw.viral ? " viral" : "");
    node.dataset.party = tw.party;
    node.style.setProperty("--c", party.color);
    node.innerHTML =
      '<div class="tw-av">' + esc(tw.user.initials || "??") + "</div>" +
      '<div class="tw-b">' +
      '<div class="tw-meta"><b>' + esc(tw.user.name) + "</b><span>" + esc(tw.user.handle) + "</span><i>" + hhmmss(tw.ts) + "</i></div>" +
      '<p class="tw-tx">' + txt + "</p>" +
      '<div class="tw-ft">' + tags + sent +
      '<span class="en">♥ ' + nf(e.likes) + " · ↻ " + nf(e.rts) + "</span>" +
      '<span class="rg">◎ ' + esc(W.REGION_MAP[tw.region].label.toUpperCase()) + "</span>" +
      "</div></div>";
    feed.insertBefore(node, feed.firstChild);
    feedItems++;
    while (feedItems > 45) { feed.removeChild(feed.lastChild); feedItems--; }
  }
  function tagsRaw(tw) {
    return (tw.hashtags || []).filter(h => W.PARTIES.some(p => p.tags.some(t => t.toUpperCase() === h.toUpperCase()))).map(h => h.toUpperCase());
  }

  /* ═════════ LEYENDA / RANKING / STATS ═════════ */
  function refreshLegend() {
    const tot = W.PARTIES.reduce((a, p) => a + st.party[p.id], 0) || 1;
    $$(".lg").forEach(row => {
      const id = row.dataset.party;
      const v = st.party[id], pct = v / tot * 100;
      row.querySelector("[data-v]").textContent = nf(v);
      row.querySelector("[data-p]").textContent = Math.round(pct) + " %";
      row.querySelector(".lg-bar i").style.width = pct.toFixed(1) + "%";
    });
  }

  function refreshRank() {
    const rows = W.REGIONS.map(r => ({ r, n: st.region[r.id], dom: dominantParty(r.id) }))
      .sort((a, b) => b.n - a.n).slice(0, 7);
    const max = rows.length ? (rows[0].n || 1) : 1;
    $("#regionRank").innerHTML = rows.map((x, i) => {
      const c = x.dom ? W.PARTY_MAP[x.dom].color : "rgba(255,255,255,.3)";
      return '<div class="rk" style="--c:' + c + '"><span class="rk-i">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<span class="rk-n">' + esc(x.r.label) + "</span>" +
        '<span class="rk-bar"><i style="width:' + ((x.n / max) * 100).toFixed(1) + '%"></i></span>' +
        '<span class="rk-v">' + x.n + "</span></div>";
    }).join("");
  }

  function refreshStats() {
    $("#statTotal").textContent = nf(st.total);
    $("#statViral").textContent = nf(st.viral);
    const cut = Date.now() - 60000;
    while (st.stamps.length && st.stamps[0] < cut) st.stamps.shift();
    $("#statRate").textContent = nf(st.stamps.length);
    let hot = null, hv = 0;
    for (const id in st.heat) if (st.heat[id] > hv) { hv = st.heat[id]; hot = id; }
    $("#statHot").textContent = hot && hv > .08 ? W.REGION_MAP[hot].label.toUpperCase() : "EN CALMA";
  }

  /* ═════════ DOSSIER DEL SECTOR ═════════ */
  function refreshDetail() {
    const box = $("#detailBody");
    if (!st.selected) {
      box.innerHTML = '<p class="empty">Toca cualquier comunidad del mapa para abrir su dossier.</p>';
      return;
    }
    const rid = st.selected, r = W.REGION_MAP[rid];
    const n = st.region[rid] || 0;
    const dom = dominantParty(rid);
    const tot = W.PARTIES.reduce((a, p) => a + st.regionParty[rid][p.id], 0) || 0;
    const rows = W.PARTIES.map(p => {
      const c = st.regionParty[rid][p.id];
      const pct = tot ? c / tot * 100 : 0;
      return { p, c, pct };
    }).sort((a, b) => b.c - a.c);
    const tags = Object.entries(st.regionTag[rid]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const domColor = dom ? W.PARTY_MAP[dom].color : "#6d84a6";

    const domPct = dom ? (rows.find(x => x.p.id === dom) || { pct: 0 }).pct : 0;

    box.innerHTML =
      '<div class="dt-h" style="--c:' + domColor + '"><span class="dt-sw"></span><b>' + esc(r.label.toUpperCase()) + "</b>" +
      "<em>" + nf(n) + " menc.</em></div>" +
      (dom
        ? '<div class="dt-big">' + Math.round(domPct) + ' %</div><div class="dt-lab">dominancia de ' + esc(W.PARTY_MAP[dom].name) + "</div>"
        : '<div class="dt-big">—</div><div class="dt-lab">sin menciones todavía</div>') +
      '<div class="dt-rows">' + rows.map(x =>
        '<div class="dt-r" style="--c:' + x.p.color + '"><span>' + esc(x.p.name) + '</span>' +
        '<span class="bar"><i style="width:' + x.pct.toFixed(1) + '%"></i></span><b>' + Math.round(x.pct) + "%</b></div>").join("") +
      "</div>" +
      (tags.length ? '<div class="dt-tags">' + tags.map(t => '<span class="dt-tag">' + esc(t[0]) + " · " + t[1] + "</span>").join("") + "</div>" : "") +
      '<button class="btn ghost dt-close" id="dtClose">CERRAR DOSSIER</button>';
    const b = $("#dtClose");
    if (b) b.addEventListener("click", () => selectRegion(null));
  }

  /* ═════════ GRÁFICA ═════════ */
  const tc = $("#trend"), tctx = tc.getContext("2d");
  const MAXB = 90;
  function drawChart() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = tc.clientWidth, h = tc.clientHeight;
    if (!w || !h) return;
    if (tc.width !== Math.round(w * dpr)) { tc.width = Math.round(w * dpr); tc.height = Math.round(h * dpr); }
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, w, h);

    const pad = 10;
    const W0 = w - pad * 2, H0 = h - pad * 2 - 8;

    // rejilla
    tctx.strokeStyle = "rgba(120,180,255,.10)"; tctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad + H0 * i / 3;
      tctx.beginPath(); tctx.moveTo(pad, y); tctx.lineTo(pad + W0, y); tctx.stroke();
    }

    const s = st.series;
    if (s.length < 2) return;
    const val = (b, pid) => (st.hidden.has(pid) ? 0 : (b[pid] || 0));
    let max = 4;
    s.forEach(b => {
      let t = 0; W.PARTIES.forEach(p => t += val(b, p.id));
      if (t > max) max = t;
    });
    max *= 1.15;

    const off = MAXB - s.length;
    const x = i => pad + (i / (MAXB - 1)) * W0;
    const y = v => pad + H0 - (v / max) * H0;

    // áreas apiladas (de atrás hacia delante)
    const order = ["pp", "psoe", "vox", "otros", "sumar", "podemos"];
    const base = new Array(s.length).fill(0);
    order.forEach(pid => {
      const p = W.PARTY_MAP[pid]; if (!p) return;
      const top = s.map((b, i) => base[i] + val(b, pid));
      tctx.beginPath();
      for (let i = 0; i < s.length; i++) {
        const xx = x(off + i);
        i === 0 ? tctx.moveTo(xx, y(top[i])) : tctx.lineTo(xx, y(top[i]));
      }
      for (let i = s.length - 1; i >= 0; i--) tctx.lineTo(x(off + i), y(base[i]));
      tctx.closePath();
      tctx.fillStyle = hexA(p.color, .38); tctx.fill();
      tctx.strokeStyle = hexA(p.color, .9); tctx.lineWidth = 1.2;
      tctx.stroke();
      for (let i = 0; i < s.length; i++) base[i] = top[i];
    });

    // eje temporal
    tctx.fillStyle = "rgba(140,180,230,.55)";
    tctx.font = "9px 'JetBrains Mono', monospace";
    tctx.fillText("-90 s", pad, h - 3);
    tctx.textAlign = "right"; tctx.fillText("ahora", pad + W0, h - 3); tctx.textAlign = "left";
  }
  function hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  /* ═════════ TENDENCIA ═════════ */
  function onTrend(t) {
    if (!t.start) t.start = Date.now();
    st.trend = t;
    const box = $("#trendBox");
    box.hidden = false;
    const color = t.party ? W.PARTY_MAP[t.party].color : "#43e8ff";
    box.style.color = color;
    $("#trendTag").textContent = t.tag;
    addAlert('<b class="t">▲ TENDENCIA</b> ' + esc(t.tag) + " dispara las menciones" + (t.party ? " · " + esc(W.PARTY_MAP[t.party].name) : ""));
  }
  function tickTrend() {
    const box = $("#trendBox");
    if (!st.trend) { box.hidden = true; return; }
    const span = Math.max(1, st.trend.until - st.trend.start);
    const left = (st.trend.until - Date.now()) / span;
    if (left <= 0) { st.trend = null; box.hidden = true; return; }
    box.querySelector("i").style.width = Math.min(1, left) * 100 + "%";
  }

  /* ═════════ CINTA DE ALERTAS ═════════ */
  function addAlert(html) {
    st.alerts.unshift(html);
    if (st.alerts.length > 7) st.alerts.pop();
    const one = st.alerts.map(a => "<span>" + a + "</span>").join("");
    $("#ticker").innerHTML = one + one;   // duplicado para bucle continuo
  }

  /* ═════════ RELOJ Y TICKS ═════════ */
  $("#clock").textContent = hhmmss(Date.now());
  setInterval(() => { $("#clock").textContent = hhmmss(Date.now()); }, 1000);

  let bucketAt = Date.now();
  setInterval(() => {
    // calor se enfría
    for (const id in st.heat) st.heat[id] *= .90;
    refreshAllRegions();
    refreshStats();
    tickTrend();

    // nueva columna de la gráfica (1 s)
    const now = Date.now();
    if (now - bucketAt >= 1000) {
      bucketAt = now;
      st.series.push(Object.assign({}, st.acc));
      W.PARTIES.forEach(p => st.acc[p.id] = 0);
      while (st.series.length > MAXB) st.series.shift();
      drawChart();
    }
  }, 500);
  setInterval(refreshRank, 1200);

  /* ═════════ CONTROLES ═════════ */
  const btnPause = $("#btnPause");
  btnPause.addEventListener("click", () => {
    st.paused = !st.paused;
    btnPause.textContent = st.paused ? "▶ REANUDAR" : "❙❙ PAUSA";
    btnPause.classList.toggle("on", st.paused);
    if (st.mode === "sim") { st.paused ? sim.stop() : sim.start(); }
  });

  $("#btnBurst").addEventListener("click", () => {
    const n = 14 + Math.floor(Math.random() * 12);
    for (let i = 0; i < n; i++) setTimeout(() => onTweet(sim._make()), i * 90);
    const p = W.PARTIES[Math.floor(Math.random() * 5)];
    onTrend({ party: p.id, tag: p.tags[0], power: 1.6, until: Date.now() + 14000, start: Date.now() });
    addAlert('<b class="v">⚡ OLA VIRAL</b> ' + n + " menciones coordinadas detectadas");
  });

  $("#btnReset").addEventListener("click", () => {
    st.total = st.viral = 0;
    W.PARTIES.forEach(p => { st.party[p.id] = 0; st.acc[p.id] = 0; });
    W.REGIONS.forEach(r => {
      st.region[r.id] = 0; st.heat[r.id] = 0; st.regionTag[r.id] = {};
      W.PARTIES.forEach(p => st.regionParty[r.id][p.id] = 0);
    });
    st.series = []; st.stamps = []; st.alerts = []; st.trend = null;
    feed.innerHTML = ""; feedItems = 0;
    $("#trendBox").hidden = true;
    $("#ticker").innerHTML = "<span>Frente reiniciado · esperando menciones</span>";
    refreshAllRegions(); refreshLegend(); refreshRank(); refreshStats(); refreshDetail(); drawChart();
  });

  $("#rate").addEventListener("input", e => {
    const v = parseFloat(e.target.value);
    sim.setRate(v);
    $("#rateVal").textContent = v.toFixed(1).replace(".", ",") + "/s";
  });
  $("#sens").addEventListener("input", e => {
    st.sens = parseFloat(e.target.value);
    $("#sensVal").textContent = "x" + st.sens.toFixed(1).replace(".", ",");
  });
  $("#search").addEventListener("input", e => { st.search = e.target.value.trim(); });

  /* fuente de datos */
  let sim, ws;
  function setStatus(kind, label) {
    const d = $("#connDot");
    d.className = "dot" + (kind === "open" ? "" : kind === "connecting" ? " warn" : " err");
    $("#connLabel").textContent = label;
  }
  function switchMode(mode) {
    st.mode = mode;
    $$("#srcSeg .seg-b").forEach(b => b.classList.toggle("active", b.dataset.src === mode));
    $("#wsBox").hidden = mode !== "ws";
    if (mode === "ws") {
      sim.stop();
      if (ws) ws.stop();
      setStatus("closed", "SIN CONEXIÓN");
    } else {
      if (ws) ws.stop();
      setStatus("open", "SIMULACIÓN EN VIVO");
      if (!st.paused) sim.start();
    }
  }
  $$("#srcSeg .seg-b").forEach(b => b.addEventListener("click", () => switchMode(b.dataset.src)));
  $("#wsConnect").addEventListener("click", () => {
    const url = $("#wsUrl").value.trim();
    if (!url) return;
    if (ws) ws.stop();
    ws = new S.WSStream(url,
      t => onTweet(t),
      (k, msg) => {
        if (k === "open") setStatus("open", "STREAM CONECTADO");
        else if (k === "connecting") setStatus("connecting", "CONECTANDO…");
        else if (k === "error") setStatus("error", "ERROR DE CONEXIÓN");
        else setStatus("closed", "DESCONECTADO");
      });
    ws.start();
  });

  /* ayuda + teclado */
  const help = $("#help");
  $("#btnHelp").addEventListener("click", () => { help.hidden = false; });
  $("#helpClose").addEventListener("click", () => { help.hidden = true; });
  help.addEventListener("click", e => { if (e.target === help) help.hidden = true; });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { help.hidden = true; if (st.selected) selectRegion(null); }
    if (e.code === "Space" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault(); btnPause.click();
    }
  });
  window.addEventListener("resize", () => { M.fit(); drawChart(); });

  /* ═════════ ARRANQUE ═════════ */
  sim = new S.SimStream(onTweet, onTrend);
  sim.start();
  setStatus("open", "SIMULACIÓN EN VIVO");

  /* parámetros de arranque: index.html?rate=3&ws=ws://localhost:8787/tweets */
  const params = new URLSearchParams(location.search);
  const qRate = parseFloat(params.get("rate"));
  if (qRate > 0) {
    const v = Math.max(.2, Math.min(8, qRate));
    $("#rate").value = v;
    $("#rateVal").textContent = v.toFixed(1).replace(".", ",") + "/s";
    sim.setRate(v);
  }
  if (params.get("ws")) {
    $("#wsUrl").value = params.get("ws");
    switchMode("ws");
    $("#wsConnect").click();
  }

  $("#hudRegions").textContent = M.regions().length + " SECTORES ACTIVOS";
  addAlert("<b>● SISTEMA</b> Radar político en línea · " + M.regions().length + " sectores monitorizados");
  refreshAllRegions(); refreshLegend(); refreshRank(); refreshStats(); refreshDetail();
  requestAnimationFrame(() => { M.fit(); drawChart(); });
  setTimeout(() => { M.fit(); drawChart(); }, 350);
})();

/* ═══════════════════════════════════════════════════════════
   map.js · proyección + render del mapa + capa de efectos
   · GeoJSON oficial de España (geoBoundaries / IGN, CC-BY 4.0)
   · Proyección de Mercator, simplificación Douglas-Peucker
   · Efectos en <canvas> sincronizados con la caja del SVG
   ═══════════════════════════════════════════════════════════ */
window.WarMap = (function () {
  "use strict";
  const W = window.WAR;
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ── proyección principal ───────────────────────────────── */
  const VIEW = { lon0: -10.0, lon1: 4.7, lat0: 35.10, lat1: 44.50, w: 1200 };
  const mercY = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * 180 / Math.PI;
  const SC = VIEW.w / (VIEW.lon1 - VIEW.lon0);
  const Y0 = mercY(VIEW.lat1);
  const VIEW_H = (Y0 - mercY(VIEW.lat0)) * SC;
  const px = lon => (lon - VIEW.lon0) * SC;
  const py = lat => (Y0 - mercY(lat)) * SC;

  /* ── proyección del recuadro de Canarias ────────────────── */
  const CI = { lon0: -18.8, lon1: -12.8, lat0: 27.4, lat1: 29.7, sc: SC * 0.50 };
  const ciY0 = mercY(CI.lat1);
  const CIW = (CI.lon1 - CI.lon0) * CI.sc;
  const CIH = (ciY0 - mercY(CI.lat0)) * CI.sc;
  const CIBOX = { w: CIW + 26, h: CIH + 30 };
  CIBOX.x = VIEW.w - CIBOX.w - 18;
  CIBOX.y = VIEW_H - CIBOX.h - 16;
  const cix = lon => CIBOX.x + 13 + (lon - CI.lon0) * CI.sc;
  const ciy = lat => CIBOX.y + 20 + (ciY0 - mercY(lat)) * CI.sc;

  // desplazamiento de la etiqueta respecto al centroide, en px de pantalla
  const LABEL_OFFSET = {
    paisvasco: [-14, 14], navarra: [16, 6], larioja: [7, 13],
    cantabria: [-5, -7], asturias: [-10, -5], murcia: [4, 6],
    ceuta: [26, 3], melilla: [28, 1], baleares: [0, 4],
    cvalenciana: [0, 14], cleon: [0, -4]
  };

  /* ── Douglas-Peucker iterativo ──────────────────────────── */
  function rdp(pts, eps) {
    const n = pts.length;
    if (n < 4) return pts;
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    const stack = [0, n - 1];
    const e2 = eps * eps;
    while (stack.length) {
      const b = stack.pop(), a = stack.pop();
      if (b - a < 2) continue;
      const [x1, y1] = pts[a], [x2, y2] = pts[b];
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1e-9;
      let maxD = -1, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const [pxx, pyy] = pts[i];
        let t = ((pxx - x1) * dx + (pyy - y1) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x1 + t * dx - pxx, ey = y1 + t * dy - pyy;
        const d = ex * ex + ey * ey;
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > e2) { keep[idx] = 1; stack.push(a, idx, idx, b); }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }

  function ringArea(r) {
    let a = 0;
    for (let i = 0, n = r.length; i < n; i++) {
      const p = r[i], q = r[(i + 1) % n];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }
  function ringCentroid(r) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, n = r.length; i < n; i++) {
      const p = r[i], q = r[(i + 1) % n];
      const f = p[0] * q[1] - q[0] * p[1];
      a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
    }
    a *= .5;
    if (Math.abs(a) < 1e-6) {
      let sx = 0, sy = 0;
      r.forEach(p => { sx += p[0]; sy += p[1]; });
      return [sx / r.length, sy / r.length];
    }
    return [cx / (6 * a), cy / (6 * a)];
  }
  function bbox(r) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    r.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  /* ── construcción de regiones ───────────────────────────── */
  function buildRegions() {
    const out = [];
    const feats = (window.SPAIN_GEO && window.SPAIN_GEO.features) || [];
    for (const f of feats) {
      const rawName = (f.properties && (f.properties.shapeName || f.properties.shapeGroup)) || "";
      const id = W.REGION_KEYS[W.slug(rawName)];
      if (!id || !W.REGION_MAP[id]) continue;
      const g = f.geometry;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      const isCan = id === "canarias";

      let d = "", best = null, bestArea = 0, totalArea = 0;
      for (const poly of polys) {
        for (let ri = 0; ri < poly.length; ri++) {
          const ring = poly[ri];
          const proj = ring.map(c => isCan ? [cix(c[0]), ciy(c[1])] : [px(c[0]), py(c[1])]);
          if (proj.length < 4) continue;
          const bb = bbox(proj);
          const small = Math.max(bb.w, bb.h) < 11;          // islas/ciudades diminutas
          const simp = small ? proj : rdp(proj, 0.9);
          if (simp.length < 3) continue;
          let dd = "M" + simp.map(p => (Math.round(p[0] * 10) / 10) + " " + (Math.round(p[1] * 10) / 10)).join("L") + "Z";
          d += dd;
          if (ri === 0) {
            const a = Math.abs(ringArea(simp));
            totalArea += a;
            if (a > bestArea) { bestArea = a; best = simp; }
          }
        }
      }
      if (!d) continue;
      const c = best ? ringCentroid(best) : [0, 0];
      out.push({
        id, name: W.REGION_MAP[id].name, label: W.REGION_MAP[id].label,
        d, cx: c[0], cy: c[1], area: totalArea, isCan
      });
    }
    out.sort((a, b) => b.area - a.area);   // las pequeñas encima
    return out;
  }

  /* ═════════ ESTADO Y API ═════════ */
  let svg, canvas, wrap, ctx, regions = [], byId = {};
  let els = {};                             // path/label por región
  let VW = VIEW.w, VH = VIEW_H;
  let scale = 1, ox = 0, oy = 0, dpr = 1;
  let onClick = null, onHover = null;

  const state = {};                         // id → {heat, count, dom}

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function init(opts) {
    svg = opts.svg; canvas = opts.canvas; wrap = opts.wrap;
    onClick = opts.onClick; onHover = opts.onHover;
    ctx = canvas.getContext("2d");
    regions = buildRegions();
    regions.forEach(r => state[r.id] = { heat: 0, count: 0, dom: null });

    svg.setAttribute("viewBox", "0 0 " + VW + " " + VH);

    /* defs */
    const defs = el("defs", {}, svg);
    defs.innerHTML =
      '<filter id="glow" x="-60%" y="-60%" width="220%" height="220%">' +
      '<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<radialGradient id="seawash"><stop offset="0%" stop-color="rgba(30,80,150,.30)"/><stop offset="100%" stop-color="rgba(6,14,30,0)"/></radialGradient>';
    el("ellipse", { cx: VW * .46, cy: VH * .47, rx: VW * .52, ry: VH * .5, fill: "url(#seawash)" }, svg);

    /* países vecinos (contexto geográfico, sin datos) */
    const gC = el("g", { class: "ctx" }, svg);
    for (const f of (window.CTX_GEO || [])) {
      const g = f.geometry;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      let dd = "";
      for (const poly of polys) {
        for (let ri = 0; ri < poly.length; ri++) {
          const ring = poly[ri];
          if (ring.length < 4) continue;
          const proj = ring.map(c => [px(c[0]), py(c[1])]);
          const bb = bbox(proj);
          if (bb.x1 < -40 || bb.x0 > VW + 40 || bb.y1 < -40 || bb.y0 > VH + 40) continue;   // fuera de cuadro
          const simp = Math.max(bb.w, bb.h) < 11 ? proj : rdp(proj, 1.2);
          if (simp.length < 3) continue;
          dd += "M" + simp.map(p => (Math.round(p[0] * 10) / 10) + " " + (Math.round(p[1] * 10) / 10)).join("L") + "Z";
        }
      }
      if (dd) el("path", { class: "ctx-land", d: dd, "fill-rule": "evenodd" }, gC);
    }
    [["PORTUGAL", 171, 566], ["FRANCIA", 1092, 84]].forEach(([txt, x, y]) => {
      const t = el("text", { class: "ctx-lab", x, y }, gC);
      t.textContent = txt;
    });

    /* retícula geográfica */
    const grat = el("g", { class: "grat" }, svg);
    for (let lon = -8; lon <= 4; lon += 2) {
      const x = px(lon);
      el("line", { x1: x, y1: 0, x2: x, y2: VH }, grat);
      const t = el("text", { x: x + 4, y: VH - 8 }, grat);
      t.textContent = (lon > 0 ? "+" : "") + lon + "º";
    }
    for (let lat = 36; lat <= 44; lat += 2) {
      const y = py(lat);
      el("line", { x1: 0, y1: y, x2: VW, y2: y }, grat);
      const t = el("text", { x: 6, y: y - 5 }, grat);
      t.textContent = lat + "ºN";
    }

    /* rótulos de mar */
    const ocean = [
      ["OCÉANO ATLÁNTICO", 33, 640, -90],
      ["GOLFO DE VIZCAYA", 470, 54, 0],
      ["MAR MEDITERRÁNEO", 1012, 748, 0]
    ];
    ocean.forEach(o => {
      const a = { class: "ocean-lab", x: o[1], y: o[2] };
      if (o[3]) a.transform = "rotate(" + o[3] + " " + o[1] + " " + o[2] + ")";
      const t = el("text", a, svg);
      t.textContent = o[0];
    });

    /* recuadro de Canarias */
    const gIns = el("g", {}, svg);
    el("rect", { class: "inset-box", x: CIBOX.x, y: CIBOX.y, width: CIBOX.w, height: CIBOX.h }, gIns);
    const cap = el("text", { class: "inset-cap", x: CIBOX.x + 8, y: CIBOX.y + 13 }, gIns);
    cap.textContent = "CANARIAS · ESCALA 1:2";

    /* regiones */
    const gR = el("g", { class: "regions" }, svg);
    const gL = el("g", { class: "labels" }, svg);
    const gH = el("g", { class: "hits" }, svg);

    for (const r of regions) {
      const p = el("path", {
        class: "region", d: r.d, "data-id": r.id, "fill-rule": "evenodd",
        fill: "rgba(120,170,230,.10)"
      }, gR);
      p.addEventListener("click", () => onClick && onClick(r.id));
      p.addEventListener("mouseenter", () => onHover && onHover(r.id));
      p.addEventListener("mouseleave", () => onHover && onHover(null));

      const meta = W.REGION_MAP[r.id];
      const nm = el("text", { class: "rlab" }, gL);
      nm.textContent = meta.label.toUpperCase();
      const cnt = el("text", { class: "rcnt" }, gL);

      // desplazamientos en PÍXELES DE PANTALLA (se recalculan con el zoom)
      const off = LABEL_OFFSET[r.id] || [0, 0];
      let dot = null, hit = null;
      if (r.id === "ceuta" || r.id === "melilla") {
        dot = el("circle", { class: "rdot", cx: r.cx, cy: r.cy }, gH);
        hit = el("circle", { class: "hit", cx: r.cx, cy: r.cy, fill: "transparent", style: "cursor:pointer" }, gH);
        hit.addEventListener("click", () => onClick && onClick(r.id));
      }
      els[r.id] = {
        path: p, label: nm, count: cnt, dot, hit,
        cx: r.cx, cy: r.cy, dx: off[0], dy: off[1],
        inset: r.id === "canarias", x: r.cx, y: r.cy
      };
    }

    fit();
    window.addEventListener("resize", fit);
    requestAnimationFrame(loop);
    return { regions, VW, VH };
  }

  /* ── ajuste de la capa de efectos (letterbox idéntico al SVG) ── */
  function fit() {
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    if (!cw || !ch) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(cw / VW, ch / VH);
    ox = (cw - VW * scale) / 2;
    oy = (ch - VH * scale) / 2;
    // 1 px de pantalla = 1/scale unidades del viewBox
    if (svg) svg.style.setProperty("--u", (1 / scale).toFixed(4) + "px");
    layout();
  }

  /* ── coloca rótulos y zonas clicables en función del zoom ── */
  function layout() {
    const u = 1 / scale;
    for (const id in els) {
      const e = els[id];
      if (e.inset) {
        e.x = CIBOX.x + CIBOX.w / 2;
        e.y = CIBOX.y + CIBOX.h - 9;
      } else {
        e.x = e.cx + e.dx * u;
        e.y = e.cy + e.dy * u;
      }
      e.label.setAttribute("x", e.x.toFixed(1));
      e.label.setAttribute("y", e.y.toFixed(1));
      e.count.setAttribute("x", e.x.toFixed(1));
      e.count.setAttribute("y", (e.y + 15 * u).toFixed(1));
      if (e.dot) { e.dot.setAttribute("r", (3 * u).toFixed(2)); e.hit.setAttribute("r", (17 * u).toFixed(2)); }
    }
  }
  const TX = x => ox + x * scale;
  const TY = y => oy + y * scale;

  /* ── estado visual de una región ─────────────────────────── */
  function hexRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function apply(id) {
    const e = els[id], st = state[id];
    if (!e || !st) return;
    const p = W.PARTY_MAP[st.dom];
    if (!p) { e.path.setAttribute("fill", "rgba(120,170,230,.10)"); return; }
    const [r, g, b] = hexRgb(p.color);
    const a = Math.min(.06 + st.heat * .62, .78);
    e.path.setAttribute("fill", "rgba(" + r + "," + g + "," + b + "," + a.toFixed(3) + ")");
    e.count.textContent = st.count ? st.count : "";
    e.count.style.opacity = st.count ? .95 : 0;
  }

  function update(id, count, partyId, heat) {
    const st = state[id];
    if (!st) return;
    st.count = count; st.dom = partyId; st.heat = heat;
    apply(id);
  }

  function select(id) {
    Object.keys(els).forEach(k => els[k].path.classList.toggle("sel", k === id));
  }
  function labelPos(id) { return els[id] ? [els[id].x, els[id].y] : [0, 0]; }

  /* ═════════ CAPA DE EFECTOS (canvas) ═════════ */
  const F = { pings: [], chips: [], sparks: [], tracers: [], shocks: [] };
  let last = performance.now();

  function ping(x, y, color, big) {
    F.pings.push({ x, y, c: color, t: 0, dur: big ? 1.1 : .75, r: big ? 150 : 78 });
    if (F.pings.length > 90) F.pings.shift();
  }
  function chip(x, y, txt, color) {
    F.chips.push({ x, y, txt, c: color, t: 0, dur: 1.25, dy: -46 });
    if (F.chips.length > 40) F.chips.shift();
  }
  function burst(x, y, color, power) {
    const n = Math.round(16 + power * 26);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (40 + Math.random() * 190) * (0.6 + power * .5);
      F.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c: color, t: 0, dur: .5 + Math.random() * .8, len: 3 + Math.random() * 7 });
    }
    F.shocks.push({ x, y, c: color, t: 0, dur: .85, r: 30 + power * 90 });
    if (F.sparks.length > 900) F.sparks.splice(0, F.sparks.length - 900);
  }
  function tracer(x1, y1, x2, y2, color) {
    F.tracers.push({ x1, y1, x2, y2, c: color, t: 0, dur: .75, lift: 60 + Math.random() * 90 });
    if (F.tracers.length > 30) F.tracers.shift();
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    /* rastros */
    ctx.lineCap = "round";
    for (let i = F.tracers.length - 1; i >= 0; i--) {
      const t = F.tracers[i]; t.t += dt;
      const k = t.t / t.dur;
      if (k >= 1) { F.tracers.splice(i, 1); continue; }
      const x1 = TX(t.x1), y1 = TY(t.y1), x2 = TX(t.x2), y2 = TY(t.y2);
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 - t.lift * scale;
      const head = Math.min(k * 1.35, 1);
      ctx.save();
      ctx.strokeStyle = t.c; ctx.globalAlpha = (1 - k) * .85; ctx.lineWidth = 1.6;
      ctx.shadowColor = t.c; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const steps = 24, end = steps * head;
      for (let s = 1; s <= end; s++) {
        const u = s / steps;
        const bx = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2;
        const by = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2;
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
      if (head < 1) {
        const u = head;
        const bx = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2;
        const by = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2;
        ctx.globalAlpha = 1; ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    /* ondas */
    for (let i = F.pings.length - 1; i >= 0; i--) {
      const p = F.pings[i]; p.t += dt;
      const k = p.t / p.dur;
      if (k >= 1) { F.pings.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - k, 3);
      ctx.save();
      ctx.strokeStyle = p.c;
      ctx.globalAlpha = (1 - k) * .85;
      ctx.lineWidth = 2.4 * (1 - k) + .6;
      ctx.shadowColor = p.c; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(TX(p.x), TY(p.y), p.r * e * scale + 3, 0, 7);
      ctx.stroke();
      if (k < .5) {
        ctx.globalAlpha = (1 - k * 2) * .5;
        ctx.beginPath();
        ctx.arc(TX(p.x), TY(p.y), p.r * .55 * e * scale + 3, 0, 7);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* choques (viral) */
    for (let i = F.shocks.length - 1; i >= 0; i--) {
      const s = F.shocks[i]; s.t += dt;
      const k = s.t / s.dur;
      if (k >= 1) { F.shocks.splice(i, 1); continue; }
      ctx.save();
      ctx.strokeStyle = s.c; ctx.globalAlpha = (1 - k) * .9;
      ctx.lineWidth = 3.5 * (1 - k);
      ctx.shadowColor = s.c; ctx.shadowBlur = 22;
      const e = 1 - Math.pow(1 - k, 2.2);
      ctx.beginPath(); ctx.arc(TX(s.x), TY(s.y), (s.r * e + 8) * scale, 0, 7); ctx.stroke();
      ctx.restore();
    }

    /* chispas */
    for (let i = F.sparks.length - 1; i >= 0; i--) {
      const s = F.sparks[i]; s.t += dt;
      if (s.t >= s.dur) { F.sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= .955; s.vy *= .955;
      const k = s.t / s.dur;
      ctx.save();
      ctx.globalAlpha = (1 - k);
      ctx.strokeStyle = s.c; ctx.lineWidth = 1.6;
      ctx.shadowColor = s.c; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(TX(s.x), TY(s.y));
      ctx.lineTo(TX(s.x - s.vx * .03), TY(s.y - s.vy * .03));
      ctx.stroke();
      ctx.restore();
    }

    /* etiquetas flotantes +N */
    for (let i = F.chips.length - 1; i >= 0; i--) {
      const c = F.chips[i]; c.t += dt;
      const k = c.t / c.dur;
      if (k >= 1) { F.chips.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - k, 2);
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.font = "700 " + (13 + (1 - k) * 3) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = c.c;
      ctx.shadowColor = "#000"; ctx.shadowBlur = 6;
      ctx.fillText(c.txt, TX(c.x), TY(c.y + c.dy * e * .6));
      ctx.restore();
    }

    requestAnimationFrame(loop);
  }

  return {
    init, update, select, labelPos, fit,
    ping, chip, burst, tracer,
    regions: () => regions,
    state: () => state,
    viewBox: () => ({ w: VW, h: VH })
  };
})();

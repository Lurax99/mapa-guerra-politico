/* ═══════════════════════════════════════════════════════════
   stream.js · fuente de datos en tiempo real
   · Modo SIM : genera un flujo plausible de menciones.
   · Modo WS  : se conecta a tu WebSocket (API de X real).
   Ambos emiten el MISMO objeto normalizado:
   { id, ts, text, user:{name,handle,initials}, party, region,
     hashtags[], sentiment, engagement:{likes,rts,replies}, viral }
   ═══════════════════════════════════════════════════════════ */
window.WarStream = (function () {
  "use strict";
  const W = window.WAR;
  const R = (a, b) => a + Math.random() * (b - a);
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ── selección ponderada ────────────────────────────────── */
  function weighted(entries) {
    let tot = 0;
    for (const e of entries) tot += e[1];
    let r = Math.random() * tot;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  }

  function pickRegion() {
    return weighted(W.REGIONS.map(r => [r, Math.pow(r.w, 0.92)]));
  }

  function pickParty(region, trend, pulse) {
    const entries = [];
    for (const p of W.PARTIES) {
      let w = (region.b[p.id] || 0.01) * (0.7 + 0.3 * (W.BASE_SHARE[p.id] || .1) * 3);
      w *= R(0.75, 1.3);                                     // ruido diario
      if (pulse && pulse[p.id]) w *= pulse[p.id];            // pulso nacional
      if (trend && trend.party === p.id) w *= (2.4 * trend.power); // tendencia
      entries.push([p.id, Math.max(w, 0.001)]);
    }
    return weighted(entries);
  }

  /* ── engagement con cola larga (ley de potencia) ────────── */
  function engagement(viralBias) {
    const base = Math.pow(Math.random(), 3.1);
    let likes = Math.round(4 + 1400 * base * viralBias);
    const rts = Math.round(likes * R(0.08, 0.35));
    const reps = Math.round(likes * R(0.03, 0.22));
    return { likes, rts, replies: reps };
  }

  function makeUser() {
    const first = pick(W.FIRST);
    const last = Math.random() < .5 ? pick(W.LAST) : pick(W.CITYISH);
    const handle = "@" + pick(W.FIRST).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      + pick(W.LAST).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      + RI(1, 99);
    return {
      name: first + " " + last,
      handle,
      initials: (first[0] + last[0]).toUpperCase()
    };
  }

  function fill(tpl, region, party, tag) {
    return tpl.t
      .replace(/\{topic\}/g, pick(W.TOPICS))
      .replace(/\{region\}/g, region.name)
      .replace(/\{tag\}/g, tag)
      .replace(/\{pct\}/g, (Math.random() * 8 + 0.4).toFixed(1).replace(".", ","));
  }

  /* ═════════ SIMULADOR ═════════ */
  function SimStream(onTweet, onTrend) {
    this.onTweet = onTweet;
    this.onTrend = onTrend;
    this.rate = 1.6;          // tweets/segundo base
    this.sens = 1;            // multiplicador de intensidad
    this.running = false;
    this.trend = null;
    this.pulse = {};          // pulso nacional: deriva lenta del humor por partido
    this.recent = [];
    this._t = null;
    this._tt = null;
    this._pulse();
  }
  SimStream.prototype._pulse = function () {
    const o = {};
    W.PARTIES.forEach(p => { o[p.id] = R(.8, 1.25); });
    this.pulse = o;
  };

  SimStream.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this._loop();
    this._scheduleTrend();
  };
  SimStream.prototype.stop = function () {
    this.running = false;
    clearTimeout(this._t); clearTimeout(this._tt);
  };
  SimStream.prototype.setRate = function (r) { this.rate = r; };
  SimStream.prototype.setSens = function (s) { this.sens = s; };

  SimStream.prototype._loop = function () {
    if (!this.running) return;
    const per = 1000 / Math.max(0.15, this.rate * this.sens);
    const burst = Math.random() < .16 ? RI(2, 4) : 1;      // ráfagas ocasionales
    for (let i = 0; i < burst; i++) {
      const tw = this._make();
      if (tw) this.onTweet(tw);
    }
    this._t = setTimeout(() => this._loop(), per * R(.55, 1.7));
  };

  SimStream.prototype._scheduleTrend = function () {
    if (!this.running) return;
    this._tt = setTimeout(() => {
      if (this.running) {
        this._pulse();
        if (Math.random() < .75) {
          const p = W.PARTIES[Math.floor(Math.random() * 5)];
          this.trend = { party: p.id, tag: pick(p.tags), power: R(.8, 1.6), until: Date.now() + R(9000, 18000) };
        } else {
          this.trend = { party: null, tag: "#" + pick(W.TOPICS).replace(/^(la|el|los|las) /, "").replace(/\s+/g, "").toUpperCase(), power: R(.6, 1.1), until: Date.now() + R(7000, 14000) };
        }
        if (this.onTrend) this.onTrend(this.trend);
      }
      this._scheduleTrend();
    }, R(16000, 32000));
  };

  SimStream.prototype._make = function () {
    const now = Date.now();
    if (this.trend && now > this.trend.until) this.trend = null;
    const trend = this.trend;

    const region = pickRegion();
    const partyId = pickParty(region, trend && trend.party ? trend : null, this.pulse);
    const party = W.PARTY_MAP[partyId];

    // hashtag: tendencia si coincide, si no, uno del partido (o regional)
    let tag = party.tags[0];
    if (trend && trend.party === partyId) tag = trend.tag;
    else if (partyId === "otros" && Math.random() < .5) tag = pick(party.tags);
    else if (Math.random() < .35) tag = pick(party.tags);

    // plantilla, evitando repetir las últimas 6
    let tpl = null, guard = 0;
    do { tpl = pick(W.TEMPLATES); guard++; } while (this.recent.includes(tpl.t) && guard < 12);
    this.recent.push(tpl.t);
    if (this.recent.length > 6) this.recent.shift();

    let text = fill(tpl, region, party, tag);
    if (Math.random() < .22) text += " " + pick(party.tags);

    const viralBias = (trend && trend.party === partyId) ? R(1.4, 3.2) : R(.7, 1.4);
    const e = engagement(viralBias);
    const viral = e.likes > 950 || Math.random() < .035;

    const user = makeUser();
    return {
      id: "sim-" + now + "-" + Math.random().toString(36).slice(2, 8),
      ts: now,
      text,
      user,
      party: partyId,
      region: region.id,
      hashtags: [tag].concat(Math.random() < .4 ? [pick(party.tags)] : []).filter((v, i, a) => a.indexOf(v) === i),
      sentiment: tpl.s,
      engagement: e,
      viral,
      source: "sim"
    };
  };

  /* ═════════ NORMALIZACIÓN DE TWEETS REALES ═════════ */
  function inferParty(text) {
    const t = " " + W.norm(text) + " ";
    let best = null, bestScore = 0;
    for (const p of W.PARTIES) {
      let score = 0;
      for (const k of p.keys) {
        const key = W.norm(k);
        if (!key) continue;
        if (t.includes(" #" + key + " ") || t.includes("@" + key)) score += 5;
        else if (key.length > 2 && t.includes(" " + key)) score += 2;
        else if (key.length > 3 && t.includes(key)) score += 1;
      }
      if (score > bestScore) { bestScore = score; best = p.id; }
    }
    return bestScore >= 2 ? best : null;
  }

  function inferRegion(text) {
    const s = W.slug(text);
    if (!s) return null;
    for (const city in W.PLACE_ALIASES) {
      if (s.includes(W.slug(city))) return W.PLACE_ALIASES[city];
    }
    for (const r of W.REGIONS) {
      if (s.includes(W.slug(r.name)) || s.includes(W.slug(r.label))) return r.id;
    }
    return null;
  }

  function inferSentiment(text) {
    const t = W.norm(text);
    let pos = 0, neg = 0;
    for (const w of W.POS_WORDS) if (t.includes(w)) pos++;
    for (const w of W.NEG_WORDS) if (t.includes(w)) neg++;
    return neg > pos ? "neg" : pos > neg ? "pos" : "neu";
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const text = String(raw.text || raw.full_text || (raw.tweet && raw.tweet.text) || "").trim();
    if (!text) return null;

    const u = raw.user || raw.author || {};
    const name = u.name || raw.name || "Usuario anónimo";
    const handle = u.handle || u.screen_name || raw.handle || ("@" + String(name).toLowerCase().replace(/[^a-záéíóúñü]/g, "").slice(0, 12));
    const initials = String(name).split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();

    let party = raw.party && W.PARTY_MAP[raw.party] ? raw.party : inferParty(text);
    if (!party) party = Math.random() < .55 ? "otros" : null;
    if (!party) return null;

    let region = raw.region && W.REGION_MAP[raw.region] ? raw.region : inferRegion(raw.location || u.location || text);
    if (!region) region = pickRegion().id;

    const eng = raw.engagement || {};
    const likes = Number(eng.likes || eng.favorite_count || raw.likes || 0);
    const rts = Number(eng.retweets || eng.retweet_count || raw.retweets || 0);
    const reps = Number(eng.replies || raw.replies || 0);

    let hashtags = raw.hashtags;
    if (!Array.isArray(hashtags)) hashtags = (text.match(/#[\wÁÉÍÓÚÜÑáéíóúüñ]+/g) || []);
    hashtags = hashtags.slice(0, 4);

    return {
      id: raw.id || ("ws-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7)),
      ts: raw.ts ? new Date(raw.ts).getTime() : Date.now(),
      text,
      user: { name, handle, initials },
      party,
      region,
      hashtags,
      sentiment: raw.sentiment || inferSentiment(text),
      engagement: { likes, rts, replies: reps },
      viral: !!raw.viral || likes > 900,
      source: "ws"
    };
  }

  /* ═════════ WEBSOCKET ═════════ */
  function WSStream(url, onTweet, onStatus) {
    this.url = url; this.onTweet = onTweet; this.onStatus = onStatus;
    this.ws = null; this.running = false; this._retry = 0;
  }
  WSStream.prototype.start = function () {
    this.running = true;
    this._open();
  };
  WSStream.prototype._open = function () {
    const self = this;
    try {
      this.onStatus && this.onStatus("connecting");
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.onStatus && this.onStatus("error", String(e));
      return;
    }
    this.ws.onopen = function () { self._retry = 0; self.onStatus && self.onStatus("open"); };
    this.ws.onmessage = function (ev) {
      let data;
      try { data = JSON.parse(ev.data); } catch (e) { return; }
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const n = normalize(it);
        if (n) self.onTweet(n);
      }
    };
    this.ws.onerror = function () { self.onStatus && self.onStatus("error"); };
    this.ws.onclose = function () {
      self.onStatus && self.onStatus("closed");
      if (self.running && self._retry < 8) {
        self._retry++;
        setTimeout(() => self.running && self._open(), 1500 * self._retry);
      }
    };
  };
  WSStream.prototype.stop = function () {
    this.running = false;
    if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    this.onStatus && this.onStatus("closed");
  };
  WSStream.prototype.setRate = WSStream.prototype.setSens = function () {};

  return { SimStream, WSStream, normalize, inferParty, inferRegion, inferSentiment };
})();

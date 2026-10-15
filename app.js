/* Atlas Diário — jogo diário de países. Vanilla JS, sem dependências. */
(() => {
'use strict';
const TZ = 'America/Sao_Paulo';
const SITE = 'https://weslopes-eng.github.io/atlas-diario/';
const IG = 'https://www.instagram.com/oatlas.curioso/';
const NEWS = 'https://statts-participaes-newsletter.beehiiv.com/subscribe';
const KEY = 'atlasDiario:v1';
const CLOSE_KM = 800;

const qs = new URLSearchParams(location.search);
const LANG = (qs.get('lang') || localStorage.getItem('atlasDiario:lang') || 'pt') in I18N ? (qs.get('lang') || localStorage.getItem('atlasDiario:lang') || 'pt') : 'pt';
if (qs.get('lang')) localStorage.setItem('atlasDiario:lang', LANG);
const T = I18N[LANG];
document.documentElement.lang = T.locale;
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app');

let DATA, MAP, CH, state, today, dayIdx, game;

// ---------- datas (BRT) ----------
function brtDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function secondsToMidnight(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return 86400 - (+p.hour * 3600 + +p.minute * 60 + +p.second);
}
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
function prettyDate(iso) {
  return new Intl.DateTimeFormat(T.locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
}

// ---------- armazenamento ----------
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { games: {} }; } catch { return { games: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

// ---------- números ----------
const nf = (d) => new Intl.NumberFormat(T.locale, { maximumFractionDigits: d, minimumFractionDigits: d });
function big(v) {
  const pt = LANG === 'pt';
  if (v >= 1e9) { const x = v / 1e9; return nf(2).format(x) + (pt ? (x < 2 ? ' bilhão' : ' bilhões') : ' billion'); }
  if (v >= 1e6) { const x = v / 1e6; return nf(x >= 100 ? 0 : 1).format(x) + (pt ? (x < 2 ? ' milhão' : ' milhões') : ' million'); }
  if (v >= 1e4) return nf(0).format(Math.round(v / 1000)) + (pt ? ' mil' : 'k');
  return nf(0).format(v);
}
const pt = () => LANG === 'pt';
function fmtStat(s, v) {
  switch (s) {
    case 'pop': return big(v) + (pt() ? '' : '');
    case 'area': return (v >= 1e6 ? big(v) + (pt() ? ' de km²' : ' km²') : nf(0).format(v) + ' km²');
    case 'gdppc': return 'US$ ' + nf(0).format(v);
    case 'life': return nf(1).format(v) + (pt() ? ' anos' : ' years');
    case 'forest': case 'internet': case 'urban': case 'elec': return nf(1).format(v) + '%';
    case 'fert': return nf(2).format(v) + (pt() ? ' filhos' : ' children');
    case 'tourism': return big(v) + (pt() ? ' de turistas' : ' tourists');
    case 'density': return nf(v < 10 ? 1 : 0).format(v) + (pt() ? ' hab./km²' : ' /km²');
    case 'co2': return nf(1).format(v) + (pt() ? ' t por pessoa' : ' t per person');
  }
  return String(v);
}
const WHAT = {
  pt: { pop: 'habitantes', area: 'território', gdppc: 'PIB por pessoa', tourism: 'turistas', density: 'gente por km²', co2: 'CO₂ por pessoa' },
  en: { pop: 'people', area: 'land', gdppc: 'GDP per person', tourism: 'tourists', density: 'people per km²', co2: 'CO₂ per person' },
};
const cname = id => { const c = DATA.countries[id]; return c ? (LANG === 'pt' ? c.pt : c.en) : (MAP.byId[id] ? (LANG === 'pt' ? MAP.byId[id].n : MAP.byId[id].ne) : id); };

// ---------- distância ----------
function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- estatísticas ----------
function computeStats() {
  const done = Object.entries(state.games).filter(([, g]) => g.done).sort(([a], [b]) => a < b ? -1 : 1);
  const dist = [0, 0, 0, 0, 0, 0];
  let correct = 0, rounds = 0;
  for (const [, g] of done) { dist[g.score]++; correct += g.score; rounds += 5; }
  let best = 0, run = 0, prev = null;
  for (const [d] of done) { run = prev && dayDiff(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  let streak = 0;
  if (prev && dayDiff(prev, today) <= 1) streak = run;
  return { played: done.length, pct: rounds ? Math.round(100 * correct / rounds) : 0, streak, best, dist };
}

// ---------- telas ----------
function header(n) {
  return `<div class="day-pill">${T.challenge} <b>#${n}</b> · ${prettyDate(today)}</div>`;
}
function renderStart() {
  const g = state.games[today];
  if (g && g.done) return renderEnd();
  const n = dayIdx + 1;
  const started = g && g.answers && g.answers.length;
  app.innerHTML = `
  <section class="screen start pop-in">
    ${header(n)}
    <h1 class="hero">${T.tagline}</h1>
    <div class="hero-flags" aria-hidden="true">${heroFlags()}</div>
    <p class="sub">${T.rounds5}</p>
    <button class="btn btn-play" id="go">${started ? T.next + ' ▶' : T.play + ' ▶'}</button>
    <button class="link-btn" id="how2">${T.howTitle}</button>
  </section>`;
  $('#go').onclick = () => startGame();
  $('#how2').onclick = showHow;
}
function heroFlags() {
  const r = CH.days[dayIdx];
  const ids = [];
  r.forEach(x => x.t === 'c' ? ids.push(x.a, x.b) : 0);
  return ids.slice(0, 8).map((id, i) => `<span style="animation-delay:${i * 0.12}s">${DATA.countries[id].f}</span>`).join('');
}

function startGame() {
  if (!state.games[today]) state.games[today] = { n: dayIdx + 1, answers: [], start: Date.now() };
  game = state.games[today];
  if (!game.start) game.start = Date.now();
  save();
  renderRound();
}
function dots() {
  const rounds = CH.days[dayIdx];
  return `<div class="dots">${rounds.map((r, i) => {
    const a = game.answers[i];
    const cls = a == null ? (i === game.answers.length ? 'cur' : '') : a === 2 ? 'ok' : a === 1 ? 'mid' : 'bad';
    return `<span class="dot ${cls}">${r.t === 'm' ? '📍' : i + 1}</span>`;
  }).join('')}</div>`;
}
function renderRound() {
  const i = game.answers.length;
  const r = CH.days[dayIdx][i];
  window.scrollTo(0, 0);
  if (!r) return finish();
  if (r.t === 'c') renderCompare(r, i); else renderMap(r, i);
}

function renderCompare(r, i) {
  const A = DATA.countries[r.a], B = DATA.countries[r.b];
  app.innerHTML = `
  <section class="screen round slide-in">
    ${dots()}
    <div class="stat-tag">${T.statName[r.s]}</div>
    <h2 class="question">${T.q[r.s]}</h2>
    <div class="cards">
      ${card(r.a, A, 'a')}
      <div class="vs">VS</div>
      ${card(r.b, B, 'b')}
    </div>
    <div id="fact"></div>
  </section>`;
  const pick = (side) => {
    const va = A.v[r.s][0], vb = B.v[r.s][0];
    const win = va >= vb ? 'a' : 'b';
    const ok = side === win;
    answer(ok ? 2 : 0);
    app.querySelectorAll('.ccard').forEach(el => { el.disabled = true; el.classList.add('revealed'); });
    const chosen = $(`.ccard[data-side="${side}"]`), winner = $(`.ccard[data-side="${win}"]`);
    chosen.classList.add(ok ? 'right' : 'wrong');
    winner.classList.add('winner');
    countUp($('.ccard[data-side="a"] .val'), r.s, va);
    countUp($('.ccard[data-side="b"] .val'), r.s, vb);
    navigator.vibrate?.(ok ? 30 : [40, 60, 40]);
    showFact(ok ? 2 : 0, compareFact(r, A, B, win), r.s, i);
  };
  app.querySelectorAll('.ccard').forEach(el => el.onclick = () => pick(el.dataset.side));
}
function card(id, C, side) {
  return `<button class="ccard" data-side="${side}" aria-label="${cname(id)}">
    <span class="flag">${C.f}</span><span class="cname">${cname(id)}</span><span class="val">?</span><span class="crown">👑</span></button>`;
}
function countUp(el, s, v) {
  const t0 = performance.now(), dur = 700;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtStat(s, p < 1 ? v * e : v);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function compareFact(r, A, B, win) {
  const W = win === 'a' ? A : B, L = win === 'a' ? B : A;
  const wid = win === 'a' ? r.a : r.b, lid = win === 'a' ? r.b : r.a;
  const vw = W.v[r.s], vl = L.v[r.s];
  const lines = [];
  lines.push(`${W.f} <b>${cname(wid)}</b>: ${fmtStat(r.s, vw[0])} <small>(${vw[1]})</small><br>${L.f} <b>${cname(lid)}</b>: ${fmtStat(r.s, vl[0])} <small>(${vl[1]})</small>`);
  const kind = DATA.stats[r.s].kind;
  if (kind === 'ratio') {
    const x = vw[0] / vl[0];
    lines.push(fmt(T.times, { a: cname(wid), b: cname(lid), x: nf(x < 10 ? 1 : 0).format(x), what: WHAT[LANG][r.s] }).replace('{what}', ''));
  } else if (r.s === 'life') lines.push(fmt(T.diffYears, { x: nf(1).format(vw[0] - vl[0]) }));
  else if (r.s === 'fert') lines.push(fmt(T.diffKids, { x: nf(1).format(vw[0] - vl[0]) }));
  else lines.push(fmt(T.pts, { x: nf(0).format(vw[0] - vl[0]) }));
  if (r.a !== 'BRA' && r.b !== 'BRA' && DATA.countries.BRA.v[r.s]) lines.push(fmt(T.brazilRef, { v: fmtStat(r.s, DATA.countries.BRA.v[r.s][0]) }));
  return lines;
}

// ---------- mapa ----------
function renderMap(r, i) {
  const target = DATA.countries[r.c];
  app.innerHTML = `
  <section class="screen round slide-in">
    ${dots()}
    <div class="stat-tag map-tag">📍 ${LANG === 'pt' ? 'Ache no mapa' : 'Find it'}</div>
    <h2 class="question">${T.mapAsk} <span class="nowrap"><span class="target">${target.f} ${cname(r.c)}</span>?</span></h2>
    <div class="map-wrap" id="mapwrap">
      <svg id="map" viewBox="${r.vb.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa">${MAP.svg}</svg>
      <div class="zoom"><button id="zin" aria-label="Zoom +">＋</button><button id="zout" aria-label="Zoom −">－</button></div>
      <div class="map-toast" id="toast"></div>
    </div>
    <p class="hint">${T.mapHint}</p>
    <div id="fact"></div>
  </section>`;
  const svg = $('#map');
  let vb = [...r.vb];
  const setVB = () => svg.setAttribute('viewBox', vb.map(x => x.toFixed(1)).join(' '));
  const zoom = (k, cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2) => {
    const nw = Math.max(50, Math.min(MAP.w * 1.1, vb[2] * k)), nh = nw * (r.vb[3] / r.vb[2]);
    vb = [cx - (cx - vb[0]) * nw / vb[2], cy - (cy - vb[1]) * nh / vb[3], nw, nh];
    setVB();
  };
  $('#zin').onclick = () => zoom(0.7);
  $('#zout').onclick = () => zoom(1.4);
  let done = false;
  const ptrs = new Map(); let moved = 0, lastPinch = 0;
  const unitsPerPx = () => { const rc = svg.getBoundingClientRect(); return Math.max(vb[2] / rc.width, vb[3] / rc.height); };
  svg.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; lastPinch = 0; svg.setPointerCapture?.(e.pointerId); });
  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (ptrs.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 8) { const u = unitsPerPx(); vb[0] -= dx * u; vb[1] -= dy * u; setVB(); }
    } else if (ptrs.size === 2) {
      moved += 99;
      const [p1, p2] = [...ptrs.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (lastPinch) zoom(lastPinch / d);
      lastPinch = d;
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => {
    const wasTap = ptrs.size === 1 && moved <= 8;
    ptrs.delete(e.pointerId); if (ptrs.size < 2) lastPinch = 0;
    if (!wasTap || done) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const path = el && el.closest && el.closest('path[data-id]');
    if (!path) { toast(T.tapCountry); return; }
    done = true;
    const id = path.dataset.id;
    const ok = id === r.c;
    const dist = ok ? 0 : Math.round(km(MAP.byId[id].c, MAP.byId[r.c].c));
    const isNb = !ok && (MAP.byId[r.c].nb || []).includes(id);
    const res = ok ? 2 : (dist <= CLOSE_KM || isNb) ? 1 : 0;
    answer(res);
    navigator.vibrate?.(ok ? 30 : [40, 60, 40]);
    const tgt = svg.querySelector(`path[data-id="${r.c}"]`);
    if (!ok) path.classList.add(res === 1 ? 'tap-mid' : 'tap-bad');
    tgt.classList.add('tap-ok');
    tgt.parentNode.appendChild(tgt);
    // garante que o alvo apareça
    const b = tgt.getBBox();
    const pad = Math.max(b.width, b.height) * 0.6 + 20;
    const nx0 = Math.min(vb[0], b.x - pad), ny0 = Math.min(vb[1], b.y - pad), nx1 = Math.max(vb[0] + vb[2], b.x + b.width + pad), ny1 = Math.max(vb[1] + vb[3], b.y + b.height + pad);
    if (nx0 < vb[0] || ny0 < vb[1] || nx1 > vb[0] + vb[2] || ny1 > vb[1] + vb[3]) {
      const ratio = r.vb[3] / r.vb[2]; let w = nx1 - nx0, h = ny1 - ny0;
      if (h / w > ratio) w = h / ratio; else h = w * ratio;
      vb = [(nx0 + nx1) / 2 - w / 2, (ny0 + ny1) / 2 - h / 2, w, h]; svg.classList.add('anim'); setVB();
    }
    const lines = [];
    if (!ok) lines.push(isNb ? fmt(T.youTappedNb, { name: `<b>${cname(id)}</b>`, target: cname(r.c) }) : fmt(T.youTapped, { name: `<b>${cname(id)}</b>`, km: nf(0).format(dist) }));
    const a = target.v.area[0], bra = DATA.countries.BRA.v.area[0];
    lines.push(fmt(T.mapFact, { flag: target.f, name: `<b>${cname(r.c)}</b>`, region: LANG === 'pt' ? target.r : target.re, area: fmtStat('area', a), pop: big(target.v.pop[0]) + (LANG === 'pt' && /(milhão|milhões|bilhão|bilhões)$/.test(big(target.v.pop[0])) ? ' de' : '') }));
    if (r.c !== 'BRA') {
      const x = bra / a;
      lines.push(x > 1.3 ? fmt(T.fitsInBrazil, { x: nf(x < 10 ? 1 : 0).format(x) }) : x < 0.77 ? fmt(T.fitsBrazil, { x: nf(1).format(1 / x) }) : T.sameSizeBrazil);
    }
    showFact(res, lines, 'area', i, true);
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
}
function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }

function answer(res) {
  game.answers.push(res);
  save();
  const d = app.querySelectorAll('.dot')[game.answers.length - 1];
  if (d) { d.classList.remove('cur'); d.classList.add(res === 2 ? 'ok' : res === 1 ? 'mid' : 'bad'); }
}
function showFact(res, lines, stat, i, isMap) {
  const last = i === CH.days[dayIdx].length - 1;
  const meta = DATA.stats[stat];
  const srcs = isMap ? `${T.source}: ${LANG === 'pt' ? meta.src : meta.srcEn} (${meta.code}, ${DATA.stats.pop.code}) · Natural Earth` : `${T.source}: ${LANG === 'pt' ? meta.src : meta.srcEn} · ${meta.code}`;
  $('#fact').innerHTML = `
  <div class="fact ${res === 2 ? 'ok' : res === 1 ? 'mid' : 'bad'}">
    <div class="verdict">${res === 2 ? '✅ ' + T.correct : res === 1 ? '🟨 ' + T.close : '❌ ' + T.wrong}</div>
    ${lines.map(l => `<p>${l}</p>`).join('')}
    <p class="src">${srcs}</p>
    <button class="btn btn-next" id="nextb">${last ? T.finish + ' 🏁' : T.next + ' →'}</button>
  </div>`;
  const f = $('#fact .fact');
  requestAnimationFrame(() => f.classList.add('show'));
  setTimeout(() => f.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 250);
  $('#nextb').onclick = () => renderRound();
}

function finish() {
  game.done = true;
  game.score = game.answers.filter(a => a === 2).length;
  game.time = game.time || Math.min(3600, Math.round((Date.now() - (game.start || Date.now())) / 1000));
  save();
  renderEnd(true);
}
const emoji = a => a === 2 ? '🟩' : a === 1 ? '🟨' : '🟥';
function shareText() {
  const g = state.games[today]; const st = computeStats();
  const roundsIcons = CH.days[dayIdx].map(r => r.t === 'm' ? '📍' : '🌍');
  return [
    fmt(T.shareText, { n: g.n, score: g.score }),
    g.answers.map(emoji).join(''),
    st.streak > 1 ? fmt(T.shareStreak, { s: st.streak }) : null,
    SITE,
  ].filter(Boolean).join('\n');
}
function fmtTime(s) { const m = Math.floor(s / 60), r = s % 60; return m ? `${m}min ${r}s` : `${r}s`; }
function renderEnd(fresh) {
  game = state.games[today];
  const st = computeStats();
  const s = game.score;
  const msg = s === 5 ? T.perfect : s >= 4 ? T.great : s >= 2 ? T.good : T.meh;
  app.innerHTML = `
  <section class="screen end pop-in">
    ${header(game.n)}
    <div class="score-card">
      <div class="score-label">${T.resultTitle}</div>
      <div class="score"><span class="big">${s}</span><span class="of">${T.scoreOf}</span></div>
      <div class="grid">${game.answers.map((a, i) => `<span style="animation-delay:${0.15 * i}s">${emoji(a)}</span>`).join('')}</div>
      <div class="msg">${msg}</div>
      <div class="time">⏱️ ${T.time}: ${fmtTime(game.time || 0)} · 🔥 ${T.streak}: ${st.streak}</div>
    </div>
    <div class="share-row">
      <button class="btn btn-share" id="sh">📤 ${T.share}</button>
      <a class="btn btn-wa" id="wa" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn btn-x" id="xx" target="_blank" rel="noopener">𝕏</a>
      <button class="btn btn-copy" id="cp">📋 ${T.copy}</button>
    </div>
    <pre class="share-preview" id="preview"></pre>
    <div class="countdown-box"><div>${T.nextIn}</div><div class="countdown" id="cd">--:--:--</div></div>
    ${statsHTML(st)}
    <a class="cta cta-ig" href="${IG}" target="_blank" rel="noopener"><span class="cta-ico">📸</span><span><small>${T.follow}</small><b>${T.followCta}</b></span></a>
    <a class="cta cta-news" href="${NEWS}" target="_blank" rel="noopener"><span class="cta-ico">💌</span><span><small>${T.news}</small><b>${T.newsCta}</b></span></a>
  </section>`;
  const text = shareText();
  $('#preview').textContent = text;
  $('#wa').href = 'https://wa.me/?text=' + encodeURIComponent(text);
  $('#xx').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
  $('#cp').onclick = () => copy(text);
  const sh = $('#sh');
  if (navigator.share) sh.onclick = () => navigator.share({ text }).catch(() => {});
  else sh.remove();
  tick();
  if (fresh && s >= 4) confetti();
}
function statsHTML(st) {
  const max = Math.max(1, ...st.dist);
  return `<div class="stats-box">
    <h3>📊 ${T.stats}</h3>
    <div class="stat-nums">
      <div><b>${st.played}</b><span>${T.playedN}</span></div>
      <div><b>${st.pct}</b><span>${T.winPct}</span></div>
      <div><b>${st.streak}</b><span>${T.streak}</span></div>
      <div><b>${st.best}</b><span>${T.best}</span></div>
    </div>
    <div class="dist-title">${T.dist}</div>
    <div class="dist">${st.dist.map((n, i) => `<div class="bar-row"><span>${i}</span><div class="bar ${state.games[today]?.done && state.games[today].score === i ? 'me' : ''}" style="width:${Math.max(8, 100 * n / max)}%">${n}</div></div>`).join('')}</div>
  </div>`;
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  const b = $('#cp'); if (b) { b.textContent = T.copied; setTimeout(() => b.textContent = '📋 ' + T.copy, 1800); }
}

// ---------- contagem regressiva / virada do dia ----------
let tickTimer;
function tick() {
  clearTimeout(tickTimer);
  if (brtDate() !== today) { boot(); return; }
  const el = $('#cd');
  if (el) {
    const s = secondsToMidnight();
    el.textContent = [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(x => String(x).padStart(2, '0')).join(':');
  }
  tickTimer = setTimeout(tick, 1000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && today && brtDate() !== today) boot(); });

// ---------- modais ----------
function modal(html) {
  const m = $('#modal'); $('.modal-body', m).innerHTML = html; m.hidden = false;
  requestAnimationFrame(() => m.classList.add('show'));
  const close = () => { m.classList.remove('show'); setTimeout(() => m.hidden = true, 200); localStorage.setItem('atlasDiario:seenHow', '1'); };
  $('.modal-x', m).onclick = close; m.onclick = e => { if (e.target === m) close(); };
  const ok = $('.modal-ok', m); if (ok) ok.onclick = close;
}
function showHow() {
  modal(`<h2>🌎 ${T.howTitle}</h2><ol class="how">${T.how.map(x => `<li>${x}</li>`).join('')}</ol>
  <div class="how-ex"><span>🟩 ${T.correct}</span><span>🟨 ${T.close}</span><span>🟥 ${T.wrong}</span></div>
  <p class="note">${T.dataNote}</p><button class="btn btn-play modal-ok">${T.ok}</button>`);
}
function showStats() { modal(statsHTML(computeStats())); }

// ---------- confete ----------
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti'), ctx = c.getContext('2d');
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; c.style.display = 'block';
  const cols = ['#ff3d7f', '#ffcc00', '#00d4a6', '#6a2cf5', '#2ec5ff', '#ff7a00'];
  const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -Math.random() * c.height * 0.5, vx: (Math.random() - 0.5) * 6, vy: 4 + Math.random() * 6, s: (5 + Math.random() * 7) * devicePixelRatio, r: Math.random() * 6, col: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  const step = t => {
    ctx.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (t - t0 < 3200) requestAnimationFrame(step); else { ctx.clearRect(0, 0, c.width, c.height); c.style.display = 'none'; }
  };
  requestAnimationFrame(step);
}

// ---------- início ----------
function boot() {
  today = brtDate();
  let idx = dayDiff(CH.start, today);
  if (idx < 0) idx = 0;
  dayIdx = idx % CH.days.length;
  state = load();
  game = state.games[today];
  if (game && !game.done && game.answers.length) { renderRound(); tick(); return; }
  renderStart();
  tick();
}
async function init() {
  $('#btn-help').onclick = showHow;
  $('#btn-stats').onclick = showStats;
  $('#btn-help').setAttribute('aria-label', T.howTitle);
  $('#btn-stats').setAttribute('aria-label', T.stats);
  $('#foot').innerHTML = (LANG === 'pt' ? 'Dados: Banco Mundial (WDI) e ONU · Mapa: Natural Earth · Feito pelo ' : 'Data: World Bank (WDI) & UN · Map: Natural Earth · Made by ') + `<a href="${IG}" target="_blank" rel="noopener">Atlas Curioso</a>`;
  const [d, m, c] = await Promise.all(['data/countries.json', 'data/map.json', 'data/challenges.json'].map(u => fetch(u + '?v=1').then(r => r.json())));
  DATA = d; CH = c; MAP = m;
  MAP.byId = {};
  for (const f of m.f) MAP.byId[f.id] = f;
  MAP.svg = `<rect x="-2000" y="-2000" width="5000" height="5000" class="sea"/>` + m.f.map(f => `<path data-id="${f.id}" d="${f.d}"/>`).join('');
  boot();
  if (!localStorage.getItem('atlasDiario:seenHow')) showHow();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
})();

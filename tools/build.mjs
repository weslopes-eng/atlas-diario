// Builds data/countries.json, data/map.json and data/challenges.json from raw_wb.json (World Bank) + Natural Earth (world-atlas).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';
const require = createRequire(import.meta.url);
const iso = require('i18n-iso-countries');
const topo = require('world-atlas/countries-110m.json');
const raw = JSON.parse(fs.readFileSync('raw_wb.json'));
const OUT = process.env.OUT || '../site/data';
fs.mkdirSync(OUT, { recursive: true });

// ---------- stats metadata ----------
const STATS = {
  pop:     { kind: 'ratio', src: 'Banco Mundial (WDI), com base na ONU – World Population Prospects', srcEn: 'World Bank (WDI), based on UN World Population Prospects' },
  area:    { kind: 'ratio', src: 'Banco Mundial (WDI), com base na FAO', srcEn: 'World Bank (WDI), based on FAO' },
  gdppc:   { kind: 'ratio', src: 'Banco Mundial (WDI) e OCDE – contas nacionais', srcEn: 'World Bank (WDI) and OECD national accounts' },
  life:    { kind: 'abs', steps: [2, 5, 10], src: 'Banco Mundial (WDI), com base na ONU – World Population Prospects', srcEn: 'World Bank (WDI), based on UN World Population Prospects' },
  forest:  { kind: 'abs', steps: [6, 14, 28], src: 'Banco Mundial (WDI), com base na FAO', srcEn: 'World Bank (WDI), based on FAO' },
  internet:{ kind: 'abs', steps: [6, 14, 28], minYear: 2019, src: 'Banco Mundial (WDI), com base na UIT', srcEn: 'World Bank (WDI), based on ITU' },
  urban:   { kind: 'abs', steps: [6, 14, 28], src: 'Banco Mundial (WDI), com base na ONU – World Urbanization Prospects', srcEn: 'World Bank (WDI), based on UN World Urbanization Prospects' },
  fert:    { kind: 'abs', steps: [0.35, 0.8, 1.6], src: 'Banco Mundial (WDI), com base na ONU – World Population Prospects', srcEn: 'World Bank (WDI), based on UN World Population Prospects' },
  tourism: { kind: 'ratio', minYear: 2019, src: 'Banco Mundial (WDI), com base na ONU Turismo (dados de 2019, antes da pandemia)', srcEn: 'World Bank (WDI), based on UN Tourism (2019, pre-pandemic)' },
  density: { kind: 'ratio', src: 'Banco Mundial (WDI), com base na FAO e ONU', srcEn: 'World Bank (WDI), based on FAO and UN' },
  co2:     { kind: 'ratio', src: 'Banco Mundial (WDI), com base no EDGAR – Comissão Europeia', srcEn: 'World Bank (WDI), based on EDGAR – European Commission' },
  elec:    { kind: 'abs', steps: [8, 20, 40], src: 'Banco Mundial (WDI), com base no SE4ALL/Tracking SDG7', srcEn: 'World Bank (WDI), based on Tracking SDG7' },
};
const RATIO_STEPS = [1.15, 1.5, 2.6]; // hard >=1.15, medium >=1.5, easy >=2.6

// ---------- countries ----------
const EXCLUDE = new Set(['HKG', 'MAC', 'PRI', 'PSE', 'XKX', 'CHI', 'GUM', 'VIR', 'NCL', 'PYF']);
const ptNames = new Intl.DisplayNames('pt-BR', { type: 'region' });
const enNames = new Intl.DisplayNames('en', { type: 'region' });
const NAME_FIX_PT = { CZE: 'Tchéquia', MKD: 'Macedônia do Norte', COD: 'Rep. Dem. do Congo', COG: 'Congo', CAF: 'Rep. Centro-Africana', DOM: 'Rep. Dominicana', BIH: 'Bósnia e Herzegovina', PRK: 'Coreia do Norte', KOR: 'Coreia do Sul', MMR: 'Mianmar', SWZ: 'Essuatíni', TLS: 'Timor-Leste' };
const NAME_FIX_EN = { COD: 'DR Congo', CAF: 'Central African Rep.', DOM: 'Dominican Rep.', CZE: 'Czechia' };
const flag = iso2 => [...iso2.toUpperCase()].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
const REGION_PT = { 'Latin America & Caribbean': 'América Latina e Caribe', 'Sub-Saharan Africa': 'África Subsaariana', 'Europe & Central Asia': 'Europa e Ásia Central', 'East Asia & Pacific': 'Leste Asiático e Pacífico', 'Middle East, North Africa, Afghanistan & Pakistan': 'Oriente Médio, Norte da África, Afeganistão e Paquistão', 'Middle East & North Africa': 'Oriente Médio e Norte da África', 'South Asia': 'Sul da Ásia', 'North America': 'América do Norte' };

const countries = {};
for (const c of Object.values(raw.countries)) {
  if (EXCLUDE.has(c.iso3)) continue;
  const pop = c.values.pop?.v;
  if (!pop || pop < 400000) continue;
  if (!iso.alpha3ToNumeric(c.iso3)) continue;
  const v = {};
  for (const [k, m] of Object.entries(STATS)) {
    const x = c.values[k];
    if (!x) continue;
    if (m.minYear && x.y < m.minYear) continue;
    v[k] = [Math.round(x.v * 1000) / 1000, x.y];
  }
  if (Object.keys(v).length < 9) continue;
  countries[c.iso3] = {
    pt: NAME_FIX_PT[c.iso3] || ptNames.of(c.iso2), en: NAME_FIX_EN[c.iso3] || enNames.of(c.iso2),
    f: flag(c.iso2), r: REGION_PT[c.region.trim()] || c.region.trim(), re: c.region.trim(), v,
  };
}
console.log('countries', Object.keys(countries).length);

// ---------- map ----------
const W = 1000, H = 520;
const fc = topojson.feature(topo, topo.objects.countries);
fc.features = fc.features.filter(f => f.properties.name !== 'Antarctica');
const proj = d3.geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], fc);
const path = d3.geoPath(proj).digits(1);
const mapOut = { w: W, h: H, f: [] };
const geoms = topo.objects.countries.geometries; const nbs = topojson.neighbors(geoms);
const nbById = {}; geoms.forEach((g, i) => { const id = g.id ? iso.numericToAlpha3(g.id) : 'X_' + g.properties.name; nbById[id] = nbs[i].map(j => geoms[j].id ? iso.numericToAlpha3(geoms[j].id) : 'X_' + geoms[j].properties.name); });
const mapMeta = {};
for (const f of fc.features) {
  const id = f.id ? iso.numericToAlpha3(f.id) : null;
  const d = path(f);
  if (!d) continue;
  // largest polygon for bounds / centroid
  let main = f.geometry;
  if (f.geometry.type === 'MultiPolygon') {
    let best = null, ba = -1;
    for (const p of f.geometry.coordinates) { const g = { type: 'Polygon', coordinates: p }; const a = d3.geoArea(g); if (a > ba) { ba = a; best = g; } }
    main = best;
  }
  const b = path.bounds(main);
  const gc = d3.geoCentroid(main);
  const gc0 = d3.geoCentroid(main).map(x => Math.round(x * 100) / 100);
  const feat = { id: id || 'X_' + f.properties.name, d, c: gc0 }; const nb = nbById[feat.id]; if (nb && nb.length) feat.nb = nb;
  if (!id || !countries[id]) { let a2 = id && iso.alpha3ToAlpha2(id); feat.n = a2 ? ptNames.of(a2) : ({ 'N. Cyprus': 'Chipre do Norte', Somaliland: 'Somalilândia' }[f.properties.name] || f.properties.name); feat.ne = a2 ? enNames.of(a2) : f.properties.name; }
  mapOut.f.push(feat);
  if (id) mapMeta[id] = { b: b.flat().map(x => Math.round(x)), c: gc.map(x => Math.round(x * 100) / 100) };
}
for (const [id, m] of Object.entries(mapMeta)) if (countries[id]) { countries[id].c = m.c; countries[id].m = 1; }
fs.writeFileSync(`${OUT}/map.json`, JSON.stringify(mapOut));

// ---------- challenges ----------
let seed = 20261015;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ids = Object.keys(countries);
const weight = id => Math.pow(countries[id].v.pop[0], 0.33) * (id === 'BRA' ? 3 : 1);
const pickW = (list, wf) => { const ws = list.map(wf); let s = ws.reduce((a, b) => a + b, 0) * rnd(); for (let i = 0; i < list.length; i++) { s -= ws[i]; if (s <= 0) return list[i]; } return list.at(-1); };
const level = (s, a, b) => { // 0 too close, 1 hard, 2 medium, 3 easy
  const m = STATS[s]; const x = countries[a].v[s][0], y = countries[b].v[s][0];
  let d, steps;
  if (m.kind === 'ratio') { if (x <= 0 || y <= 0) return 0; d = Math.max(x, y) / Math.min(x, y); steps = RATIO_STEPS; }
  else { d = Math.abs(x - y); steps = m.steps; }
  return d >= steps[2] ? 3 : d >= steps[1] ? 2 : d >= steps[0] ? 1 : 0;
};
const mapPool = ids.filter(id => countries[id].m && countries[id].v.area[0] >= 60000 && countries[id].v.pop[0] >= 1e6 && id !== 'BRA');
console.log('map pool', mapPool.length);
const START = '2026-10-15', END = '2028-12-31';
const days = [];
const recentPairs = new Map(), recentMap = [], recentStat = [];
const statKeys = Object.keys(STATS);
const PLAN = [3, 2, 'm', 2, 1]; // round difficulty plan
for (let t = Date.parse(START), i = 0; t <= Date.parse(END); t += 864e5, i++) {
  const used = new Set(), statsUsed = new Set(), rounds = [];
  const mapPos = 1 + Math.floor(rnd() * 4); // map round at position 2..5
  const plan = [3, 2, 2, 1]; plan.splice(mapPos, 0, 'm');
  for (const lv of plan) {
    if (lv === 'm') {
      let c; let tries = 0;
      do { c = pickW(mapPool, id => weight(id)); tries++; } while ((used.has(c) || recentMap.includes(c)) && tries < 200);
      used.add(c); recentMap.push(c); if (recentMap.length > 60) recentMap.shift();
      // view window around target (in map units), with deterministic offset
      const [x0, y0, x1, y1] = mapMeta[c].b; const bw = x1 - x0, bh = y1 - y0;
      let w = Math.min(W, Math.max(90, Math.max(bw, bh * 1.25) * 4)); const h = w * 0.8;
      const cx = (x0 + x1) / 2 + (rnd() - 0.5) * w * 0.4, cy = (y0 + y1) / 2 + (rnd() - 0.5) * h * 0.35;
      let vx = Math.max(0, Math.min(W - w, cx - w / 2)), vy = Math.max(0, Math.min(H - h, cy - h / 2));
      if (h > H) vy = (H - h) / 2;
      rounds.push({ t: 'm', c, vb: [vx, vy, w, h].map(Math.round) });
      continue;
    }
    let ok = false, tries = 0;
    while (!ok && tries++ < 5000) {
      const s = statKeys[Math.floor(rnd() * statKeys.length)];
      if (statsUsed.has(s) || (recentStat.slice(-6).includes(s) && tries < 300)) continue;
      const pool = ids.filter(id => countries[id].v[s] && !used.has(id));
      const a = pickW(pool, weight), b = pickW(pool, weight);
      if (a === b) continue;
      if (level(s, a, b) !== lv) continue;
      const key = [a, b].sort().join('-') + s;
      if (recentPairs.has(key) && i - recentPairs.get(key) < 300) continue;
      recentPairs.set(key, i); used.add(a); used.add(b); statsUsed.add(s); recentStat.push(s);
      rounds.push(rnd() < 0.5 ? { t: 'c', s, a, b } : { t: 'c', s, a: b, b: a });
      ok = true;
    }
    if (!ok) throw new Error('could not generate day ' + i);
  }
  days.push(rounds);
}
console.log('days', days.length);
fs.writeFileSync(`${OUT}/challenges.json`, JSON.stringify({ start: START, days }));
const statsMeta = {};
for (const [k, m] of Object.entries(STATS)) statsMeta[k] = { code: raw.indicators[k].code, src: m.src, srcEn: m.srcEn, kind: m.kind };
fs.writeFileSync(`${OUT}/countries.json`, JSON.stringify({ fetched: raw.fetched.slice(0, 10), stats: statsMeta, countries }));
// stat usage summary
const use = {}; days.flat().forEach(r => { const k = r.t === 'm' ? 'map' : r.s; use[k] = (use[k] || 0) + 1; }); console.log(use);

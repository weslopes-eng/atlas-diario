import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('raw_wb.json'));
const get = async u => { for (let i=0;i<4;i++){ try { const r = await fetch(u); if (r.ok) return await r.json(); } catch(e){} await new Promise(r=>setTimeout(r,1500)); } throw new Error(u); };
async function range(k, code, dates) {
  const j = await get(`https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&date=${dates}&per_page=20000`);
  d.indicators[k] = { code, name: j[1][0].indicator.value, lastupdated: j[0].lastupdated };
  for (const c of Object.values(d.countries)) delete c.values[k];
  let n=0;
  for (const r of j[1]) { const c = d.countries[r.countryiso3code]; if (!c || r.value==null) continue;
    if (!c.values[k] || +r.date > c.values[k].y) { if(!c.values[k]) n++; c.values[k] = { v: r.value, y: +r.date }; } }
  console.log(k, n);
}
await range('gdppc','NY.GDP.PCAP.CD','2021:2025');
await range('tourism','ST.INT.ARVL','2019:2019');
fs.writeFileSync('raw_wb.json', JSON.stringify(d, null, 1));

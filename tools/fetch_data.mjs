// Fetches real data from the World Bank WDI API (most recent non-empty value per country).
import fs from 'node:fs';
const IND = {
  pop:     'SP.POP.TOTL',
  area:    'AG.SRF.TOTL.K2',
  gdppc:   'NY.GDP.PCAP.CD',
  life:    'SP.DYN.LE00.IN',
  forest:  'AG.LND.FRST.ZS',
  internet:'IT.NET.USER.ZS',
  urban:   'SP.URB.TOTL.IN.ZS',
  fert:    'SP.DYN.TFRT.IN',
  tourism: 'ST.INT.ARVL',
  density: 'EN.POP.DNST',
  co2:     'EN.GHG.CO2.PC.CE.AR5',
  elec:    'EG.ELC.ACCS.ZS',
};
const get = async u => { for (let i=0;i<4;i++){ try { const r = await fetch(u); if (r.ok) return await r.json(); } catch(e){} await new Promise(r=>setTimeout(r,1500)); } throw new Error(u); };
const meta = await get('https://api.worldbank.org/v2/country?format=json&per_page=400');
const countries = meta[1].filter(c => c.region.id !== 'NA');
const out = { fetched: new Date().toISOString(), countries: {}, indicators: {} };
for (const c of countries) out.countries[c.id] = { iso3: c.id, iso2: c.iso2Code, en: c.name, region: c.region.value, income: c.incomeLevel.value, lat: +c.latitude, lon: +c.longitude, values: {} };
for (const [k, code] of Object.entries(IND)) {
  const j = await get(`https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&mrnev=1&per_page=1000`);
  out.indicators[k] = { code, name: j[1][0].indicator.value, lastupdated: j[0].lastupdated };
  let n = 0;
  for (const r of j[1]) { const c = out.countries[r.countryiso3code]; if (c && r.value != null) { c.values[k] = { v: r.value, y: +r.date }; n++; } }
  console.log(k, code, n);
}
fs.writeFileSync('raw_wb.json', JSON.stringify(out, null, 1));

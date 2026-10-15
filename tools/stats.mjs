// Lê o contador anônimo do Atlas Diário (Abacus). Uso: node stats.mjs [dias=7] [--json]
const NS = 'weslopes-eng.atlas-diario';
const EV = ['pv', 'players', 'start', 'done', 'share', 'share_wa', 'share_x', 'share_copy', 'share_native', 'score0', 'score1', 'score2', 'score3', 'score4', 'score5'];
const n = +(process.argv.find(a => /^\d+$/.test(a)) || 7);
const json = process.argv.includes('--json');
const get = async k => { for (let i = 0; i < 3; i++) { const r = await fetch(`https://abacus.jasoncameron.dev/get/${NS}/${k}`); if (r.status === 404) return 0; if (r.ok) return (await r.json()).value; await new Promise(s => setTimeout(s, 2500)); } return null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d).replace(/-/g, '');
const days = []; for (let i = n - 1; i >= 0; i--) days.push(fmt(new Date(Date.now() - i * 864e5)));
const out = {};
let c = 0;
for (const d of [...days, 'total']) { out[d] = {}; for (const e of EV) { if (++c % 25 === 0) await sleep(10500); out[d][e] = await get(`${e}-${d}`); } }
if (json) console.log(JSON.stringify(out, null, 1));
else {
  console.log(['dia', 'aberturas', 'jogadores', 'começaram', 'terminaram', 'compartilharam'].join('\t'));
  for (const [d, v] of Object.entries(out)) console.log([d === 'total' ? 'total*' : d, v.pv, v.players, v.start, v.done, v.share].join('\t'));
  const sum = k => Object.entries(out).filter(([d]) => d !== 'total' && d >= '20261016').reduce((a, [, v]) => a + (v[k] || 0), 0);
  console.log(['lanç.→', sum('pv'), sum('players'), sum('start'), sum('done'), sum('share')].join('\t') + '   (soma dos dias mostrados a partir de 16/10)');
  console.log('* total inclui os testes de 15/10 (prévia).');
}

import { chromium, devices } from 'playwright';
const URL = process.env.URL || 'http://localhost:8765/';
const OUT = '../prints/';
const DEV = [['iphone', devices['iPhone 14']], ['ipad', devices['iPad (gen 7)']], ['android', devices['Pixel 7']]];
const b = await chromium.launch();
let fail = 0;
async function tapMap(p, wrong) {
  const tid = await p.evaluate(async () => { const d = await (await fetch('data/countries.json?v=1')).json(); const name = document.querySelector('.target').textContent.trim().split(' ').slice(1).join(' '); return Object.entries(d.countries).find(([k, v]) => v.pt === name)[0]; });
  const xy = await p.evaluate(({ tid, wrong }) => {
    const svg = document.querySelector('#map'); const sr = svg.getBoundingClientRect();
    const cand = wrong ? [...svg.querySelectorAll('path[data-id]')].filter(x => x.dataset.id !== tid) : [svg.querySelector(`path[data-id="${tid}"]`)];
    for (const el of cand) { const r = el.getBoundingClientRect();
      for (let k = 0; k < 400; k++) { const x = r.left + r.width * ((k % 20) + .5) / 20, y = r.top + r.height * (Math.floor(k / 20) + .5) / 20;
        if (x < sr.left + 5 || x > sr.right - 50 || y < sr.top + 5 || y > sr.bottom - 5) continue;
        const e = document.elementFromPoint(x, y); if (e === el) return { x: x - sr.left, y: y - sr.top, id: el.dataset.id, w: Math.round(r.width), h: Math.round(r.height) }; } }
    return null; }, { tid, wrong });
  if (xy) await p.locator('#map').click({ position: { x: xy.x, y: xy.y } });
  return { tid, xy };
}
for (const [name, dev] of DEV) {
  const ctx = await b.newContext({ ...dev, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.clock.install({ time: new Date('2026-10-15T10:00:00-03:00') }); await p.clock.resume();
  await p.goto(URL); await p.waitForSelector('.modal.show'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}${name}-0-como-jogar.png` });
  await p.click('.modal-ok'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}${name}-1-inicio.png` });
  console.log(name, 'pill:', await p.textContent('.day-pill'));
  await p.click('#go');
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(450);
    if (await p.$('#map')) {
      await p.screenshot({ path: `${OUT}${name}-r${i + 1}-mapa.png` });
      const { tid, xy } = await tapMap(p, name === 'android');
      console.log(name, 'map target', tid, 'tap', JSON.stringify(xy));
      if (!xy) { fail++; console.log('NO TAPPABLE POINT'); continue; }
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${OUT}${name}-r${i + 1}-mapa-resposta.png` });
    } else {
      await p.screenshot({ path: `${OUT}${name}-r${i + 1}-pergunta.png` });
      await p.click(i % 2 ? '.ccard[data-side="b"]' : '.ccard[data-side="a"]');
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${OUT}${name}-r${i + 1}-resposta.png`, fullPage: true });
    }
    console.log(name, 'round', i + 1, (await p.textContent('.verdict')).trim(), '|', (await p.textContent('.fact')).replace(/\s+/g, ' ').slice(0, 260));
    await p.click('#nextb');
  }
  await p.waitForSelector('.end'); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}${name}-fim.png` });
  await p.screenshot({ path: `${OUT}${name}-fim-inteira.png`, fullPage: true });
  const share = await p.textContent('#preview');
  console.log(name, 'SHARE:\n' + share);
  await p.click('#cp'); console.log(name, 'clipboard ok:', (await p.evaluate(() => navigator.clipboard.readText())) === share);
  console.log(name, 'wa href', (await p.getAttribute('#wa', 'href')).slice(0, 60));
  console.log(name, 'countdown', await p.textContent('#cd'));
  // reload same day -> should show result, not replay
  await p.reload(); await p.waitForSelector('.end'); console.log(name, 'reload keeps result: OK');
  // rollover: 23:59:58 -> 00:00:01 next day
  await p.clock.setSystemTime(new Date('2026-10-15T23:59:58-03:00')); await p.waitForTimeout(1300);
  console.log(name, 'before midnight countdown', await p.textContent('#cd'));
  await p.clock.setSystemTime(new Date('2026-10-16T00:00:01-03:00')); await p.waitForTimeout(1600);
  console.log(name, 'after midnight pill:', await p.textContent('.day-pill'), 'start screen:', !!(await p.$('#go')));
  // play day 2 fully to check streak
  await p.click('#go');
  for (let i = 0; i < 5; i++) { await p.waitForTimeout(400); if (await p.$('#map')) await tapMap(p, false); else await p.click('.ccard[data-side="a"]'); await p.waitForSelector('#nextb'); await p.click('#nextb'); }
  await p.waitForSelector('.end');
  console.log(name, 'day2 share:\n' + await p.textContent('#preview'));
  if (errs.length) { fail++; console.log(name, 'ERRORS', errs); }
  await ctx.close();
}
await b.close();
console.log('FAILS', fail);

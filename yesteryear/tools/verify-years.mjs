// Checks every Yesteryear card against Wikidata. Each card names an English
// Wikipedia article; its Wikidata item must carry the card's year in one of the
// dated properties below. Prints mismatches so they can be reviewed by hand.
// Usage: node yesteryear/tools/verify-years.mjs [--json report.json]
import {CARDS} from '../src/cards.js';
import {writeFile} from 'node:fs/promises';
import {REVIEWED} from './reviewed.mjs';

const PROPS = {P575: 'discovered or invented', P571: 'inception', P585: 'point in time', P580: 'start time', P582: 'end time', P577: 'publication',
  P619: 'launch', P620: 'landing', P1619: 'official opening', P729: 'service entry', P606: 'first flight', P1191: 'first performance', P569: 'birth', P570: 'death', P793: 'significant event', P5444: 'first use'};
const agent = {'User-Agent': 'games-yesteryear-verify/1.0 (https://github.com/nathsou/games)'};
const cards = Object.values(CARDS), titles = [...new Set(cards.map(card => card.wiki))];
const items = new Map();
for (let i = 0; i < titles.length; i += 50) {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=' + encodeURIComponent(titles.slice(i, i + 50).join('|'));
  const data = await (await fetch(url, {headers: agent})).json();
  const back = new Map();
  for (const n of data.query.normalized || []) back.set(n.to, n.from);
  for (const r of data.query.redirects || []) back.set(r.to, back.get(r.from) || r.from);
  for (const page of Object.values(data.query.pages)) items.set(back.get(page.title) || page.title, page.pageprops?.wikibase_item || null);
}
const qids = [...new Set([...items.values()].filter(Boolean))], years = new Map();
for (let i = 0; i < qids.length; i += 80) {
  const query = 'SELECT ?item ?p ?date WHERE { VALUES ?item {' + qids.slice(i, i + 80).map(q => 'wd:' + q).join(' ') + '} VALUES ?p {' + Object.keys(PROPS).filter(p => p !== 'P793').map(p => 'wdt:' + p).join(' ') + '} ?item ?p ?date . FILTER(DATATYPE(?date) = xsd:dateTime) }';
  const data = await (await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), {headers: agent})).json();
  for (const row of data.results.bindings) {
    const qid = row.item.value.split('/').pop(), raw = row.date.value, year = Number(raw.match(/^(-?\d+)/)[1]);
    const list = years.get(qid) || []; list.push({prop: PROPS[row.p.value.split('/').pop()], year}); years.set(qid, list);
  }
}
const report = [];
for (const card of cards) {
  const qid = items.get(card.wiki), found = qid ? years.get(qid) || [] : [];
  // Wikidata stores BCE years astronomically: 1 BCE is year 0.
  const match = found.some(f => f.year === card.year || card.year < 0 && f.year === card.year + 1);
  report.push({id: card.id, year: card.year, wiki: card.wiki, qid, status: !qid ? 'no item' : match ? 'ok' : found.length ? 'mismatch' : 'no date', found});
}
for (const r of report) if (r.status !== 'ok' && REVIEWED[r.id]) { r.status = 'reviewed'; r.note = REVIEWED[r.id]; }
const problems = report.filter(r => r.status !== 'ok' && r.status !== 'reviewed');
for (const id of Object.keys(REVIEWED)) if (!CARDS[id]) console.log('stale review', id);
for (const r of problems) console.log(r.status.padEnd(9), String(r.year).padStart(5), r.id, '·', r.wiki, r.found.map(f => f.prop + ' ' + f.year).join(', '));
console.log(`${report.filter(r => r.status === 'ok').length} cards match a Wikidata date, ${report.filter(r => r.status === 'reviewed').length} were checked by hand, ${problems.length} need review.`);
if (problems.length) process.exitCode = 1;
const out = process.argv.indexOf('--json');
if (out > 0) await writeFile(process.argv[out + 1], JSON.stringify(report, null, 1));

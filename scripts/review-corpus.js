#!/usr/bin/env node

/**
 * Stage 3: the human review tool.
 *
 *   npm run corpus:review     → http://localhost:4100
 *
 * Review throughput is the bottleneck for this whole project — a few hundred
 * entries at ~20s each — so this exists to make it fast: one entry at a time,
 * keyboard-driven, one-click Etymonline lookup, saves after every keystroke.
 *
 * No dependencies; Node's built-in http server, reading and writing
 * corpus/review.json in place.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { TIER_LEVELS } = require('./lib/authoring');

const PORT = Number(process.env.REVIEW_PORT) || 4100;
const REVIEW_FILE = path.join(__dirname, '..', 'corpus', 'review.json');

function load() {
  try { return JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8')); }
  catch { return null; }
}

const PAGE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Etymon — Review</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { --ink:#2c2416; --parchment:#f7f3ea; --accent:#c7956d; --ok:#4a7c59; --no:#a03830; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:var(--parchment); color:var(--ink); }
  .wrap { max-width:780px; margin:0 auto; padding:20px; }
  .bar { position:sticky; top:0; background:var(--parchment); padding:12px 0; z-index:5;
         border-bottom:1px solid rgba(44,36,22,.15); }
  .progress { height:6px; background:rgba(44,36,22,.1); border-radius:3px; overflow:hidden; }
  .progress span { display:block; height:100%; background:var(--accent); transition:width .2s; }
  .counts { display:flex; gap:16px; font-size:.85rem; margin-top:8px; flex-wrap:wrap; }
  .counts b { font-variant-numeric:tabular-nums; }
  .card { background:#fff; border-radius:14px; padding:24px; margin-top:18px;
          box-shadow:0 2px 14px rgba(0,0,0,.07); }
  .word { font-size:2rem; font-weight:700; letter-spacing:1px; }
  .tier { display:inline-block; font-size:.7rem; text-transform:uppercase; letter-spacing:1px;
          background:var(--parchment); border:1px solid var(--accent); color:var(--accent);
          padding:4px 10px; border-radius:99px; margin-left:10px; vertical-align:middle; cursor:pointer; }
  .clue { font-size:1.15rem; margin:16px 0; padding:12px 14px; background:var(--parchment);
          border-left:4px solid var(--accent); border-radius:6px; }
  dl { margin:0; }
  dt { font-size:.7rem; text-transform:uppercase; letter-spacing:1px; opacity:.55; margin-top:14px; }
  dd { margin:4px 0 0; line-height:1.5; }
  .flags { margin-top:14px; padding:10px 12px; background:#fdf6e3; border:1px solid #e6d9a8;
           border-radius:8px; font-size:.85rem; }
  .actions { display:flex; gap:10px; margin-top:20px; flex-wrap:wrap; }
  button { font:inherit; font-weight:600; padding:11px 18px; border-radius:10px;
           border:2px solid var(--ink); background:#fff; color:var(--ink); cursor:pointer; }
  button.approve { background:var(--ok); border-color:var(--ok); color:#fff; }
  button.reject  { background:var(--no); border-color:var(--no); color:#fff; }
  a.src { display:inline-block; margin-top:14px; color:var(--accent); font-weight:600; }
  .status { display:inline-block; padding:3px 10px; border-radius:99px; font-size:.72rem;
            text-transform:uppercase; letter-spacing:1px; }
  .s-approved { background:var(--ok); color:#fff; }
  .s-rejected { background:var(--no); color:#fff; }
  .s-unreviewed { background:rgba(44,36,22,.12); }
  .keys { margin-top:18px; font-size:.78rem; opacity:.6; line-height:1.7; }
  .warn { margin-top:22px; padding:12px 14px; border:1px dashed var(--no); border-radius:8px;
          font-size:.85rem; color:var(--no); }
  textarea { width:100%; margin-top:8px; padding:8px; border-radius:8px;
             border:1px solid rgba(44,36,22,.25); font:inherit; font-size:.85rem; resize:vertical; }
</style></head><body>
<div class="wrap">
  <div class="bar">
    <div class="progress"><span id="pbar" style="width:0%"></span></div>
    <div class="counts">
      <span>#<b id="pos">0</b>/<b id="total">0</b></span>
      <span style="color:var(--ok)">approved <b id="nApproved">0</b></span>
      <span style="color:var(--no)">rejected <b id="nRejected">0</b></span>
      <span style="opacity:.6">left <b id="nLeft">0</b></span>
      <span style="opacity:.6">days ready <b id="nDays">0</b></span>
    </div>
  </div>
  <div id="card"></div>
  <div class="keys">
    <b>a</b> approve &nbsp; <b>r</b> reject &nbsp; <b>t</b> cycle tier &nbsp;
    <b>&larr; &rarr;</b> move &nbsp; <b>u</b> next unreviewed &nbsp; <b>s</b> open source
  </div>
  <div class="warn">
    Automated checks verified <em>shape</em>, not truth. The one thing only you can do
    is confirm the etymology is real — check the date and the derivation against the source.
  </div>
</div>
<script>
const TIERS = ${JSON.stringify(TIER_LEVELS)};
let data = [], i = 0;

async function boot() {
  data = await (await fetch('/api/data')).json();
  i = Math.max(0, data.findIndex(d => d.status === 'unreviewed'));
  render();
}

function counts() {
  const a = data.filter(d => d.status === 'approved');
  const byTier = {};
  a.forEach(d => byTier[d.difficulty] = (byTier[d.difficulty] || 0) + 1);
  const days = TIERS.length ? Math.min(...TIERS.map(t => byTier[t] || 0)) : 0;
  return {
    approved: a.length,
    rejected: data.filter(d => d.status === 'rejected').length,
    left: data.filter(d => d.status === 'unreviewed').length,
    days
  };
}

function render() {
  if (!data.length) {
    document.getElementById('card').innerHTML =
      '<div class="card">No candidates found. Run <code>npm run corpus:generate</code> first.</div>';
    return;
  }
  const d = data[i], c = counts();
  document.getElementById('pos').textContent = i + 1;
  document.getElementById('total').textContent = data.length;
  document.getElementById('nApproved').textContent = c.approved;
  document.getElementById('nRejected').textContent = c.rejected;
  document.getElementById('nLeft').textContent = c.left;
  document.getElementById('nDays').textContent = c.days;
  document.getElementById('pbar').style.width =
    (((data.length - c.left) / data.length) * 100) + '%';

  document.getElementById('card').innerHTML = \`
    <div class="card">
      <div>
        <span class="word">\${d.word}</span>
        <span class="tier" onclick="cycleTier()" title="click or press t">\${d.difficulty}</span>
        <span class="status s-\${d.status}" style="float:right">\${d.status}</span>
      </div>
      <div class="clue">\${esc(d.clue)}</div>
      <dl>
        <dt>Definition</dt><dd>\${esc(d.definition)}</dd>
        <dt>Roots</dt><dd>\${esc(d.briefEtymology)}</dd>
        <dt>Etymology — verify this</dt><dd>\${esc(d.detailedEtymology)}</dd>
      </dl>
      \${(d.flags && d.flags.length) ? '<div class="flags">⚠ ' + d.flags.map(esc).join('<br>⚠ ') + '</div>' : ''}
      <a class="src" href="\${d.source}" target="_blank" rel="noopener">Check on Etymonline →</a>
      <textarea id="notes" rows="2" placeholder="notes (optional)">\${esc(d.notes || '')}</textarea>
      <div class="actions">
        <button class="approve" onclick="mark('approved')">Approve (a)</button>
        <button class="reject" onclick="mark('rejected')">Reject (r)</button>
        <button onclick="move(-1)">← Prev</button>
        <button onclick="move(1)">Next →</button>
      </div>
    </div>\`;

  document.getElementById('notes').addEventListener('change', e => {
    data[i].notes = e.target.value;
    save();
  });
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function save() {
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

function mark(status) {
  data[i].status = status;
  save();
  nextUnreviewed(true);
}

function move(n) {
  i = Math.min(data.length - 1, Math.max(0, i + n));
  render();
}

function nextUnreviewed(fallbackForward) {
  const next = data.findIndex((d, k) => k > i && d.status === 'unreviewed');
  if (next !== -1) i = next;
  else if (fallbackForward && i < data.length - 1) i++;
  render();
}

function cycleTier() {
  const cur = TIERS.indexOf(data[i].difficulty);
  data[i].difficulty = TIERS[(cur + 1) % TIERS.length];
  save();
  render();
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (k === 'a') mark('approved');
  else if (k === 'r') mark('rejected');
  else if (k === 't') cycleTier();
  else if (k === 'u') nextUnreviewed(false);
  else if (k === 's') window.open(data[i].source, '_blank');
  else if (e.key === 'ArrowLeft') move(-1);
  else if (e.key === 'ArrowRight') move(1);
});

boot();
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/api/data' && req.method === 'GET') {
    const data = load();
    if (!data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('[]');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  if (req.url === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(REVIEW_FILE, JSON.stringify(parsed, null, 2));
        res.writeHead(204).end();
      } catch (err) {
        res.writeHead(400).end(String(err.message));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});

if (!load()) {
  console.log('\n  No corpus/review.json yet — run `npm run corpus:generate` first.\n');
}

server.listen(PORT, () => {
  console.log(`\n  Etymon review  →  http://localhost:${PORT}`);
  console.log(`  Editing corpus/review.json in place. Ctrl-C when done.\n`);
});

#!/usr/bin/env node
// Local diagram dashboard.
//
//   ./scripts/dashboard.sh [--port 4747] [--no-open]
//
// Renders every diagram in diagrams/, serves a clickable dashboard at
// http://127.0.0.1:<port>, re-renders changed sources and live-reloads
// the browser over SSE. D2 SVGs are dual-theme: the Light/Dark/System
// toggle sets color-scheme, which embedded SVGs inherit.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIAGRAMS = path.join(ROOT, 'diagrams');
const RENDER = path.join(ROOT, 'render');

const argv = process.argv.slice(2);
const portArg = argv.includes('--port')
  ? argv[argv.indexOf('--port') + 1]
  : argv.find((a) => a.startsWith('--port='))?.split('=')[1];
const PORT = Number(portArg || process.env.PORT || 4747);
const OPEN = !argv.includes('--no-open');

const log = (msg) => console.log(msg);

// ---------------------------------------------------------------- diagrams

async function titleOf(src, ext) {
  try {
    const text = await fsp.readFile(src, 'utf8');
    const m = /^title:\s*(.+)$/m.exec(text);
    if (m) return m[1].trim();
    if (ext === 'md') {
      const h = /^#\s+(.+)$/m.exec(text);
      if (h) return h[1].trim();
    }
  } catch {}
  return null;
}

async function listDiagrams() {
  const files = await fsp.readdir(DIAGRAMS).catch(() => []);
  const out = [];
  for (const file of files) {
    const m = /^(.+)\.(d2|md)$/.exec(file);
    if (!m) continue;
    const [, slug, ext] = m;
    const svgStat = await fsp.stat(path.join(RENDER, `${slug}.svg`)).catch(() => null);
    out.push({
      slug,
      format: ext === 'd2' ? 'd2' : 'mermaid',
      title: await titleOf(path.join(DIAGRAMS, file), ext),
      rendered: Boolean(svgStat),
      mtime: svgStat ? svgStat.mtimeMs : 0,
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

// ----------------------------------------------------------------- render

const pending = new Map();
const inFlight = new Map();

function schedule(slug) {
  clearTimeout(pending.get(slug));
  pending.set(slug, setTimeout(() => {
    pending.delete(slug);
    const prev = inFlight.get(slug) || Promise.resolve();
    const next = prev
      .then(() => renderSlug(slug))
      .finally(() => { if (inFlight.get(slug) === next) inFlight.delete(slug); });
    inFlight.set(slug, next);
  }, 250));
}

async function renderSlug(slug) {
  broadcast({ type: 'render-start', slug });
  try {
    await execFileP(path.join(ROOT, 'scripts', 'render.sh'), [slug], {
      cwd: ROOT,
      maxBuffer: 8 * 1024 * 1024,
    });
    log(`rendered  ${slug}`);
    broadcast({ type: 'rendered', slug, ok: true });
    refreshDarkTwin(slug);
  } catch (err) {
    const error = String(err.stderr || err.message || err).trim();
    log(`FAILED    ${slug}\n${error}`);
    broadcast({ type: 'rendered', slug, ok: false, error });
  }
}

// Mermaid SVGs bake in a single theme, so dark mode needs a separately
// rendered variant. D2 embeds both palettes and needs nothing here.
const DARK_DIR = path.join(RENDER, '.dark');

async function ensureDarkTwin(slug) {
  const srcStat = await fsp.stat(path.join(DIAGRAMS, `${slug}.md`)).catch(() => null);
  if (!srcStat) return null;

  const out = path.join(DARK_DIR, `${slug}.svg`);
  const outStat = await fsp.stat(out).catch(() => null);
  if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) return out;

  await execFileP(path.join(ROOT, 'scripts', 'render.sh'), ['--dark', slug], {
    cwd: ROOT,
    maxBuffer: 8 * 1024 * 1024,
  });
  return fs.existsSync(out) ? out : null;
}

function refreshDarkTwin(slug) {
  const out = path.join(DARK_DIR, `${slug}.svg`);
  if (!fs.existsSync(out)) return;
  execFileP(path.join(ROOT, 'scripts', 'render.sh'), ['--dark', slug], {
    cwd: ROOT,
    maxBuffer: 8 * 1024 * 1024,
  })
    .then(() => log(`dark      ${slug}`))
    .catch(() => {});
}

async function warmDarkTwins() {
  const files = await fsp.readdir(DIAGRAMS).catch(() => []);
  const mds = files.filter((f) => f.endsWith('.md'));
  if (!mds.length) return;
  log(`pre-rendering dark variants for ${mds.length} mermaid diagram(s)...`);
  for (const f of mds) await ensureDarkTwin(f.replace(/\.md$/, '')).catch(() => {});
  log('dark variants ready');
}

// ------------------------------------------------------------------ watch

fs.watch(DIAGRAMS, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const base = path.basename(filename);
  if (base.startsWith('.')) return;
  const m = /^(.+)\.(d2|md)$/.exec(base);
  if (m) schedule(m[1]);
  broadcast({ type: 'refresh-list' });
});

// -------------------------------------------------------------------- sse

const clients = new Set();

function broadcast(event) {
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(frame);
}

setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 20_000).unref();

// ------------------------------------------------------------------- http

const PAGE = `<!doctype html>
<html lang="en" data-mode="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagram dashboard</title>
<style>
  :root {
    --bg:#f6f7f9; --panel:#fff; --line:#d0d7de; --fg:#24292f; --muted:#57606a;
    --chip:#eaeef2; --accent:#0969da; --err:#cf222e; --viewer-bg:#fff;
  }
  :root[data-mode="dark"] {
    --bg:#0d1117; --panel:#161b22; --line:#30363d; --fg:#e6edf3; --muted:#8b949e;
    --chip:#21262d; --accent:#58a6ff; --err:#f85149; --viewer-bg:#0d1117;
  }
  * { box-sizing: border-box; }
  body { margin:0; height:100vh; display:flex; flex-direction:column;
         background:var(--bg); color:var(--fg);
         font:14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { display:flex; align-items:center; gap:16px; padding:10px 16px;
           background:var(--panel); border-bottom:1px solid var(--line); }
  header h1 { font-size:14px; font-weight:600; margin:0; }
  header .spacer { flex:1; }
  .seg { display:flex; border:1px solid var(--line); border-radius:6px; overflow:hidden; }
  .seg button { border:0; background:transparent; color:var(--muted); padding:4px 10px;
                font:inherit; font-size:12px; cursor:pointer; }
  .seg button.active { background:var(--chip); color:var(--fg); font-weight:600; }
  main { flex:1; display:flex; min-height:0; }
  aside { width:300px; flex:none; overflow:auto; border-right:1px solid var(--line);
          background:var(--panel); padding:8px; }
  aside ul { list-style:none; margin:0; padding:0; }
  .item { display:flex; gap:8px; align-items:center; padding:8px 10px; border-radius:6px;
          cursor:pointer; }
  .item:hover { background:var(--chip); }
  .item.active { background:var(--chip); box-shadow: inset 2px 0 0 var(--accent); }
  .chip { flex:none; font-size:10px; font-weight:700; letter-spacing:.04em; padding:2px 6px;
          border-radius:4px; background:var(--chip); border:1px solid var(--line); color:var(--muted); }
  .item.active .chip { color:var(--fg); }
  .name { min-width:0; }
  .name b { display:block; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .name small { display:block; color:var(--muted); font-family:ui-monospace, Menlo, monospace;
                font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #pane { flex:1; display:flex; flex-direction:column; min-width:0; }
  #toolbar { display:flex; align-items:center; gap:12px; padding:8px 16px;
             border-bottom:1px solid var(--line); background:var(--panel); }
  #caption { font-weight:600; }
  #status { color:var(--muted); font-size:12px; }
  #open { margin-left:auto; color:var(--accent); text-decoration:none; font-size:12px; }
  #stage { flex:1; overflow:auto; padding:24px; }
  #stage img { display:block; max-width:100%; height:auto; background:var(--viewer-bg);
               border:1px solid var(--line); border-radius:8px; }
  #error { margin:16px; padding:12px 16px; border:1px solid var(--err); border-radius:8px;
           background:color-mix(in srgb, var(--err) 8%, transparent); overflow:auto; }
  #error pre { margin:0; font-family:ui-monospace, Menlo, monospace; font-size:12px; white-space:pre-wrap; }
</style>
</head>
<body>
<header>
  <h1>Diagram dashboard</h1>
  <span class="spacer"></span>
  <span id="status"></span>
  <div class="seg">
    <button data-theme="light">Light</button>
    <button data-theme="system">System</button>
    <button data-theme="dark">Dark</button>
  </div>
</header>
<main>
  <aside><ul id="list"></ul></aside>
  <div id="pane">
    <div id="toolbar">
      <span id="caption"></span>
      <a id="open" target="_blank" rel="noopener">open in new tab &#8599;</a>
    </div>
    <div id="error" hidden><pre></pre></div>
    <div id="stage"><img id="viewer" alt=""></div>
  </div>
</main>
<script>
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEY = 'diagram-dashboard-theme';
const params = new URLSearchParams(location.search);
let mode = params.get('theme') || localStorage.getItem(KEY) || 'system';
let items = [];
let selected = null;
let isDark = false;

function applyMode() {
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  isDark = dark;
  document.documentElement.dataset.mode = dark ? 'dark' : 'light';
  if (mode === 'system') document.documentElement.style.removeProperty('color-scheme');
  else document.documentElement.style.colorScheme = mode;
  for (const b of document.querySelectorAll('[data-theme]'))
    b.classList.toggle('active', b.dataset.theme === mode);
  localStorage.setItem(KEY, mode);
  if (selected && items.some((i) => i.slug === selected && i.format === 'mermaid')) select(selected);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMode);
for (const b of document.querySelectorAll('[data-theme]'))
  b.onclick = () => { mode = b.dataset.theme; applyMode(); };

const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const errorPre = errorEl.querySelector('pre');
const viewer = document.getElementById('viewer');

function setStatus(text) { statusEl.textContent = text || ''; }
function showError(text) {
  errorPre.textContent = text;
  errorEl.hidden = false;
  document.getElementById('stage').style.display = 'none';
}
function clearError() {
  errorEl.hidden = true;
  document.getElementById('stage').style.display = '';
}

function renderList() {
  const ul = document.getElementById('list');
  ul.innerHTML = '';
  if (!items.length) {
    ul.innerHTML = '<li class="item"><span class="name"><b>No diagrams yet</b><small>add a .md or .d2 file to diagrams/</small></span></li>';
    return;
  }
  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'item' + (it.slug === selected ? ' active' : '');
    li.innerHTML =
      '<span class="chip">' + (it.format === 'd2' ? 'D2' : 'MMD') + '</span>' +
      '<span class="name"><b>' + esc(it.title || it.slug) + '</b>' +
      '<small>' + esc(it.slug) + '</small></span>';
    li.onclick = () => select(it.slug);
    ul.appendChild(li);
  }
}

function viewUrl(slug) {
  const it = items.find((i) => i.slug === slug);
  const darkVariant = isDark && it && it.format === 'mermaid';
  return '/' + (darkVariant ? 'dark' : 'svg') + '/' + slug + '.svg';
}

function select(slug) {
  selected = slug;
  const it = items.find((i) => i.slug === slug);
  const url = viewUrl(slug);
  viewer.src = url + '?v=' + (it ? it.mtime : Date.now());
  viewer.alt = slug;
  document.getElementById('caption').textContent = it && it.title ? it.title : slug;
  document.getElementById('open').href = '/view/' + slug + '?theme=' + (isDark ? 'dark' : 'light');
  clearError();
  renderList();
}

async function refresh() {
  items = await (await fetch('/api/diagrams')).json();
  if (!selected && items.length) { select(items[0].slug); return; }
  if (selected && !items.some((i) => i.slug === selected) && items.length) select(items[0].slug);
  else renderList();
}

const es = new EventSource('/events');
es.onmessage = async (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'refresh-list') refresh();
  if (msg.type === 'render-start' && msg.slug === selected) setStatus('rendering\\u2026');
  if (msg.type === 'rendered') {
    await refresh();
    if (msg.slug === selected) {
      if (msg.ok) { select(selected); setStatus(''); }
      else showError(msg.error);
    } else {
      setStatus(msg.ok ? '' : 'error in ' + msg.slug);
    }
  }
};

addEventListener('keydown', (e) => {
  const idx = items.findIndex((i) => i.slug === selected);
  if (e.key === 'ArrowDown' || e.key === 'j') select(items[Math.min(idx + 1, items.length - 1)].slug);
  if (e.key === 'ArrowUp' || e.key === 'k') select(items[Math.max(idx - 1, 0)].slug);
});

applyMode();
refresh();
setStatus('live \\u2014 edits re-render automatically');
</script>
</body>
</html>`;

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function viewerPage(slug, src, dark) {
  const bg = dark ? '#0d1117' : '#f6f7f9';
  const line = dark ? '#30363d' : '#d0d7de';
  return `<!doctype html>
<html lang="en" style="color-scheme:${dark ? 'dark' : 'light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${slug}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:${bg}; padding:32px; box-sizing:border-box; }
  img { max-width:100%; height:auto; border:1px solid ${line}; border-radius:8px; }
</style>
</head>
<body><img src="${src}" alt="${slug}"></body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/') return send(res, 200, 'text/html; charset=utf-8', PAGE);
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/diagrams') {
    listDiagrams()
      .then((items) => send(res, 200, 'application/json', JSON.stringify(items)))
      .catch(() => send(res, 500, 'application/json', '{"error":"list failed"}'));
    return;
  }
  const v = /^\/view\/([\w.-]+)$/.exec(url.pathname);
  if (v) {
    const slug = v[1];
    const dark = url.searchParams.get('theme') === 'dark';
    const isMermaid = fs.existsSync(path.join(DIAGRAMS, `${slug}.md`));
    const src = dark && isMermaid ? `/dark/${slug}.svg` : `/svg/${slug}.svg`;
    return send(res, 200, 'text/html; charset=utf-8', viewerPage(slug, src, dark));
  }
  const dm = /^\/dark\/([\w.-]+)\.svg$/.exec(url.pathname);
  if (dm) {
    ensureDarkTwin(dm[1])
      .then((file) => {
        if (!file) return send(res, 404, 'text/plain', 'no dark variant for this diagram');
        fs.readFile(file, (err, data) => {
          if (err) return send(res, 404, 'text/plain', 'not rendered yet');
          send(res, 200, 'image/svg+xml', data);
        });
      })
      .catch((err) => send(res, 500, 'text/plain', String(err.stderr || err.message).trim()));
    return;
  }
  const m = /^\/svg\/([\w.-]+\.svg)$/.exec(url.pathname);
  if (m) {
    fs.readFile(path.join(RENDER, m[1]), (err, data) => {
      if (err) return send(res, 404, 'text/plain', 'not rendered yet');
      send(res, 200, 'image/svg+xml', data);
    });
    return;
  }
  send(res, 404, 'text/plain', 'not found');
});

function openBrowser(url) {
  if (process.platform === 'darwin') {
    execFile('open', ['-a', 'Google Chrome', url], (err) => {
      if (err) execFile('open', [url], () => {});
    });
  } else if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], () => {});
  } else {
    execFile('xdg-open', [url], () => {});
  }
}

await fsp.mkdir(RENDER, { recursive: true });
log('rendering all diagrams...');
await execFileP(path.join(ROOT, 'scripts', 'render.sh'), [], {
  cwd: ROOT,
  maxBuffer: 8 * 1024 * 1024,
}).catch((err) => log(`warn: initial render had errors\n${err.stderr || err.message}`));

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  log(`dashboard  ${url}  (ctrl-c to stop)`);
  if (OPEN) openBrowser(url);
  warmDarkTwins();
});

process.on('SIGINT', () => {
  log('\nstopped');
  process.exit(0);
});

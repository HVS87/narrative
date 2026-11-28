/* Corre a suite qa/qa.js em vários browsers instalados (sem interface), cada um com um perfil temporário.
   Uso:  node qa/run.js [edge] [firefox] [chrome]      (sem argumentos: todos os que existirem)
   Não toca nos dados de nenhum perfil real: serve o projeto numa porta própria e usa perfis descartáveis. */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 5199;
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json',
  '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const INJECT = `<script>try{localStorage.setItem('narrativa.lang','pt');localStorage.setItem('narrativa.privacySeen','1');}catch(e){}window.__early=[];window.addEventListener('error',e=>window.__early.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));</script>`;
const REPORT = `<script>
  const send = (r, n = 0) => fetch('/__report', {method:'POST', body:JSON.stringify(Object.assign(r, {early:window.__early, ua:navigator.userAgent}))}).catch(() => n < 5 && setTimeout(() => send(r, n + 1), 1000));
  setInterval(() => fetch('/__ping?' + encodeURIComponent(window.__qaLast || document.readyState)), 1500);
  window.addEventListener('load', () => setTimeout(() => { const s = document.createElement('script'); s.src = 'qa/qa.js';
    s.onload = () => window.__qa.then(send, e => send({error:String(e)})); s.onerror = () => send({error:'qa.js não carregou'}); document.body.append(s); }, 300));</script>`;
let onReport = null, lastPing = '(a página nunca respondeu)', lastPingAt = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__ping'){ lastPing = decodeURIComponent(url.search.slice(1)); lastPingAt = Date.now(); return res.end('ok'); }
  if (url.pathname === '/__report'){ let b = ''; req.on('data', d => b += d); req.on('end', () => { res.end('ok'); onReport && onReport(JSON.parse(b)); }); return; }
  let p = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
  if (!p.startsWith(root)){ res.writeHead(403); return res.end(); }
  if (p === root || p.endsWith(path.sep)) p = path.join(p, 'index.html');
  if (process.env.NO_SW && p.endsWith('sw.js')){ res.writeHead(404); return res.end(); }
  fs.readFile(p, (err, data) => {
    if (err){ res.writeHead(404); return res.end('not found'); }
    if (p.endsWith('index.html') && url.searchParams.has('qa'))
      data = data.toString().replace('<head>', '<head>' + INJECT).replace('</body>', REPORT + '</body>');
    res.writeHead(200, {'Content-Type':types[path.extname(p)] || 'application/octet-stream', 'Cache-Control':'no-store'}); res.end(data);
  });
});
const find = list => list.find(f => f && fs.existsSync(f));
/* O Edge sem interface deixa processos vivos depois de o principal ser terminado, e esses processos prendem o perfil.
   Termina-se tudo o que use o perfil e só então se apaga — com nova tentativa, e aviso se ficar alguma coisa. */
function killProfile(prof){
  const tag = path.basename(prof).replace(/'/g, '');
  try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.Name -match '^(msedge|chrome|firefox)\.exe$' -and $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, {stdio:'ignore'}); } catch (e) {}
}
function removeProfile(prof){
  killProfile(prof);
  try { fs.rmSync(prof, {recursive:true, force:true, maxRetries:20, retryDelay:500}); } catch (e) {}
  if (fs.existsSync(prof)) console.log('   aviso: não foi possível apagar o perfil temporário ' + prof);
}
/* perfis que tenham ficado de corridas anteriores (interrompidas); os recentes podem ser de uma corrida que ainda decorre */
function sweepOld(){
  for (const d of fs.readdirSync(os.tmpdir())){ if (!d.startsWith('narrativa-qa-')) continue; const p = path.join(os.tmpdir(), d);
    try { if (Date.now() - fs.statSync(p).mtimeMs > 10 * 60000) removeProfile(p); } catch (e) {} }
}
const PF = process.env['ProgramFiles'] || '', PF86 = process.env['ProgramFiles(x86)'] || '', LA = process.env['LOCALAPPDATA'] || '';
const BROWSERS = {
  edge:{ exe:find([PF86 + '\\Microsoft\\Edge\\Application\\msedge.exe', PF + '\\Microsoft\\Edge\\Application\\msedge.exe']),
    args:(prof, url) => ['--headless=new', '--no-first-run', '--disable-gpu', '--window-size=1366,768', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--user-data-dir=' + prof, url] },
  chrome:{ exe:find([PF + '\\Google\\Chrome\\Application\\chrome.exe', PF86 + '\\Google\\Chrome\\Application\\chrome.exe', LA + '\\Google\\Chrome\\Application\\chrome.exe']),
    args:(prof, url) => ['--headless=new', '--no-first-run', '--disable-gpu', '--window-size=1366,768', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--user-data-dir=' + prof, url] },
  firefox:{ exe:find([PF + '\\Mozilla Firefox\\firefox.exe', PF86 + '\\Mozilla Firefox\\firefox.exe']),
    args:(prof, url) => ['-headless', '-no-remote', '-width', '1366', '-height', '768', '-profile', prof, url] },
};
function runOne(name){
  const b = BROWSERS[name];
  return new Promise(resolve => {
    if (!b || !b.exe) return resolve({name, skipped:'não instalado'});
    lastPing = '(a página nunca respondeu)';
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'narrativa-qa-' + name + '-'));
    const started = Date.now();
    const child = spawn(b.exe, b.args(prof, `http://localhost:${PORT}/?qa=1`), {stdio:'ignore'});
    const done = r => { clearTimeout(t); onReport = null;
      try { execSync(`taskkill /PID ${child.pid} /T /F`, {stdio:'ignore'}); } catch (e) {}
      setTimeout(() => { removeProfile(prof); resolve(Object.assign({name, secs:Math.round((Date.now() - started) / 1000)}, r)); }, 1500); };
    const t = setTimeout(() => done({error:'sem resposta em 480 s; último sinal: ' + lastPing + (Date.now() - lastPingAt < 5000 ? ' (página viva, à espera)' : ' (página parada há ' + Math.round((Date.now() - lastPingAt) / 1000) + ' s)')}), 480000); // a suite inteira, num browser lento
    onReport = done;
  });
}
(async () => {
  sweepOld();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BROWSERS);
  let bad = 0;
  for (const n of names){
    const r = await runOne(n);
    if (r.skipped){ console.log(`${n}: ${r.skipped}`); continue; }
    if (r.error){ bad++; console.log(`${n}: ERRO ${r.error}`); continue; }
    const ver = (r.ua.match(/(Edg|Firefox|Chrome)\/[\d.]+/g) || []).pop();
    console.log(`${n} (${ver}): ${r.passed}/${r.total} testes em ${r.secs} s` + (r.uncaught.length || r.early.length ? `, erros não tratados: ${JSON.stringify([...r.early, ...r.uncaught])}` : '') + `  perf=${JSON.stringify(r.perf)}`);
    r.failed.forEach(f => console.log(`   ✗ ${f.name}\n      ${f.err}`));
    if (r.failed.length || r.uncaught.length || r.early.length) bad++;
  }
  server.close(); process.exit(bad ? 1 : 0);
})();

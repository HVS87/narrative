/* Teste de ponta a ponta da aplicação para PC (desktop/) com um telemóvel simulado:
   arranca o .exe gerado (desktop/dist/win-unpacked) e um Chrome sem interface em modo Android, ambos sobre um servidor local
   com a ferramenta, e comanda-os pelo DevTools Protocol. Emparelha-os com um código, sincroniza nos dois sentidos, fecha e
   reabre o .exe (o projeto tem de lá estar e a ligação tem de voltar sozinha) e abre-o sem internet.
   Usa pastas de dados descartáveis: não toca nos projetos reais. Precisa de internet (serviço de contacto PeerJS).
   Uso: node qa/desktop.js */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 5199, BASE = `http://localhost:${PORT}/`;
const EXE = path.join(root, 'desktop', 'dist', 'win-unpacked', 'Narrative.exe');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json',
  '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(root) || p.includes(path.sep + 'desktop' + path.sep) || p.includes(path.sep + '.git')){ res.writeHead(403); return res.end(); }
  if (p === root || p.endsWith(path.sep)) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => { if (err){ res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type':types[path.extname(p)] || 'application/octet-stream'}); res.end(data); });
});
const PF = process.env['ProgramFiles'] || '', PF86 = process.env['ProgramFiles(x86)'] || '', LA = process.env['LOCALAPPDATA'] || '';
const CHROME = [path.join(PF, 'Google/Chrome/Application/chrome.exe'), path.join(PF86, 'Google/Chrome/Application/chrome.exe'), path.join(LA, 'Google/Chrome/Application/chrome.exe'),
  path.join(PF86, 'Microsoft/Edge/Application/msedge.exe')].find(f => fs.existsSync(f));
const W = ms => new Promise(r => setTimeout(r, ms));
const R = [];
const check = (name, ok, info) => { R.push({name, ok}); console.log((ok ? '  ✓ ' : '  ✗ ') + name + (info ? '  — ' + info : '')); };

async function connect(port){
  for (let i = 0; i < 100; i++){
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const pg = l.find(t => t.type === 'page' && /^http/.test(t.url)); if (pg) return open(pg.webSocketDebuggerUrl); } catch (e) {}
    await W(250);
  }
  throw new Error('sem resposta na porta ' + port);
}
function open(url){
  return new Promise((res, rej) => {
    const ws = new WebSocket(url); let id = 0; const wait = new Map();
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)){ const [ok, ko] = wait.get(d.id); wait.delete(d.id); d.error ? ko(new Error(d.error.message)) : ok(d.result); } };
    ws.onerror = rej;
    ws.onopen = () => {
      const send = (method, params) => new Promise((ok, ko) => { wait.set(++id, [ok, ko]); ws.send(JSON.stringify({id, method, params:params || {}})); });
      const ev = async expr => { const r = await send('Runtime.evaluate', {expression:expr, awaitPromise:true, returnByValue:true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result.value; };
      res({ send, ev, close:() => ws.close() });
    };
  });
}
const until = async (c, expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 30000)){ try { const v = await c.ev(expr); if (v) return v; } catch (e) {} await W(500); } return null; };

const procs = [], dirs = [];
function launchExe(dataDir, port, env){
  const p = spawn(EXE, [`--remote-debugging-port=${port}`], {env:Object.assign({}, process.env, {NARRATIVA_URL:BASE, NARRATIVA_USERDATA:dataDir}, env || {}), stdio:'ignore'});
  procs.push(p); return p;
}
const kill = p => { try { execSync(`taskkill /PID ${p.pid} /T /F`, {stdio:'ignore'}); } catch (e) {} };

(async () => {
  if (!fs.existsSync(EXE)){ console.log('Falta gerar a aplicação: cd desktop && npx electron-builder --win nsis portable'); process.exit(1); }
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const exeData = fs.mkdtempSync(path.join(os.tmpdir(), 'narrativa-qa-exe-')), phoneProf = fs.mkdtempSync(path.join(os.tmpdir(), 'narrativa-qa-phone-'));
  dirs.push(exeData, phoneProf);
  let pc, phone, exe;
  try {
    console.log('Aplicação para PC (.exe)');
    exe = launchExe(exeData, 9351);
    pc = await connect(9351);
    await until(pc, `typeof state === 'object' && typeof Projects === 'object'`);
    check('o .exe abre a ferramenta', await pc.ev(`!!document.querySelector('#topbar')`));
    check('a ferramenta sabe que está na aplicação para PC', await pc.ev(`isDesktopApp() && isInstalledApp() && /^\\d+\\.\\d+\\.\\d+$/.test(window.narrativaDesktop.version)`), await pc.ev(`window.narrativaDesktop && window.narrativaDesktop.version`));
    check('na primeira abertura, segue a língua do sistema', await pc.ev(`LANG === detectLang()`), await pc.ev(`LANG`));
    // o resto do teste procura textos em português: fixa a língua e recarrega
    await pc.ev(`lsSet(LS_TOUR, '1'); lsSet(LS_PRIV, '1'); localStorage.setItem(LS_LANG, 'pt'); Projects.leaving = true; setTimeout(() => location.reload(), 50); 1`);
    await W(1500); pc.close(); pc = await connect(9351); await until(pc, `typeof state === 'object' && typeof Projects === 'object' && LANG === 'pt'`);
    check('primeira abertura sem projetos: página inicial', await pc.ev(`projNone() && !document.querySelector('#landing').hidden`));
    await pc.ev(`newProject(); state.project.name = 'Romance do PC'; state.books[0].name = 'Livro um'; commit(); flushSave(); setTab('settings'); 1`);
    check('Definições: «Está a usar a aplicação para PC»', await pc.ev(`!!document.querySelector('[data-install="desktop"]')`));

    console.log('Telemóvel (Chrome em modo Android)');
    const ch = spawn(CHROME, ['--headless=new', '--no-first-run', '--disable-gpu', '--remote-debugging-port=9352', '--user-data-dir=' + phoneProf, BASE], {stdio:'ignore'}); procs.push(ch);
    phone = await connect(9352);
    await phone.send('Emulation.setDeviceMetricsOverride', {width:412, height:915, deviceScaleFactor:2.6, mobile:true});
    await phone.send('Emulation.setTouchEmulationEnabled', {enabled:true, maxTouchPoints:5});
    await until(phone, `typeof state === 'object' && typeof Projects === 'object'`);
    await phone.ev(`lsSet(LS_TOUR, '1'); lsSet(LS_PRIV, '1'); localStorage.setItem(LS_LANG, 'pt'); Projects.leaving = true; setTimeout(() => location.reload(), 50); 1`);
    await W(1500); phone.close(); phone = await connect(9352); await until(phone, `typeof state === 'object' && typeof Projects === 'object' && LANG === 'pt'`);
    await phone.ev(`closeAllModals(); Sync.cfg.name = 'Telemóvel de teste'; syncSave(); 1`);

    console.log('Emparelhar e sincronizar');
    const code = await pc.ev(`(async () => { syncPairShow(); for (let i = 0; i < 60; i++){ const m = openModals.find(x => x.pairCode); const st = m && m.back.querySelector('[role=status]'); if (st && /espera/.test(st.textContent)) return m.pairCode; await new Promise(r => setTimeout(r, 500)); } return null; })()`);
    check('o .exe mostra um código de ligação', !!code, code);
    await phone.ev(`(async () => { syncPairEnter(); await new Promise(r => setTimeout(r, 300)); const i = document.querySelector('.modal input'); i.value = ${JSON.stringify(code || '')}; i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true})); return 1; })()`);
    const asked = await until(pc, `!!openModals.find(m => m.titleEl.textContent === 'Ligar dispositivo')`, 40000);
    check('o pedido do telemóvel chega ao .exe', !!asked);
    await pc.ev(`[...document.querySelectorAll('.modal .btn.primary')].find(b => b.textContent === 'Ligar').click(); 1`);
    check('ligados nos dois sentidos', !!(await until(pc, `[...Sync.links.values()].some(L => L.authed)`, 40000)) && !!(await until(phone, `[...Sync.links.values()].some(L => L.authed)`, 40000)));
    // o telemóvel ainda não tem nenhum projeto: recebe o do PC
    const other = await until(phone, `(() => { const L = [...Sync.links.values()].find(x => x.authed && x.other); return L && L.other.name; })()`, 30000);
    check('o telemóvel vê que o PC está noutro projeto', other === 'Romance do PC', other);
    await phone.ev(`syncWant([...Sync.links.values()].find(x => x.authed && x.other)); 1`);
    check('o telemóvel recebe o projeto do PC', !!(await until(phone, `!projNone() && state.project.name === 'Romance do PC' && state.books[0].name === 'Livro um'`, 30000)));
    check('ficam a sincronizar o mesmo projeto', !!(await until(phone, `syncState() === 'linked'`, 30000)) && !!(await until(pc, `syncState() === 'linked'`, 30000)));
    await phone.ev(`state.books[0].name = 'Mudado no telemóvel'; commit(); flushSave(); 1`);
    check('telemóvel → PC', !!(await until(pc, `state.books[0].name === 'Mudado no telemóvel'`, 20000)));
    await pc.ev(`state.books[0].chapters[0].name = 'Escrito no PC'; commit(); flushSave(); 1`);
    check('PC → telemóvel', !!(await until(phone, `state.books[0].chapters[0].name === 'Escrito no PC'`, 20000)));
    await phone.ev(`(async () => { const r = newNote([]); r.title = 'Ideia no autocarro'; commit(); flushSave(); return 1; })()`);
    check('Note criada no telemóvel chega ao PC', !!(await until(pc, `state.refs.some(r => r.title === 'Ideia no autocarro')`, 20000)));

    console.log('Fechar e reabrir o .exe');
    // fecha-se como um utilizador (a janela), e confirma-se que o processo termina
    await pc.ev(`flushSave(); Projects.leaving = true; setTimeout(() => window.close(), 100); 1`).catch(() => {}); pc.close();
    const ended = await new Promise(r => { const t = setTimeout(() => r(false), 15000); exe.once('exit', () => { clearTimeout(t); r(true); }); });
    check('o .exe fecha normalmente', ended); if (!ended) kill(exe); await W(1500);
    exe = launchExe(exeData, 9353); pc = await connect(9353);
    check('o projeto continua lá', !!(await until(pc, `!projNone() && state.project.name === 'Romance do PC' && state.books[0].chapters[0].name === 'Escrito no PC'`, 30000)));
    check('a ligação ao telemóvel volta sozinha', !!(await until(pc, `syncState() === 'linked'`, 45000)));
    await phone.ev(`state.scenes = state.scenes; state.books[0].chapters[0].name = 'Depois de reabrir'; commit(); flushSave(); 1`);
    check('e a sincronização continua', !!(await until(pc, `state.books[0].chapters[0].name === 'Depois de reabrir'`, 25000)));

    console.log('Sem internet');
    const swInfo = await pc.ev(`navigator.serviceWorker.getRegistration().then(r => JSON.stringify({ctrl:!!navigator.serviceWorker.controller, active:!!(r && r.active)}))`);
    console.log('    (service worker: ' + swInfo + ')');
    await pc.ev(`Projects.leaving = true; 1`);
    await pc.send('Network.enable'); await pc.send('Network.emulateNetworkConditions', {offline:true, latency:0, downloadThroughput:-1, uploadThroughput:-1});
    await pc.send('Page.reload'); await W(3000);
    const okOff = !!(await until(pc, `typeof Projects === 'object' && state.project.name === 'Romance do PC'`, 20000));
    if (!okOff) console.log('    (página: ' + await pc.ev('location.href + " | " + document.title').catch(e => e.message) + ')');
    check('o .exe abre sem internet, com o projeto', okOff);
    await pc.send('Network.emulateNetworkConditions', {offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1});
  } catch (e) { check('o teste correu até ao fim', false, e.message); }
  finally {
    try { pc && pc.close(); phone && phone.close(); } catch (e) {}
    procs.forEach(kill); await W(2000);
    for (const d of dirs){ try { fs.rmSync(d, {recursive:true, force:true, maxRetries:20, retryDelay:500}); } catch (e) {} }
    server.close();
    const bad = R.filter(r => !r.ok).length; console.log(`${R.length - bad}/${R.length} verificações`); process.exit(bad ? 1 : 0);
  }
})();

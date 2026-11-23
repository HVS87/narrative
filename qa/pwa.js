/* Verifica a ferramenta como app instalável (PWA), no PC e num telemóvel simulado, comandando o Chrome por dentro (DevTools Protocol).
   Uso:  node qa/pwa.js            verificações
         node qa/pwa.js --shots    também gera as capturas do ecrã de instalação (icons/screenshot-*.png)
   Serve o projeto numa porta própria e usa um perfil descartável: não toca em dados reais. */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 5198, DBG = 9339, BASE = `http://localhost:${PORT}/`;
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json',
  '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let published = null; // outra versão «publicada» no site a meio do teste (conteúdo de js/version.js)
const server = http.createServer((req, res) => {
  if (published && new URL(req.url, 'http://x').pathname === '/js/version.js'){ res.writeHead(200, {'Content-Type':types['.js']}); return res.end(published); }
  let p = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(root)){ res.writeHead(403); return res.end(); }
  if (p === root || p.endsWith(path.sep)) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => { if (err){ res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type':types[path.extname(p)] || 'application/octet-stream'}); res.end(data); });
});
const PF = process.env['ProgramFiles'] || '', PF86 = process.env['ProgramFiles(x86)'] || '', LA = process.env['LOCALAPPDATA'] || '';
const exe = [path.join(PF, 'Google/Chrome/Application/chrome.exe'), path.join(PF86, 'Google/Chrome/Application/chrome.exe'), path.join(LA, 'Google/Chrome/Application/chrome.exe'),
  path.join(PF86, 'Microsoft/Edge/Application/msedge.exe'), path.join(PF, 'Microsoft/Edge/Application/msedge.exe')].find(f => fs.existsSync(f));
const W = ms => new Promise(r => setTimeout(r, ms));
/* o Chrome sem interface não abre janelas de app: simula-se a resposta do browser à pergunta «estou instalada?» */
const STANDALONE = "(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => q.replace(/ /g, '').includes('display-mode:standalone') ? {matches:true, media:q, onchange:null, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}} : mm(q); })();";

/* cliente mínimo do DevTools Protocol */
async function connect(){
  for (let i = 0; i < 50; i++){ try { const l = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json(); const pg = l.find(t => t.type === 'page'); if (pg) return open(pg.webSocketDebuggerUrl); } catch (e) {} await W(200); }
  throw new Error('o browser não respondeu');
}
function open(url){
  return new Promise((res, rej) => {
    const ws = new WebSocket(url); let id = 0; const wait = new Map(), on = [];
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)){ const [ok, ko] = wait.get(d.id); wait.delete(d.id); d.error ? ko(new Error(d.error.message)) : ok(d.result); } else on.forEach(f => f(d)); };
    ws.onerror = rej;
    ws.onopen = () => res({ send:(method, params) => new Promise((ok, ko) => { wait.set(++id, [ok, ko]); ws.send(JSON.stringify({id, method, params:params || {}})); }),
      on:f => on.push(f), close:() => ws.close() });
  });
}
const R = [];
const check = (name, ok, info) => { R.push({name, ok}); console.log((ok ? '  ✓ ' : '  ✗ ') + name + (info ? '  — ' + info : '')); };

(async () => {
  if (!exe){ console.log('Sem Chrome nem Edge instalado.'); process.exit(1); }
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'narrativa-qa-pwa-'));
  const child = spawn(exe, ['--headless=new', '--no-first-run', '--disable-gpu', `--remote-debugging-port=${DBG}`, '--user-data-dir=' + prof, 'about:blank'], {stdio:'ignore'});
  let c;
  try {
    c = await connect();
    const ev = expr => c.send('Runtime.evaluate', {expression:expr, awaitPromise:true, returnByValue:true}).then(r => r.result.value);
    const go = async url => { await c.send('Page.navigate', {url}); await W(1500); };
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
    console.log('App no PC (' + path.basename(exe) + ')');
    await go(BASE); await ev(`localStorage.setItem('narrativa.tourSeen','1'); localStorage.setItem('narrativa.privacySeen','1'); localStorage.setItem('narrativa.lang','pt')`); await go(BASE);
    const man = await c.send('Page.getAppManifest');
    check('manifesto lido sem erros', !man.errors.length, man.errors.map(e => e.message).join('; '));
    const mj = JSON.parse(man.data || '{}');
    check('nome, ícones 192 e 512 e ícone «maskable» (Android)', mj.name && ['192x192', '512x512'].every(s => mj.icons.some(i => i.sizes === s)) && mj.icons.some(i => /maskable/.test(i.purpose || '')));
    for (const ic of [...mj.icons, ...(mj.screenshots || [])]){ const r = await fetch(new URL(ic.src, BASE)); check('existe ' + ic.src, r.ok); }
    // o service worker precisa de um instante para ficar ativo na primeira visita
    const swOk = await ev(`(async () => { for (let i = 0; i < 40; i++){ const r = await navigator.serviceWorker.getRegistration(); if (r && r.active) return true; await new Promise(x => setTimeout(x, 250)); } return false; })()`);
    check('service worker ativo', swOk);
    let inst = await c.send('Page.getInstallabilityErrors');
    check('instalável no PC (Chrome/Edge: «Instalar app»)', !inst.installabilityErrors.length, inst.installabilityErrors.map(e => e.errorId).join(', '));
    const tags = await ev(`[...document.querySelectorAll('meta[property^="og:"]')].reduce((o, m) => (o[m.getAttribute('property')] = m.content, o), {})`);
    check('etiquetas de partilha (título, descrição, imagem absoluta 1200×630)', tags['og:title'] && tags['og:description'] && /^https:\/\//.test(tags['og:image']) && tags['og:image:width'] === '1200');
    const apple = await ev(`(document.querySelector('link[rel="apple-touch-icon"]') || {}).href`);
    check('ícone para o ecrã principal do iPhone/iPad', apple && (await fetch(apple)).ok, apple);

    // sem internet: a app tem de abrir a partir da cache
    await c.send('Network.emulateNetworkConditions', {offline:true, latency:0, downloadThroughput:-1, uploadThroughput:-1});
    await go(BASE); const off = await ev(`!!document.querySelector('#board .book-head') && typeof state === 'object'`);
    check('abre sem ligação à internet', off);
    await c.send('Network.emulateNetworkConditions', {offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1});

    // janela instalada: o modo «standalone» tem de ser reconhecido
    const fake = await c.send('Page.addScriptToEvaluateOnNewDocument', {source:STANDALONE});
    await go(BASE);
    const std = await ev(`isInstalledApp() && (setTab('settings'), !!document.querySelector('[data-install="installed"]'))`);
    check('modo instalado reconhecido (Definições: «Está a usar a app instalada»; simulado)', std);
    await c.send('Page.removeScriptToEvaluateOnNewDocument', {identifier:fake.identifier});

    console.log('Atualização automática da app instalada');
    await c.send('Emulation.setEmulatedMedia', {features:[]});
    await go(BASE); await W(1500);
    const v0 = await ev('APP_RELEASE.version'), cache0 = await ev('caches.keys().then(k => k.join(","))');
    check('a versão instalada tem a sua cache', cache0.includes('narrativa-app-' + v0), cache0);
    const vNew = v0.split('.').map((x, i) => i === 2 ? +x + 1 : x).join('.');
    published = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8').replace('"version":"' + v0 + '"', '"version":"' + vNew + '"');
    await ev('Upd.lastInput = 0; updCheck(false); 1');
    let vNow = v0; for (let i = 0; i < 60 && vNow === v0; i++){ await W(500); try { vNow = await ev('typeof APP_RELEASE === "object" ? APP_RELEASE.version : "?"'); } catch (e) {} }
    check('publicada uma versão nova, a app encontra-a, descarrega-a e recarrega sozinha', vNow === vNew, v0 + ' → ' + vNow);
    await W(800);
    const cache1 = await ev('caches.keys().then(k => k.join(","))');
    check('a versão nova fica guardada para uso sem internet e a antiga é apagada', cache1.includes('narrativa-app-' + vNew) && !cache1.includes('narrativa-app-' + v0 + ','), cache1);
    check('avisa que foi atualizada', await ev('new Promise(r => setTimeout(() => r([...document.querySelectorAll(".toast")].some(t => t.textContent.includes("atualizada para a versão"))), 1200))'));
    published = null;

    console.log('App no telemóvel (Android simulado)');
    await c.send('Emulation.setDeviceMetricsOverride', {width:412, height:915, deviceScaleFactor:2.6, mobile:true});
    await c.send('Emulation.setTouchEmulationEnabled', {enabled:true, maxTouchPoints:5});
    await c.send('Emulation.setUserAgentOverride', {userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', platform:'Android'});
    await go(BASE);
    inst = await c.send('Page.getInstallabilityErrors');
    check('instalável no telemóvel (Chrome Android: «Instalar app»)', !inst.installabilityErrors.length, inst.installabilityErrors.map(e => e.errorId).join(', '));
    const mob = await ev(`({coarse:coarse(), gut:B.GUT, wide:document.documentElement.scrollWidth <= innerWidth, dual:document.querySelector('#dualBtn').hidden})`);
    check('interface tátil: alvos grandes, coluna estreita, sem deslizar para o lado, sem «segundo ecrã»', mob.coarse && mob.gut === 104 && mob.wide && mob.dual, JSON.stringify(mob));
    // barra de baixo, Narrativa em Lista, Criar; Definições numa barra lateral (em «Mais»), fechada por omissão
    await ev(`(projNone() && newProject(), setTab('refs'), setTab('settings'), 1)`); await go(BASE);
    const nv0 = await ev(`(() => { const n = document.querySelector('#bnav'), r = n.getBoundingClientRect(), fab = document.querySelector('#createFab').getBoundingClientRect();
      return {nav:document.body.dataset.nav, items:[...n.querySelectorAll('.nav-item')].map(b => b.textContent).join(','), bottom:Math.round(r.bottom) === innerHeight, big:[...n.querySelectorAll('.nav-item')].every(b => b.getBoundingClientRect().height >= 48),
        closed:!document.querySelector('#setDrawer').classList.contains('open') && activeTab !== 'settings', list:!document.querySelector('#narrList').hidden, fab:fab.width >= 48 && fab.bottom <= r.top, more:!!document.querySelector('#moreBtn').offsetParent}; })()`);
    check('telemóvel: cinco destinos em baixo (alvos grandes), Narrativa em Lista, botão Criar por cima da barra, Definições fechadas',
      nv0.nav === 'bottom' && nv0.items === 'Narrativa,Plano,Elementos,Referências,Mais' && nv0.bottom && nv0.big && nv0.closed && nv0.list && nv0.fab && nv0.more, JSON.stringify(nv0));
    const nv1 = await ev(`(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); document.querySelector('#createFab').click(); await W(300);
      const sh = document.querySelector('.modal.sheet'), r = sh.getBoundingClientRect(), items = [...sh.querySelectorAll('.create-grid button')];
      const out = {first:items[0].textContent, n:items.length, docked:Math.round(r.bottom) >= innerHeight - 1 && r.width >= innerWidth - 1, big:items.every(b => b.getBoundingClientRect().height >= 48)}; closeAllModals(); return out; })()`);
    check('o botão Criar abre a folha com nove opções, a Nota primeiro, encostada ao fundo', nv1.first === 'Nota' && nv1.n === 9 && nv1.docked && nv1.big, JSON.stringify(nv1));
    const dr1 = await ev(`(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); setTab('plan'); document.querySelector('#bnav .nav-item[data-tab="more"]').click(); await W(300);
      const row = [...document.querySelectorAll('.sheet-row')].find(x => x.textContent === 'Definições do Projeto'); row.click(); await W(400);
      const d = document.querySelector('#setDrawer'), r = d.getBoundingClientRect(), first = d.querySelector('.drawer-body .settings > .card');
      return {open:d.classList.contains('open'), inView:r.left >= 0 && r.right <= innerWidth + 1 && r.width >= innerWidth * 0.8, under:!document.querySelector('#view-page').hidden && document.querySelector('#view-page h1').textContent,
        install:first.classList.contains('install-card') && first.textContent.startsWith('Instalar como app'), wide:document.documentElement.scrollWidth <= innerWidth, noDup:document.querySelectorAll('.settings').length === 1}; })()`);
    check('«Mais» › Definições abre a barra por cima da área atual, com «Instalar como app» em primeiro lugar', dr1.open && dr1.inView && dr1.under === 'Calendarização e Objetivos' && dr1.install && dr1.wide && dr1.noDup, JSON.stringify(dr1));
    const dr2 = await ev(`(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); let asked = 0;
      Install.prompt = {prompt(){ asked++; }, userChoice:Promise.resolve({outcome:'accepted'})}; renderAll(); const b = [...document.querySelectorAll('#setDrawer .install-card button')].find(x => x.textContent === 'Instalar'); b && b.click(); await W(50);
      return {button:!!b, asked, stillOpen:document.querySelector('#setDrawer').classList.contains('open')}; })()`);
    check('na barra, «Instalar» pede ao browser para instalar a app', dr2.button && dr2.asked === 1 && dr2.stillOpen, JSON.stringify(dr2));
    const dr3 = await ev(`(async () => { const W = ms => new Promise(r => setTimeout(r, ms)), d = document.querySelector('#setDrawer'), open = () => d.classList.contains('open'), out = {};
      document.querySelector('.drawer-head .icon-btn').click(); await W(30); out.x = !open() && activeTab === 'plan';
      setTab('settings'); document.querySelector('#setBack').click(); await W(30); out.back = !open();
      setTab('settings'); document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); await W(30); out.esc = !open();
      setTab('settings'); document.querySelector('#bnav .nav-item[data-tab="board"]').click(); await W(30); out.nav = !open() && activeTab === 'board';
      await W(400); out.empty = !d.querySelector('.drawer-body').children.length; return out; })()`);
    check('fecha-se com ✕, tocando ao lado, com Esc ou escolhendo outra área em baixo', Object.values(dr3).every(Boolean), JSON.stringify(dr3));
    await ev(`(setTab('settings'), 1)`);
    await c.send('Emulation.setDeviceMetricsOverride', {width:915, height:412, deviceScaleFactor:2.6, mobile:true}); await W(300);
    const dr4 = await ev(`({open:document.querySelector('#setDrawer').classList.contains('open'), wide:document.documentElement.scrollWidth <= innerWidth, nav:document.body.dataset.nav,
      rail:[...document.querySelectorAll('#rail .nav-item')].length, name:document.querySelector('#projName').offsetWidth > 40})`);
    await c.send('Emulation.setDeviceMetricsOverride', {width:1280, height:800, deviceScaleFactor:1, mobile:false}); await W(300);
    const dr5 = await ev(`({page:!document.querySelector('#view-page').hidden && !!document.querySelector('#view-page .settings'), drawer:getComputedStyle(document.querySelector('#setDrawer')).display,
      nav:document.body.dataset.nav, rail:[...document.querySelectorAll('#rail .nav-item')].length, gear:document.querySelector('#setBtn').classList.contains('on')})`);
    check('deitado: continua a barra, cinco destinos à esquerda e o nome à vista; ecrã largo: Definições na página, oito áreas, roda dentada assinalada',
      dr4.open && dr4.wide && dr4.nav === 'compact' && dr4.rail === 5 && dr4.name && dr5.page && dr5.drawer === 'none' && dr5.nav === 'rail' && dr5.rail === 8 && dr5.gear, JSON.stringify([dr4, dr5]));
    // PC: a barra de topo numa só linha, com o nome do projeto inteiro
    const nm0 = await ev(`(window.__nm0 = state.project.name, state.project.name = 'O Segredo da Casa do Rio', renderAll(), 1)`), fitR = [];
    for (const w of [1024, 1280, 1600, 1920, 2400]){
      await c.send('Emulation.setDeviceMetricsOverride', {width:w, height:900, deviceScaleFactor:1, mobile:false}); await W(200);
      fitR.push(await ev(`(() => { const n = document.querySelector('#projName'), tb = document.querySelector('#topbar'); return {w:innerWidth, cut:n.scrollWidth - n.clientWidth, h:Math.round(tb.getBoundingClientRect().height), over:tb.scrollWidth > tb.clientWidth}; })()`));
    }
    await ev(`(state.project.name = window.__nm0, renderAll(), 1)`);
    check('PC: a barra de topo tem uma só linha e o nome do projeto nunca fica cortado', nm0 && fitR.every(r => r.cut <= 1 && !r.over && r.h <= 64), JSON.stringify(fitR));
    await c.send('Emulation.setDeviceMetricsOverride', {width:412, height:915, deviceScaleFactor:2.6, mobile:true}); await ev(`(setTab('board'), 1)`);
    const fake2 = await c.send('Page.addScriptToEvaluateOnNewDocument', {source:STANDALONE});
    await go(BASE);
    check('modo instalado reconhecido no telemóvel', await ev(`isInstalledApp() && document.querySelector('#installBtn').hidden`));
    await c.send('Page.removeScriptToEvaluateOnNewDocument', {identifier:fake2.identifier});

    if (process.argv.includes('--shots')){
      console.log('Capturas para o ecrã de instalação');
      const shot = async (file, w, hh, mobile, dpr) => {
        await c.send('Emulation.setDeviceMetricsOverride', {width:w, height:hh, deviceScaleFactor:dpr, mobile});
        await c.send('Emulation.setTouchEmulationEnabled', mobile ? {enabled:true, maxTouchPoints:5} : {enabled:false});
        await go(BASE);
        await ev(`(() => { closeAllModals(); tourMode = true; state = demoProject(); applyPalette(); activeTab = 'board'; renderAll(); for (const k in target){ cur[k] = {...target[k]}; applyPos(k, cur[k]); } drawLines(); document.querySelectorAll('.toast,#orientHint').forEach(e => e.hidden = true); return 1; })()`);
        await W(600);
        const img = await c.send('Page.captureScreenshot', {format:'png'}); fs.writeFileSync(path.join(root, 'icons', file), Buffer.from(img.data, 'base64'));
        console.log('  ' + file + ' (' + Math.round(fs.statSync(path.join(root, 'icons', file)).size / 1024) + ' KB)');
      };
      await c.send('Emulation.setUserAgentOverride', {userAgent:''});
      await shot('screenshot-wide.png', 1280, 800, false, 1);
      await c.send('Emulation.setUserAgentOverride', {userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
      await shot('screenshot-narrow.png', 540, 1170, true, 1);
    }
  } catch (e) { check('a verificação correu até ao fim', false, e.message); }
  finally {
    try { c && c.close(); } catch (e) {}
    try { execSync(`taskkill /PID ${child.pid} /T /F`, {stdio:'ignore'}); } catch (e) {}
    await W(1200); try { fs.rmSync(prof, {recursive:true, force:true, maxRetries:20, retryDelay:500}); } catch (e) {}
    server.close();
    const bad = R.filter(r => !r.ok).length; console.log(`${R.length - bad}/${R.length} verificações`); process.exit(bad ? 1 : 0);
  }
})();

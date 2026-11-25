'use strict';
/* ===== Visitas guiadas (a principal e a detalhada): correm sobre um projeto de demonstração, nunca tocam nos dados reais ===== */
const Tour = { active:false, i:0, token:0, saved:null, poll:null, steps:null, paused:null, exploreId:null, back:null };
/* tudo o que um Tomo ou um Capítulo leva consigo ao ser arrastado (para as simulações) */
const tourKeys = (kind, id) => { const out = [kind[0] + ':' + id]; if (kind === 'book') bookById(id).chapters.forEach(c => { out.push('c:' + c.id); c.scenes.forEach(s => out.push('s:' + s)); }); else findChapter(id).chapter.scenes.forEach(s => out.push('s:' + s)); return out; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const scrollBoard = x => { const sc = $('#board-scroll'); sc.scrollLeft = x === 'end' ? sc.scrollWidth : x; sc.scrollTop = 0; };

async function simStruct(tk, mut, lift){
  await sleep(800); if (tk !== Tour.token) return;
  const st = structFromState(); mut(st);
  lift.forEach((k, i) => els[k] && els[k].forEach(e => e.classList.add(i === 0 ? 'lifted' : 'riding')));
  setTargets(computeLayout(st), st);
  await sleep(2400); if (tk !== Tour.token) return;
  renderBoard();
}
async function simLink(tk, from, to){
  await sleep(800); if (tk !== Tour.token) return;
  const a = cur['s:' + from], b = cur['s:' + to]; if (!a || !b) return;
  const x0 = a.x + B.SW, y0 = a.y + B.SH / 2 + 10, x1 = b.x + B.SW / 2, y1 = b.y + B.SH / 2;
  linkDrag = { from, fake:true, x:x0, y:y0 }; kick();
  const t0 = performance.now();
  while (performance.now() - t0 < 1300){
    if (tk !== Tour.token) return;
    const p = Math.min(1, (performance.now() - t0) / 1200), e = p * p * (3 - 2 * p);
    linkDrag.x = x0 + (x1 - x0) * e; linkDrag.y = y0 + (y1 - y0) * e; await sleep(16);
  }
  els['s:' + to] && els['s:' + to][0].classList.add('link-target');
  await sleep(1300); if (tk !== Tour.token) return;
  linkDrag = null; renderBoard();
}

const TOUR_STEPS = [
  { title:_('Bem-vindo ao Narrative'),
    text:_('Esta visita usa um projeto de demonstração — um livro com dois Tomos, doze Capítulos, vinte Personagens e quinze Localizações: tudo o que vê é simulado e nada é registado ou alterado nos seus dados. Em qualquer passo, «Explorar o projeto» deixa-o mexer nesse livro à vontade, com a visita em pausa, à espera. Pode terminar a qualquer momento com «Terminar visita» ou com a tecla Esc.') },
  { sel:'#projBtn', title:_('Projetos'),
    text:_('O nome do projeto, na barra de topo, abre a lista dos projetos abertos: pode ter vários e alternar entre eles. Na mesma lista cria um Novo Projeto, abre um projeto guardado num ficheiro (Abrir Projeto), grava o atual num ficheiro (Guardar Projeto) ou fecha-o. Sem projetos abertos, aparece a página inicial.') },
  { sel:'#rail', title:_('Áreas e Criar'), when:() => navMode() !== 'bottom',
    text:_('À esquerda estão as áreas da ferramenta: a Narrativa (o quadro), o Plano (Calendarização e Objetivos), os Tomos e Capítulos, os Arcos Narrativos, as Personagens e as Localizações, as Referências e os Materiais de Apoio. O botão Criar, no topo, cria o que precisar a partir de qualquer área: uma Cena, um Capítulo, um Tomo, um Arco Narrativo, uma Personagem, uma Localização, uma Nota, uma Referência ou um objetivo de pesquisa.') },
  { sel:'#bnav', title:_('Áreas e Criar'), when:() => navMode() === 'bottom',
    text:_('Em baixo estão as áreas: a Narrativa, o Plano (Calendarização e Objetivos), os Elementos (Tomos e Capítulos, Arcos Narrativos, Personagens e Localizações), as Referências e Mais (Materiais de Apoio, Definições e as visitas). O botão redondo, no canto, cria uma Nota, uma Cena ou qualquer outra coisa.') },
  { sel:'.book-head[data-book="b1"]', title:_('Tomos'),
    text:_('Tal como os dias num calendário, cada Tomo é uma coluna. Clique no nome para o alterar, em ⓘ para abrir a ficha do Tomo e em + para lhe acrescentar um Capítulo. A largura adapta-se ao conteúdo.') },
  { sel:'.add-book', setup:() => scrollBoard('end'), title:_('Novo Tomo'), text:_('O pequeno botão «+» no fim da linha de cabeçalhos acrescenta um novo Tomo.') },
  { sel:'.book-head[data-book="b2"]', title:_('Reordenar Tomos'),
    text:_('Um clique longo no cabeçalho permite arrastar o Tomo. Os Tomos vizinhos afastam-se para lhe abrir espaço, e ele leva consigo todos os Capítulos e Cenas. Ao largar, fica feito — e uma barra, em baixo, oferece «Anular».'),
    sim:tk => simStruct(tk, st => st.unshift(st.pop()), tourKeys('book', 'b2')) },
  { sel:'.ch-head[data-chapter="c2"]', title:_('Capítulos'),
    text:_('Os Capítulos são blocos arredondados, numerados automaticamente dentro do Tomo. Com um clique longo pode mudá-los de ordem ou até de Tomo — a numeração e a largura dos Tomos ajustam-se sozinhas.'),
    sim:tk => simStruct(tk, st => { const c = st[0].chapters.splice(1, 1)[0]; st[0].chapters.splice(3, 0, c); }, tourKeys('chapter', 'c2')) },
  { sel:'#board-scroll', title:_('Quadro no telemóvel'), when:() => navMode() !== 'rail',
    text:_('Afaste dois dedos sobre o quadro para o ampliar e aproxime-os para ver a narrativa de mais longe. Ao deslocar o quadro para o lado, o número e o nome do Tomo e do Capítulo em que está vão consigo, encostados à esquerda. As cores claras ou escuras seguem as do aparelho.') },
  { sel:'.scene[data-scene="s2"]', title:_('Cenas'),
    text:_('A Cena é a unidade base. A linha branca liga todas as Cenas pela Ordem Narrativa — una e ininterrupta. As linhas coloridas ligam as Cenas de cada Arco Narrativo pela sua Ordem Cronológica (a tracejado quando a cronologia recua). Clique numa Cena para abrir a ficha.') },
  { sel:'.scene[data-scene="s12"] .scene-st', title:_('Estado de cada Cena'),
    text:_('O círculo no canto de cada Cena mostra o estado: por escrever, escrita (um visto) ou revista (dois vistos). Um clique avança. Duas linhas verticais — «A escrita vai aqui» e «A revisão vai aqui» — marcam o ponto do livro em que vai, e um relógio vermelho assinala um prazo em atraso. Ao parar o rato numa Cena, vê o resumo, quem lá está e onde.') },
  { sel:'#boardBar', title:_('Filtros e vistas'),
    text:_('«Filtrar» destaca as Cenas de uma Personagem, de um POV, de uma Localização ou com um certo estado; as outras esbatem-se, sem sair do lugar. O visto de cada Arco Narrativo, à esquerda, recolhe a sua faixa. No PC, há três vistas — Quadro, Compacta (as Cenas reduzidas a etiquetas) e Lista — e, no canto de baixo do quadro, a ampliação (− 100 % +, «Ajustar») e um mini-mapa da narrativa inteira. Para percorrer o quadro com o rato, prima e arraste um espaço vazio.') },
  { sel:'#gutter', title:_('Arcos Narrativos e Ramos'),
    text:_('Cada Arco Narrativo ocupa uma faixa horizontal exclusiva, com cor atribuída automaticamente. Os Ramos (divergências) ficam nas faixas imediatamente abaixo do Arco Narrativo de onde partem.') },
  { sel:'.scene[data-scene="s3"]', title:_('Mover Cenas'),
    text:_('Clique longo e arraste: a Cena eleva-se, as vizinhas abrem espaço e os Capítulos e Tomos ajustam o tamanho. A Cena mantém-se sempre na faixa do seu Arco Narrativo e a linha branca é redesenhada.'),
    sim:tk => simStruct(tk, st => { st[0].chapters[0].scenes.pop(); st[0].chapters[1].scenes.splice(1, 0, 's3'); }, ['s:s3']) },
  { sel:'.ghost-scene', title:_('Criar Cenas'), when:() => !coarse(), setup:() => quickDemo(),
    text:_('Passe o rato por um espaço vazio de um Capítulo: aparece «+ Cena» na faixa do Arco Narrativo onde está o rato. Um clique cria-a ali e fica logo a escrever o título — Enter confirma, Esc desiste. Entre duas Cenas do mesmo Arco Narrativo aparece um «+», para inserir no meio. O botão direito continua a abrir o menu: nova Cena, novo Ramo ou outro Arco Narrativo.') },
  { sel:'.ctx-menu', title:_('Criar Cenas com um toque longo'), when:() => coarse(),
    text:_('Toque longo numa Cena (ou entre Cenas): cria uma nova Cena no mesmo Arco Narrativo, ou num novo Ramo. Num espaço vazio de um Capítulo: «Criar nova Cena», escolhendo ou criando o Arco Narrativo. Com o rato, o mesmo menu abre-se com o botão direito.'),
    setup:() => { const r = $('.scene[data-scene="s2"]').getBoundingClientRect();
      showMenu(r.right - 30, r.bottom - 10, [{label:_('Criar nova Cena aqui')}, {label:_('Criar nova Cena num novo Ramo')}, '-', {label:_('Abrir ficha da Cena')}, {label:_('Eliminar Cena')}]); } },
  { sel:'.scene[data-scene="s7"]', setup:() => scrollBoard('end'), title:_('Convergências'),
    text:_('A última Cena de cada Arco Narrativo tem uma pequena bola na margem direita: arraste-a até uma Cena de outro Arco Narrativo — em qualquer Capítulo ou Tomo — e o Arco Narrativo passa a convergir nela, após confirmação. Também funciona com um clique longo do botão direito. Em alternativa, escolha «Criar convergência…» no menu da Cena e indique a Cena de destino.'),
    sim:tk => simLink(tk, 's7', 's9') },
  { sel:'.modal', title:_('Ficha da Cena'), setup:() => openSceneFicha('s2'),
    text:_('Título, resumo, Arco Narrativo (nunca em branco), POV, Personagens, Localizações, posição na Ordem Narrativa e na Ordem Cronológica, o estado (por escrever, escrita, revista) com os prazos, e ainda Notas e Referências associadas. No topo, a fita do percurso mostra, como no quadro, a Cena anterior e a seguinte do livro (linha branca, Ordem Narrativa) e as do Arco Narrativo (linha da cor do Arco, Ordem Cronológica), com as bifurcações e as convergências desenhadas. Clique numa Cena da fita ou nas setas para lá ir, ou use ← e → (com Shift, pelo Arco). No PC, o botão ao lado do ✕ põe a ficha num painel à direita, com o quadro à vista. Num ecrã tátil, deslize o dedo para o lado para passar à Cena seguinte ou à anterior do livro.') },
  { sel:'.modal', title:_('Ficha do Tomo'), setup:() => openBookFicha('b1'),
    text:_('Nome, cor do Tomo (que o distingue no quadro e nas listas), tipo de narrador (com ligação aos Materiais de Apoio) e a lista automática de Personagens: primeiro as Personagens Principais, depois as Secundárias, com POV, género e idade. «Marcar como principal» só afeta este Tomo.') },
  { sel:'#view-page', tab:'plan', title:_('Calendarização e Objetivos'),
    text:_('No topo, os cartões «a seguir»: a próxima Cena a escrever e a rever, o próximo prazo e o próximo objetivo de pesquisa. Depois, três fases — Pesquisa e Planeamento, Escrita e Revisão — numa linha do tempo cujas pontas se arrastam, com percentagens de conclusão. Em «Escrita e Revisão» marcam-se as Cenas escritas e revistas, lado a lado (ou na ficha de cada Cena): os Capítulos e os Tomos completam-se sozinhos. Crie objetivos de pesquisa (livros, mapas, locais, entrevistas, podcasts…) com data e Referências, veja tudo num calendário — em mês ou em agenda — e exporte para o Google Calendar, o Apple Calendar ou o Outlook / Teams.') },
  { sel:'.el-tabs', tab:'books', title:_('Elementos'), when:() => navMode() !== 'rail',
    text:_('No telemóvel, «Elementos» junta os Tomos, os Capítulos, os Arcos Narrativos, as Personagens e as Localizações, cada um no seu separador, no topo da página. Tomos e Capítulos têm os mesmos filtros, por Personagem e por Arco Narrativo; todas as listas têm procura, ordenação e a escolha entre cartões e linhas. Toque num Tomo para abrir a ficha, ou num Capítulo para ir até ele no quadro.') },
  { sel:'#view-page', tab:'books', title:_('Separador Tomos e Capítulos'), when:() => navMode() === 'rail', text:_('Os Tomos e, por baixo, os seus Capítulos, com filtros por Personagem e por Arco Narrativo (pesquisa com sugestão automática). Todas as listas têm procura, ordenação e a escolha entre cartões e linhas; a tira em cada cartão mostra onde esse elemento aparece ao longo da narrativa. Clique num Tomo para abrir a ficha, ou num Capítulo para ir até ele no quadro.') },
  { sel:'.modal', tab:'arcs', title:_('Separador Arcos Narrativos'), setup:() => openArcFicha('a3'),
    text:_('A ficha de um Arco Narrativo mostra as suas Cenas por ordem, com um interruptor entre Ordem Narrativa e Ordem Cronológica (onde pode reordenar por arrasto). Um Ramo mostra também, noutro tom, as Cenas anteriores à divergência.') },
  { sel:'#view-page', tab:'characters', title:_('Separador Personagens'), text:_('Todas as Personagens, filtráveis por Tomo e por Principais / Secundárias, com as iniciais na cor do Arco Narrativo em que mais aparecem e a tira de presença na narrativa. Na ficha, pode editar atributos, Localizações, Notas e Referências. «Importar» copia Personagens de outro projeto aberto.') },
  { sel:'#view-page', tab:'sceneries', title:_('Separador Localizações'), text:_('Os lugares da história. Cada Localização associa-se a uma ou mais Cenas e a Personagens, e tem as suas próprias Notas e Referências. Tal como as Personagens, as Localizações são Principais — a casa da protagonista, o lugar onde decorre o grosso da ação — ou Secundárias; quando uma Localização já aparece em três Cenas, a ferramenta sugere marcá-la como principal. A lista filtra-se por Personagem e por Principais / Secundárias.') },
  { sel:'.modal', title:_('Notas'), setup:() => openRefFicha('r3'),
    text:_('Uma Nota é um texto curto — uma ideia, uma dúvida, uma pesquisa — que se associa a um ou mais Tomos, Cenas, Arcos Narrativos, Personagens ou Localizações, e aparece na ficha de cada um. Cria-se a partir de qualquer ficha (+ Criar Nota) ou no separador Referências.') },
  { sel:'#createFab', title:_('Criar num toque'), when:() => navMode() === 'bottom', setup:() => { $('#createFab').hidden = false; },
    text:_('No telemóvel, o botão redondo no canto abre o Criar: a Nota vem em primeiro lugar, para não perder uma ideia; a seguir, Cena, Capítulo, Tomo, Arco Narrativo, Personagem, Localização, Referência e objetivo de pesquisa.') },
  { sel:'#narrList', title:_('A Narrativa em Lista'), when:() => navMode() === 'bottom', setup:() => { Narr.tourList = true; renderAll(); },
    text:_('Com o telemóvel ao alto, a Narrativa abre em Lista: Tomos, Capítulos e Cenas pela Ordem Narrativa, com a cor do Arco Narrativo e o estado da escrita. Toque numa Cena para abrir a ficha, ou toque longo para mais opções. O botão Quadro, no topo, mostra o quadro — e rodar o telemóvel também.') },
  { sel:'#view-page', tab:'refs', title:_('Referências'), text:_('O repositório do projeto: Documents, Links, Audio, Video e Notas, guardados localmente. «+ Novo» cria uma Nota ou abre uma janela que também aceita ficheiros arrastados do ambiente de trabalho; «Importar» copia Referências de outro projeto aberto.') },
  { sel:'#view-page', tab:'support', title:_('Materiais de Apoio'), text:_('Fichas de consulta em onze secções — tipos de narrador, figuras de estilo, recursos estilísticos, estilos narrativos, recursos narrativos, técnicas, métodos, ortografia, pontuação, sintaxe e escrita antiga —, com exemplos, pesquisa e ligações entre fichas. Os tipos de narrador abrem-se também a partir da ficha de cada Tomo.') },
  { sel:'.settings', tab:'settings', title:_('Definições do Projeto'), text:_('A roda dentada, no canto superior direito (no telemóvel, em Mais), abre as Definições. Dê um nome ao projeto; guarde-o num ficheiro, abra outro ou feche-o; ligue o telemóvel ao PC; escolha ou gere paletas de cores (todas com contraste verificado); instale a ferramenta como app, que se atualiza sozinha; ligue ou desligue os explicadores; e repita as visitas quando quiser.') },
  { sel:'#searchBtn', title:_('Pesquisa e atalhos'),
    text:_('A pesquisa (tecla / ou Ctrl K) procura em todo o projeto — Cenas, Capítulos, Personagens, Localizações, Arcos Narrativos, Referências — e nos Materiais de Apoio, e aceita ações, como «nova personagem» ou «tema claro». A tecla ? mostra os atalhos de teclado e F1 procura só nos Materiais de Apoio.') },
  { sel:'.hist', title:_('Anular, refazer e gravação automática'),
    text:_('Mover não pede confirmação: fica feito e uma barra, em baixo, oferece «Anular». Eliminar pede sempre confirmação e, depois, a mesma barra ainda oferece «Anular». ↶ anula a última alteração e ↷ refaz o que anulou (Ctrl+Z e Ctrl+Shift+Z), até 100 passos — no telemóvel, estão no menu ⋮. Cada alteração fica gravada neste dispositivo no momento em que é feita — o indicador ao lado confirma-o — e está cá quando voltar a abrir a ferramenta. «Guardar Projeto» grava-o também num ficheiro; um ● junto ao nome do projeto indica alterações ainda por guardar em ficheiro.') },
  { sel:'#tip', title:_('Explicadores'), when:() => !coarse(),
    setup:() => { const el = $('.scene[data-scene="s2"]'), r = el.getBoundingClientRect(); Tips.x = r.left + 20; Tips.y = r.top + 30; showTip(tipFor(el)); },
    text:_('Pare o rato sobre qualquer elemento — um botão, um campo, uma Cena — e aparece uma breve explicação do que faz. Podem desligar-se nas Definições do Projeto.') },
  { sel:'#dualBtn', title:_('Dois ecrãs'), when:() => !$('#dualBtn').hidden,
    text:_('O botão ⧉ abre uma segunda janela para pôr noutro ecrã. A partir daí, as fichas que abrir aqui aparecem lá: o quadro fica sempre à vista e a Cena mostrada fica assinalada. As duas janelas mantêm-se sincronizadas, e o que alterar numa pode ser anulado na outra.') },
  { sel:'.sync-card', tab:'settings', title:_('Telemóvel e PC sincronizados'), setup:() => { const c = $('.sync-card'); c && c.scrollIntoView({block:'center'}); },
    text:_('Ligue o telemóvel ao PC uma vez — um mostra um código de 6 caracteres e o outro escreve-o — e, sempre que a ferramenta estiver aberta nos dois, o projeto passa a ser o mesmo nos dois, incluindo os ficheiros das Referências. Os dados viajam cifrados.') },
  { title:_('Telemóvel e tablet'),
    text:_('Num ecrã tátil, um toque faz de clique e um toque longo faz de clique longo e de botão direito: toque longo e arraste para mover; toque longo e largue para abrir o menu. A ferramenta adapta-se à orientação do dispositivo e pode ser instalada como app — no ecrã principal — a partir das Definições do Projeto (ou do menu ⋮).') },
  { title:_('Fim da visita'), offerDeep:true, text:_('A demonstração vai desaparecer e o seu projeto volta, exatamente como estava. Comece por criar a primeira Cena com o botão Criar, ou dentro de um Capítulo, no quadro — ou, na página inicial, comece de um modelo de estrutura ou do exemplo. Quer conhecer cada funcionalidade em pormenor? A visita detalhada mostra o que ficou por ver. Boa escrita!') }
];

/* Visita detalhada: funcionalidade a funcionalidade, para quem já fez a primeira */
const TOUR_DEEP = [
  { title:_('Visita detalhada'), text:_('Esta visita percorre cada funcionalidade em pormenor, também sobre o projeto de demonstração e sem alterar nada nos seus dados. Use as setas do teclado (ou «Seguinte») para avançar e Esc para terminar.') },
  { sel:'.modal', title:_('Ficha da Cena: quem e onde'), setup:() => openSceneFicha('s2'),
    text:_('O Arco Narrativo é obrigatório (mudá-lo leva a Cena para a faixa desse Arco Narrativo). O POV é a Personagem pelo olhar de quem a Cena é contada; as Personagens e as Localizações escolhem-se com sugestão automática — e, se o nome não existir, cria-se ali mesmo. O título e o resumo gravam-se enquanto escreve.') },
  { sel:'.modal', title:_('Ficha ao lado e em duas colunas'), when:() => !coarse(), setup:() => openSceneFicha('s2'),
    text:_('No PC, numa janela larga, a ficha tem duas colunas: à esquerda o que se escreve, à direita o progresso, as Notas e as Referências; cada secção abre e fecha e mostra quantos itens tem. O botão ao lado do ✕ passa a ficha para um painel à direita: o quadro continua à vista e utilizável, a Cena aberta fica assinalada e abrir outra Cena substitui a do painel. A escolha fica lembrada.') },
  { sel:'.posbox', title:_('Ficha da Cena: posição'), setup:() => { openSceneFicha('s5'); const p = $('.posbox'); p && p.scrollIntoView({block:'center'}); },
    text:_('A Ordem Narrativa é a posição da Cena no livro (Tomo › Capítulo › Cena); a Ordem Cronológica é a posição dentro do seu Arco Narrativo, que pode ser diferente — é assim que se escrevem analepses. Ambas se mudam aqui ou arrastando no quadro.') },
  { sel:'.ctx-menu', title:_('Ramos'), setup:() => { const r0 = $('.scene[data-scene="s2"]').getBoundingClientRect(); showMenu(r0.right - 30, r0.bottom - 10, [{label:_('Criar nova Cena aqui')}, {label:_('Criar nova Cena num novo Ramo')}, '-', {label:_('Abrir ficha da Cena')}, {label:_('Criar convergência…')}]); },
    text:_('«Criar nova Cena num novo Ramo» faz o Arco Narrativo divergir a partir desta Cena: o Ramo tem faixa própria, logo abaixo, e herda as Cenas anteriores. «Criar convergência…» junta este Arco Narrativo a outro: toque depois na Cena de destino (útil num ecrã tátil, sem arrastar).') },
  { sel:'.modal', tab:'arcs', title:_('Ordem Cronológica'), setup:() => openArcFicha('a1'),
    text:_('Na ficha do Arco Narrativo, o interruptor alterna entre a Ordem Narrativa e a Ordem Cronológica. Na cronológica, um clique longo numa Cena permite arrastá-la para outra posição no tempo; no quadro, as linhas a tracejado mostram onde a cronologia recua.') },
  { sel:'.modal', tab:'characters', title:_('Ficha da Personagem'), setup:() => openCharFicha('ch1'),
    text:_('Nome, género, idade e descrição; os Tomos em que figura (principal ou secundária em cada um — «Marcar como principal» só afeta esse Tomo); as Localizações a que está associada e as das Cenas em que aparece; e as suas Notas e Referências.') },
  { sel:'.modal', tab:'sceneries', title:_('Ficha da Localização'), setup:() => openSceneryFicha('sc1'),
    text:_('Uma Localização reúne as Personagens que lhe estão associadas, as que aparecem nas suas Cenas, as Cenas que nela decorrem (com a posição de cada uma) e as Notas e Referências. Elimina-se sem afetar as Cenas.') },
  { sel:'.loc-seg', tab:'sceneries', title:_('Localizações principais e secundárias'),
    text:_('Marque como Localização Principal os lugares onde decorre o grosso da ação; os restantes ficam como secundários. A estrela aparece nas fichas das Cenas, e a lista filtra-se por umas e outras. Quando uma Localização por marcar já aparece em três Cenas, surge a sugestão de a tornar principal — na ficha, na lista e ao associá-la à terceira Cena; «Não, é secundária» encerra o assunto.') },
  { sel:'.imp-btn', tab:'characters', title:_('Importar de outro projeto'),
    text:_('«Importar» copia Personagens, Localizações e Referências de outro projeto que esteja aberto — útil numa série, ou num livro novo no mesmo mundo. Escolhe o que quer trazer; o que já existe com o mesmo nome vem assinalado. O outro projeto não é alterado e a importação anula-se de uma vez.') },
  { sel:'.modal', tab:'refs', title:_('Nova Referência'), setup:() => newRefDialog(),
    text:_('Documentos, Links, Audio, Video ou Notas. Os ficheiros — também arrastados do ambiente de trabalho para esta janela — ficam guardados neste dispositivo e seguem com o projeto ao guardá-lo em ficheiro ou ao sincronizar. Imagens, PDF, áudio e vídeo abrem-se na ficha.') },
  { sel:'#view-page .page-head', tab:'books', title:_('Filtros'),
    text:_('Em Tomos e Capítulos, Arcos Narrativos e Localizações, os filtros sugerem nomes enquanto escreve: escolha uma Personagem, por exemplo, para ver só os Tomos ou Arcos Narrativos em que aparece; o ✕ do filtro mostra tudo outra vez. Em Personagens filtra-se por Tomo e por Principais / Secundárias; em Referências, pelo tipo.') },
  { sel:'.modal', title:_('Tipo de narrador'), setup:() => openNarratorFicha('terceira-limitada'),
    text:_('Cada Tomo tem um tipo de narrador. A ficha de cada tipo, nos Materiais de Apoio, explica-o com exemplos; as fichas ligam-se umas às outras e a pesquisa dos Materiais de Apoio encontra-as por qualquer palavra.') },
  { sel:'.swatches', title:_('Cor do Tomo'), setup:() => openBookFicha('b2'),
    text:_('A cor distingue o Tomo no quadro (faixa no cabeçalho e fundo da coluna), no separador Tomos e nas listas das fichas. Há cores sugeridas, «sem cor» e qualquer outra, pelo seletor do sistema; o texto mantém-se legível em qualquer paleta.') },
  { sel:'.palettes', tab:'settings', title:_('Paletas de cores'), setup:() => { const p = $('.palettes'); p && p.scrollIntoView({block:'center'}); },
    text:_('As paletas mudam as cores de toda a ferramenta (escuras e claras). «Gerar novas paletas» propõe outras; o contraste do texto é verificado em todas, e as cores dos Arcos Narrativos ajustam-se para continuarem legíveis. Na página inicial, sem projetos abertos, o botão das cores, ao lado da língua, escolhe a paleta, que passa a ser também a dos projetos novos.') },
  { sel:'.proj-card', tab:'settings', title:_('Vários projetos'), setup:() => { const c = $('.proj-card'); c && c.scrollIntoView({block:'center'}); },
    text:_('«Abrir Projeto» acrescenta o projeto de um ficheiro aos que estão abertos (se já estiver aberto, pergunta se o substitui). «Fechar Projeto» pergunta se quer guardar quando há alterações por guardar; o projeto fechado fica nos «Projetos recentes» da página inicial, de onde se reabre. A ferramenta pode também perguntar antes de sair.') },
  { sel:'.sync-card', tab:'settings', title:_('Sincronização em pormenor'), setup:() => { const c = $('.sync-card'); c && c.scrollIntoView({block:'center'}); },
    text:_('Sincroniza-se o projeto que está aberto. Se os dois dispositivos tiverem projetos diferentes, a sincronização espera e aqui pode mudar para o mesmo projeto — ou recebê-lo do outro. Se os dois foram alterados enquanto estavam desligados, escolhe qual versão fica; a outra fica como cópia de segurança, que se pode repor.') },
  { sel:'.upd-card', tab:'settings', title:_('Atualizações'), setup:() => { const c = $('.upd-card'); c && c.scrollIntoView({block:'center'}); },
    text:_('A ferramenta procura versões novas sozinha e instala-as num momento em que não esteja a meio de nada, no PC, no telemóvel e no tablet — sem desinstalar nem voltar a instalar. Pode desligar a instalação automática e escolher o momento.') },
  { title:_('Teclado'), when:() => !coarse(),
    text:_('Esc fecha a janela de cima, cancela um arrasto ou uma convergência em curso e termina esta visita. Ctrl+Z anula e Ctrl+Shift+Z refaz. A tecla / (ou Ctrl K) abre a pesquisa, ? mostra todos os atalhos, F1 procura nos Materiais de Apoio, N cria uma Cena e 1 a 8 mudam de área; no quadro, + e − ampliam e reduzem. Enter confirma as janelas de nome. Tab percorre os botões e, nas amostras de cor, as setas mudam de cor. Na ficha de uma Cena, ← e → passam à Cena anterior e à seguinte (com Shift, pelo Arco Narrativo).') },
  { title:_('Ecrãs táteis'), text:_('Um toque faz de clique; um toque longo e arrastar move Cenas, Capítulos e Tomos; um toque longo sem arrastar abre o menu. Num telemóvel ao alto, a ferramenta sugere rodá-lo para ver mais do quadro; os nomes cortados aparecem inteiros no topo do menu do toque longo.') },
  { title:_('Fim da visita detalhada'), text:_('O seu projeto volta, exatamente como estava. As duas visitas estão sempre disponíveis no botão de ajuda (?) — no telemóvel, em Mais — e nas Definições do Projeto.') }
];

function startTour(kind, at){
  if (Tour.active) return;
  Tour.paused = null; tourPausedUI();
  flushSave(); closeAllModals(); closeMenu(); endPickLink();
  Tour.kind = kind === 'deep' ? 'deep' : 'basic';
  Tour.steps = (Tour.kind === 'deep' ? TOUR_DEEP : TOUR_STEPS).filter(s => !s.when || s.when()); // só os passos que fazem sentido neste dispositivo
  Tour.saved = { state, tab:activeTab };
  const demo = demoProject(); demo.project.palette = state.project.palette;
  tourMode = true; Tour.active = true; state = demo; Tour.i = Math.max(0, Math.min(Tour.steps.length - 1, at | 0));
  $('#tourBlock').hidden = false; $('#tourSpot').hidden = false; $('#tourPop').hidden = false;
  Tour.poll = setInterval(placeTour, 120); syncInert(); setSaveUI('demo');
  showTourStep();
}
function endTour(then){
  if (!Tour.active) return;
  Tour.token++; clearInterval(Tour.poll); linkDrag = null;
  closeAllModals(); closeMenu();
  state = Tour.saved.state; activeTab = Tour.saved.tab; Tour.saved = null;
  tourMode = false; Tour.active = false; Narr.tourList = false; hideHover();
  if (typeof projKey === 'function' && LS_KEY !== (projActive() ? projKey(projActive()) : null)){ projActivate(projActive()); } // outra janela mudou de projeto durante a visita
  $('#tourBlock').hidden = true; $('#tourSpot').hidden = true; $('#tourPop').hidden = true;
  lsSet(LS_TOUR, '1'); syncInert(); hideTip(); setSaveUI('ok');
  applyPalette(); renderAll();
  if (then === 'deep') return startTour('deep');
  if (typeof syncLocalChanged === 'function') syncLocalChanged(); // o que outra janela mudou durante a visita segue agora para os dispositivos ligados
}
function showTourStep(){
  const step = Tour.steps[Tour.i]; const tk = ++Tour.token;
  linkDrag = null; closeAllModals(); closeMenu(); hideTip(); hideHover(); Narr.tourList = false;
  activeTab = step.tab || 'board'; renderAll();
  if (activeTab === 'board') scrollBoard(0);
  step.setup && step.setup();
  // em ecrãs estreitos o alvo pode ficar fora da vista (ou por baixo da coluna dos Story Arcs): o quadro desloca-se até ele
  const tgt = step.sel && document.querySelector(step.sel);
  if (tgt && tgt.closest('#headLayer,#bodyLayer') && !tgt.closest('.corner')){
    const sc = $('#board-scroll'), a = sc.getBoundingClientRect(), b = tgt.getBoundingClientRect(), w = Math.min(b.width, 200);
    if (b.left < a.left + B.GUT + 8 || b.left + w > a.right - 8) sc.scrollLeft += b.left - (a.left + B.GUT + 16);
  }
  const pop = $('#tourPop'); pop.innerHTML = '';
  const last = Tour.i === Tour.steps.length - 1;
  add(pop, h('h3', null, step.title), h('p', null, step.text),
    step.sim ? h('p', null, h('button', {class:'btn small', onclick:() => { Tour.token++; linkDrag = null; renderAll(); step.setup && step.setup(); step.sim(Tour.token); }}, _('↻ Repetir simulação'))) : null,
    h('div', {class:'foot'}, h('span', {class:'count'}, (Tour.i + 1) + ' / ' + Tour.steps.length),
      h('button', {class:'btn small', onclick:endTour}, _('Terminar visita')),
      last ? null : h('button', {class:'btn small tour-explore', onclick:tourExplore}, _('Explorar o projeto')),
      Tour.i > 0 ? h('button', {class:'btn small', onclick:() => { Tour.i--; showTourStep(); }}, _('Anterior')) : null,
      step.offerDeep ? h('button', {class:'btn small', onclick:() => endTour('deep')}, _('Fazer a visita detalhada')) : null,
      h('button', {class:'btn small primary', onclick:() => { if (last) endTour(); else { Tour.i++; showTourStep(); } }}, last ? _('Concluir') : _('Seguinte'))));
  pop.style.transition = 'none'; placeTour(); void pop.offsetHeight; pop.style.transition = ''; // o balão muda de tamanho: salta para o novo lugar em vez de deslizar para fora do ecrã
  step.sim && step.sim(tk);
}
/* «Explorar o projeto»: a visita fica em pausa, à espera, e o livro de demonstração abre como um projeto verdadeiro — pode
   mexer-se em tudo. «Continuar a visita» retoma no mesmo passo; o projeto de exemplo continua aberto (no menu do nome do projeto). */
function tourExplore(){
  if (!Tour.active) return;
  const keep = {kind:Tour.kind, i:Tour.i, n:Tour.steps.length};
  endTour(); Tour.back = projActive();
  const open = Tour.exploreId && Projects.idx.open.includes(Tour.exploreId);
  if (open) projSwitch(Tour.exploreId); else Tour.exploreId = projAdd(sanitize(demoProject()));
  if (!Tour.exploreId) return; // sem espaço para mais um projeto: a visita termina aqui
  activeTab = 'board'; renderAll(); Tour.paused = keep; tourPausedUI();
}
function tourResume(){
  const p = Tour.paused; if (!p) return; Tour.paused = null; tourPausedUI();
  if (Tour.back && Tour.back !== projActive() && Projects.idx.open.includes(Tour.back)) projSwitch(Tour.back);
  startTour(p.kind, p.i);
}
function tourPausedUI(){
  let el = $('#tourResume'); const p = Tour.paused;
  if (!p){ if (el) el.remove(); return; }
  if (!el){ el = h('div', {id:'tourResume', role:'status'}); document.body.append(el); }
  el.replaceChildren(h('span', {class:'tr-t'}, _('Visita em pausa · passo {n} de {total}', {n:p.i + 1, total:p.n})),
    h('button', {class:'btn small primary', dataset:{go:'back'}, onclick:tourResume}, _('Continuar a visita')),
    h('button', {class:'btn small', dataset:{go:'end'}, onclick:() => { Tour.paused = null; tourPausedUI(); }}, _('Terminar visita')));
}
function placeTour(){
  if (!Tour.active) return;
  const step = Tour.steps[Tour.i]; const spot = $('#tourSpot'), pop = $('#tourPop');
  const t0 = step.sel && document.querySelector(step.sel);
  const t = t0 && t0.getClientRects().length ? t0 : null; // um alvo escondido (neste ecrã) conta como ausente: o texto fica ao centro
  const pw = pop.offsetWidth, ph = pop.offsetHeight; let left, top;
  if (!t){
    Object.assign(spot.style, {left:(innerWidth / 2) + 'px', top:(innerHeight / 2) + 'px', width:'0px', height:'0px'});
    left = (innerWidth - pw) / 2; top = (innerHeight - ph) / 2;
  } else {
    const r = t.getBoundingClientRect(), pad = 6;
    const x0 = Math.max(0, r.left - pad), y0 = Math.max(0, r.top - pad), x1 = Math.min(innerWidth, r.right + pad), y1 = Math.min(innerHeight, r.bottom + pad);
    Object.assign(spot.style, {left:x0 + 'px', top:y0 + 'px', width:Math.max(0, x1 - x0) + 'px', height:Math.max(0, y1 - y0) + 'px'});
    left = Math.max(12, Math.min(x0, innerWidth - pw - 12));
    if (y1 + 14 + ph < innerHeight) top = y1 + 14;
    else if (y0 - 14 - ph > 0) top = y0 - 14 - ph;
    else { top = innerHeight - ph - 16; left = innerWidth - pw - 16; }
  }
  left = Math.max(8, Math.min(left, innerWidth - pw - 8)); top = Math.max(8, Math.min(top, innerHeight - ph - 8));
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
}
document.addEventListener('keydown', e => {
  if (!Tour.active) return;
  if (e.key === 'Escape') endTour();
  else if (e.key === 'ArrowRight' && Tour.i < Tour.steps.length - 1){ Tour.i++; showTourStep(); }
  else if (e.key === 'ArrowLeft' && Tour.i > 0){ Tour.i--; showTourStep(); }
});

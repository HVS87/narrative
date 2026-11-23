'use strict';
/* ===== Explicadores: uma breve explicação ao parar o rato sobre um elemento =====
   As explicações estão todas nesta tabela; a regra do elemento mais interior ganha. */
const LS_TIPS = 'narrativa.tips';
const Tips = { on:lsGet(LS_TIPS) !== '0', el:null, cur:null, timer:null, x:0, y:0, DELAY:550, touchT:0 };

const TAB_TIPS = {
  board:[_('Narrativa'), _('O quadro principal: Tomos em colunas, Capítulos e Cenas dispostos pela Ordem Narrativa, com uma faixa por Arco Narrativo.')],
  books:[_('Tomos'), _('Lista de todos os Tomos, com filtros por Personagem e por Arco Narrativo.')],
  characters:[_('Personagens'), _('Lista de todas as Personagens, com filtros por Tomo e por Principais / Secundárias.')],
  arcs:[_('Arcos Narrativos'), _('Lista de todos os Arcos Narrativos e Ramos, com filtro por Personagem.')],
  sceneries:[_('Cenários'), _('Lista dos lugares e cenários da história, com filtro por Personagem associado.')],
  plan:[_('Calendarização e Objetivos'), _('Prazos e progresso da Pesquisa e Planeamento, da Escrita e da Revisão; objetivos de pesquisa; calendário e exportação para o Google Calendar, o Apple Calendar e o Outlook / Teams.')],
  refs:[_('Referências'), _('O repositório do projeto: Documents, Links, Audio, Video e Notas, guardados localmente neste browser.')],
  support:[_('Materiais de Apoio'), _('Fichas de consulta: tipos de narrador, figuras de estilo, recursos estilísticos e narrativos, estilos narrativos, técnicas e métodos, ortografia, pontuação, sintaxe e escrita antiga.')],
  settings:[_('Definições do Projeto'), _('Nome do projeto, guardar, abrir e fechar projetos, sincronizar dispositivos, paletas de cores, guardar como app, atualizações, explicadores e visitas guiadas.')],
  elements:[_('Elementos'), _('Tomos, Arcos Narrativos, Personagens e Cenários, num seletor no topo da página.')],
  more:[_('Mais'), _('Materiais de Apoio, Definições do Projeto e as visitas guiadas.')] };
const CREATE_TIPS = {
  scene:[_('Nova Cena'), _('Escolha o título, o Capítulo e o Arco Narrativo. A Cena fica no fim do Capítulo; no quadro, pode depois arrastá-la.')],
  chapter:[_('Novo Capítulo'), _('Acrescenta um Capítulo no fim do Tomo que escolher.')],
  book:[_('Novo Tomo'), _('Acrescenta um Tomo no fim da sequência, já com um Capítulo, e abre a ficha para lhe dar nome.')],
  arc:[_('Novo Arco Narrativo'), _('Cria um Arco Narrativo com cor própria e uma faixa no quadro, e abre a sua ficha.')],
  character:[_('Nova Personagem'), _('Cria uma Personagem e abre a ficha, com o nome pronto a escrever.')],
  scenery:[_('Novo Cenário'), _('Cria um lugar ou cenário e abre a ficha, com o nome pronto a escrever.')],
  note:[_('Nova Nota'), _('Cria uma Nota e abre-a, pronta a escrever — para não perder uma ideia. Depois pode associá-la ao que quiser.')],
  ref:[_('Nova Referência'), _('Carrega ficheiros (também arrastando-os para a janela), adiciona um Link ou cria uma Nota.')],
  goal:[_('Novo objetivo de pesquisa'), _('Consultar um livro ou mapa, visitar um local, entrevistar alguém, ver um documentário, ouvir um podcast…')] };
/* as tabelas por texto usam o texto português como chave e são traduzidas aqui */
const trK = o => { const t = {}; for (const k in o) t[_(k)] = o[k]; return t; };
const MORE_TIPS = trK({ 'Abrir Projeto…':_('Abre um projeto guardado num ficheiro, como mais um projeto aberto.'), 'Anular':_('Desfaz a última alteração ao projeto (até 100 passos).'), 'Refazer':_('Repõe a alteração que acabou de anular.'), 'Instalar como app':_('Instala a ferramenta neste dispositivo: ícone próprio, ecrã inteiro e funcionamento sem internet.') });
const CARD_TIPS = {
  books:[_('Tomo'), _('Clique para abrir a ficha do Tomo: narrador, Personagens, Arcos Narrativos, Notas e Referências.')],
  characters:[_('Personagem'), _('Clique para abrir a ficha da Personagem: género, idade, descrição, Tomos em que figura, Cenários, Notas e Referências.')],
  arcs:[_('Arco Narrativo'), _('Clique para abrir a ficha do Arco Narrativo e ver as suas Cenas por Ordem Narrativa ou Cronológica.')],
  sceneries:[_('Cenário'), _('Clique para abrir a ficha do Cenário: nome, Personagens e Cenas associados, Notas e Referências.')],
  refs:[_('Referência'), _('Clique para abrir a Referência, editá-la e associá-la a Tomos, Cenas, Arcos Narrativos, Personagens ou Cenários.')],
  support:[_('Ficha de consulta'), _('Clique para ler a ficha completa: descrição, como usar, cuidados, exemplos e fichas relacionadas.')] };
/* por texto do botão / item de menu */
const TEXT_TIPS = trK({
  'Aplicar cores seguras para daltonismo':[_('Cores seguras para daltonismo'), _('Dá aos Arcos Narrativos deste projeto, pela ordem em que estão, cores que se distinguem com protanopia, deuteranopia e tritanopia. Pode ser anulado com Ctrl+Z.')],
  'Começar':[_('Começar'), _('Fecha este aviso. Fica sempre disponível no fim das Definições.')],
  '+ Arco Narrativo':[_('Novo Arco Narrativo'), _('Cria um Arco Narrativo vazio, com uma cor atribuída automaticamente e uma faixa própria no quadro.')],
  '+ Novo Tomo':[_('Novo Tomo'), _('Acrescenta um Tomo no fim da sequência, já com um Capítulo vazio.')],
  '+ Nova Personagem':[_('Nova Personagem'), _('Cria uma Personagem e abre a sua ficha. Para figurar num Tomo, adicione-a a uma Cena.')],
  'Fechar':[_('Fechar'), _('Fecha a janela (Esc). As alterações já estão guardadas.')],
  '+ Novo Cenário':[_('Novo Cenário'), _('Cria um Cenário — um lugar ou cenário — e abre a sua ficha.')],
  '+ Associar Cenário':[_('Associar Cenário'), _('Pesquise um Cenário existente para o ligar a esta ficha, ou escreva um nome novo para o criar.')],
  '+ Associar Personagem':[_('Associar Personagem'), _('Pesquise uma Personagem existente para a ligar a este Cenário, ou escreva um nome novo para o criar.')],
  '+ Associar Cena':[_('Associar Cena'), _('Pesquise uma Cena pelo título para a ligar a este Cenário.')],
  'Eliminar Cenário':[_('Eliminar Cenário'), _('Remove o Cenário de todas as Cenas e de todas as Personagens, depois de confirmar. Pode ser anulado com Ctrl+Z.')],
  '+ Novo Arco Narrativo':[_('Novo Arco Narrativo'), _('Cria um Arco Narrativo vazio, com uma cor atribuída automaticamente.')],
  '+ Nova Nota':[_('Nova Nota'), _('Cria uma Nota em branco no repositório de Referências.')],
  '+ Nova Referência':[_('Nova Referência'), _('Carrega ficheiros (também arrastando-os do ambiente de trabalho), adiciona um Link ou cria uma Nota.')],
  '+ Criar Nota':[_('Criar Nota'), _('Cria uma Nota já associada a esta ficha.')],
  '+ Associar Referência':[_('Associar Referência'), _('Liga a esta ficha uma Referência existente, ou cria uma nova.')],
  'Nova Referência…':[_('Nova Referência'), _('Cria uma Referência nova, já associada a esta ficha.')],
  '+ Nova Nota em branco':[_('Nova Nota'), _('Cria uma Nota em branco e abre-a para escrever.')],
  'Adicionar Link':[_('Adicionar Link'), _('Guarda o endereço como Referência do tipo Link.')],
  'Abrir ↗':[_('Abrir Link'), _('Abre o endereço num novo separador do browser.')],
  'Abrir':[_('Abrir ficheiro'), _('Abre o ficheiro guardado num novo separador.')],
  'Descarregar':[_('Descarregar'), _('Guarda no disco uma cópia do ficheiro.')],
  'Ver ficha ↗':[_('Ficha do narrador'), _('Abre, nos Materiais de Apoio, a ficha do tipo de narrador escolhido.')],
  'Marcar como principal':[_('Marcar como principal'), _('Marca esta Personagem como Personagem Principal neste Tomo. As Personagens Principais aparecem primeiro na lista.')],
  'Desmarcar principal':[_('Desmarcar principal'), _('A Personagem volta a ser Personagem Secundária neste Tomo.')],
  'Remover convergência':[_('Remover convergência'), _('Desfaz a ligação que faz este Arco Narrativo convergir noutro.')],
  'Criar convergência…':[_('Criar convergência'), _('Faz este Arco Narrativo convergir noutro: a seguir, escolha a Cena de destino. Só está disponível na última Cena do Arco Narrativo.')],
  'Mostrar código para ligar':[_('Ligar um dispositivo'), _('Mostra um código para escrever no outro dispositivo. Use-o, por exemplo, no PC, e escreva o código no telemóvel.')],
  'Introduzir código':[_('Introduzir código'), _('Escreva o código mostrado no outro dispositivo para os ligar.')],
  'Deixar de sincronizar':[_('Deixar de sincronizar'), _('Desfaz a ligação a este dispositivo. O projeto fica como está nos dois; para voltar a sincronizar, é preciso um novo código.')],
  'Escolher a versão':[_('Escolher a versão'), _('Os dois dispositivos foram alterados. Escolha qual versão fica nos dois; até lá, a sincronização está em pausa.')],
  'Manter a deste dispositivo':[_('Manter esta versão'), _('Esta versão passa a ser a dos dois dispositivos. A do outro fica guardada lá como cópia de segurança.')],
  'Repor a cópia de segurança':[_('Repor a cópia de segurança'), _('Volta à versão do projeto que foi substituída na última sincronização.')],
  'Procurar atualizações':[_('Procurar atualizações'), _('Pergunta já ao site se há uma versão nova. A ferramenta também o faz sozinha, de 30 em 30 minutos.')],
  'Atualizar agora':[_('Atualizar agora'), _('Recarrega a ferramenta com a versão nova. O projeto fica gravado e não é alterado.')],
  'Exportar calendário (.ics)':[_('Exportar calendário'), _('Cria um ficheiro .ics com todos os prazos e objetivos, para importar no Google Calendar, no Apple Calendar ou no Outlook / Teams.')],
  '+ Objetivo de pesquisa':[_('Novo objetivo de pesquisa'), _('Consultar um livro ou mapa, visitar um local, entrevistar alguém, ver um documentário, ouvir um podcast…')],
  'Eliminar objetivo':[_('Eliminar objetivo'), _('Apaga o objetivo. As Referências associadas mantêm-se.')],
  'Hoje':[_('Hoje'), _('Volta ao mês atual.')],
  'Ver o mês todo':[_('Ver o mês todo'), _('Volta a mostrar todos os eventos do mês.')],
  'Guardar Projeto':[_('Guardar Projeto'), _('Grava o projeto num ficheiro, com as Referências. No PC (Chrome e Edge), escolhe o sítio uma vez e as gravações seguintes vão para o mesmo ficheiro.')],
  'Abrir Projeto':[_('Abrir Projeto'), _('Abre um projeto guardado num ficheiro, como mais um projeto aberto, sem fechar os outros.')],
  'Novo Projeto':[_('Novo Projeto'), _('Cria um projeto em branco. Os outros continuam abertos.')],
  'Fechar Projeto':[_('Fechar Projeto'), _('Fecha este projeto. Se houver alterações por guardar, pergunta se as quer guardar — senão, perdem-se. Fica nos projetos recentes da página inicial.')],
  'Guardar e fechar':[_('Guardar e fechar'), _('Grava o projeto num ficheiro e fecha-o.')],
  'Fechar sem guardar':[_('Fechar sem guardar'), _('Fecha o projeto e perde as alterações feitas desde a última vez que o guardou (se nunca foi guardado, perde-se o projeto).')],
  'Reabrir':[_('Reabrir'), _('Volta a abrir este projeto.')],
  'Remover':[_('Remover'), _('Apaga este projeto deste dispositivo. Um ficheiro que tenha guardado continua a poder ser aberto.')],
  'Fazer a visita detalhada':[_('Visita detalhada'), _('Termina esta visita e começa a detalhada, funcionalidade a funcionalidade.')],
  'Visita detalhada':[_('Visita detalhada'), _('Uma visita mais longa, funcionalidade a funcionalidade.')],
  'Visita guiada':[_('Visita guiada'), _('Mostra as principais funcionalidades em poucos minutos.')],
  'Ver como instalar':[_('Instalar como app'), _('Mostra os passos para pôr a ferramenta no ecrã principal deste dispositivo.')],
  'Parar de seguir':[_('Parar de seguir'), _('Esta janela deixa de mostrar as fichas abertas na outra; as fichas voltam a abrir lá.')],
  'Seguir a outra janela':[_('Seguir a outra janela'), _('As fichas que abrir na outra janela passam a aparecer nesta.')],
  'Eliminar Cena':[_('Eliminar Cena'), _('Remove a Cena, depois de confirmar. Pode ser anulado com Ctrl+Z.')],
  'Eliminar Tomo':[_('Eliminar Tomo'), _('Remove o Tomo com os seus Capítulos e Cenas, depois de confirmar. Pode ser anulado com Ctrl+Z.')],
  'Eliminar Capítulo':[_('Eliminar Capítulo'), _('Remove o Capítulo e as suas Cenas, depois de confirmar. Pode ser anulado com Ctrl+Z.')],
  'Eliminar Personagem':[_('Eliminar Personagem'), _('Remove a Personagem das Cenas, dos Tomos e dos Cenários, depois de confirmar. Pode ser anulado com Ctrl+Z.')],
  'Eliminar Arco Narrativo':[_('Eliminar Arco Narrativo'), _('Só é possível eliminar um Arco Narrativo sem Cenas nem Ramos.')],
  'Eliminar':[_('Eliminar Referência'), _('Remove a Referência e as suas associações, depois de confirmar. Pode ser anulado com Ctrl+Z.')],
  '↻ Gerar novas paletas':[_('Gerar paletas'), _('Cria seis paletas novas, com cores escolhidas ao acaso, para experimentar.')],
  'Instalar':[_('Instalar como app'), _('Instala a ferramenta neste dispositivo: janela própria, ícone no sistema e funcionamento sem internet.')],
  'Criar nova Cena':[_('Criar nova Cena'), _('Cria uma Cena nesta posição; a seguir, pode escolher ou criar o Arco Narrativo a que pertence.')],
  'Criar nova Cena aqui':[_('Criar nova Cena aqui'), _('Cria uma Cena do mesmo Arco Narrativo, imediatamente a seguir a esta.')],
  'Criar nova Cena num novo Ramo':[_('Novo Ramo'), _('Cria um Ramo que diverge deste Arco Narrativo a partir da Cena anterior, numa faixa logo abaixo.')],
  'Criar nova Cena noutro Arco Narrativo…':[_('Noutro Arco Narrativo'), _('Cria a Cena nesta posição e deixa escolher ou criar outro Arco Narrativo.')],
  'Abrir ficha da Cena':[_('Ficha da Cena'), _('Título, resumo, Arco Narrativo, POV, Personagens, Cenários, posição, Notas e Referências.')],
  'Abrir ficha do Tomo':[_('Ficha do Tomo'), _('Nome, tipo de narrador, Personagens, Arcos Narrativos, Notas e Referências.')],
  'Renomear Capítulo':[_('Renomear Capítulo'), _('Edita o nome do Capítulo diretamente no cabeçalho.')],
  'Novo Capítulo':[_('Novo Capítulo'), _('Acrescenta um Capítulo vazio no fim deste Tomo.')],
  'Nova Cena neste Capítulo':[_('Nova Cena'), _('Cria uma Cena no fim deste Capítulo: escolha o título e o Arco Narrativo.')],
  'Mais opções':[_('Mais opções'), _('Cria a Cena e abre a ficha completa: resumo, POV, Personagens, Cenários, Notas e Referências.')],
  'Todos':[_('Todos'), _('Mostra as Personagens Principais e as secundárias.')],
  'Personagens Principais':[_('Personagens Principais'), _('Mostra só as Personagens marcadas como principais em pelo menos um Tomo.')],
  'Personagens Secundárias':[_('Personagens Secundárias'), _('Mostra só as Personagens que não são principais em nenhum Tomo.')] });
/* por etiqueta do campo */
const FIELD_TIPS = trK({
  'Arco Narrativo':[_('Arco Narrativo'), _('Uma Cena pertence sempre a um Arco Narrativo. Ao mudar, passa para o fim da Ordem Cronológica do novo Arco Narrativo.')],
  'Personagem POV':[_('Personagem POV'), _('A Personagem através de cujo ponto de vista a Cena é contada.')],
  'Personagens':[_('Personagens'), _('Quem figura nesta Cena. Escreva um nome para adicionar uma Personagem existente ou criar uma nova.')],
  'Cenários':[_('Cenários'), _('Os lugares onde decorre esta Cena. Uma Cena pode ter vários Cenários, e um Cenário várias Cenas.')],
  'Escolher um Cenário ou criar um novo':[_('Associar Cenário'), _('Escolha da lista, ou escreva um nome que ainda não exista e escolha «Criar».')],
  'Escolher uma Personagem ou criar uma nova':[_('Associar Personagem'), _('Escolha da lista, ou escreva um nome que ainda não exista e escolha «Criar».')],
  'Escolher uma Cena':[_('Associar Cena'), _('Pesquise pelo título da Cena.')],
  'Posição':[_('Posição'), _('A Ordem Narrativa (única, definida no quadro) e a Ordem Cronológica dentro do Arco Narrativo (várias Cenas podem partilhar a mesma posição).')],
  'Resumo':[_('Resumo'), _('O que acontece nesta Cena.')],
  'Título':[_('Título'), _('O nome curto por que esta ficha aparece nas listas e no quadro.')],
  'Nome':[_('Nome'), _('Pode ser alterado a qualquer momento e muda em todo o projeto. Não pode ficar vazio.')],
  'Idade':[_('Idade'), _('Texto livre: um número, um intervalo ou o que fizer sentido para a história.')],
  'Endereço':[_('Endereço'), _('O endereço da web deste Link; deve começar por http:// ou https://.')],
  'Pontos fortes':[_('Pontos fortes'), _('O que este tipo de narrador faz melhor.')],
  'Riscos':[_('Riscos'), _('As dificuldades típicas deste tipo de narrador.')],
  'Como usar':[_('Como usar'), _('Conselhos práticos para aplicar este recurso na escrita.')],
  'Cuidado':[_('Cuidado'), _('Os erros e excessos mais comuns.')],
  'Exemplos':[_('Exemplos'), _('Os exemplos sem autor são frases criadas para ilustrar o recurso.')],
  'Na ferramenta':[_('Na ferramenta'), _('Como aplicar este conceito no quadro e nas fichas do projeto.')],
  'Ver também':[_('Ver também'), _('Fichas relacionadas. Clique para abrir.')],
  'Texto':[_('Texto'), _('O conteúdo da Nota; fica guardado à medida que escreve.')],
  'Cor do Tomo':[_('Cor do Tomo'), _('Distingue o Tomo no quadro (faixa no cabeçalho e fundo da coluna), no separador Tomos e nas listas das fichas. É só decorativa: o texto mantém-se legível em qualquer paleta.')],
  'Tipo de narrador':[_('Tipo de narrador'), _('O narrador deste Tomo. A ficha de cada tipo está nos Materiais de Apoio.')],
  'Descrição':[_('Descrição'), _('Texto livre; fica guardado à medida que escreve.')],
  'Género':[_('Género'), _('M — Masculino, F — Feminino, N/D — Não Definido.')],
  'Instalar atualizações automaticamente':[_('Atualizações automáticas'), _('Ligado: as versões novas instalam-se sozinhas, num momento em que não esteja a meio de nada. Desligado: aparece «Atualizar» na barra de topo e escolhe quando.')],
  'Nome deste dispositivo':[_('Nome deste dispositivo'), _('Como este dispositivo aparece nos outros a que está ligado.')],
  'Nome do Projeto':[_('Nome do Projeto'), _('Aparece no topo da página e no nome do ficheiro exportado.')],
  'Escolher o Arco Narrativo':[_('Escolher o Arco Narrativo'), _('Pesquise pelo nome para associar a nova Cena a um Arco Narrativo existente.')],
  'Criar um novo Arco Narrativo':[_('Novo Arco Narrativo'), _('Dê um nome para criar um Arco Narrativo com cor automática e associá-lo à nova Cena.')],
  'Escolher uma Referência existente':[_('Associar Referência'), _('Pesquise pelo título de uma Referência para a ligar a esta ficha.')] });
const SEC_TIPS = trK({
  'Progresso':[_('Progresso'), _('Escrita e Revisão: marque quando estiverem concluídas e defina prazos. Tudo aparece em Calendarização e Objetivos.')],
  'Objetivos de pesquisa':[_('Objetivos de pesquisa'), _('O que é preciso pesquisar para esta parte: livros, mapas, locais, entrevistas, documentários, podcasts…')],
  'Notas':[_('Notas'), _('Apontamentos de texto associados a esta ficha.')],
  'Referências':[_('Referências'), _('Documents, Links, Audio e Video associados a esta ficha.')],
  'Personagens':[_('Personagens'), _('Lista gerada automaticamente a partir das Cenas: Personagens Principais primeiro, depois Personagens Secundárias.')],
  'Arcos Narrativos':[_('Arcos Narrativos'), _('Os Arcos Narrativos com Cenas neste Tomo. Clique para abrir a ficha.')],
  'Cenas':[_('Cenas do Arco Narrativo'), _('Inclui as Cenas herdadas: as anteriores a uma divergência e as posteriores a uma convergência, em cor mais clara.')],
  'Tomos em que figura':[_('Tomos em que figura'), _('Os Tomos onde a Personagem aparece em alguma Cena.')],
  'Cenários':[_('Cenários'), _('Os lugares ligados a esta ficha — associados diretamente ou através das suas Cenas. Clique para abrir.')],
  'Personagens associadas':[_('Personagens associadas'), _('As Personagens ligados a este lugar. Clique para abrir; ✕ para desassociar.')],
  'Cenas associadas':[_('Cenas associadas'), _('As Cenas que decorrem neste Cenário, pela Ordem Narrativa. Clique para abrir; ✕ para desassociar.')],
  'Link':[_('Link'), _('Guarda um endereço da web como Referência.')],
  'Nota':[_('Nota'), _('Uma Referência só de texto, escrita aqui.')],
  'Associada a':[_('Associações'), _('As fichas a que esta Referência está ligada. Clique para abrir; ✕ para desassociar.')] });

const txt = el => el.textContent.trim();
/* «Eliminar» só é «Eliminar Referência» dentro de uma ficha; nas confirmações o botão explica-se a si próprio */
const textTip = el => { const t = txt(el); if (t === _('Eliminar') && !el.closest('.ficha')) return null; return TEXT_TIPS[t] || TEXT_TIPS[t.replace(/ \(«.*»\)$/, '')]; };
const secTip = el => { const t = txt(el); if (t === _('Personagens') && el.closest('.ficha') && el.closest('.ficha').querySelector('.arc-row')) return [_('Personagens'), _('As Personagens que figuram nas Cenas deste Arco Narrativo. Clique para abrir a ficha.')]; return SEC_TIPS[t]; };
/* [seletor, título, texto] — título e texto podem ser funções do elemento; devolver null ignora a regra */
const TIP_RULES = [
  ['.brand', _('Projeto'), _('O nome do projeto muda-se em Definições do Projeto.')],
  ['.tab', el => (TAB_TIPS[el.dataset.tab] || [])[0], el => (TAB_TIPS[el.dataset.tab] || [])[1]],
  ['#undoBtn', _('Anular (Ctrl+Z)'), _('Desfaz a última alteração ao projeto. O histórico guarda até 100 passos e recomeça quando a página é recarregada.')],
  ['#redoBtn', _('Refazer (Ctrl+Shift+Z)'), _('Repõe a alteração que acabou de anular.')],
  ['#tourBtn', _('Ajuda'), _('A visita guiada e a visita detalhada percorrem as funcionalidades num projeto de demonstração, sem alterar os seus dados.')],
  ['#setBtn', _('Definições do Projeto'), el => el.classList.contains('on') ? _('Está nas Definições. Clique outra vez para voltar à área em que estava.') : _('Nome do projeto, sincronização, tema e paleta de cores, instalar como app, atualizações, explicadores e visitas.')],
  ['#moreBtn', _('Mais opções'), _('Novo, Abrir, Guardar e Fechar Projeto; Anular e Refazer.')],
  ['.nav-item', el => (TAB_TIPS[el.dataset.tab] || [])[0], el => (TAB_TIPS[el.dataset.tab] || [])[1]],
  ['.el-tabs button', el => (TAB_TIPS[el.dataset.tab] || [])[0], el => (TAB_TIPS[el.dataset.tab] || [])[1]],
  ['#createBtn, #createFab', _('Criar'), _('Cria uma Cena, um Capítulo, um Tomo, um Arco Narrativo, uma Personagem, um Cenário, uma Nota, uma Referência ou um objetivo de pesquisa, a partir de qualquer área.')],
  ['.create-menu .ctx-item, .create-grid button', el => (CREATE_TIPS[(el.querySelector('[data-k]') || el).dataset.k] || [])[0], el => (CREATE_TIPS[(el.querySelector('[data-k]') || el).dataset.k] || [])[1]],
  ['.more-menu .ctx-item', el => MORE_TIPS[el.textContent] ? el.textContent : null, el => MORE_TIPS[el.textContent]],
  ['.sheet-row', el => ({support:_('Materiais de Apoio'), settings:_('Definições do Projeto'), tour:_('Visita guiada'), deep:_('Visita detalhada')})[el.dataset.k],
    el => ({support:TAB_TIPS.support[1], settings:TAB_TIPS.settings[1], tour:_('Mostra as principais funcionalidades em poucos minutos.'), deep:_('Uma visita mais longa, funcionalidade a funcionalidade.')})[el.dataset.k]],
  ['.ghost-scene', _('Nova Cena aqui'), _('Clique para criar uma Cena deste Arco Narrativo neste lugar e escrever já o título no cartão. Enter confirma; Esc desiste.')],
  ['.ins-plus', _('Inserir Cena'), _('Cria uma Cena deste Arco Narrativo entre as duas, pronta a escrever o título. Enter confirma; Esc desiste.')],
  ['.conv-h', _('Criar convergência'), _('Arraste até uma Cena de outro Arco Narrativo: este passa a convergir nela. Um clique, sem arrastar, deixa escolher a Cena de destino a seguir.')],
  ['.scene-rename', _('Título da nova Cena'), _('Enter confirma; Esc desiste e a Cena não é criada.')],
  ['.view-toggle button', el => el.dataset.view === 'list' ? _('Lista') : _('Quadro'), el => el.dataset.view === 'list' ? _('Tomos, Capítulos e Cenas pela Ordem Narrativa, numa lista. Toque numa Cena para abrir a ficha; toque longo para mais opções.') : _('O quadro com as faixas dos Arcos Narrativos. Rode o telemóvel para ver mais.')],
  ['.nl-row', _('Cena'), _('Toque para abrir a ficha. Toque longo (ou botão direito) para criar Cenas, Ramos e convergências, ou eliminar.')],
  ['.nl-bname', _('Tomo'), _('Abrir a ficha do Tomo.')],
  ['.nl-add, .nl-empty', el => el.classList.contains('nl-addbook') ? _('Novo Tomo') : el.textContent.includes(_('Novo Capítulo neste Tomo')) ? _('Novo Capítulo') : _('Nova Cena'), el => el.classList.contains('nl-addbook') ? _('Acrescenta um Tomo no fim, já com um Capítulo.') : el.textContent.includes(_('Novo Capítulo neste Tomo')) ? _('Acrescenta um Capítulo a este Tomo.') : _('Cria uma Cena no fim deste Capítulo: escolha o título e o Arco Narrativo.')],
  ['.nl-more', el => el.closest('.nl-bhead') ? _('Opções do Tomo') : _('Opções do Capítulo'), el => el.closest('.nl-bhead') ? _('Abrir a ficha, criar um Capítulo ou eliminar o Tomo.') : _('Criar uma Cena, mudar o nome ou eliminar o Capítulo.')],
  ['#saveState', _('Gravação automática'), el => el.dataset.state === 'fail' ? _('A última alteração não ficou guardada: o armazenamento deste browser está cheio ou bloqueado. Guarde o projeto num ficheiro para não o perder.')
    : el.dataset.state === 'demo' ? _('Durante a visita guiada nada é guardado: o seu projeto está intacto e volta no fim.')
    : _('Cada alteração é guardada neste dispositivo no momento em que a faz, e continua cá quando voltar a abrir a ferramenta. Para cópias de segurança ou para o levar para outro dispositivo, use «Guardar Projeto».')],
  ['#dualBtn', el => el.classList.contains('on') ? _('Segundo ecrã ligado') : _('Segundo ecrã'),
    el => el.classList.contains('on') ? _('As fichas estão a abrir na outra janela. Clique para voltarem a abrir aqui.') : _('Abre uma segunda janela para pôr noutro ecrã. As fichas que abrir aqui passam a aparecer lá, e o quadro fica sempre à vista.')],
  ['#updBtn', _('Versão nova'), () => `A versão ${Upd.remote} está pronta. Clique para atualizar agora; o projeto fica como está.`],
  ['.plan-nav button', el => el.textContent, el => trK({'Visão global':_('Progresso do projeto, fases, Tomos, prazos em atraso e próximos prazos.'), 'Pesquisa e Planeamento':_('Objetivos de pesquisa: livros, mapas, locais, entrevistas, documentários, podcasts…'), 'Escrita':_('Marque as Cenas escritas e defina prazos para Cenas, Capítulos e Tomos.'), 'Revisão':_('Marque as Cenas revistas (depois de escritas) e defina prazos.'), 'Calendário':_('Todos os prazos e objetivos num calendário mensal, com ligações para o Google Calendar, o Apple Calendar e o Outlook / Teams.')})[el.textContent] || ''],
  ['.lbar', el => el.closest('.ch-head') || el.closest('.ch-prog') ? _('Progresso do Capítulo') : _('Progresso do Tomo'), el => el.dataset.tip + '. Em baixo a Pesquisa, por cima a Escrita e por cima de tudo a Revisão.'],
  ['.pbar', _('Progresso'), el => el.getAttribute('aria-label') + _(' concluído. Atualiza-se sozinho quando marca Cenas ou quando acrescenta, move ou elimina Cenas e Capítulos.')],
  ['.chk', el => el.textContent, el => el.classList.contains('off') ? _('Primeiro marque a Cena como escrita.') : _('Marque quando estiver concluído. Pode desmarcar para reescrever ou rever outra vez.')],
  ['.inp.due', _('Prazo'), el => el.classList.contains('late') ? _('Este prazo já passou.') : _('Data limite. Aparece no calendário e na exportação para outros calendários.')],
  ['.goal-row input[type=checkbox]', _('Objetivo feito'), _('Marque quando o objetivo de pesquisa estiver cumprido.')],
  ['.goal-t', _('Objetivo de pesquisa'), _('Clique para abrir a ficha: tipo, associação, data, notas e Referências.')],
  ['.plan-view .seg button', el => el.textContent, el => trK({'Todos':_('Mostra todos os objetivos de pesquisa.'), 'Por fazer':_('Só os objetivos ainda por cumprir.'), 'Feitos':_('Só os objetivos cumpridos.')})[el.textContent] || ''],
  ['.cal-day.has', _('Dia com eventos'), _('Toque para ver só os eventos deste dia (no telemóvel).')],
  ['.cal-ev', el => el.title, _('Clique para abrir.')],
  ['.page-head.sub .btn[aria-label]', el => el.getAttribute('aria-label'), _('Muda o mês mostrado no calendário.')],
  ['.cal-links a, .cal-links button', el => el.textContent, el => el.title],
  ['#projNewBtn', _('Novo Projeto'), _('Cria um projeto em branco. Os outros continuam abertos, no menu do nome do projeto.')],
  ['#projSaveBtn', _('Guardar Projeto'), _('Grava este projeto num ficheiro, com as Referências. Fica a cor de destaque quando há alterações por guardar.')],
  ['#projOpenBtn', _('Abrir Projeto'), _('Abre um projeto guardado num ficheiro, como mais um projeto aberto.')],
  ['#projCloseBtn', _('Fechar Projeto'), _('Fecha este projeto. Se houver alterações por guardar, pergunta se as quer guardar — senão, perdem-se.')],
  ['.theme-seg button', el => el.textContent, el => trK({'Automático (segue o sistema)':_('Claro ou escuro conforme o sistema operativo, e muda quando ele muda.'), 'Claro':_('Sempre claro neste dispositivo.'), 'Escuro':_('Sempre escuro neste dispositivo.')})[el.textContent] || ''],
  ['.ext-link', _('Abrir ligação'), _('Abre o endereço num novo separador do browser.')],
  ['.embed', _('Leitor incorporado'), _('Vídeo, áudio ou documento do endereço desta Referência.')],
  ['#projBtn', _('Projetos'), _('O projeto que está a ver. Clique para alternar entre os projetos abertos, criar ou abrir outro, guardá-lo ou fechá-lo. ● = alterações por guardar em ficheiro.')],
  ['.proj-menu .ctx-item', el => el.querySelector('.proj-item') ? _('Mudar de projeto') : el.textContent.replace('…', ''), el => el.querySelector('.proj-item') ? _('Passa a mostrar este projeto. Os outros continuam abertos.') : trK({'Novo Projeto':_('Cria um projeto em branco, sem fechar os que estão abertos.'), 'Abrir Projeto…':_('Abre um projeto guardado num ficheiro, como mais um projeto aberto.'), 'Guardar Projeto':_('Grava este projeto num ficheiro, com as Referências.'), 'Fechar Projeto':_('Fecha este projeto (pergunta se quer guardar). Fica nos projetos recentes da página inicial.')})[el.textContent] || ''],
  ['.land-card', el => el.querySelector('.land-t').textContent, el => el.querySelector('.land-d').textContent],
  ['.linkish', _('Visita detalhada'), _('Uma visita mais longa, funcionalidade a funcionalidade, sobre um projeto de demonstração.')],
  ['.land-reopen', _('Reabrir projeto'), _('Volta a abrir este projeto, como estava quando o fechou.')],
  ['.proj-card .switch-wrap', _('Perguntar antes de sair'), _('Ao fechar a janela ou a app com projetos que têm alterações por guardar em ficheiro, o browser pergunta se quer mesmo sair. O projeto fica sempre gravado neste dispositivo.')],
  ['#syncBtn', _('Sincronizar dispositivos'), el => SYNC_TXT[el.dataset.state || 'off'] + _(' Clique para ver os dispositivos ligados.')],
  ['.pair-code', _('Código de ligação'), _('Escreva-o no outro dispositivo, em «Introduzir código». Só serve para esta ligação.')],
  ['.sync-dot', el => el.classList.contains('on') ? _('Ligado') : _('Não ligado'), el => el.classList.contains('on') ? _('Este dispositivo está ligado agora.') : _('Fica ligado quando a ferramenta estiver aberta nos dois.')],
  ['#installBtn', _('Instalar como app'), _('Instala a ferramenta neste dispositivo: ícone próprio, janela própria e funcionamento sem internet.')],
  ['#dualBar', _('Segundo ecrã'), _('Esta janela acompanha a principal: mostra as fichas que lá forem abertas, e o que alterar aqui aparece lá de imediato.')],
  ['#orientHint .icon-btn', _('Dispensar'), _('Não voltar a mostrar esta sugestão.')],
  // quadro
  ['.corner', _('Arcos Narrativos'), _('Cada Arco Narrativo ocupa uma faixa horizontal exclusiva; os Ramos ficam logo abaixo do Arco Narrativo de onde divergem.')],
  ['.lane-label', _('Arco Narrativo'), _('Clique para abrir a ficha do Arco Narrativo.')],
  ['.book-head', _('Tomo'), _('Clique longo para arrastar e reordenar os Tomos. Botão direito para mais opções.')],
  // um nome que não coube inteiro aparece completo no título do explicador
  ['.book-name', el => el.scrollWidth > el.clientWidth + 1 ? el.textContent : _('Nome do Tomo'), _('Clique para renomear. Clique longo para arrastar o Tomo.')],
  ['[data-act="ficha"]', _('Ficha do Tomo'), _('Nome, tipo de narrador, Personagens, Arcos Narrativos, Notas e Referências.')],
  ['[data-act="addch"]', _('Novo Capítulo'), _('Acrescenta um Capítulo vazio no fim deste Tomo.')],
  ['.add-book', _('Novo Tomo'), _('Acrescenta um Tomo no fim da sequência.')],
  ['.ch-head', el => { const n = el.querySelector('.ch-name'); return n && n.scrollWidth > n.clientWidth + 1 ? n.textContent : _('Capítulo'); }, _('Clique no nome para renomear. Clique longo para arrastar, dentro do Tomo ou para outro Tomo — a numeração ajusta-se sozinha. Botão direito para mais opções.')],
  ['.ch-body', _('Capítulo'), _('Clique com o botão direito num espaço vazio para criar uma Cena aqui, na faixa do Arco Narrativo onde clicar.')],
  ['.scene.sel2', _('Cena aberta no segundo ecrã'), _('A ficha desta Cena está à vista na outra janela.')],
  ['.scene', _('Cena'), _('Clique para abrir a ficha. Clique longo para arrastar e mudar a Ordem Narrativa. Botão direito para criar Cenas ou Ramos; clique longo com o botão direito, numa Cena sem descendência, para a ligar a outro Arco Narrativo (convergência).')],
  // páginas
  ['.sup-search', _('Pesquisar'), _('Procura em todas as secções ao mesmo tempo, pelo nome, pela descrição ou pelos exemplos. Não distingue acentos e aceita os termos em inglês.')],
  ['.sup-nav button', _('Secção'), _('Mostra as fichas desta secção. O número indica quantas fichas tem.')],
  ['.page-head input.inp', _('Filtro'), _('Escreva para pesquisar com sugestão automática e filtrar a lista.')],
  ['.page-head select', _('Filtrar por Tomo'), _('Mostra só as Personagens que figuram no Tomo escolhido.')],
  ['.lang-seg button', _('Língua'), _('Muda a língua da ferramenta e dos Materiais de Apoio neste dispositivo. A página recarrega; os projetos não mudam.')],
  ['.a11y-card .seg button', el => txt(el), el => trK({'Normal':_('Texto no tamanho de origem.'), 'Grande':_('Texto 15% maior nas páginas, fichas, menus e avisos.'), 'Muito grande':_('Texto 30% maior nas páginas, fichas, menus e avisos.'),
    'Automático (segue o sistema)':_('Reduz as animações se o sistema operativo o pedir.'), 'Reduzidas':_('Quase sem animações nem transições, em qualquer caso.'), 'Normais':_('Animações e transições sempre ativas.')})[txt(el)] || ''],
  ['.seg button', el => TEXT_TIPS[txt(el)] ? null : _('Filtro'), el => (txt(el) === _('Todas') ? _('Mostra as Referências de todos os tipos.') : _('Mostra só as Referências do tipo ') + txt(el).replace(/s$/, '') + '.')],
  ['.page-head .chip',_('Filtro ativo'), _('✕ remove o filtro.')],
  ['#view-page .card:not(.static)', () => (CARD_TIPS[activeTab] || [])[0], () => (CARD_TIPS[activeTab] || [])[1]],
  ['.pal', _('Paleta'), _('Clique para aplicar esta paleta de cores ao projeto.')],
  ['.swatches .sw-native', _('Outra cor'), _('Abre o seletor de cores do sistema para escolher qualquer cor.')],
  ['.swatches .sw', el => el.dataset.tip, el => el.classList.contains('other') ? _('Abre o seletor de cores do sistema para escolher qualquer cor.') : el.classList.contains('none') ? _('O Tomo fica sem cor própria.') : _('Aplica esta cor ao Tomo.')],
  ['.modal-title .book-dot', _('Cor do Tomo'), _('A cor escolhida em «Cor do Tomo», nesta ficha.')],
  ['.book-dot', _('Cor do Tomo'), _('Muda-se na ficha do Tomo.')],
  // fichas
  ['.modal-head .icon-btn', _('Fechar'), _('Fecha a janela (Esc). As alterações já estão guardadas.')],
  ['.upd-card .switch-wrap', _('Atualizações automáticas'), _('Ligado: as versões novas instalam-se sozinhas, num momento em que não esteja a meio de nada. Desligado: aparece «Atualizar» na barra de topo e escolhe quando.')],
  ['.switch-wrap', el => el.closest('.sec') ? _('Ordem das Cenas') : _('Explicadores'),
    el => el.closest('.sec') ? _('Alterna entre a Ordem Narrativa e a Ordem Cronológica. Na cronológica, um clique longo arrasta as Cenas deste Arco Narrativo.') : _('Liga ou desliga estas explicações.')],
  ['.arc-card', _('Cena'), el => el.dataset.own ? _('Clique para abrir a ficha. Na Ordem Cronológica, clique longo para arrastar e mudar a posição.') : _('Cena herdada de outro Arco Narrativo. Clique para abrir a ficha.')],
  ['.dropzone', _('Carregar ficheiros'), _('Clique para escolher ficheiros ou arraste-os do ambiente de trabalho. Ficam guardados localmente neste browser.')],
  ['.chip.click', _('Abrir ficha'), _('Clique para abrir a ficha correspondente.')],
  ['.chip-x', el => el.closest('.page-head') ? null : _('Remover'), _('Remove este elemento da ficha, sem o eliminar do projeto.')],
  ['.list-row .grow', _('Abrir ficha'), _('Clique para abrir.')],
  ['.badge.main', _('Personagem Principal'), _('Marcado como Personagem Principal.')],
  ['.badge.pov', _('Personagem POV'), _('É o ponto de vista de pelo menos uma Cena.')],
  ['.posbox input', _('Ordem Cronológica'), _('A posição desta Cena na cronologia do seu Arco Narrativo. Duas Cenas podem partilhar a mesma posição.')],
  ['.field', el => { const l = el.querySelector(':scope > label'); return l && (FIELD_TIPS[txt(l)] || [])[0]; }, el => (FIELD_TIPS[txt(el.querySelector(':scope > label'))] || [])[1]],
  ['.sec-title', el => (secTip(el) || [])[0], el => (secTip(el) || [])[1]],
  ['button, .ctx-item, a.btn', el => (textTip(el) || [])[0], el => (textTip(el) || [])[1]],
];

const val = (v, el) => typeof v === 'function' ? v(el) : v;
const depth = el => { let d = 0; while ((el = el.parentElement)) d++; return d; };
function tipFor(target){
  if (!target || !target.closest) return null;
  let best = null;
  for (const [sel, t, d] of TIP_RULES){
    const el = target.closest(sel); if (!el) continue;
    const title = val(t, el); if (!title) continue;
    const dp = depth(el); if (!best || dp > best.dp) best = { el, dp, title, text:val(d, el) };
  }
  // dicas nativas (atributo title): passam a usar o mesmo balão
  const tt = target.closest('[title],[data-tip]');
  if (tt){
    if (tt.title){ tt.dataset.tip = tt.title; tt.removeAttribute('title'); }
    const dp = depth(tt); if (!best || dp > best.dp) best = { el:tt, dp, title:'', text:tt.dataset.tip };
  }
  return best;
}
function hideTip(){
  clearTimeout(Tips.timer); Tips.timer = null; Tips.cur = null;
  if (Tips.el) Tips.el.classList.remove('on');
}
function showTip(tip){
  if (!tip.el.isConnected) return;
  if (!Tips.el){ Tips.el = h('div', {id:'tip', role:'tooltip'}); document.body.append(Tips.el); }
  const el = Tips.el; el.innerHTML = '';
  add(el, tip.title ? h('b', null, tip.title) : null, tip.text);
  const w = el.offsetWidth, hh = el.offsetHeight;
  let x = Tips.x + 14, y = Tips.y + 20;
  if (x + w > innerWidth - 8) x = Math.max(8, innerWidth - w - 8);
  if (y + hh > innerHeight - 8) y = Math.max(8, Tips.y - hh - 12);
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.add('on');
}
function tipsBlocked(e){
  return !Tips.on || Tour.active || drag || linkDrag || (e && e.buttons) || document.querySelector('.ac-list');
}
function setTipsOn(on){ Tips.on = !!on; lsSet(LS_TIPS, on ? '1' : '0'); if (!on) hideTip(); }

document.addEventListener('mousemove', e => { Tips.x = e.clientX; Tips.y = e.clientY; }, {passive:true});
/* num ecrã tátil não há rato: os eventos de rato que o browser simula depois de um toque não abrem explicadores */
window.addEventListener('pointerdown', e => { if (e.pointerType && e.pointerType !== 'mouse') Tips.touchT = Date.now(); }, {capture:true, passive:true});
document.addEventListener('mouseover', e => {
  if (Tour.active) return; // o explicador que a visita mostra de exemplo não desaparece ao mexer o rato
  if (tipsBlocked(e) || Date.now() - Tips.touchT < 1500) return hideTip();
  const tip = tipFor(e.target);
  if (tip && Tips.cur && tip.el === Tips.cur.el) return;
  hideTip(); if (!tip) return;
  Tips.cur = tip; Tips.timer = setTimeout(() => { if (Tips.cur === tip && !tipsBlocked()) showTip(tip); }, Tips.DELAY);
});
document.addEventListener('mouseleave', hideTip);
for (const ev of ['pointerdown', 'keydown', 'wheel', 'scroll']) window.addEventListener(ev, hideTip, {capture:true, passive:true});

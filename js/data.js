'use strict';
/* Os tipos de narrador e os Materiais de Apoio vêm dos ficheiros da língua ativa (js/i18n.js escolhe quais); aqui só se criam as listas. */
const NARRATORS = [];
const SUPPORT = [];
const narratorByKey = k => NARRATORS.find(n => n.key === k);

/* Projeto de demonstração (visita guiada e «Começar com um exemplo»): um livro com a dimensão habitual — 2 Tomos, 12 Capítulos
   com 3 a 5 Cenas cada, 20 Personagens (3 principais) e 15 Localizações (3 principais). Na visita nunca é guardado. */
function demoProject(){
  const N = null, S = {};
  /* [id, título, Arco, POV, Personagens, Localizações, resumo] — pela ordem do livro, Capítulo a Capítulo */
  const CH = [
    ['b1', 'c1', _('Chegada'), [
      ['s1', _('Inês desembarca na ilha'), 'a1', 'ch1', ['ch1', 'ch8'], ['sc3'], _('Depois de quinze anos, Inês volta à ilha onde cresceu.')],
      ['s2', _('A casa da avó'), 'a1', 'ch1', ['ch1', 'ch3', 'ch4'], ['sc1'], _('A casa está igual. A avó, não.')],
      ['s11', _('O quarto de criança'), 'a1', 'ch1', ['ch1'], ['sc1']],
      ['s3', _('Luz apagada'), 'a2', 'ch2', ['ch2'], ['sc2'], _('Pela primeira vez em décadas, o farol não acende.')]]],
    ['b1', 'c2', _('Vozes'), [
      ['s4', _('Duarte foge de casa'), 'a3', 'ch4', ['ch4'], ['sc1']],
      ['s5', _('O diário do faroleiro'), 'a2', N, ['ch5'], ['sc2'], _('Analepse: páginas escritas trinta anos antes.')],
      ['s12', _('Conversa na mercearia'), 'a1', 'ch1', ['ch1', 'ch7'], ['sc4']]]],
    ['b1', 'c3', _('Maré'), [
      ['s6', _('A carta por abrir'), 'a1', 'ch1', ['ch1', 'ch3'], ['sc1']],
      ['s13', _('A gruta dos contrabandistas'), 'a3', 'ch4', ['ch4', 'ch19'], ['sc5']],
      ['s14', _('O livro de registos'), 'a2', 'ch2', ['ch2', 'ch6'], ['sc2']],
      ['s15', _('Jantar em silêncio'), 'a1', 'ch1', ['ch1', 'ch3', 'ch4'], ['sc1']]]],
    ['b1', 'c6', _('Nevoeiro'), [
      ['s16', _('Um barco sem luzes'), 'a2', 'ch2', ['ch2', 'ch14'], ['sc3', 'sc2']],
      ['s17', _('A fotografia rasgada'), 'a1', 'ch1', ['ch1', 'ch18'], ['sc4']],
      ['s18', _('Duarte e o pescador'), 'a3', 'ch4', ['ch4', 'ch8', 'ch19'], ['sc9']]]],
    ['b1', 'c7', _('Arquivo'), [
      ['s19', _('Na junta de freguesia'), 'a1', 'ch1', ['ch1', 'ch20'], ['sc6']],
      ['s20', _('Inverno de 1957'), 'a4', 'ch5', ['ch5', 'ch17'], ['sc2']],
      ['s21', _('A chave da lanterna'), 'a2', 'ch2', ['ch2'], ['sc2']],
      ['s22', _('O nome riscado'), 'a1', 'ch1', ['ch1', 'ch9'], ['sc7']]]],
    ['b1', 'c8', _('Vésperas'), [
      ['s23', _('O bilhete para o continente'), 'a3', 'ch4', ['ch4', 'ch7'], ['sc4']],
      ['s24', _('A avó fala, por fim'), 'a1', 'ch1', ['ch1', 'ch3'], ['sc1']],
      ['s25', _('O aviso de temporal'), 'a2', 'ch2', ['ch2', 'ch12', 'ch14'], ['sc15']]]],
    ['b2', 'c4', _('Tempestade'), [
      ['s7', _('Noite no cais'), 'a3', 'ch4', ['ch4', 'ch2'], ['sc3']],
      ['s8', _('A escada em espiral'), 'a2', 'ch2', ['ch2', 'ch1'], ['sc2']],
      ['s26', _('A ilha sem luz'), 'a1', 'ch1', ['ch1', 'ch3', 'ch10'], ['sc1']],
      ['s27', _('O naufrágio'), 'a4', 'ch5', ['ch5', 'ch17', 'ch16'], ['sc11']]]],
    ['b2', 'c5', _('Luz'), [
      ['s9', _('O que a avó sabia'), 'a1', 'ch1', ['ch1', 'ch3'], ['sc1']],
      ['s10', _('O farol volta a acender'), 'a2', 'ch2', ['ch2', 'ch1', 'ch4'], ['sc2', 'sc3']],
      ['s28', _('A lanterna antiga'), 'a1', 'ch1', ['ch1', 'ch2'], ['sc2']]]],
    ['b2', 'c9', _('Rescaldo'), [
      ['s29', _('O cais, de manhã'), 'a1', 'ch1', ['ch1', 'ch8', 'ch14'], ['sc3']],
      ['s30', _('O que o mar devolveu'), 'a2', 'ch2', ['ch2', 'ch12'], ['sc11']],
      ['s31', _('A última entrada do diário'), 'a4', 'ch5', ['ch5'], ['sc2']],
      ['s32', _('Duarte regressa'), 'a1', 'ch4', ['ch4', 'ch1', 'ch3'], ['sc1']]]],
    ['b2', 'c10', _('Vozes antigas'), [
      ['s33', _('A carta, aberta'), 'a1', 'ch1', ['ch1'], ['sc1']],
      ['s34', _('O irmão do faroleiro'), 'a2', 'ch2', ['ch2', 'ch16'], ['sc13']],
      ['s35', _('Perguntas à avó'), 'a1', 'ch1', ['ch1', 'ch3', 'ch11'], ['sc1']]]],
    ['b2', 'c11', _('Maré cheia'), [
      ['s36', _('A segunda lanterna'), 'a2', 'ch2', ['ch2', 'ch6'], ['sc2']],
      ['s37', _('O artigo por escrever'), 'a1', 'ch1', ['ch1', 'ch15'], ['sc8']],
      ['s38', _('O que ficou por dizer'), 'a4', 'ch5', ['ch5', 'ch17'], ['sc12']],
      ['s39', _('Despedida no cais'), 'a1', 'ch1', ['ch1', 'ch4', 'ch13'], ['sc3']]]],
    ['b2', 'c12', _('Luz acesa'), [
      ['s40', _('Tomás fica'), 'a2', 'ch2', ['ch2', 'ch6'], ['sc14']],
      ['s41', _('O barco da manhã'), 'a1', 'ch1', ['ch1', 'ch3', 'ch8'], ['sc3']],
      ['s42', _('Uma luz atrás'), 'a1', 'ch1', ['ch1'], ['sc9']]]]];
  const chron = {}, books = {b1:[], b2:[]}; let n = 0;
  CH.forEach(([b, id, name, list]) => { books[b].push({id, name, scenes:list.map(x => x[0])});
    list.forEach(([sid, title, arcId, pov, chars, sceneries, summary]) => { n++; chron[arcId] = (chron[arcId] || 0) + 1;
      const s = S[sid] = {id:sid, title, summary:summary || '', arcId, chron:chron[arcId], pov, chars, sceneries, convergeTo:null};
      if (n <= 14) s.prog = {write:{done:true, at:1, due:null}, review:{done:n <= 6, at:n <= 6 ? 1 : 0, due:null}}; }); }); // as primeiras Cenas já estão escritas (e algumas, revistas)
  S.s5.chron = 1; S.s3.chron = 2; // «O diário do faroleiro» é uma analepse: vem depois no livro, mas antes no tempo
  S.s16.prog = {write:{done:false, at:0, due:'2027-02-10'}, review:{done:false, at:0, due:null}}; S.s17.prog = {write:{done:false, at:0, due:'2027-02-24'}, review:{done:false, at:0, due:null}};
  const ch = (id, name, gender, age, description) => ({id, name, gender, age:age || '', description:description || ''});
  const loc = (id, name, chars, main) => main ? {id, name, chars, main:true} : {id, name, chars};
  return {
    version:1,
    project:{ name:_('Projeto de demonstração'), palette:{h:220,mode:'dark'} },
    books:[
      { id:'b1', name:_('A Maré Baixa'), narrator:'terceira-limitada', color:'#2fb3a0', mainChars:['ch1', 'ch4'], chapters:books.b1 },
      { id:'b2', name:_('O Farol'), narrator:'primeira-protagonista', color:'#d4a72c', mainChars:['ch1', 'ch2', 'ch4'], chapters:books.b2 } ],
    scenes:S,
    arcs:[
      { id:'a1', name:_('O regresso de Inês'), hue:342, sat:50, parentId:null, forkSceneId:null, description:'' },
      { id:'a3', name:_('A fuga de Duarte'), hue:54, sat:80, parentId:'a1', forkSceneId:'s2', description:'' },
      { id:'a2', name:_('O segredo do farol'), hue:258, sat:80, parentId:null, forkSceneId:null, description:'' },
      { id:'a4', name:_('O inverno de 1957'), hue:172, sat:50, parentId:null, forkSceneId:null, description:'' } ],
    characters:[
      ch('ch1', 'Inês Valadares', 'F', '34', _('Jornalista. Saiu da ilha aos dezanove anos.')), ch('ch2', 'Tomás Reis', 'M', '41', _('Técnico do farol.')), ch('ch3', 'Avó Celeste', 'F', '78'),
      ch('ch4', 'Duarte', 'M', '17', _('Primo de Inês.')), ch('ch5', 'O Faroleiro', 'N/D', '', _('Só existe nas páginas do diário.')),
      ch('ch6', 'Matilde Reis', 'F', '69'), ch('ch7', 'Rosa Canhoto', 'F', '52'), ch('ch8', 'Joaquim Barqueiro', 'M', '63'), ch('ch9', 'Anselmo Frade', 'M', '71'), ch('ch10', 'Vasco Lemos', 'M', '58'),
      ch('ch11', 'Amélia Valadares', 'F', '60'), ch('ch12', 'Sargento Pires', 'M', '47'), ch('ch13', 'Benedita Sousa', 'F', '36'), ch('ch14', 'Zé Maria', 'M', '55'), ch('ch15', 'Leonor Prates', 'F', '44'),
      ch('ch16', 'Henrique Reis', 'M', '83'), ch('ch17', 'Capitão Albano', 'M', ''), ch('ch18', 'Guiomar Neves', 'F', '35'), ch('ch19', 'Simão Barqueiro', 'M', '18'), ch('ch20', 'Laura Antunes', 'F', '29') ],
    sceneries:[
      loc('sc1', _('A casa da avó'), ['ch3', 'ch1', 'ch4'], true), loc('sc2', _('O farol'), ['ch2', 'ch5'], true), loc('sc3', _('O cais'), ['ch4', 'ch8'], true),
      loc('sc4', _('A mercearia'), ['ch7']), loc('sc5', _('A gruta'), []), loc('sc6', _('A junta de freguesia'), ['ch20']), loc('sc7', _('A igreja'), ['ch9']), loc('sc8', _('A escola'), ['ch13']),
      loc('sc9', _('A praia do norte'), []), loc('sc10', _('A taberna do porto'), ['ch14']), loc('sc11', _('Os rochedos'), []), loc('sc12', _('O cemitério'), []), loc('sc13', _('A casa de Henrique'), ['ch16']),
      loc('sc14', _('A casa de Tomás'), ['ch2', 'ch6']), loc('sc15', _('O posto da guarda'), ['ch12']) ],
    goals:[
      { id:'g1', title:_('Visitar o farol do Cabo Espichel'), type:'local', target:{kind:'book', id:'b2'}, due:'2027-03-14', time:'10:00', notes:_('Subir à lanterna, perguntar ao faroleiro como se acende.'), done:false },
      { id:'g2', title:_('Ouvir o podcast sobre faroleiros portugueses'), type:'podcast', target:{kind:'project', id:null}, due:null, time:null, notes:'', done:true },
      { id:'g3', title:_('Consultar o mapa da ilha de 1950'), type:'mapa', target:{kind:'scene', id:'s1'}, due:'2027-02-20', time:null, notes:'', done:false } ],
    plan:{ research:{start:'2027-01-05', end:'2027-03-31'}, write:{start:'2027-02-01', end:'2027-09-30'}, review:{start:'2027-10-01', end:'2027-12-15'} },
    refs:[
      { id:'r1', type:'note', title:_('Ideias para o final'), text:_('O farol acende, mas quem o acendeu?'), links:[{kind:'book',id:'b2'}], created:Date.now() },
      { id:'r2', type:'link', title:_('Faróis de Portugal'), url:'https://pt.wikipedia.org/wiki/Farol', links:[{kind:'arc',id:'a2'}], created:Date.now() },
      { id:'r3', type:'note', title:_('A cozinha da avó'), text:_('Cheiro a café de cevada e maresia.'), links:[{kind:'scene',id:'s2'},{kind:'character',id:'ch3'},{kind:'scenery',id:'sc1'}], created:Date.now() } ]
  };
}

/* O mesmo livro em ponto pequeno (10 Cenas): serve os testes, que precisam de um projeto curto e estável */
function demoProjectMini(){
  const sc = (id,title,arcId,chron,pov,chars,summary,sceneries) => ({id,title,summary:summary||'',arcId,chron,pov,chars,sceneries:sceneries||[],convergeTo:null});
  const scenes = {};
  [ sc('s1',_('Inês desembarca na ilha'),'a1',1,'ch1',['ch1'],_('Depois de quinze anos, Inês volta à ilha onde cresceu.'),['sc3']),
    sc('s2',_('A casa da avó'),'a1',2,'ch1',['ch1','ch3','ch4'],_('A casa está igual. A avó, não.'),['sc1']),
    sc('s3',_('Luz apagada'),'a2',2,'ch2',['ch2'],_('Pela primeira vez em décadas, o farol não acende.'),['sc2']),
    sc('s4',_('Duarte foge de casa'),'a3',1,'ch4',['ch4'],''),
    sc('s5',_('O diário do faroleiro'),'a2',1,null,['ch5'],_('Analepse: páginas escritas trinta anos antes.')),
    sc('s6',_('A carta por abrir'),'a1',3,'ch1',['ch1','ch3'],'',['sc1']),
    sc('s7',_('Noite no cais'),'a3',2,'ch4',['ch4','ch2'],'',['sc3']),
    sc('s8',_('A escada em espiral'),'a2',3,'ch2',['ch2','ch1'],'',['sc2']),
    sc('s9',_('O que a avó sabia'),'a1',4,'ch1',['ch1','ch3'],''),
    sc('s10',_('O farol volta a acender'),'a2',4,'ch2',['ch2','ch1','ch4'],'',['sc2','sc3'])
  ].forEach(s => scenes[s.id] = s);
  return {
    version:1,
    project:{ name:_('Projeto de demonstração'), palette:{h:220,mode:'dark'} },
    books:[
      { id:'b1', name:_('A Maré Baixa'), narrator:'terceira-limitada', color:'#2fb3a0', mainChars:['ch1'], chapters:[
        { id:'c1', name:_('Chegada'), scenes:['s1','s2','s3'] },
        { id:'c2', name:_('Vozes'), scenes:['s4','s5'] },
        { id:'c3', name:_('Maré'), scenes:['s6'] } ] },
      { id:'b2', name:_('O Farol'), narrator:'primeira-protagonista', color:'#d4a72c', mainChars:['ch2'], chapters:[
        { id:'c4', name:_('Tempestade'), scenes:['s7','s8'] },
        { id:'c5', name:_('Luz'), scenes:['s9','s10'] } ] }
    ],
    scenes,
    arcs:[
      { id:'a1', name:_('O regresso de Inês'), hue:342, sat:50, parentId:null, forkSceneId:null, description:'' },
      { id:'a3', name:_('A fuga de Duarte'), hue:54, sat:80, parentId:'a1', forkSceneId:'s2', description:'' },
      { id:'a2', name:_('O segredo do farol'), hue:258, sat:80, parentId:null, forkSceneId:null, description:'' }
    ],
    characters:[
      { id:'ch1', name:'Inês Valadares', gender:'F', age:'34', description:_('Jornalista. Saiu da ilha aos dezanove anos.') },
      { id:'ch2', name:'Tomás Reis', gender:'M', age:'41', description:_('Técnico do farol.') },
      { id:'ch3', name:'Avó Celeste', gender:'F', age:'78', description:'' },
      { id:'ch4', name:'Duarte', gender:'M', age:'17', description:_('Primo de Inês.') },
      { id:'ch5', name:'O Faroleiro', gender:'N/D', age:'', description:_('Só existe nas páginas do diário.') }
    ],
    sceneries:[
      { id:'sc1', name:_('A casa da avó'), chars:['ch3','ch1'] },
      { id:'sc2', name:_('O farol'), chars:['ch2','ch5'] },
      { id:'sc3', name:_('O cais'), chars:['ch4'] }
    ],
    goals:[
      { id:'g1', title:_('Visitar o farol do Cabo Espichel'), type:'local', target:{kind:'book', id:'b2'}, due:'2027-03-14', time:'10:00', notes:_('Subir à lanterna, perguntar ao faroleiro como se acende.'), done:false },
      { id:'g2', title:_('Ouvir o podcast sobre faroleiros portugueses'), type:'podcast', target:{kind:'project', id:null}, due:null, time:null, notes:'', done:true },
      { id:'g3', title:_('Consultar o mapa da ilha de 1950'), type:'mapa', target:{kind:'scene', id:'s1'}, due:'2027-02-20', time:null, notes:'', done:false }
    ],
    plan:{ research:{start:'2027-01-05', end:'2027-03-31'}, write:{start:'2027-02-01', end:'2027-09-30'}, review:{start:'2027-10-01', end:'2027-12-15'} },
    refs:[
      { id:'r1', type:'note', title:_('Ideias para o final'), text:_('O farol acende, mas quem o acendeu?'), links:[{kind:'book',id:'b2'}], created:Date.now() },
      { id:'r2', type:'link', title:_('Faróis de Portugal'), url:'https://pt.wikipedia.org/wiki/Farol', links:[{kind:'arc',id:'a2'}], created:Date.now() },
      { id:'r3', type:'note', title:_('A cozinha da avó'), text:_('Cheiro a café de cevada e maresia.'), links:[{kind:'scene',id:'s2'},{kind:'character',id:'ch3'},{kind:'scenery',id:'sc1'}], created:Date.now() }
    ]
  };
}

/* Fichas dos Materiais de Apoio cujo nome vem de uma expressão estrangeira: o nome original, mostrado entre parênteses
   a seguir ao nome da ficha (por língua, pelo nome da ficha nessa língua). */
const SUPPORT_ORIGINAL = {
 "pt": { "Fluxo de consciência": "Stream of consciousness", "Narrador não fiável": "Unreliable narrator", "Personagem POV": "Point-of-view character", "Saltos de cabeça": "Head-hopping", "Discurso indireto livre": "Style indirect libre", "Verbos declarativos e gestos de cena": "Dialogue tags and beats", "Pormenor significativo": "Telling detail", "Falácia patética": "Pathetic fallacy", "Correlativo objetivo": "Objective correlative", "Motivo recorrente": "Leitmotiv", "Estilo oral": "Skaz", "Estilo noir": "Hard-boiled", "Primeira frase": "Incipit", "Última frase": "Explicit", "Humor negro": "Humour noir", "Romance de formação": "Bildungsroman", "Romance picaresco": "Novela picaresca", "Analepse": "Flashback", "Prolepse": "Flash-forward", "Contrarrelógio": "Ticking clock", "Prenúncio": "Foreshadowing", "Arma de Tchékhov": "Chekhov’s gun", "Plantar e colher": "Setup and payoff", "Pista falsa": "Red herring", "Gancho": "Hook · cliffhanger", "Reviravolta": "Plot twist", "Incidente desencadeador": "Inciting incident", "O que está em jogo": "Stakes", "Ponto médio": "Midpoint", "Tudo está perdido": "All is lost", "Ponto sem retorno": "Point of no return", "Falha trágica": "Hamartia", "Contraponto": "Foil", "Enredo secundário": "Subplot", "Arco de personagem": "Character arc", "Entrar tarde, sair cedo": "Late in, early out", "Mostrar, não dizer": "Show, don’t tell", "Cena e sequela": "Scene and sequel", "Ciclos de tentativa e falha": "Try-fail cycles", "Ritmo narrativo": "Pacing", "Montagem paralela": "Cross-cutting", "Teoria do icebergue": "Iceberg theory", "Exposição diluída": "Incluing", "Construção de mundo": "Worldbuilding", "Estranhamento": "Ostranenie", "Narrativa encaixada": "Frame story", "Estrutura em três atos": "Three-act structure", "Jornada do Herói": "The Hero’s Journey", "Jornada da Heroína": "The Heroine’s Journey", "Sete pontos": "Seven-Point Story Structure", "Curva de Fichte": "Fichtean curve", "Os sete enredos básicos": "The Seven Basic Plots", "Quociente MICE": "MICE Quotient", "Planear ou descobrir": "Plotters and pantsers", "Método do Floco de Neve": "Snowflake Method", "Escaleta": "Step outline", "Querer e precisar": "Want and need", "Rascunho zero": "Zero draft", "Os cinco mandamentos da cena": "The Five Commandments of Storytelling", "Bíblia da série": "Series bible", "Premissa e frase-síntese": "Logline" },
 "es": { "Flujo de conciencia": "Stream of consciousness", "Narrador no fiable": "Unreliable narrator", "Personaje POV": "Point-of-view character", "Saltos de punto de vista": "Head-hopping", "Estilo indirecto libre": "Style indirect libre", "Verbos de habla y acotaciones": "Dialogue tags and beats", "Detalle significativo": "Telling detail", "Falacia patética": "Pathetic fallacy", "Correlato objetivo": "Objective correlative", "Motivo recurrente": "Leitmotiv", "Estilo oral": "Skaz", "Estilo negro": "Hard-boiled", "Primera frase": "Incipit", "Última frase": "Explicit", "Humor negro": "Humour noir", "Novela de formación": "Bildungsroman", "Minimalismo y realismo sucio": "Dirty realism", "El doble": "Doppelgänger", "Analepsis": "Flashback", "Prolepsis": "Flash-forward", "Carrera contrarreloj": "Ticking clock", "Presagio": "Foreshadowing", "El arma de Chéjov": "Chekhov’s gun", "Siembra y cosecha": "Setup and payoff", "Pista falsa": "Red herring", "Gancho": "Hook · cliffhanger", "Giro argumental": "Plot twist", "Incidente incitador": "Inciting incident", "Lo que está en juego": "Stakes", "Punto medio": "Midpoint", "Todo está perdido": "All is lost", "Punto de no retorno": "Point of no return", "Defecto trágico": "Hamartia", "Personaje contraste": "Foil", "Subtrama": "Subplot", "Arco de personaje": "Character arc", "Entrar tarde, salir pronto": "Late in, early out", "Mostrar, no contar": "Show, don’t tell", "Escena y secuela": "Scene and sequel", "Ciclos de intento y fracaso": "Try-fail cycles", "Ritmo narrativo": "Pacing", "Montaje paralelo": "Cross-cutting", "Teoría del iceberg": "Iceberg theory", "Exposición dosificada": "Incluing", "Construcción de mundos": "Worldbuilding", "Extrañamiento": "Ostranenie", "Relato enmarcado": "Frame story", "Estructura en tres actos": "Three-act structure", "El viaje del héroe": "The Hero’s Journey", "El viaje de la heroína": "The Heroine’s Journey", "Estructura de siete puntos": "Seven-Point Story Structure", "Curva de Fichte": "Fichtean curve", "Las siete tramas básicas": "The Seven Basic Plots", "Cociente MICE": "MICE Quotient", "Planificar o descubrir": "Plotters and pantsers", "Método del copo de nieve": "Snowflake Method", "Escaleta": "Step outline", "Deseo y necesidad": "Want and need", "Borrador cero": "Zero draft", "Los cinco mandamientos de la escena": "The Five Commandments of Storytelling", "Biblia de la serie": "Series bible" },
 "fr": { "Flux de conscience": "Stream of consciousness", "Narrateur non fiable": "Unreliable narrator", "Personnage POV": "Point-of-view character", "Sauts de point de vue": "Head-hopping", "Verbes de parole et gestes de scène": "Dialogue tags and beats", "Détail révélateur": "Telling detail", "Paysage état d’âme": "Pathetic fallacy", "Corrélatif objectif": "Objective correlative", "Motif récurrent": "Leitmotiv", "Roman d’apprentissage": "Bildungsroman", "Roman picaresque": "Novela picaresca", "Réalisme magique": "Realismo mágico", "Analepse": "Flashback", "Prolepse": "Flash-forward", "Course contre la montre": "Ticking clock", "Préfiguration": "Foreshadowing", "Fusil de Tchekhov": "Chekhov’s gun", "Semer et récolter": "Setup and payoff", "Fausse piste": "Red herring", "Élément déclencheur": "Inciting incident", "Enjeux": "Stakes", "Point médian": "Midpoint", "Tout est perdu": "All is lost", "Point de non-retour": "Point of no return", "Faute tragique": "Hamartia", "Faire-valoir": "Foil", "Intrigue secondaire": "Subplot", "Arc de personnage": "Character arc", "Entrer tard, sortir tôt": "Late in, early out", "Montrer plutôt que dire": "Show, don’t tell", "Scène et suite": "Scene and sequel", "Tentatives et échecs": "Try-fail cycles", "Rythme narratif": "Pacing", "Montage alterné": "Cross-cutting", "Théorie de l’iceberg": "Iceberg theory", "Exposition distillée": "Incluing", "Construction d’univers": "Worldbuilding", "Défamiliarisation": "Ostranenie", "Récit enchâssé": "Frame story", "Structure en trois actes": "Three-act structure", "Voyage du héros": "The Hero’s Journey", "Voyage de l’héroïne": "The Heroine’s Journey", "Structure en sept points": "Seven-Point Story Structure", "Courbe de Fichte": "Fichtean curve", "Les sept intrigues fondamentales": "The Seven Basic Plots", "Quotient MICE": "MICE Quotient", "Architecte ou jardinier": "Plotters and pantsers", "Méthode du flocon": "Snowflake Method", "Séquencier": "Step outline", "Désir et besoin": "Want and need", "Premier jet": "Zero draft", "Les cinq commandements de la scène": "The Five Commandments of Storytelling", "Bible de série": "Series bible" },
 "en": { "Free indirect speech": "Style indirect libre", "Motif": "Leitmotiv", "First line": "Incipit", "Last line": "Explicit", "Black humor": "Humour noir", "Picaresque novel": "Novela picaresca", "Magical realism": "Realismo mágico", "Tragic flaw": "Hamartia", "Recognition and reversal": "Anagnorisis and peripeteia", "Defamiliarization": "Ostranenie" }
};

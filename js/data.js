'use strict';
/* Os tipos de narrador e os Materiais de Apoio vêm dos ficheiros da língua ativa (js/i18n.js escolhe quais); aqui só se criam as listas. */
const NARRATORS = [];
const SUPPORT = [];
const narratorByKey = k => NARRATORS.find(n => n.key === k);

/* Projeto de demonstração usado apenas na visita guiada (nunca é guardado) */
function demoProject(){
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

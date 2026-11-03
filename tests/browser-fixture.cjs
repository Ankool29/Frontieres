const fs=require('node:fs');
const directory=process.argv[2];
fs.copyFileSync('ecosystem.js',`${directory}/ecosystem.js`);
const smoke=String.raw`
;(async()=>{
clearInterval(timer);clearInterval(wildlifeTimer);
const results=[];
function check(condition,name){if(!condition)throw Error(name);results.push(name)}
try{
 check(S.map.length===72&&S.map[0].length===144,'nouvelle partie 144 × 72');
 $('exploreBtn').onclick();
 check($('detailGrid').children.length===225,'exploration 225 sous-zones');
 const initial=JSON.stringify(FrontieresEco.populationTotals(S.map));
 for(let i=0;i<30;i++)wildlifeStep();
 check(JSON.stringify(FrontieresEco.populationTotals(S.map))===initial,'animation conserve les effectifs');
 const state=JSON.parse(JSON.stringify(S));
 const expected=JSON.parse(JSON.stringify(S.map));
 for(let n=1;n<=30;n++)FrontieresEco.advance(expected,S.day+n,S.x,S.y,S.seed);
 let yields=0;const pulse=setInterval(()=>yields++,0),simulationStart=performance.now();
 const pending=$('ecoAdvance').onclick();
 check(ecologyBusy&&$('ecoAdvance').disabled,'simulation longue verrouillée');
 const busyDay=S.day;S.hour=23;tick();
 check(S.day===busyDay&&S.hour===23,'tick suspendu pendant la simulation longue');
 await pending;
 clearInterval(pulse);const simulation30Ms=performance.now()-simulationStart;
 check(yields>0,'interface disponible pendant les 30 jours');
 check(S.day===state.day+30,'bouton avance de 30 jours');
 check(JSON.stringify(S.map)===JSON.stringify(expected),'bouton et moteur quotidien identiques');
 const totals=FrontieresEco.populationTotals(S.map);
 check($('wildlife').textContent===totals.herb+' herbivores · '+totals.pred+' prédateurs','compteurs mondiaux exacts');
 const glyphs=ecoCounts(subData());
 const budget=FrontieresEco.detailPopulation(cell());
 check(glyphs.herb<=budget.herb&&glyphs.pred<=budget.pred,'groupes locaux réconciliés sans individus fictifs');
 const savedMap=JSON.parse(JSON.stringify(S.map));
 S.hour=23;tick();
 FrontieresEco.advance(savedMap,S.day,S.x,S.y,S.seed);
 check(JSON.stringify(S.map)===JSON.stringify(savedMap),'tick utilise le même moteur');
 const data=subData();
 cell().t="grass";cell().fauna=60;cell().predators=6;render();
 check($('ecoPop').textContent.includes('Herbivores 60 · Prédateurs 6'),'effectifs réels explicitement affichés');
 check(ecoCounts(data).herb===8&&ecoCounts(data).pred===3,'troupeau dense représenté par onze groupes : '+JSON.stringify({glyphs:ecoCounts(data),type:cell().t,biome:cell().biome}));
 const checkVisible=()=>{
  const labels=Array.from($('detailGrid').children,b=>b.textContent);
  const a=labels.filter(g=>g==='a').length,w=labels.filter(g=>g==='W').length;
  return $('ecoGlyphs').textContent.includes('visibles : a '+a+' · W '+w);
 };
 check(checkVisible(),'compteur de glyphes visibles respecte brouillard et joueur');
 const savedSeen=data.seen.slice();data.seen=Array.from({length:225},(_,i)=>i);
 subX=0;subY=0;render();for(let i=0;i<10;i++)wildlifeStep();
 check(checkVisible()&&cell().fauna===60&&cell().predators===6,'animation des groupes conserve individus et compteurs visibles');
 data.seen=savedSeen;
 const plot=Array.from({length:225},(_,i)=>i).find(i=>!['a','W','~','^'].includes(subGlyph(i)));
 subX=plot%15;subY=Math.floor(plot/15);data[plot]='t';
 const wood=S.wood;subGather();check(S.wood===wood+1&&data[plot]==='.', 'récolte conservée');
 const before=JSON.stringify(S.map);paused=true;S.hour=23;tick();wildlifeStep();
 check(JSON.stringify(S.map)===before,'pause conserve la simulation');paused=false;
 S.wood=100;S.stone=100;cell().b=null;cell().t='grass';
 document.querySelector('[data-b="hut"]').onclick();
 check(cell().b==='hut'&&S.buildings.includes('hut'),'construction conservée');
 $('save').onclick();const saved=JSON.parse(localStorage.getItem('frontieres-save'));
 check(saved.subzones[subKey()].seen.length>0&&saved.map[S.y][S.x].b==='hut','sauvegarde de l’exploration et des constructions');
 const migrated=FrontieresEco.migrate(saved.map,saved.seed);
 check(JSON.stringify(migrated)===JSON.stringify(S.map),'reprise sans modification des effectifs');
 const previousState=S,interrupted=$('ecoAdvance').onclick();fresh();const newDay=S.day;
 await interrupted;
 check(S!==previousState&&S.day===newDay&&!ecologyBusy&&!$('ecoAdvance').disabled,'nouvelle partie annule la simulation longue');
 document.body.innerHTML='<pre id="smoke-result">'+JSON.stringify({ok:true,results,metrics:{simulation30Ms:+simulation30Ms.toFixed(1),yields}})+'</pre>';
}catch(error){document.body.innerHTML='<pre id="smoke-result">'+JSON.stringify({ok:false,error:error.message,results})+'</pre>';}
})();
`;
for(const page of ['index.html','exploration.html']){
 const html=fs.readFileSync(page,'utf8');
 const closing=html.lastIndexOf('</script>');
 fs.writeFileSync(`${directory}/${page}`,html.slice(0,closing)+smoke+html.slice(closing));
}

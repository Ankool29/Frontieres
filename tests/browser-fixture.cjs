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
 const pending=$('ecoAdvance').onclick();
 check(ecologyBusy&&$('ecoAdvance').disabled,'simulation longue verrouillée');
 const busyDay=S.day;S.hour=23;tick();
 check(S.day===busyDay&&S.hour===23,'tick suspendu pendant la simulation longue');
 await pending;
 check(S.day===state.day+30,'bouton avance de 30 jours');
 check(JSON.stringify(S.map)===JSON.stringify(expected),'bouton et moteur quotidien identiques');
 const totals=FrontieresEco.populationTotals(S.map);
 check($('wildlife').textContent===totals.herb+' herbivores · '+totals.pred+' prédateurs','compteurs mondiaux exacts');
 const glyphs=ecoCounts(subData());
 check(glyphs.herb===cell().fauna&&glyphs.pred===cell().predators,'effectifs locaux réconciliés');
 const savedMap=JSON.parse(JSON.stringify(S.map));
 S.hour=23;tick();
 FrontieresEco.advance(savedMap,S.day,S.x,S.y,S.seed);
 check(JSON.stringify(S.map)===JSON.stringify(savedMap),'tick utilise le même moteur');
 const data=subData();
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
 document.body.innerHTML='<pre id="smoke-result">'+JSON.stringify({ok:true,results})+'</pre>';
}catch(error){document.body.innerHTML='<pre id="smoke-result">'+JSON.stringify({ok:false,error:error.message,results})+'</pre>';}
})();
`;
for(const page of ['index.html','exploration.html']){
 const html=fs.readFileSync(page,'utf8');
 const closing=html.lastIndexOf('</script>');
 fs.writeFileSync(`${directory}/${page}`,html.slice(0,closing)+smoke+html.slice(closing));
}

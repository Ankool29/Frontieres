// Mesures indépendantes des règles du moteur, utilisables sur une version historique.
function snapshot(eco,map,day){
  let herb=0,pred=0,biomass=0,land=0,occupied=0,predOccupied=0,maxHerb=0,maxPred=0,maxGlyphs=0,glyphs=0;
  for(const row of map)for(const c of row){
    herb+=c.fauna||0;pred+=c.predators||0;
    if(['water','rock','ruin'].includes(c.t))continue;
    land++;biomass+=c.vegetation||0;if(c.fauna)occupied++;if(c.predators)predOccupied++;
    maxHerb=Math.max(maxHerb,c.fauna||0);maxPred=Math.max(maxPred,c.predators||0);
    const visual=eco.detailPopulation?eco.detailPopulation(c):{herb:c.fauna||0,pred:c.predators||0};
    const count=Math.min(225,visual.herb+visual.pred);glyphs+=count;maxGlyphs=Math.max(maxGlyphs,count);
  }
  return {day,herb,pred,biomass:+biomass.toFixed(3),land,occupied,predOccupied,
    meanHerbDensity:+(herb/Math.max(1,land)).toFixed(4),maxHerb,maxPred,glyphTargets:glyphs,maxGlyphs};
}
function simulate(eco,seed,{width=144,height=72,days=480,timing=false}={}){
  const map=eco.generate(width,height,seed),initial=snapshot(eco,map,1),checkpoints=[initial],times=[];
  const migrations={herbivores:0,predators:0},extinctions={herbivoreDay:null,predatorDay:null};
  const flows={births:0,deaths:0,hunts:0,forageGrowth:0,forageClimateLoss:0,forageConsumed:0,forageReproduction:0};
  let peakHerb=initial.herb,peakPred=initial.pred;
  for(let day=2;day<=days+1;day++){
    const start=timing?performance.now():0,result=eco.advance(map,day,0,0,seed);
    if(timing)times.push(performance.now()-start);
    peakHerb=Math.max(peakHerb,result.herb);peakPred=Math.max(peakPred,result.pred);
    for(const key of Object.keys(migrations))migrations[key]+=result.migrations[key];
    for(const key of Object.keys(flows)){if(result[key]===undefined)flows[key]=null;else flows[key]+=result[key];}
    if(result.herb===0&&extinctions.herbivoreDay===null)extinctions.herbivoreDay=day;
    if(result.pred===0&&extinctions.predatorDay===null)extinctions.predatorDay=day;
    if([49,241,481].includes(day))checkpoints.push({...snapshot(eco,map,day),migrations:{...migrations},extinctions:{...extinctions}});
  }
  for(const key of Object.keys(flows))if(flows[key]!==null)flows[key]=+flows[key].toFixed(3);
  const metrics={seed,dimensions:[width,height],checkpoints,peakHerb,peakPred,migrations,extinctions,flows};
  if(timing){times.sort((a,b)=>a-b);metrics.timing={medianMs:+times[Math.floor(times.length*.5)].toFixed(2),p95Ms:+times[Math.floor(times.length*.95)].toFixed(2)};}
  return metrics;
}
module.exports={snapshot,simulate};

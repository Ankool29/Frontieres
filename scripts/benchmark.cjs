const {load}=require('../tests/helpers.cjs');
const fs=require('node:fs');
const eco=load(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):undefined);
for(const seed of [1,29,2026]){
 const map=eco.generate(144,72,seed);
 const totals=()=>map.flat().reduce((a,c)=>[a[0]+c.fauna,a[1]+c.predators],[0,0]);
 const checkpoints=[{day:1,populations:totals()}],timings=[];
 for(let day=2;day<=481;day++){
  const start=performance.now();eco.advance(map,day,0,0,seed);timings.push(performance.now()-start);
  if([31,49,97,241,481].includes(day))checkpoints.push({day,populations:totals()});
 }
 timings.sort((a,b)=>a-b);
 console.log(JSON.stringify({seed,checkpoints,medianMs:+timings[240].toFixed(2),p95Ms:+timings[456].toFixed(2)}));
}

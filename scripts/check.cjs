const fs=require('node:fs');
const engine=fs.readFileSync('ecosystem.js','utf8');
new Function(engine);
const scripts=[];
for(const path of ['index.html','exploration.html']){
  const html=fs.readFileSync(path,'utf8');
  const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  if(inline.length!==1)throw Error(`${path}: script principal manquant`);
  new Function(inline[0]);scripts.push(inline[0]);
  if(!html.includes('ecosystem.js?v=20261102-herds09'))throw Error(`${path}: version moteur incohérente`);
}
// La page de test ouvre directement l'exploration ; le reste doit rester identique.
if(scripts[1].replace('mapZoom=2;mapCenterX=S.x;mapCenterY=S.y;render();start();','start();')!==scripts[0]){
  throw Error('Les deux points d’entrée ont des moteurs de jeu différents');
}
console.log('Syntaxe JavaScript et cohérence des deux points d’entrée : OK');

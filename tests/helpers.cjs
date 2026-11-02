const fs = require('node:fs');
// Le moteur reste un script navigateur, sans dépendance ni adaptation en production.
const load = (source = fs.readFileSync('ecosystem.js', 'utf8')) => {
  const window = {};
  new Function('window', source)(window);
  return window.FrontieresEco;
};
const tile = (overrides = {}) => ({t:'grass', biome:'Prairie', vegetation:70,
  moisture:.8, temperature:.6, trees:0, fauna:0, predators:0, ...overrides});
const clone = value => JSON.parse(JSON.stringify(value));
const counts = data => Array.from({length:225}, (_,i) => data[i] ?? data.base[i])
  .reduce((a,g) => {if(g==='a')a.herb++;if(g==='W')a.pred++;return a;}, {herb:0,pred:0});
module.exports = {load,tile,clone,counts};

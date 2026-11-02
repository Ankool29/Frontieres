/* FRONTIÈRES — moteur écologique léger, déterministe et persistant */
(function () {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (x, y, seed) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123; return n - Math.floor(n); };
  const seasons = ["Printemps", "Été", "Automne", "Hiver"];
  function season(day) {
    const d = ((day - 1) % 48 + 48) % 48;
    return { name: seasons[Math.floor(d / 12)], year: Math.floor((day - 1) / 48) + 1 };
  }
  // Bruit interpolé : les grandes formes du relief sont continues, contrairement à un tirage case par case.
  function smoothNoise(x, y, scale, seed) {
    const gx = x / scale, gy = y / scale, ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy;
    const fade = t => t * t * (3 - 2 * t);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    const u = fade(fx), v = fade(fy);
    return (a * (1-u) + b*u) * (1-v) + (c * (1-u) + d*u) * v;
  }
  function generate(w, h, seed) {
    const map = [], elevationGrid = Array.from({length:h}, () => Array(w).fill(0));
    // Première passe : continents, bassins et relief à plusieurs échelles.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const continental = smoothNoise(x, y, 25, seed + 3) * .62 + smoothNoise(x, y, 12, seed + 7) * .25 + smoothNoise(x, y, 5, seed + 11) * .13;
      const ridgeNoise = smoothNoise(x + 37, y - 19, 10, seed + 23);
      const ridge = 1 - Math.abs(ridgeNoise * 2 - 1);
      elevationGrid[y][x] = clamp(.09 + continental * .95 + Math.pow(ridge, 3) * .22 - .30, 0, 1);
    }
    // Lissage local : les pentes et les vallées forment des ensembles continus.
    const raw = elevationGrid.map(row => row.slice());
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let sum = raw[y][x] * 4;
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) if(dx||dy) sum += raw[y+dy][x+dx];
      elevationGrid[y][x] = sum / 12;
    }
    const moistureGrid = Array.from({length:h}, (_,y) => Array.from({length:w}, (_,x) =>
      clamp(.12 + smoothNoise(x+81,y-27,18,seed+31)*.52 + smoothNoise(x,y,7,seed+37)*.28,0,1)));
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const elevation = elevationGrid[y][x], moisture = moistureGrid[y][x];
        const latitude = Math.abs((y / Math.max(1,h-1)) - .5) * 2;
        const temperature = clamp(.94 - latitude * .72 - elevation * .36 + (smoothNoise(x,y,22,seed+43)-.5)*.12,0,1);
        const biome = elevation < .205 ? "Océan" : elevation > .64 ? "Montagnes" :
          temperature < .22 ? "Toundra" : moisture > .78 && elevation < .48 ? "Marécage" :
          temperature > .69 && moisture < .27 ? "Désert" : temperature < .4 && moisture > .46 ? "Taïga" :
          moisture > .59 ? "Forêt tempérée" : temperature > .59 ? "Savane" : "Prairie";
        let t = elevation < .205 ? "water" : elevation > .64 ? "rock" : biome === "Désert" ? "sand" :
          ["Forêt tempérée","Taïga","Marécage"].includes(biome) ? "forest" : "grass";
        const vegetation = t === "forest" ? 65 + Math.round(moisture*30) : t === "grass" ? 20 + Math.round(moisture*38) : t === "sand" ? 3 : 0;
        row.push({t,b:null,biome,elevation:+elevation.toFixed(3),moisture:+moisture.toFixed(3),
          temperature:+temperature.toFixed(3),vegetation,trees:t==="forest"?5+Math.floor(hash(x,y,seed+9)*8):0,
          fauna:["Forêt tempérée","Taïga","Prairie","Savane"].includes(biome)?1+Math.floor(hash(x,y,seed+13)*4):0,
          explored:false,soil:moisture>.65?"riche":moisture<.25?"pauvre":"ordinaire",
          waterway:false,waterKind:t==="water"?"ocean":null,flow:0,downstream:null});
      }
      map.push(row);
    }
    // Drainage : chaque case terrestre s'écoule vers son voisin le plus bas.
    const ordered=[];
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const c=map[y][x]; if(c.t==="water")continue;
      let low=c.elevation, target=null;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy,n=map[ny][nx];
        if(n.elevation<low){low=n.elevation;target={x:nx,y:ny};}
      }
      c.downstream=target; c.flow=1; ordered.push({x,y,e:c.elevation});
    }
    ordered.sort((a,b)=>b.e-a.e);
    for(const p of ordered){const c=map[p.y][p.x];if(c.downstream){const d=map[c.downstream.y][c.downstream.x];d.flow+=c.flow;}}
    // Cours d'eau : les accumulations importantes dessinent des réseaux qui convergent vers la mer.
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const c=map[y][x];
      if(c.t!=="water"&&c.flow>=12){c.waterway=true;c.biome="Littoral";c.moisture=clamp(c.moisture+.16,0,1);}
    }
    // Petits lacs intérieurs dans les cuvettes fermées, sans transformer les plaines en mares isolées.
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
      const c=map[y][x];if(c.t==="water"||c.elevation>.43||c.flow>3)continue;
      let lower=false,landNeighbours=0;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(dx||dy){
        const n=map[y+dy][x+dx];if(n.t!=="water")landNeighbours++;
        if(n.elevation<c.elevation-.025)lower=true;
      }
      if(!lower&&landNeighbours>=18&&hash(x,y,seed+97)>.91){c.t="water";c.waterKind="lake";c.biome="Lac";c.vegetation=0;c.trees=0;}
    }
    // Ruines rares, posées sur la terre ferme uniquement.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=map[y][x];if(c.t!=="water"&&!c.waterway&&hash(x,y,seed+67)<.006)c.t="ruin";}
    return map;
  }
  function migrate(map, seed) {
    const generated = generate(map[0].length, map.length, seed || 1);
    map.forEach((row, y) => row.forEach((c, x) => {
      const g = generated[y][x];
      ["biome", "elevation", "moisture", "temperature", "vegetation", "trees", "fauna", "soil", "waterway", "waterKind", "flow", "downstream"].forEach(k => { if (c[k] === undefined) c[k] = g[k]; });
      if (c.t === "forest" && c.trees === 0) c.trees = 5;
      c.explored = c.explored || false;
    }));
    return map;
  }
  function weatherAt(tile, day, seed) {
    const s = season(day), roll = hash(day, Math.round(tile.moisture * 100), seed + 101);
    const temp = tile.temperature + ({ "Printemps": 0, "Été": .17, "Automne": -.04, "Hiver": -.24 }[s.name]);
    let type = "Dégagé";
    if (temp < .2 && tile.moisture > .35) type = roll > .58 ? "Neige" : "Gel";
    else if (tile.moisture > .68 && roll > .32) type = roll > .86 ? "Orage" : "Pluie";
    else if (tile.moisture > .48 && roll > .72) type = "Averses";
    else if (tile.moisture < .2 && temp > .5) type = "Sec";
    else if (roll < .12) type = "Brouillard";
    return { type, season: s.name, year: s.year, temperature: Math.round(clamp(temp, 0, 1) * 34 - 8) };
  }
  function advance(map, day, px, py, seed) {
    map.forEach((row, y) => row.forEach((c, x) => {
      const near = Math.abs(x - px) <= 4 && Math.abs(y - py) <= 4;
      if (!near && day % 4 !== 0) return;
      const s = season(day).name;
      const growth = s === "Printemps" ? 1.35 : s === "Été" ? .8 : s === "Automne" ? .35 : .08;
      const localWeather = weatherAt(c, day, seed + x * 31 + y * 17);
      if (["Pluie", "Orage", "Averses", "Neige"].includes(localWeather.type)) c.moisture = clamp(c.moisture + .035, 0, 1);
      else if (localWeather.temperature > 20) c.moisture = clamp(c.moisture - .012, 0, 1);
      if (["Forêt tempérée", "Taïga", "Marécage"].includes(c.biome)) {
        if (c.trees > 0) c.vegetation = clamp(c.vegetation + growth * (c.moisture + .25), 0, 100);
        else if (c.moisture > .48 && hash(x, y, seed + day) > .55) c.vegetation = clamp(c.vegetation + growth * .7, 0, 100);
        if (c.trees === 0 && c.vegetation > 58) c.trees = 1;
        else if (c.trees > 0 && c.trees < 14 && c.vegetation > 72 && hash(x, y, seed + day + 5) > .72) c.trees++;
        if (c.trees > 0 && c.vegetation > 32) c.t = "forest";
      } else if (["Prairie", "Savane"].includes(c.biome)) c.vegetation = clamp(c.vegetation + growth * (c.moisture - .25), 0, 75);
      if (c.fauna > 0 && c.vegetation < 12) c.fauna = Math.max(0, c.fauna - 1);
      else if (c.fauna < 6 && c.vegetation > 55 && hash(x, y, seed + day + 19) > .94) c.fauna++;
    }));
  }
  window.FrontieresEco = { generate, migrate, season, weatherAt, advance };
})();
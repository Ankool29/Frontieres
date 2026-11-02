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
  function generate(w, h, seed) {
    const map = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const nx = x / Math.max(1, w - 1), ny = y / Math.max(1, h - 1);
        const broad = Math.sin(nx * 5.1 + seed * .013) * .13 + Math.cos(ny * 4.2 - seed * .009) * .12;
        const detail = (hash(x, y, seed) - .5) * .22 + (hash(x * 2, y * 2, seed + 17) - .5) * .08;
        const elevation = clamp(.48 + broad + detail + Math.sin((nx + ny) * 7) * .08, 0, 1);
        const moisture = clamp(.48 + Math.sin(nx * 7 + seed * .02) * .19 + Math.cos(ny * 6 - seed * .01) * .16 + (hash(x, y, seed + 31) - .5) * .2, 0, 1);
        const temperature = clamp(.78 - Math.abs(ny - .5) * 1.15 - elevation * .22 + Math.sin(nx * 3 + seed) * .06, 0, 1);
        const biome = elevation < .22 ? "Littoral" : elevation > .82 ? "Montagnes" : temperature < .23 ? "Toundra" :
          moisture > .78 && elevation < .48 ? "Marécage" : temperature > .68 && moisture < .28 ? "Désert" :
          temperature < .42 && moisture > .48 ? "Taïga" : moisture > .57 ? "Forêt tempérée" :
          temperature > .58 ? "Savane" : "Prairie";
        const t = elevation < .22 ? "water" : elevation > .82 ? "rock" : biome === "Désert" ? "sand" :
          ["Forêt tempérée", "Taïga", "Marécage"].includes(biome) ? "forest" : "grass";
        const vegetation = t === "forest" ? 68 + Math.round(hash(x, y, seed + 4) * 28) :
          t === "grass" ? 25 + Math.round(moisture * 35) : t === "sand" ? 4 : 0;
        row.push({ t, b: null, biome, elevation: +elevation.toFixed(3), moisture: +moisture.toFixed(3),
          temperature: +temperature.toFixed(3), vegetation, trees: t === "forest" ? 5 + Math.floor(hash(x, y, seed + 9) * 8) : 0,
          fauna: ["Forêt tempérée", "Taïga", "Prairie", "Savane"].includes(biome) ? 1 + Math.floor(hash(x, y, seed + 13) * 4) : 0,
          explored: false, soil: moisture > .65 ? "riche" : moisture < .25 ? "pauvre" : "ordinaire" });
      }
      map.push(row);
    }
    return map;
  }
  function migrate(map, seed) {
    const generated = generate(map[0].length, map.length, seed || 1);
    map.forEach((row, y) => row.forEach((c, x) => {
      const g = generated[y][x];
      ["biome", "elevation", "moisture", "temperature", "vegetation", "trees", "fauna", "soil"].forEach(k => { if (c[k] === undefined) c[k] = g[k]; });
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
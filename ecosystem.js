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
  // Bruit 3D échantillonné sur une sphère : la longitude se referme sans couture.
  function noise3(x,y,z,scale,seed) {
    const X=x/scale,Y=y/scale,Z=z/scale,ix=Math.floor(X),iy=Math.floor(Y),iz=Math.floor(Z);
    const fx=X-ix,fy=Y-iy,fz=Z-iz,fade=t=>t*t*(3-2*t);
    const u=fade(fx),v=fade(fy),w=fade(fz);
    const h=(a,b,c)=>{const n=Math.sin(a*127.1+b*311.7+c*74.7+seed*19.19)*43758.5453;return n-Math.floor(n);};
    const lerp=(a,b,t)=>a+(b-a)*t;
    const plane=(dz)=>lerp(
      lerp(h(ix,iy,iz+dz),h(ix+1,iy,iz+dz),u),
      lerp(h(ix,iy+1,iz+dz),h(ix+1,iy+1,iz+dz),u),v);
    return lerp(plane(0),plane(1),w);
  }
  function generate(w,h,seed) {
    const map=[],elevation=Array.from({length:h},()=>Array(w).fill(0)),moisture=Array.from({length:h},()=>Array(w).fill(0));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const lon=2*Math.PI*x/w,lat=(y/(h-1)-.5)*Math.PI,cl=Math.cos(lat);
      const sx=Math.cos(lon)*cl,sy=Math.sin(lon)*cl,sz=Math.sin(lat);
      const continent=noise3(sx,sy,sz,0.72,seed+3)*.62+noise3(sx,sy,sz,0.34,seed+7)*.27+noise3(sx,sy,sz,0.16,seed+11)*.11;
      const ridge=1-Math.abs(noise3(sx+.31,sy-.17,sz+.23,.29,seed+23)*2-1);
      elevation[y][x]=clamp(.02+continent*.98+Math.pow(ridge,3)*.19-.32,0,1);
      moisture[y][x]=clamp(.08+noise3(sx-.21,sy+.41,sz-.13,.55,seed+31)*.58+noise3(sx,sy,sz,.21,seed+37)*.28,0,1);
    }
    const raw=elevation.map(r=>r.slice());
    for(let y=1;y<h-1;y++)for(let x=0;x<w;x++){
      let sum=raw[y][x]*4;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)sum+=raw[y+dy][(x+dx+w)%w];
      elevation[y][x]=sum/12;
    }
    for(let y=0;y<h;y++){
      const row=[];
      for(let x=0;x<w;x++){
        const e=elevation[y][x],m=moisture[y][x],latitude=Math.abs(y/(h-1)-.5)*2,lon=2*Math.PI*x/w,lat=(y/(h-1)-.5)*Math.PI,cl=Math.cos(lat),sx=Math.cos(lon)*cl,sy=Math.sin(lon)*cl,sz=Math.sin(lat);
        const temp=clamp(.98-latitude*.78-e*.34,0,1),geo=noise3(sx+.6,sy-.4,sz+.2,.24,seed+77),mineralRoll=hash(x,y,seed+79);
        const biome=e<.205?"Océan":e>.50?"Montagnes":temp<.22?"Toundra":m>.79&&e<.48?"Marécage":temp>.70&&m<.28?"Désert":temp<.4&&m>.46?"Taïga":m>.59?"Forêt tempérée":temp>.59?"Savane":"Prairie";
        let t=e<.205?"water":e>.50?"rock":biome==="Désert"?"sand":["Forêt tempérée","Taïga","Marécage"].includes(biome)?"forest":"grass";
        row.push({t,b:null,biome,elevation:+e.toFixed(3),moisture:+m.toFixed(3),temperature:+temp.toFixed(3),
          vegetation:t==="forest"?65+Math.round(m*30):t==="grass"?20+Math.round(m*38):t==="sand"?3:0,
          trees:t==="forest"?5+Math.floor(hash(x,y,seed+9)*8):0,
          fauna:["Forêt tempérée","Taïga","Prairie","Savane"].includes(biome)?1+Math.floor(hash(x,y,seed+13)*4):0,
          explored:false,soil:m>.72?"tourbeux":m>.62?"fertile":e>.50?"rocheux":m<.22?"sableux":"ordinaire",geology:e>.50?(geo>.66?"granite":geo>.33?"basalte":"métamorphique"):(geo>.55?"calcaire":geo>.28?"grès":"sédimentaire"),mineral:mineralRoll>.91?(geo>.5?"fer": "cuivre"):mineralRoll>.84?"charbon":null,mineralAmount:mineralRoll>.84?1+Math.floor(hash(x,y,seed+83)*5):0,floodplain:false,waterway:false,
          waterKind:t==="water"?"ocean":null,flow:0,downstream:null});
      }
      map.push(row);
    }
    // Drainage global avec longitude circulaire : les fleuves suivent les pentes.
    const ordered=[];
    for(let y=1;y<h-1;y++)for(let x=0;x<w;x++){
      const c=map[y][x];if(c.t==="water")continue;
      let low=c.elevation,target=null;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=(x+dx+w)%w,ny=y+dy,n=map[ny][nx];
        if(n.elevation<low){low=n.elevation;target={x:nx,y:ny};}
      }
      c.downstream=target;c.flow=1;ordered.push({x,y,e:c.elevation});
    }
    ordered.sort((a,b)=>b.e-a.e);
    for(const p of ordered){const c=map[p.y][p.x];if(c.downstream){const d=map[c.downstream.y][c.downstream.x];d.flow+=c.flow;}}
    for(let y=1;y<h-1;y++)for(let x=0;x<w;x++){
      const c=map[y][x];
      if(c.t!=="water"&&c.flow>=12){c.waterway=true;c.waterKind="river";c.t="water";c.biome="Littoral";c.moisture=clamp(c.moisture+.16,0,1);}
    }
    // Les terrains voisins des rivières deviennent des plaines alluviales fertiles.
    for(let y=1;y<h-1;y++)for(let x=0;x<w;x++){
      const c=map[y][x];if(c.t==="water")continue;
      let beside=false;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){
        const n=map[y+dy][(x+dx+w)%w];if(n.waterway)beside=true;
      }
      if(beside){c.floodplain=true;c.soil="alluvial";c.moisture=clamp(c.moisture+.12,0,1);}
    }
    // Lacs endoréiques dans certaines cuvettes fermées.
    for(let y=2;y<h-2;y++)for(let x=0;x<w;x++){
      const c=map[y][x];if(c.t==="water"||c.elevation>.43||c.flow>3)continue;
      let lower=false,land=0;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(dx||dy){
        const n=map[y+dy][(x+dx+w)%w];if(n.t!=="water")land++;
        if(n.elevation<c.elevation-.025)lower=true;
      }
      if(!lower&&land>=18&&hash(x,y,seed+97)>.91){c.t="water";c.waterKind="lake";c.biome="Lac";c.vegetation=0;c.trees=0;}
    }
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=map[y][x];if(c.t!=="water"&&!c.waterway&&hash(x,y,seed+67)<.004)c.t="ruin";}
    return map;
  }
  function migrate(map, seed) {
    const generated = generate(map[0].length, map.length, seed || 1);
    map.forEach((row, y) => row.forEach((c, x) => {
      const g = generated[y][x];
      ["biome", "elevation", "moisture", "temperature", "vegetation", "trees", "fauna", "soil", "waterway", "waterKind", "flow", "downstream", "geology", "mineral", "mineralAmount", "floodplain"].forEach(k => { if (c[k] === undefined) c[k] = g[k]; });
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
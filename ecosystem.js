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
          fauna:["Forêt tempérée","Taïga","Prairie","Savane","Marécage"].includes(biome)?(hash(x,y,seed+13)>.62?1+Math.floor(hash(x,y,seed+13)*2):0):0,predators:["Forêt tempérée","Taïga","Prairie","Savane"].includes(biome)&&hash(x,y,seed+17)>.97?1:0,
          explored:false,soil:m>.72?"tourbeux":m>.62?"fertile":e>.50?"rocheux":m<.22?"sableux":"ordinaire",geology:e>.50?(geo>.66?"granite":geo>.33?"basalte":"métamorphique"):(geo>.55?"calcaire":geo>.28?"grès":"sédimentaire"),mineral:mineralRoll>.94?(geo>.5?"fer": "cuivre"):mineralRoll>.89?"charbon":null,mineralAmount:mineralRoll>.89?1+Math.floor(hash(x,y,seed+83)*5):0,floodplain:false,waterway:false,
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
      ["biome", "elevation", "moisture", "temperature", "vegetation", "trees", "fauna", "predators", "soil", "waterway", "waterKind", "flow", "downstream", "geology", "mineral", "mineralAmount", "floodplain"].forEach(k => { if (c[k] === undefined) c[k] = g[k]; });
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
  // Simulation journalière de l'écosystème. Les populations sont stockées par cellule ;
  // les déplacements sont appliqués en fin de journée pour éviter les effets d'ordre.
  function advance(map, day, px, py, seed) {
    const h=map.length,w=map[0].length,events=[],moves=Array.from({length:h},()=>Array.from({length:w},()=>({fauna:0,predators:0})));
    const seasonName=season(day).name;
    const seasonGrowth={"Printemps":1.45,"Été":.82,"Automne":.32,"Hiver":.06}[seasonName];
    const wrap=x=>(x+w)%w;
    let herbivores=0,predatorCount=0,green=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=map[y][x]; if(c.t==="water"||c.t==="rock"||c.t==="ruin")continue;
      const local=weatherAt(c,day,seed+x*31+y*17),temp=local.temperature;
      const wet=["Pluie","Orage","Averses","Neige"].includes(local.type);
      if(wet)c.moisture=clamp(c.moisture+.025,0,1);
      else c.moisture=clamp(c.moisture-(temp>23?.018:.006),0,1);
      const forest=["Forêt tempérée","Taïga","Marécage"].includes(c.biome);
      const grass=["Prairie","Savane","Toundra"].includes(c.biome);
      if(forest){
        if(c.trees>0){
          c.vegetation=clamp(c.vegetation+seasonGrowth*(c.moisture-.18),0,100);
          if(c.moisture<.12&&temp>20&&hash(x,y,seed+day*3)<.025){c.trees=Math.max(0,c.trees-1);c.vegetation=Math.max(0,c.vegetation-12);}
        }else if(c.moisture>.43&&c.vegetation>35&&hash(x,y,seed+day*5)>.975)c.trees=1;
        if(c.trees>0&&c.trees<14&&c.vegetation>65&&c.moisture>.38&&hash(x,y,seed+day+5)>.91)c.trees++;
        if(c.trees>0&&c.vegetation>24)c.t="forest";else if(c.t==="forest")c.t="grass";
      }else if(grass){
        const climateFactor=c.moisture<.12?-.7:1;
        c.vegetation=clamp(c.vegetation+seasonGrowth*climateFactor*(c.moisture+.15),0,85);
      }else if(c.biome==="Désert")c.vegetation=clamp(c.vegetation+(wet?.08:-.015),0,15);
      if(c.vegetation>0)green++;
      let herb=Math.max(0,c.fauna||0),pred=Math.max(0,c.predators||0);
      // Herbivores eat vegetation, reproduce only when food and climate permit.
      if(herb>0){
        const consumed=Math.min(c.vegetation,herb*(forest?.65:1.05));
        c.vegetation=Math.max(0,c.vegetation-consumed);
        const stress=c.vegetation<8||c.moisture<.08||temp< -8;
        if(stress&&hash(x,y,seed+day*7)<.22)herb--;
        else if(!stress&&c.vegetation>48&&c.moisture>.25&&herb<7&&hash(x,y,seed+day*11)>.965)herb++;
      }else if(c.vegetation>58&&c.moisture>.3&&temp>0&&hash(x,y,seed+day*13)>.992)herb=1;
      // Predators consume local prey and disperse toward neighboring prey-rich cells.
      if(pred>0&&herb>0&&hash(x,y,seed+day*17)>.35){herb--;if(hash(x,y,seed+day*19)>.82&&pred<3)pred++;}
      else if(pred>0&&hash(x,y,seed+day*23)>.94)pred--;
      if(pred===0&&herb>=3&&hash(x,y,seed+day*29)>.997)pred=1;
      c.fauna=herb;c.predators=pred;herbivores+=herb;predatorCount+=pred;
      // Migration: a small fraction of animals moves one tile toward better habitat.
      for(const kind of ["fauna","predators"]){
        const count=kind==="fauna"?herb:pred;
        if(!count||hash(x,y,seed+day*(kind==="fauna"?31:37))<.88)continue;
        let best=null,bestScore=-Infinity;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){
          const ny=y+dy,nx=wrap(x+dx);if(ny<0||ny>=h)continue;
          const n=map[ny][nx];if(n.t==="water"||n.t==="rock"||n.t==="ruin")continue;
          const score=(kind==="fauna"?n.vegetation*.65+n.moisture*18+n.fauna*2:n.fauna*12+(n.biome==="Forêt tempérée"?4:0))+hash(nx,ny,seed+day+43);
          if(score>bestScore){bestScore=score;best={x:nx,y:ny};}
        }
        if(best){moves[y][x][kind]--;moves[best.y][best.x][kind]++;}
      }
    }
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=map[y][x],m=moves[y][x];
      c.fauna=clamp((c.fauna||0)+m.fauna,0,12);
      c.predators=clamp((c.predators||0)+m.predators,0,5);
    }
    // Events are sparse and grounded in actual changes, not random narrative filler.
    if(day%4===0){
      let drought=0,abundance=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=map[y][x];if(c.t!=="water"&&c.moisture<.12)drought++;if(c.fauna>=5)abundance++;}
      if(drought>w*h*.08)events.push("Sécheresse : plusieurs régions manquent d'eau.");
      if(abundance>8)events.push("Des troupeaux prospèrent dans les régions fertiles.");
      if(herbivores===0)events.push("La faune herbivore a disparu de cette planète.");
    }
    return {events,herbivores,predators:predatorCount,vegetated:green};
  }
  // Découpage déterministe d'un territoire en 25 sous-zones de paysage.
  function detailAt(tile,x,y,seed){
    const b=tile.biome||'Prairie',out=[],forest=b==='Forêt tempérée'||b==='Taïga',wet=b==='Marécage',desert=b==='Désert',mountain=b==='Montagnes'||tile.t==='rock',tundra=b==='Toundra',savanna=b==='Savane',water=tile.t==='water';
    let trees=0,rocks=0,clearings=0,wetlands=0;
    for(let gy=0;gy<15;gy++){const row=[];for(let gx=0;gx<15;gx++){
      const parentX=Math.floor(gx/3),parentY=Math.floor(gy/3);
      const r=hash(x*7+parentX,y*7+parentY,seed+701);
      const detail=hash(x*31+gx,y*31+gy,seed+1701);
      let g='.';
      if(water)g='~';else if(mountain)g=r<.58?'^':r<.82?':':'.';else if(forest)g=r<.58?'T':r<.78?'t':'.';else if(wet)g=r<.22?'~':r<.7?';':r<.86?'t':'.';else if(desert)g=r<.72?':':r<.9?"'":'.';else if(tundra)g=r<.52?'*':r<.76?'^':'.';else if(savanna)g=r<.16?'T':r<.43?'"':'.';else g=r<.12?'^':r<.28?'t':'.';
      if(g==='T'&&detail>.72)g='t';else if(g==='t'&&detail>.77)g='.';else if(g==='.'&&detail<.07)g='"';else if(g==='^'&&detail>.85)g=':';
      if(g==='T')trees++;if(g==='^')rocks++;if(g==='~'||g===';')wetlands++;if(g==='.')clearings++;row.push(g);
    }out.push(row)}
    if(!water&&!mountain&&tile.fauna>0){const n=Math.min(7,Math.ceil(tile.fauna/2));for(let i=0;i<n;i++){const gx=Math.floor(hash(x+i*3,y+i*5,seed+401)*15),gy=Math.floor(hash(x+i*7,y+i*2,seed+409)*15);if(out[gy][gx]!== '~'&&out[gy][gx]!=='^')out[gy][gx]='a'}}
    if(!water&&!mountain&&tile.predators>0){const gx=Math.floor(hash(x+11,y+17,seed+419)*15),gy=Math.floor(hash(x+19,y+3,seed+421)*15);if(out[gy][gx]!=='~'&&out[gy][gx]!=='^')out[gy][gx]='W'}
    return {tiles:out,trees,rocks,clearings,wetlands,subzoneKm:250/15};
  }
    window.FrontieresEco = { generate, migrate, season, weatherAt, advance, detailAt };
})();
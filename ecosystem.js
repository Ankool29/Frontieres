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
    for(const row of map)for(const c of row)if(!habitable(c)){c.fauna=0;c.predators=0;}
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
  const habitable = c => c && !["water", "rock", "ruin"].includes(c.t);
  // Arrondi stochastique reproductible, coût indépendant de la taille du troupeau.
  const sample = (expected, x, y, seed) => Math.floor(expected) + (hash(x,y,seed) < expected % 1 ? 1 : 0);
  function climateQuality(c, temp) {
    return clamp(c.moisture/.25,.05,1)*clamp((temp+12)/12,.1,1)*clamp((45-temp)/15,.2,1);
  }
  // Une seule étape par espèce : les arrivants ne repartent pas le même jour.
  // Longitude circulaire, latitude bornée, voisins par un bord commun uniquement.
  function migrateWildlife(map, day, seed, kind, climate) {
    const h=map.length,w=map[0].length,n=w*h;
    const predator=kind==="predators";
    const delta=new Float64Array(n),foodDelta=predator?new Float64Array(n):null,quality=climate||new Float64Array(n);
    if(!climate)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=map[y][x];
      if(habitable(c))quality[y*w+x]=climateQuality(c,weatherAt(c,day,seed+x*31+y*17).temperature);
    }
    const score=(c,i)=>quality[i]*(predator?c.fauna/(c.predators+.5):c.vegetation/(c.fauna+1));
    let moved=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=map[y][x],i=y*w+x,count=c[kind]||0;
      if(!habitable(c)||!count)continue;
      const here=score(c,i);
      let best=-1,bestScore=here*1.1+.2;
      // Varier les égalités sans favoriser systématiquement l'est ou l'ouest.
      const directions=[[1,0],[-1,0],[0,1],[0,-1]],offset=Math.floor(hash(x,y,seed+day*41)*4);
      for(let k=0;k<4;k++){
        const [dx,dy]=directions[(k+offset)%4],nx=(x+dx+w)%w,ny=y+dy;
        if(ny<0||ny>=h)continue;
        const j=ny*w+nx,d=map[ny][nx];
        if(j===i||!habitable(d))continue;
        const value=score(d,j);
        if(value>bestScore){best=j;bestScore=value;}
      }
      if(best<0)continue;
      const pressure=predator?1-clamp(c.fauna/(count*3),0,1):1-clamp(here/12,0,1);
      const amount=Math.min(count,sample(count*(.15+.45*pressure),x,y,seed+day*(predator?37:31)));
      if(!amount)continue;
      delta[i]-=amount;delta[best]+=amount;moved+=amount;
      if(predator){const food=(c.predatorFood??count*12)*amount/count;foodDelta[i]-=food;foodDelta[best]+=food;}
    }
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=map[y][x],i=y*w+x;
      if(predator)c.predatorFood=Math.max(0,(c.predatorFood??(c.predators||0)*12)+foodDelta[i]);
      c[kind]=(c[kind]||0)+delta[i];
    }
    return moved;
  }
  function populationTotals(map) {
    let herbivores=0,predators=0,trees=0,vegetated=0;
    for(const row of map)for(const c of row){herbivores+=c.fauna||0;predators+=c.predators||0;trees+=c.trees||0;if(c.vegetation>0)vegetated++;}
    // Alias conservés pour l'interface et les anciennes sauvegardes.
    return {herbivores,predators,vegetated,herb:herbivores,pred:predators,trees};
  }
  // Ressources puis dispersion puis démographie : le départ reste possible avant la famine.
  function advance(map, day, px, py, seed) {
    const h=map.length,w=map[0].length,events=[],climate=new Float64Array(w*h);
    const seasonName=season(day).name;
    const seasonGrowth={"Printemps":1.45,"Été":.82,"Automne":.32,"Hiver":.06}[seasonName];
    let forageGrowth=0,forageClimateLoss=0,forageConsumed=0,forageReproduction=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=map[y][x];if(!habitable(c))continue;
      const previousVegetation=c.vegetation;
      const local=weatherAt(c,day,seed+x*31+y*17),temp=local.temperature;
      const wet=["Pluie","Orage","Averses","Neige"].includes(local.type);
      c.moisture=clamp(c.moisture+(wet?.025:-(temp>23?.018:.006)),0,1);
      climate[y*w+x]=climateQuality(c,temp);
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
        c.vegetation=clamp(c.vegetation+seasonGrowth*(c.moisture<.12?-.7:1)*(c.moisture+.15),0,85);
      }else if(c.biome==="Désert")c.vegetation=clamp(c.vegetation+(wet?.08:-.015),0,15);
      forageGrowth+=Math.max(0,c.vegetation-previousVegetation);
      forageClimateLoss+=Math.max(0,previousVegetation-c.vegetation);
    }
    const migrations={herbivores:migrateWildlife(map,day,seed,"fauna",climate),predators:migrateWildlife(map,day,seed,"predators",climate)};
    let births=0,hunts=0,deaths=0,herbivoreBirths=0,predatorBirths=0,herbivoreDeaths=0,predatorDeaths=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=map[y][x];if(!habitable(c))continue;
      let herb=c.fauna||0,pred=c.predators||0;
      const quality=climate[y*w+x];
      const forest=["Forêt tempérée","Taïga","Marécage"].includes(c.biome);
      const demand=herb*(forest?.65:1.05),fed=demand?Math.min(1,c.vegetation/demand):0;
      forageConsumed+=Math.min(c.vegetation,demand);
      c.vegetation=Math.max(0,c.vegetation-demand);
      const lost=Math.min(herb,sample(herb*(.002+.22*(1-fed*quality)),x,y,seed+day*7));
      herb-=lost;deaths+=lost;herbivoreDeaths+=lost;
      // Ne pas convertir un simple stock initial de verdure en naissances gratuites.
      // Conserver six jours de fourrage ; chaque naissance coûte douze unités.
      const fertility=seasonName==="Printemps"?.02:seasonName==="Été"?.012:seasonName==="Automne"?.003:0;
      const surplus=Math.max(0,c.vegetation-demand*6);
      const born=Math.min(Math.floor(surplus/12),sample(herb*fertility*fed*quality*clamp(surplus/((herb+1)*12),0,1),x,y,seed+day*11));
      c.vegetation-=born*12;forageReproduction+=born*12;
      herb+=born;births+=born;herbivoreBirths+=born;
      if(pred){
        // Un repas nourrit plusieurs jours ; aucun décès sur un simple échec de chasse.
        const caught=Math.min(herb,sample(pred*.32*herb/(herb+2),x,y,seed+day*17));
        herb-=caught;hunts+=caught;
        let food=Math.min(pred*24,(c.predatorFood??pred*12)+caught*12)-pred;
        const dead=Math.min(pred,sample(pred*(food<0?.10:.001),x,y,seed+day*23));
        food=Math.max(0,food)*(pred-dead)/pred;pred-=dead;deaths+=dead;predatorDeaths+=dead;
        const cubs=pred&&food/pred>=12?sample(pred*.012*quality*clamp(herb/((pred+1)*3),0,1),x,y,seed+day*19):0;
        pred+=cubs;births+=cubs;predatorBirths+=cubs;c.predatorFood=food;
      }else c.predatorFood=0;
      c.fauna=herb;c.predators=pred;
    }
    const totals=populationTotals(map);
    if(day%4===0){
      let drought=0,abundance=0;
      for(const row of map)for(const c of row){if(c.t!=="water"&&c.moisture<.12)drought++;if(c.fauna>=5)abundance++;}
      if(drought>w*h*.08)events.push("Sécheresse : plusieurs régions manquent d'eau.");
      if(abundance>8)events.push("Des troupeaux prospèrent dans les régions fertiles.");
      if(totals.herbivores===0)events.push("La faune herbivore a disparu de cette planète.");
    }
    return {...totals,events,migrations,births,hunts,deaths,herbivoreBirths,predatorBirths,herbivoreDeaths,predatorDeaths,forageGrowth,forageClimateLoss,forageConsumed,forageReproduction};
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
    // Quelques glyphes de groupes ; les effectifs réels restent dans le territoire.
    const data={base:out.flat()};
    syncDetail(data,tile,x,y,seed);
    for(let gy=0;gy<15;gy++)for(let gx=0;gx<15;gx++)out[gy][gx]=data[gy*15+gx]??data.base[gy*15+gx];
    return {tiles:out,trees,rocks,clearings,wetlands,subzoneKm:250/15};
  }
  // Les sous-zones sont une projection persistante des effectifs du territoire.
  // Le budget de glyphes sert la lisibilité, sans limiter les effectifs simulés.
  function detailPopulation(tile) {
    if(!habitable(tile))return {herb:0,pred:0};
    return {herb:Math.min(8,Math.ceil((tile.fauna||0)/5)),pred:Math.min(4,Math.ceil((tile.predators||0)/2))};
  }
  const groundAt = (data,i) => data.ground?.[i]??data.base[i];
  function syncDetail(data,tile,x,y,seed) {
    const signature=["groups-v2",tile.t,tile.fauna||0,tile.predators||0].join(",");
    if(data.wildlifeSignature===signature)return data;
    const glyph=i=>data[i]??data.base[i];
    // Retirer les animaux décoratifs de l'ancien fond sans perdre les récoltes/exploration.
    for(let i=0;i<225;i++)if(data.base[i]==="a"||data.base[i]==="W"){
      if(data[i]===undefined)data[i]=data.base[i];data.base[i]=".";
    }
    if(!data.ground)data.ground={};
    const species=[["predators","W"],["fauna","a"]],missing=[];
    // Libérer les cases avant de placer les arrivants de l'autre espèce.
    for(const [kind,mark] of species){
      const positions=[];for(let i=0;i<225;i++)if(glyph(i)===mark)positions.push(i);
      const target=detailPopulation(tile)[kind==="fauna"?"herb":"pred"];
      while(positions.length>target){const i=positions.pop();data[i]=groundAt(data,i);delete data.ground[i];}
      missing.push(target-positions.length);
    }
    for(let k=0;k<species.length;k++){
      const mark=species[k][1];let needed=missing[k];
      const offset=Math.floor(hash(x,y,seed+401)*225);
      for(let j=0;j<225&&needed>0;j++){
        const i=(j*97+offset)%225,g=glyph(i);
        if(g!=="~"&&g!=="^"&&g!=="a"&&g!=="W"){data.ground[i]=g;data[i]=mark;needed--;}
      }
    }
    // Les réserves alimentaires sont désormais stockées au niveau du territoire.
    delete data.hunger;data.wildlifeSignature=signature;
    return data;
  }
  // Animation sans naissances, morts ou migrations supplémentaires sur minuterie.
  function animateDetail(data,day,seed) {
    const old=Array.from({length:225},(_,i)=>data[i]??data.base[i]);
    const next=old.slice(),occupied=new Set();let changes=0;
    for(const mark of ["W","a"])for(let i=0;i<225;i++){
      if(old[i]!==mark||next[i]!==mark||occupied.has(i))continue;
      const x=i%15,y=Math.floor(i/15),options=[];
      let prey=-1,distance=Infinity;
      if(mark==="W")for(let j=0;j<225;j++)if(next[j]==="a"){
        const d=Math.abs(j%15-x)+Math.abs(Math.floor(j/15)-y);if(d<distance){distance=d;prey=j;}
      }
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const xx=x+dx,yy=y+dy;if(xx<0||xx>=15||yy<0||yy>=15)continue;
        const j=yy*15+xx,g=next[j];
        if(g!=="~"&&g!=="^"&&g!=="a"&&g!=="W"&&!occupied.has(j))options.push(j);
      }
      if(!options.length)continue;
      const score=j=>prey>=0?Math.abs(j%15-prey%15)+Math.abs(Math.floor(j/15)-Math.floor(prey/15)):hash(j,day,seed);
      options.sort((a,b)=>score(a)-score(b));
      const dest=options[0];next[i]=groundAt(data,i);delete data.ground[i];data.ground[dest]=next[dest];next[dest]=mark;occupied.add(dest);changes++;
    }
    for(let i=0;i<225;i++)if(next[i]!==old[i])data[i]=next[i];
    return changes;
  }
  window.FrontieresEco = { generate, migrate, season, weatherAt, advance, detailAt, migrateWildlife, populationTotals, detailPopulation, syncDetail, animateDetail };

})();
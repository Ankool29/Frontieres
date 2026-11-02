const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load,tile,clone,counts} = require('./helpers.cjs');
const eco = load();
const total = map => eco.populationTotals(map);

test('migration conserve les individus, même au-delà des anciens plafonds', () => {
  for(let seed=1;seed<=40;seed++){
    const map = [[tile({fauna:200,vegetation:1,predators:30,predatorFood:171}),tile({fauna:15,vegetation:85})]];
    const before=total(map);
    const moves=eco.migrateWildlife(map,2,seed,'fauna');
    assert.ok(moves>0);assert.equal(total(map).herb,before.herb);
    assert.ok(map[0][1].fauna>12);
    eco.migrateWildlife(map,2,seed,'predators');
    assert.equal(total(map).pred,before.pred);
    assert.ok(Math.abs(map.flat().reduce((a,c)=>a+c.predatorFood,0)-171)<1e-8);
  }
});

test('les arrivants ne peuvent pas traverser deux territoires le même jour', () => {
  const map=[[tile({fauna:100,vegetation:0}),tile({vegetation:40}),tile({vegetation:85}),tile({t:'water'})]];
  eco.migrateWildlife(map,1,29,'fauna');
  assert.ok(map[0][1].fauna>0);assert.equal(map[0][2].fauna,0);
});

test('le score tient compte des ressources par animal et du climat', () => {
  for(const kind of ['fauna','predators']){
    const middle=kind==='fauna'?tile({fauna:100,vegetation:1}):tile({predators:100,fauna:1});
    const crowded=kind==='fauna'?tile({fauna:200,vegetation:85}):tile({predators:200,fauna:60});
    const empty=kind==='fauna'?tile({vegetation:70}):tile({fauna:30});
    const map=[[crowded,middle,empty]];
    const before=empty[kind];eco.migrateWildlife(map,4,1,kind);
    assert.ok(empty[kind]>before);
  }
  const source=tile({fauna:100,vegetation:1});
  const dry=tile({vegetation:85,moisture:0,temperature:0});
  const mild=tile({vegetation:70});
  eco.migrateWildlife([[dry,source,mild]],2,1,'fauna');
  assert.ok(mild.fauna>0);assert.equal(dry.fauna,0);
});

test('pas de départ sans amélioration de l’habitat', () => {
  const map=[[tile({fauna:5}),tile({fauna:5}),tile({fauna:5})]];
  const before=clone(map);
  assert.equal(eco.migrateWildlife(map,1,1,'fauna'),0);
  assert.deepEqual(map,before);
});

test('les prédateurs suivent les proies déplacées et colonisent un voisin', () => {
  const map=[[tile({t:'water'}),tile({fauna:100,predators:20,vegetation:0,predatorFood:140}),tile({vegetation:85}),tile({t:'water'})]];
  eco.migrateWildlife(map,1,1,'fauna');
  assert.ok(map[0][2].fauna>0);
  eco.migrateWildlife(map,1,1,'predators');
  assert.ok(map[0][2].predators>0);assert.equal(total(map).pred,20);
  assert.equal(map.flat().reduce((a,c)=>a+c.predatorFood,0),140);
});

test('eau, roche, ruines, diagonales et pôles sont des barrières ; longitude circulaire', () => {
  for(const t of ['water','rock','ruin']){
    const map=[[tile({fauna:100,vegetation:0}),tile({t}),tile({t})]];
    assert.equal(eco.migrateWildlife(map,1,1,'fauna'),0);
  }
  const blocked=Array.from({length:3},()=>Array.from({length:3},()=>tile({t:'water'})));
  blocked[1][1]=tile({fauna:100,vegetation:0});blocked[0][0]=tile();
  assert.equal(eco.migrateWildlife(blocked,1,1,'fauna'),0);
  const polar=[[tile({fauna:100,vegetation:0})],[tile({t:'water'})],[tile()]];
  assert.equal(eco.migrateWildlife(polar,1,1,'fauna'),0);
  const seam=[[tile({fauna:100,vegetation:0}),tile({t:'water'}),tile()]];
  eco.migrateWildlife(seam,1,1,'fauna');assert.ok(seam[0][2].fauna>0);
});

test('une population éteinte ne réapparaît pas spontanément', () => {
  const map=[[tile(),tile()]];
  for(let day=1;day<=200;day++)eco.advance(map,day,0,0,29);
  assert.equal(total(map).herb,0);assert.equal(total(map).pred,0);
  assert.deepEqual(counts({base:eco.detailAt(tile({predators:1}),0,0,29).tiles.flat()}),{herb:0,pred:1});
});

test('les réserves permettent de survivre à une courte disette, pas à une famine perpétuelle', () => {
  const map=[[tile({predators:100,predatorFood:800,vegetation:0})]];
  for(let day=1;day<=7;day++)eco.advance(map,day,0,0,1);
  assert.ok(total(map).pred>=95);
  for(let day=8;day<=120;day++)eco.advance(map,day,0,0,1);
  assert.equal(total(map).pred,0);
});

test('la consommation et la mortalité freinent une forte densité sans plafond', () => {
  const map=[[tile({fauna:10000,vegetation:0,moisture:0})]];
  const first=eco.advance(map,1,0,0,1);
  assert.ok(first.herb>12);assert.ok(first.herb<10000);assert.equal(first.births,0);
  for(let day=2;day<=120;day++)eco.advance(map,day,0,0,1);
  assert.ok(total(map).herb<10);
});

test('résultats déterministes, bilan démographique exact et sauvegarde reprise', () => {
  const map=eco.generate(24,12,29),same=clone(map);
  for(let day=2;day<=98;day++){
    const before=total(map),result=eco.advance(map,day,0,0,29);
    assert.deepEqual(result,eco.advance(same,day,23,11,29));
    assert.equal(result.herb+result.pred,before.herb+before.pred+result.births-result.deaths-result.hunts);
    assert.equal(result.herb,total(map).herb);assert.equal(result.pred,total(map).pred);
    for(const c of map.flat()){
      assert.ok(Number.isInteger(c.fauna)&&c.fauna>=0);
      assert.ok(Number.isInteger(c.predators)&&c.predators>=0);
      assert.ok(c.vegetation>=0&&c.moisture>=0&&c.moisture<=1);
      assert.ok((c.predatorFood||0)>=0);
    }
  }
  const saved=eco.migrate(clone(map),29);
  assert.deepEqual(eco.advance(saved,99,0,0,29),eco.advance(map,99,0,0,29));
  assert.deepEqual(saved,map);
});

test('anciennes données : champs conservés et réserves initialisées à la demande', () => {
  const map=[[tile({fauna:12,predators:2,b:'hut',explored:true})],[tile()]];
  eco.migrate(map,29);
  assert.equal(map[0][0].fauna,12);assert.equal(map[0][0].b,'hut');
  eco.migrateWildlife(map,1,29,'predators');
  assert.equal(map.flat().reduce((a,c)=>a+c.predatorFood,0),24);
});

test('sous-zones : réconciliation sans perdre récoltes, exploration ou terrain sous les animaux', () => {
  const data={base:Array(225).fill('.'),seen:[1,2],3:':',4:'a',5:'W',hunger:{5:8}};
  const c=tile({fauna:7,predators:2});
  eco.syncDetail(data,c,0,0,29);
  assert.deepEqual(counts(data),{herb:7,pred:2});assert.deepEqual(data.seen,[1,2]);assert.equal(data.hunger,undefined);
  for(let i=0;i<20;i++)eco.animateDetail(data,i,29);
  assert.deepEqual(counts(data),{herb:7,pred:2});
  c.fauna=0;c.predators=0;eco.syncDetail(data,c,0,0,29);
  assert.deepEqual(counts(data),{herb:0,pred:0});assert.equal(data[3]??data.base[3],':');
  const reloaded=clone(data);c.fauna=3;eco.syncDetail(reloaded,c,0,0,29);
  assert.equal(counts(reloaded).herb,3);
});

test('ancien fond avec fausse proie et territoire surpeuplé : aucun animal créé par le rendu', () => {
  const data={base:Array(225).fill('a')};
  eco.syncDetail(data,tile({predators:1}),0,0,1);
  assert.deepEqual(counts(data),{herb:0,pred:1});
  const c=tile({fauna:500,predators:10});eco.syncDetail(data,c,0,0,1);
  assert.ok(counts(data).herb<=215);assert.equal(c.fauna,500);assert.equal(counts(data).pred,10);
});

test('trois planètes pendant dix années : pas de croissance illimitée ni extinction précoce systématique', () => {
  for(const seed of [1,29,2026]){
    const map=eco.generate(144,72,seed),initial=total(map);
    let peak=initial.herb;
    for(let day=2;day<=481;day++){
      const result=eco.advance(map,day,0,0,seed);peak=Math.max(peak,result.herb);
      if(day===97)assert.ok(result.pred>initial.pred*.3,`graine ${seed} : prédateurs après deux ans`);
      assert.ok(result.herb<initial.herb*3,`graine ${seed} : prolifération`);
    }
    assert.ok(total(map).herb<peak);
  }
});

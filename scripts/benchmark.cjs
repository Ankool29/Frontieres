const {load}=require('../tests/helpers.cjs');
const {simulate}=require('./scenarios.cjs');
const fs=require('node:fs'),crypto=require('node:crypto');
const source=fs.readFileSync(process.argv[2]||'ecosystem.js','utf8'),eco=load(source);
const scenarios=[1,29,2026].map(seed=>simulate(eco,seed,{timing:true}));
console.log(JSON.stringify({sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),scenarios},null,2));

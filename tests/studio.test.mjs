import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {audioCurves,flowField} from '../public/close-dance/web/browser-analysis.js';
import {defaults,presets,validateSettings} from '../public/close-dance/web/studio-settings.js';
const silence=audioCurves(new Float32Array(24000),24000,1);assert.ok(Object.values(silence.curves).every(a=>a.every(v=>v===0)));
const sound=new Float32Array(48000);for(let i=12000;i<14400;i++)sound[i]=Math.sin(i*.08)*.8;
const score=audioCurves(sound,24000,2);assert.ok(score.curves.accent.some(x=>x>.8));assert.ok(score.curves.accent.slice(0,50).every(x=>x===0));assert.ok(score.curves.accent.every(Number.isFinite));
const w=80,h=60,a=new Float32Array(w*h),b=new Float32Array(w*h);let seed=5;for(let i=0;i<a.length;i++){seed=(seed*1664525+1013904223)>>>0;a[i]=seed/2**32;}
for(let y=0;y<h-1;y++)for(let x=0;x<w-2;x++)b[(y+1)*w+x+2]=a[y*w+x];
const {field}=flowField(a,b,w,h);let valid=0,correct=0;for(let i=0;i<field.length;i+=3)if(field[i+2]){valid++;correct+=field[i]===2&&field[i+1]===1;}assert.ok(valid>40&&correct/valid>.9);
const runtime=await readFile('./public/close-dance/web/studio.js','utf8'),driveText=runtime.match(/function musicDrive\(t\)\{[^\n]+/)[0];
for(const [name,preset] of Object.entries(presets)){
 const settings=validateSettings({...preset,musicMatch:true,effectsMix:.4,faceEffects:.1});let level=0;
 const musicDrive=new Function('settings','musicCurve',driveText+';return musicDrive;')(settings,()=>level);
 const quiet=musicDrive(0);level=1;const loud=musicDrive(0);assert.ok(quiet<loud,name);assert.equal(settings.effectsMix,.4);assert.equal(settings.faceEffects,.1);
 settings.musicMatch=false;assert.equal(musicDrive(0),1);settings.effectsMix=0;assert.equal(settings.effectsMix*musicDrive(0),0);
}
assert.equal(validateSettings({...defaults,musicMatch:true}).musicMatch,true);
const forceCode=runtime.match(/vortex=settings\.vortex\*settings\.vortex[^\n]+/)[0];
const force=new Function('settings','strength','let vortex,release,strata;'+forceCode+';return {vortex,release};');
const subtle=force({...defaults,vortex:.05},1),full=force({...defaults,vortex:2},1);
assert.ok(Math.abs(subtle.vortex-.00125)<1e-12);assert.ok(subtle.release<.001);
assert.equal(full.vortex,2);assert.equal(full.release,1);assert.equal(force({...defaults,vortex:2},0).release,0);
assert.equal(validateSettings({...defaults,vortex:.001}).vortex,.001);
assert.ok(runtime.includes('bool loose=(release>0.&&seed<release)||'));
assert.ok(!runtime.includes('(release>.5&&seed<1.01)'));
// File-backed cache tests run without a browser, with an in-memory file system.
const files=new Map();function dir(prefix=''){return {async getDirectoryHandle(name){return dir(prefix+name+'/');},async getFileHandle(name){const key=prefix+name;return {async getFile(){return new Blob([files.get(key)||new Uint8Array()]);},async createWritable(){let chunks=[];return {async write(data){chunks.push(new Uint8Array(await new Blob([data]).arrayBuffer()));},async close(){files.set(key,new Uint8Array(await new Blob(chunks).arrayBuffer()));},async abort(){}};}};},async *entries(){},async removeEntry(){}};}
Object.defineProperty(globalThis,'navigator',{value:{storage:{getDirectory:async()=>dir()}}});
const bytes=new Uint8Array([11,22,33,44,55,66]),m={pack:{url:'https://test.invalid/data.binpack',frames:[[0,3],[3,3]]}};let network=0;
globalThis.fetch=async(url,options)=>{if(url.includes('manifest.json'))return Response.json(m);network++;if(options?.headers?.Range){const [,start,end]=options.headers.Range.match(/bytes=(\d+)-(\d+)/);return new Response(bytes.slice(+start,+end+1),{status:206});}return new Response(bytes);};
const {packedFrame,preparePack}=await import('../public/close-dance/web/browser-store.js');
assert.deepEqual(new Uint8Array(await(await packedFrame('fixture',1)).arrayBuffer()),bytes.slice(3));
await preparePack('fixture',()=>{});const before=network;assert.deepEqual(new Uint8Array(await(await packedFrame('fixture',0)).arrayBuffer()),bytes.slice(0,3));assert.equal(network,before);
console.log('PASS: audio silence/accents, motion translation + consistency, all presets music/global/face isolation, exact CDN range and file cache reads.');

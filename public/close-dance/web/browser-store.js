import * as M from './vendor/mediabunny.mjs';
import {audioCurves,gray,flowField} from './browser-analysis.js';
const nativeFetch=globalThis.fetch.bind(globalThis),urlMap=new Map(),jsonMap=new Map(),packJobs=new Map(),packFiles=new Map(),packMeta=new Map();
async function cacheManifest(name){if(!packMeta.has(name)){const task=assetFetch(`../cache/${name}/manifest.json`).then(r=>{if(!r.ok)throw Error('Particle manifest unavailable');return r.json();});packMeta.set(name,task);task.catch(()=>packMeta.delete(name));}return packMeta.get(name);}
const root=async()=>{if(!navigator.storage?.getDirectory)throw Error('Browser file storage is unavailable. Open this studio in a current Chrome or Edge browser.');return (await navigator.storage.getDirectory()).getDirectoryHandle('afterimage',{create:true});};
async function directory(id){return (await root()).getDirectoryHandle(id,{create:true});}
async function write(dir,name,data){const file=await dir.getFileHandle(name,{create:true}),out=await file.createWritable();try{await out.write(data);await out.close();}catch(e){await out.abort().catch(()=>{});throw e;}}
async function read(dir,name){return (await dir.getFileHandle(name)).getFile();}
async function objectURL(id,name){const key=id+'/'+name;if(!urlMap.has(key))urlMap.set(key,URL.createObjectURL(await read(await directory(id),name)));return urlMap.get(key);}
async function savedClip(id){const dir=await directory(id),clip=JSON.parse(await(await read(dir,'clip.json')).text());clip.video=await objectURL(id,'source');clip.poster=await objectURL(id,'poster.jpg');clip.download=clip.song=clip.video;clip.preview=clip.video;return clip;}
export async function loadImports(){try{const clips=[];for await(const [id,handle] of (await root()).entries())if(handle.kind==='directory'&&id.startsWith('local-')){try{clips.push(await savedClip(id));}catch{}}return clips;}catch{return [];}}
export async function assetFetch(url,options){
 if(typeof url==='string'){
  if(url==='/api/imports')return Response.json({clips:await loadImports()});
  const match=url.match(/(?:data|cache)\/(local-[\w-]+)\/([^/?]+)/);
  if(match){const [,id,file]=match,dir=await directory(id);try{
   if(file.endsWith('.json')){const key=id+'/'+file;let data=jsonMap.get(key);if(!data){data=JSON.parse(await(await read(dir,file)).text());if(file==='score.json')data.audio=await objectURL(id,'source');jsonMap.set(key,data);}return Response.json(data);}
   return new Response(await read(dir,file));
  }catch{return new Response('Missing imported asset',{status:404});}}
 }
 return nativeFetch(url,options);
}
export async function packedFrame(name,index){
 const manifest=await cacheManifest(name);
 if(!manifest.pack)return assetFetch(`../cache/${name}/${String(index).padStart(3,'0')}.bin.gz`);
 const [start,length]=manifest.pack.frames[index];
 if(packFiles.has(name))return new Response(packFiles.get(name).slice(start,start+length));
 const r=await nativeFetch(manifest.pack.url,{headers:{Range:`bytes=${start}-${start+length-1}`}});
 if(r.status!==206)throw Error('Particle streaming requires byte-range support. Please retry.');
 const data=await r.arrayBuffer();if(data.byteLength!==length)throw Error('Incomplete particle frame');return new Response(data);
}
// Prepare a whole performance once, then read individual frames from browser files.
// This removes network requests from playback and export without keeping GBs in RAM.
export async function preparePack(name,onProgress,shouldCancel){
 if(name.startsWith('local-')||packFiles.has(name))return;
 if(packJobs.has(name))return packJobs.get(name);
 const task=(async()=>{
  const m=await cacheManifest(name);if(!m.pack)return;
  const expected=m.pack.frames.at(-1).reduce((a,b)=>a+b),dir=await(await root()).getDirectoryHandle('performances',{create:true});
  const key=name+'-'+m.pack.url.split('/').at(-1),handle=await dir.getFileHandle(key,{create:true}),existing=await handle.getFile();
  if(existing.size===expected){packFiles.set(name,existing);return;}
  const response=await nativeFetch(m.pack.url);if(!response.ok||!response.body)throw Error('Performance download failed.');
  const writer=await handle.createWritable(),reader=response.body.getReader();let size=0;
  try{for(;;){if(shouldCancel?.())throw Error('Export cancelled.');const {done,value}=await reader.read();if(done)break;await writer.write(value);size+=value.length;onProgress(size/expected);}if(size!==expected)throw Error('Performance download was incomplete.');await writer.close();packFiles.set(name,await handle.getFile());}
  catch(e){await writer.abort().catch(()=>{});await reader.cancel().catch(()=>{});throw e;}
 })();packJobs.set(name,task);try{return await task;}finally{packJobs.delete(name);}
}
export function hasPreparedPack(name){return name.startsWith('local-')||packFiles.has(name);}
export async function importVideo(file,onProgress){
 if(file.size>2*1024**3)throw Error('Choose a video smaller than 2 GB.');
 const input=new M.Input({source:new M.BlobSource(file),formats:M.ALL_FORMATS});let id,dir,finished=false;
 try{
  const track=await input.getPrimaryVideoTrack();if(!track||!await track.canDecode())throw Error('This video codec cannot be decoded here. Try an H.264 MP4.');
  const duration=await input.computeDuration();if(duration<.1||duration>600)throw Error('Choose a video between 0.1 seconds and 10 minutes.');
  const estimate=await navigator.storage.estimate(),needed=file.size+duration*24*1.8e6;
  if(estimate.quota&&needed>estimate.quota-estimate.usage)throw Error('Not enough browser storage for this clip’s particle cache. Try a shorter clip.');
  id='local-'+crypto.randomUUID();dir=await directory(id);await write(dir,'source',file);
  const frames=Math.max(2,Math.ceil(duration*24)),timestamps=Array.from({length:frames},(_,i)=>Math.min(i/24,duration-.001));
  const sink=new M.CanvasSink(track,{width:288,height:162,fit:'contain',poolSize:2});
  const first=await track.getFirstTimestamp(),coords=new Float32Array(131072*2),generations=new Uint16Array(131072);
  for(let i=0;i<131072;i++){coords[i*2]=((i*0.61803398875)%1)*287;coords[i*2+1]=((i*0.41421356237)%1)*161;}
  const tiny=new OffscreenCanvas(144,81),ctx=tiny.getContext('2d',{willReadFrequently:true});let previous=null,index=0;
  const faceDetector=typeof FaceDetector!=='undefined'?new FaceDetector({fastMode:true,maxDetectedFaces:1}):null,regions=[];let face=[-10,-10,.01,.01];
  for await(const wrapped of sink.canvasesAtTimestamps(timestamps.map(t=>t+first))){
   if(!wrapped)throw Error('A video frame could not be decoded.');
   const canvas=wrapped.canvas,rgba=canvas.getContext('2d').getImageData(0,0,288,162).data;
   if(index===0)await write(dir,'poster.jpg',canvas.convertToBlob?await canvas.convertToBlob({type:'image/jpeg',quality:.85}):await new Promise(r=>canvas.toBlob(r,'image/jpeg',.85)));
   ctx.drawImage(canvas,0,0,144,81);const now=gray(ctx.getImageData(0,0,144,81).data),flow=flowField(previous,now,144,81);previous=now;
   if(faceDetector&&index%6===0){try{const detected=await faceDetector.detect(canvas);if(detected[0]){const b=detected[0].boundingBox;face=[(b.x+b.width/2)/288,(b.y+b.height/2)/162,b.width/288*.7,b.height/162*.7];}else face=[-10,-10,.01,.01];}catch{face=[-10,-10,.01,.01];}}
   regions.push(face);
   const buffer=new ArrayBuffer(131072*16),v=new DataView(buffer);
   for(let i=0;i<131072;i++){
    let x=coords[i*2],y=coords[i*2+1],j=(Math.min(flow.rows-1,Math.floor(y/2/flow.step))*flow.cols+Math.min(flow.cols-1,Math.floor(x/2/flow.step)))*3;
    let dx=flow.field[j]*2,dy=flow.field[j+1]*2,valid=flow.field[j+2];
    if(index&&(!valid||x+dx<0||x+dx>287||y+dy<0||y+dy>161)){generations[i]++;x=((i*.61803398875+index*.017)%1)*287;y=((i*.41421356237+index*.031)%1)*161;dx=dy=0;}
    else{x+=dx;y+=dy;}
    coords[i*2]=x;coords[i*2+1]=y;const pixel=(Math.round(y)*288+Math.round(x))*4,o=i*16;
    v.setUint16(o,x/288*65535,true);v.setUint16(o+2,y/162*65535,true);v.setUint16(o+4,32768,true);v.setUint8(o+6,128);v.setUint8(o+7,128);
    for(let c=0;c<3;c++)v.setUint8(o+8+c,rgba[pixel+c]);v.setUint8(o+11,255);v.setUint16(o+12,generations[i],true);v.setUint8(o+14,valid?255:80);v.setUint8(o+15,Math.min(127,Math.hypot(dx,dy)*10));
   }
   const blob=await new Response(new Blob([buffer]).stream().pipeThrough(new CompressionStream('gzip'))).blob();await write(dir,`${String(index).padStart(3,'0')}.bin.gz`,blob);
   onProgress(.08+.8*++index/frames,'Tracking motion and preparing particles');await new Promise(r=>setTimeout(r,0));
  }
  let analysis=audioCurves(new Float32Array(),24000,duration);const audioTrack=await input.getPrimaryAudioTrack();
  if(audioTrack&&await audioTrack.canDecode()){
   const mono=new Float32Array(Math.ceil(duration*24000));for await(const {buffer,timestamp} of new M.AudioBufferSink(audioTrack).buffers()){
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    for(let i=0;i<Math.floor(buffer.duration*24000);i++){const dst=Math.round(timestamp*24000)+i;if(dst>=0&&dst<mono.length){const src=Math.min(buffer.length-1,Math.floor(i*buffer.sampleRate/24000));for(const c of channels)mono[dst]+=c[src]/channels.length;}}
   }analysis=audioCurves(mono,24000,duration);
  }
  const manifest={count:131072,texture_width:512,texture_height:256,frames,timestamps,source_timestamp_origin:first,duration,camera_z:5.4,fov:38,world_width:6.61109,world_height:3.71874,geometry:'Flat tracked surface',depth_metric:false};
  const score={...analysis,duration,audio:'source',source_rate:1,score:[{kind:'flow',start:0,end:duration,rate:1}]};
  // Face schema matches curated source-frame caches.
  const faceData={fps:24,regions};
  const clip={id,title:file.name.replace(/\.[^.]+$/,''),actor:'Your video',genre:'Imported audio',bpm:null,color:'#b8a0ff',duration,ready:true,local:true,new:false,lyrics:'',description:'Your local video with a flat tracked particle surface. Browser imports stay on this device. Face detection '+(faceDetector?'is enabled.':'is unavailable in this browser; face protection cannot be applied automatically.')};
  for(const [name,data] of [['manifest.json',manifest],['score.json',score],['face-regions.json',faceData],['clip.json',clip]])await write(dir,name,JSON.stringify(data));
  finished=true;onProgress(1,'Ready');return await savedClip(id);
 }finally{input.dispose();if(id&&!finished)await(await root()).removeEntry(id,{recursive:true}).catch(()=>{});}
}

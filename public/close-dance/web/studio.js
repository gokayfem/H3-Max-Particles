import {assetFetch as fetch,packedFrame,importVideo,preparePack,hasPreparedPack} from './browser-store.js';
import {createBrowserExport} from './browser-export.js';
import * as T from '../../web/vendor/three.module.js';
import {createPostEffects} from './studio-post.js?v=color-4';
import {settings, defaults, presets, controls, validateSettings} from './studio-settings.js?v=color-4';
const LIBRARY=await (await fetch('./collection.json')).json();
try{const r=await fetch('/api/imports');if(r.ok)LIBRARY.clips.push(...(await r.json()).clips);}catch{}
let activeClip=LIBRARY.clips.find(c=>c.id===new URLSearchParams(location.search).get('clip')&&c.ready)||LIBRARY.clips.find(c=>c.ready);
let MUSIC=await (await fetch(`../data/${activeClip.id}/score.json`)).json();
let FACE=await (await fetch(`../data/${activeClip.id}/face-regions.json`)).json();
let musicTime=0,scorePaused=false;

let signalEnabled=true,flowEnabled=true;
function signalEnvelope(t){if(settings.classicTiming){if(!settings.glitchEnabled)return 0;const phase=t/MUSIC.duration*54.311474;let e=0;for(const [a,b] of [[4,10.5],[17,21],[28.5,33.1],[38,45],[49,52]])e=Math.max(e,T.MathUtils.smoothstep(phase,a,a+.45)*(1-T.MathUtils.smoothstep(phase,b-.4,b)));return settings.glitch*e*(settings.beatSync?Math.min(1,.28+musicCurve('accent',t)*.9+musicCurve('bass',t)*.22):1);}return settings.glitchEnabled ? settings.glitch * (settings.beatSync ? .22 + musicCurve('accent',t)*.78 : 1) : 0;}
function musicCurve(name,t){const a=MUSIC.curves[name],q=Math.max(0,Math.min(a.length-1,t*MUSIC.curve_fps)),i=Math.floor(q);return a[i]+((a[i+1]??a[i])-a[i])*(q-i)}
const $=s=>document.querySelector(s),NAMES=['01-portrait','02-continuation','03-return','04-bloom','05-ceramic','06-ribbons','13-avant'];
const TITLES=['The gaze','Shoulder language','Back to the beat','Petal lift','Porcelain pulse','Silk current','Signal / form'];
const STEP=1/120,W=512,H=256,N=W*H,rawCache=new Map(),gpuCache=new Map(),pending=new Map(),manifests=new Map();
let node=activeClip.id,manifest,action=0,clock=0,playing=true,frozen=false,ready=false,external=false,loadingPair=false,acc=0,last=0,ping=0;
let yaw=0,pitch=0,zoom=1,release=0,vortex=0,strata=0,trails=true,inspect=false,sculpture=false,returnAge=-1,fade=1,portal=null,showcase=false,showTime=0;
let boundKey='',pairIndices=[0,1],pointer=null,noticeTimer,sculptureTextures=null,lastTrailKey='',lastUI=0;
const metrics={simulatedParticles:N,renderedSurfels:31059,visibleFraction:.24,simulationSteps:0,frameMilliseconds:[],cacheStalls:0,droppedSeconds:0,errors:[],nodeSwitches:0};
addEventListener('error',e=>metrics.errors.push(e.message));addEventListener('unhandledrejection',e=>{metrics.errors.push(String(e.reason));notice(String(e.reason));});
function notice(text){$('#notice').textContent=text;$('#notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('show'),3500)}
const renderer=new T.WebGLRenderer({canvas:$('#canvas'),alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xffffff,1);
const gl=renderer.getContext();if(!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL 2 floating-point targets required');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.03,50),simScene=new T.Scene(),simCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
function tex(data){const t=new T.DataTexture(data,W,H,T.RGBAFormat,T.FloatType);t.needsUpdate=true;return t}
function target(){return new T.WebGLRenderTarget(W,H,{type:T.FloatType,format:T.RGBAFormat,minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:false,stencilBuffer:false})}
const pos=[target(),target()],vel=[target(),target()];
async function getManifest(name){if(!manifests.has(name)){const r=await fetch(`../cache/${name}/manifest.json`);if(!r.ok)throw Error('Surface cache unavailable: '+name);manifests.set(name,await r.json())}return manifests.get(name)}
function touch(map,key){const value=map.get(key);map.delete(key);map.set(key,value);return value}
function evict(){while(rawCache.size>36){const key=rawCache.keys().next().value;if(key.startsWith(node+':')&&pairIndices.some(i=>key===`${node}:${i}`)){touch(rawCache,key);continue}rawCache.delete(key)}}
async function raw(name,i){const key=`${name}:${i}`;if(rawCache.has(key))return touch(rawCache,key);if(pending.has(key))return pending.get(key);
 const promise=(async()=>{const r=await packedFrame(name,i);if(!r.ok)throw Error('Missing surface '+key);const buffer=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(buffer.byteLength!==N*16)throw Error('Invalid cache byte count');rawCache.set(key,buffer);pending.delete(key);evict();return buffer})();pending.set(key,promise);promise.catch(()=>pending.delete(key));return promise;
}
function decoded(buffer,m){const p=new Float32Array(N*4),c=new Float32Array(N*4),a=new Float32Array(N*4),v=new DataView(buffer);
 for(let i=0;i<N;i++){const o=i*16,k=i*4,z=v.getUint16(o+4,true)/65535*.8-.4,u=v.getUint16(o,true)/65535,y=v.getUint16(o+2,true)/65535;
 p[k]=(u-.5)*m.world_width*(m.camera_z-z)/m.camera_z;p[k+1]=(.5-y)*m.world_height*(m.camera_z-z)/m.camera_z;p[k+2]=z;p[k+3]=v.getUint8(o+11)/255;
 for(let d=0;d<3;d++)c[k+d]=v.getUint8(o+8+d)/255;c[k+3]=v.getUint16(o+12,true);
 a[k]=v.getUint8(o+6)/255*2-1;a[k+1]=v.getUint8(o+7)/255*2-1;a[k+2]=v.getUint8(o+14)/255;a[k+3]=v.getUint8(o+15)/255;
 }return {p,c,a};
}
function gpu(name,i,m){const key=`${name}:${i}`;if(gpuCache.has(key))return touch(gpuCache,key);const d=decoded(rawCache.get(key),m),value={p:tex(d.p),c:tex(d.c),a:tex(d.a)};gpuCache.set(key,value);
 while(gpuCache.size>8){const oldKey=gpuCache.keys().next().value;if(pairIndices.some(j=>oldKey===`${node}:${j}`)){touch(gpuCache,oldKey);continue}const old=gpuCache.get(oldKey);Object.values(old).forEach(t=>t.dispose());gpuCache.delete(oldKey)}return value;
}
function pair(t,m=manifest){let i=Math.min(m.frames-2,Math.max(0,Math.floor(t*24)));while(i>0&&m.timestamps[i]>t)i--;while(i<m.frames-2&&m.timestamps[i+1]<t)i++;return [i,i+1,T.MathUtils.clamp((t-m.timestamps[i])/(m.timestamps[i+1]-m.timestamps[i]),0,1)]}
async function prepare(name,t){const m=await getManifest(name),[i,j]=pair(t,m);await Promise.all([raw(name,i),raw(name,j)]);return m}
function prefetch(){if(sculpture)return;const [i]=pair(action);for(let k=i+2;k<=Math.min(manifest.frames-1,i+7);k++){if(pending.size>10)break;raw(node,k).catch(e=>metrics.errors.push(String(e)))}if(trails)for(let k=Math.max(0,i-24);k<i;k+=4)raw(node,k).catch(()=>{});}
const U={effectStrength:{value:1},p:{value:null},v:{value:null},a:{value:null},b:{value:null},ca:{value:null},cb:{value:null},aux:{value:null},mixT:{value:0},dt:{value:STEP},frameDt:{value:1/24},clock:{value:0},moving:{value:1},release:{value:0},vortex:{value:0},strata:{value:0},brushRadius:{value:.45},emission:{value:1},brush:{value:new T.Vector3(100,100,0)},reset:{value:0},pass:{value:0}};
const vertex='varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}';
const simMat=new T.ShaderMaterial({uniforms:U,vertexShader:vertex,depthTest:false,depthWrite:false,fragmentShader:`
precision highp float;varying vec2 uv0;uniform sampler2D p,v,a,b,ca,cb,aux;uniform float mixT,dt,frameDt,clock,moving,release,vortex,strata,reset,pass;uniform vec3 brush;uniform float brushRadius,emission,effectStrength;
float hash(vec2 q){uvec2 bits=floatBitsToUint(q);uint n=bits.x^(bits.y*0x9e3779b9u);n=(n^(n>>16u))*0x7feb352du;n=(n^(n>>15u))*0x846ca68bu;n^=n>>16u;return float(n>>8u)*(1.0/16777216.0);}
vec3 curl(vec3 q){return vec3(sin(q.x)*(cos(q.y)-cos(q.z)),sin(q.y)*(cos(q.z)-cos(q.x)),sin(q.z)*(cos(q.x)-cos(q.y)));}
void main(){vec4 aa=texture2D(a,uv0),bb=texture2D(b,uv0),cc=texture2D(ca,uv0),dd=texture2D(cb,uv0),info=texture2D(aux,uv0);bool same=abs(cc.w-dd.w)<.1;
vec4 goal=same?mix(aa,bb,mixT):(mixT<.5?aa:bb);float gen=same?cc.w:(mixT<.5?cc.w:dd.w);
vec3 tv=same?(bb.xyz-aa.xyz)/max(.001,frameDt)*moving:vec3(0.);tv=clamp(tv,vec3(-3.),vec3(3.));
goal.z+=floor((goal.z+.4)*10.)*.19*strata;vec4 prev=texture2D(p,uv0),vv=texture2D(v,uv0);
if(reset>.5||abs(prev.w-gen)>.1){gl_FragColor=pass<.5?vec4(0.):vec4(goal.xyz,gen);return;}
float age=vv.w;float seed=hash(uv0);float brushHit=(1.-smoothstep(brushRadius*.18,brushRadius,distance(goal.xy,brush.xy)))*effectStrength;
float speed=length(tv);bool edge=info.w>.5;float emit=(edge?.14:.006)*smoothstep(.2,1.1,speed)*moving*info.z;
bool launch=age<.001&&goal.w>.5&&((release>0.&&seed<release)||(brushHit>.1&&seed<brushHit*.9)||hash(uv0+floor(clock*120.)*.001)<emit*dt*emission);
if(pass<.5){if(launch){vec3 impulse=normalize(goal.xyz+vec3(.01,.01,.15))*(1.+seed*1.7);gl_FragColor=vec4(tv+impulse*effectStrength*((release>0.&&seed<release&&brushHit<=.1)?release:1.),.01);return;}
 if(age<.001){gl_FragColor=vec4(tv,0.);return;}
 bool loose=(release>0.&&seed<release)||brushHit>.2||age<1.1;vec3 force=curl(prev.xyz*2.5+vec3(clock*.21,clock*.13,-clock*.1))*1.6*effectStrength;
 force+=vortex*vec3(-prev.y,prev.x,.25)*3.;
 force*=((release>0.&&seed<release)?release:1.);vec3 acceleration=loose?force-vv.xyz*1.2:(goal.xyz-prev.xyz)*45.-vv.xyz*12.;
 vec3 velocity=clamp(vv.xyz+acceleration*dt,vec3(-5.),vec3(5.));
 if(!loose&&distance(goal.xyz,prev.xyz)<.012&&length(velocity)<.08){gl_FragColor=vec4(tv,0.);return;}
 gl_FragColor=vec4(velocity,age+dt);
}else{gl_FragColor=vec4(vv.w<.001?goal.xyz:prev.xyz+vv.xyz*dt,gen);}}
`});
simScene.add(new T.Mesh(new T.PlaneGeometry(2,2),simMat));
function pass(dest,which){U.pass.value=which;renderer.setRenderTarget(dest);renderer.render(simScene,simCamera);renderer.setRenderTarget(null)}
const R={density:{value:.24},shape:{value:0},faceStrength:{value:1},faceRadius:{value:1},positions:{value:null},velocity:{value:null},a:{value:null},b:{value:null},ca:{value:null},cb:{value:null},aux:{value:null},mixT:{value:0},bassPulse:{value:0},accentPulse:{value:0},blast:{value:0},blastTime:{value:0},glitchGain:{value:0},faceRegion:{value:new T.Vector4(.5,.25,.1,.1)},faceWorld:{value:new T.Vector2(6.6,3.7)},signalTime:{value:0},grain:{value:6.4},ratio:{value:renderer.getPixelRatio()},fade:{value:1},ceramic:{value:0},sculpture:{value:0}};
const refs=new Float32Array(N*2),seeds=new Float32Array(N);for(let i=0;i<N;i++){refs[i*2]=(i%W+.5)/W;refs[i*2+1]=(Math.floor(i/W)+.5)/H;seeds[i]=((i*1664525+1013904223)>>>0)/4294967296}
const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(new Float32Array(N*3),3));geom.setAttribute('ref',new T.BufferAttribute(refs,2));geom.setAttribute('seed',new T.BufferAttribute(seeds,1));
const grainMat=new T.ShaderMaterial({uniforms:R,transparent:true,depthWrite:true,vertexShader:`
uniform sampler2D positions,velocity,a,b,ca,cb,aux;uniform float mixT,grain,ratio,fade,ceramic,sculpture,blast,blastTime,bassPulse,accentPulse,glitchGain,signalTime;uniform float faceStrength,faceRadius;uniform vec4 faceRegion;uniform vec2 faceWorld;attribute vec2 ref;attribute float seed;varying vec4 color;varying vec3 surfaceNormal;varying float random,loose,faceGain;
void main(){vec4 aa=texture2D(a,ref),bb=texture2D(b,ref),cc=texture2D(ca,ref),dd=texture2D(cb,ref);bool same=abs(cc.w-dd.w)<.1;vec4 goal=same?mix(aa,bb,mixT):(mixT<.5?aa:bb);color=same?mix(cc,dd,mixT):(mixT<.5?cc:dd);color.a=goal.w*fade;

vec2 faceUV=vec2(goal.x/(faceWorld.x*(5.4-goal.z)/5.4)+.5,.5-goal.y/(faceWorld.y*(5.4-goal.z)/5.4));
float faceProtect=1.-smoothstep(.65,1.18,length((faceUV-faceRegion.xy)/(faceRegion.zw*faceRadius)));
faceGain=1.-faceProtect*faceStrength;vec3 p=texture2D(positions,ref).xyz;
p=mix(p,goal.xyz,faceProtect*faceStrength);loose=step(.001,texture2D(velocity,ref).w);
// Every eligible grain participates. This is an explicit artistic scatter field.
float az=seed*107.53,el=fract(seed*79.37)*2.-1.;
vec3 direction=vec3(cos(az)*sqrt(max(0.,1.-el*el)),el,sin(az)*.45);
float turn=blastTime*.9+seed*6.283;mat2 spin=mat2(cos(turn),-sin(turn),sin(turn),cos(turn));
direction.xy=spin*direction.xy;
p+=direction*blast*faceGain*(1.1+fract(seed*137.1)*3.1);

// Foreground scan-band shear and motion-direction displacement. No white-stage noise.
vec3 flow=clamp(bb.xyz-aa.xyz,vec3(-.2),vec3(.2));
float band=floor((goal.y+2.)*19.);
float selection=step(.55,fract(sin(band*12.713)*437.13));
float tear=sin(band*2.7+floor(signalTime*7.)*.81)*selection;
float g=glitchGain*(1.-blast)*(1.-faceProtect*faceStrength);
p.x+=tear*g*(.12+min(length(flow)*3.,.25));
p+=flow*g*(2.+selection*3.);
p.xy=mix(p.xy,floor(p.xy*45.+.5)/45.,g*.45);
p*=1.+bassPulse*.012*(1.-faceProtect*faceStrength);
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
vec2 oct=texture2D(aux,ref).xy;surfaceNormal=normalize(normalMatrix*normalize(vec3(oct,1.-abs(oct.x)-abs(oct.y))));random=seed;
gl_PointSize=clamp(grain*(1.+(bassPulse*.2+accentPulse*.06)*faceGain)*ratio*(5.4/-mv.z)*(.92+seed*.30)*(1.+loose*.10*faceGain),1.,48.);}
`,fragmentShader:`varying vec4 color;varying vec3 surfaceNormal;varying float random,loose,faceGain;uniform float ceramic,accentPulse,density,shape;
void main(){if(random>density)discard;vec2 q=abs(gl_PointCoord*2.-1.);
float d=mix(max(q.x,q.y),length(q),shape);if(d>.96||color.a<.015)discard;
float lighting=.86+.14*max(0.,dot(surfaceNormal,normalize(vec3(-.4,.5,1.))));vec3 rgb=color.rgb*lighting*(.94+random*.12);rgb+=loose*faceGain*.035*vec3(.3,.65,1.);
rgb*=1.+accentPulse*.14*faceGain;gl_FragColor=sRGBTransferEOTF(vec4(rgb,color.a*smoothstep(.96,.80,d)));
#include <colorspace_fragment>
}
`});
const points=new T.Points(geom,grainMat);points.frustumCulled=false;scene.add(points);
const ribbonGroup=new T.Group();scene.add(ribbonGroup);
function bind(){
 const [fi,fj,ft]=pair(action),fa=FACE.regions[fi],fb=FACE.regions[fj];
 R.faceRegion.value.set(...fa.map((v,k)=>v+(fb[k]-v)*ft));
 R.faceWorld.value.set(manifest.world_width,manifest.world_height);
 let aa,bb,m=0;if(sculpture){aa=bb=sculptureTextures;}else{const [i,j,t]=pair(action);pairIndices=[i,j];m=t;aa=gpu(node,i,manifest);bb=gpu(node,j,manifest);U.frameDt.value=manifest.timestamps[j]-manifest.timestamps[i];}
 U.a.value=R.a.value=aa.p;U.b.value=R.b.value=bb.p;U.ca.value=R.ca.value=aa.c;U.cb.value=R.cb.value=bb.c;U.aux.value=R.aux.value=aa.a;U.mixT.value=R.mixT.value=m;
}
function reset(){bind();U.reset.value=1;U.p.value=U.a.value;U.v.value=U.a.value;pass(vel[0],0);pass(pos[0],1);ping=0;U.reset.value=0;R.positions.value=pos[0].texture;R.velocity.value=vel[0].texture;}
function step(advance=true){if(!needsParticleFrames()){clock+=STEP;return;}if(advance&&playing&&!sculpture)action=Math.min(action+STEP,manifest.timestamps.at(-1));clock+=STEP;bind();U.clock.value=clock;U.moving.value=playing&&!sculpture?(showcase||external?MUSIC.source_rate*settings.speed:1):0;U.release.value=release;U.vortex.value=vortex;U.strata.value=strata;U.p.value=pos[ping].texture;U.v.value=vel[ping].texture;const next=1-ping;pass(vel[next],0);U.v.value=vel[next].texture;pass(pos[next],1);ping=next;R.positions.value=pos[ping].texture;R.velocity.value=vel[ping].texture;metrics.simulationSteps++;
 if(returnAge>=0){returnAge+=STEP;yaw*=Math.exp(-STEP*5);pitch*=Math.exp(-STEP*5);if(returnAge>2){returnAge=-1;yaw=pitch=0;frozen=false;playing=true;syncAudio();}}
}
function clearTrails(){metrics.flowLineSegments=0;metrics.chromaticSegments=0;for(const o of [...ribbonGroup.children]){ribbonGroup.remove(o);o.geometry.dispose();o.material.dispose()}}
function updateTrails(){
 if(!trails||sculpture){clearTrails();return;}
 const i=pair(action)[0],key=`${node}:${i}:${Math.floor(musicTime*24)}:${signalEnabled}`;
 if(key===lastTrailKey)return;lastTrailKey=key;clearTrails();
 const positions=[],colors=[],echoP=[],echoC=[],gain=signalEnvelope(musicTime);
 const point=(v,o,age)=>{const z=v.getUint16(o+4,true)/65535*.8-.4;return new T.Vector3((v.getUint16(o,true)/65535-.5)*manifest.world_width*(5.4-z)/5.4,(.5-v.getUint16(o+2,true)/65535)*manifest.world_height*(5.4-z)/5.4,z-age*.02)};
 const line=(p,q,c,pp=positions,cc=colors)=>{pp.push(...p.toArray(),...q.toArray());cc.push(...c,...c)};
 for(let k=0;k<Math.ceil(settings.history*settings.effectsMix*musicDrive(musicTime));k++){
  const ia=Math.max(0,i-k*4),ib=Math.max(0,ia-4);if(ia===ib)continue;
  const ba=rawCache.get(`${node}:${ia}`),bb=rawCache.get(`${node}:${ib}`);if(!ba||!bb)continue;
  const a=new DataView(ba),b=new DataView(bb);
  for(let id=0;id<N;id+=Math.max(24,Math.round(192/Math.max(.001,settings.lineDensity*settings.effectsMix*musicDrive(musicTime))))){const o=id*16;
   if(a.getUint16(o+12,true)!==b.getUint16(o+12,true)||Math.min(a.getUint8(o+11),b.getUint8(o+11))<180||a.getUint8(o+14)<100)continue;
   const p=point(a,o,k),q=point(b,o,k+1),d=p.clone().sub(q),length=d.length();
   if(length<.012||length>.65)continue;
   const tip=p.clone().addScaledVector(d,settings.effectsMix*musicDrive(musicTime)*settings.lineLength*(settings.classicTiming?gain:.5+gain)*(1.2+k*.2));
   const tail=q.clone().addScaledVector(d,-settings.effectsMix*musicDrive(musicTime)*settings.lineLength*(settings.classicTiming?gain:.5+gain)*(.45+k*.12));
   const c=[8,9,10].map(n=>a.getUint8(o+n)/255*(.5-k*.045));
   line(tail,tip,c);
   // A small parallel comb makes moving folds into legible graphic filaments.
   if(settings.combs&&gain>.1&&k<3&&length>.035){
    const normal=new T.Vector3(-d.y,d.x,0).normalize().multiplyScalar(.008+gain*.012);
    for(const sign of [-1,1])line(tail.clone().addScaledVector(normal,sign),tip.clone().addScaledVector(normal,sign),c);
   }
   // Selective cyan/magenta channel echoes along genuine tracked motion.
   if(settings.chromatic>0&&k===0&&id%960===0){
    const dx=.025*settings.chromatic*settings.effectsMix*musicDrive(musicTime);
    line(tail.clone().add(new T.Vector3(-dx,0,.025)),tip.clone().add(new T.Vector3(-dx,0,.025)),[.05,.55,.64],echoP,echoC);
    line(tail.clone().add(new T.Vector3(dx,0,.025)),tip.clone().add(new T.Vector3(dx,0,.025)),[.72,.10,.40],echoP,echoC);
   }
  }
 }
 function add(p,c,opacity){if(!p.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));ribbonGroup.add(new T.LineSegments(g,new T.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:T.NormalBlending,
 uniforms:{opacity:{value:opacity*settings.lineOpacity},faceStrength:R.faceStrength,faceRadius:R.faceRadius,faceRegion:R.faceRegion,faceWorld:R.faceWorld},
 vertexShader:`varying vec3 lineColor;varying vec3 sourcePosition;void main(){lineColor=color;sourcePosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float opacity;uniform float faceStrength,faceRadius;uniform vec4 faceRegion;uniform vec2 faceWorld;varying vec3 lineColor;varying vec3 sourcePosition;
 void main(){vec3 p=sourcePosition;vec2 uv=vec2(p.x/(faceWorld.x*(5.4-p.z)/5.4)+.5,.5-p.y/(faceWorld.y*(5.4-p.z)/5.4));
 float protect=1.-smoothstep(.65,1.18,length((uv-faceRegion.xy)/(faceRegion.zw*faceRadius)));gl_FragColor=sRGBTransferEOTF(vec4(lineColor,opacity*(1.-protect*faceStrength)));
#include <colorspace_fragment>

 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`})));}
 add(positions,colors,.23+gain*.42+musicCurve('treble',musicTime)*.12);add(echoP,echoC,settings.chromatic*.6);
 metrics.flowLineSegments=positions.length/6;metrics.chromaticSegments=echoP.length/6;
}

// Live studio runtime. build_studio_core.py assembles this with the existing shader core.
const source=$('#source'),audio=new Audio(MUSIC.audio),viewport=$('#viewport');
const post=createPostEffects(T,renderer);
source.crossOrigin='anonymous';audio.crossOrigin='anonymous';source.src=activeClip.video;source.muted=true;source.preload='auto';
audio.preload='auto';audio.muted=true;audio.volume=settings.volume;
const videoTexture=new T.VideoTexture(source);videoTexture.colorSpace=T.SRGBColorSpace;
const videoMaterial=new T.MeshBasicMaterial({map:videoTexture,transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
let videoPlane,paused=true,rawMode=false,scrubbing=false,pendingSeek=null,seekSerial=0,manualBurst=-100,heldAction=null,contextLost=false;
let exportBusy=false,captureRequested=false,dirty=true,lastDraw=0,lastFrame=0,activePreset='Clean video',savedA=null;
const storageKey='afterimage-studio-v1';
function saveLocal(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,defaultExample:3,settings}));}catch{}}
function applySettings(value,label='Custom mix'){
 Object.assign(settings,validateSettings(value));activePreset=label;rawMode=false;dirty=true;lastTrailKey='';
 audio.volume=settings.volume;audio.playbackRate=settings.speed;pauseForCache();saveLocal();syncControls();
}
function change(key,value){if(!(key in defaults))return;applySettings({...settings,[key]:value});}
function pauseForCache(){if(!paused&&needsParticleFrames()&&!hasPreparedPack(node)){paused=true;audio.pause();source.pause();notice('Particle effects enabled. Press Play to prepare smooth playback.');}}
function toggleRaw(){rawMode=!rawMode;pauseForCache();dirty=true;syncControls();notice(rawMode?'Clean video · your mix is saved underneath':'Your mix is back');}
let preparingPlay=false;
async function togglePlay(){if(preparingPlay||exportBusy||switching)return;if(paused&&!activeClip.local&&needsParticleFrames()){const preparingNode=node;preparingPlay=true;$('#play').disabled=true;try{await preparePack(node,p=>{$('#switchNotice').hidden=false;$('#switchNotice').textContent='Preparing smooth playback · '+Math.round(p*100)+'%';});if(node!==preparingNode||exportBusy)return;}catch(e){notice(e.message);return;}finally{preparingPlay=false;if(!switching&&!exportBusy){$('#play').disabled=false;$('#switchNotice').hidden=true;}}}paused=!paused;last=0;if(paused)audio.pause();else{audio.currentTime=musicTime;audio.playbackRate=settings.speed;if(!audio.muted)audio.play().catch(()=>{});}syncControls();}
function sound(){audio.muted=!audio.muted;if(!paused&&!audio.muted){audio.currentTime=musicTime;audio.play().catch(()=>notice('Press Sound again to enable playback.'));}syncControls();}
function seek(t){
 paused=true;audio.pause();source.pause();heldAction=null;
 pendingSeek?.resolve(false);
 return new Promise(resolve=>{pendingSeek={t:T.MathUtils.clamp(t,0,MUSIC.duration-.001),id:++seekSerial,resolve};syncControls();});
}
function sourceTime(t){let begin=0;for(const e of MUSIC.score){if(t<e.end){return {action:e.kind==='rupture'?e.start:Math.min(e.start+(t-begin)*e.rate,manifest.timestamps.at(-1)),entry:e,local:t-begin,begin};}begin=e.end;}return {action:manifest.timestamps.at(-1),entry:{kind:'flow'},local:0,begin:0};}
function smooth(x){x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);}
function burstEnvelope(age){return age<0||age>.788?0:smooth(age/.16)*(1-smooth((age-.22)/.568));}
function needsParticleFrames(){return !rawMode&&settings.effectsMix>0&&(settings.particlesEnabled||settings.flowEnabled);}
async function setMoment(t,resetState=false){
 const mapped=sourceTime(t),next=heldAction??mapped.action;
 if(needsParticleFrames())await prepare(node,next);action=next;musicTime=t;playing=!paused&&heldAction===null&&mapped.entry.kind!=='rupture';frozen=heldAction!==null;
 if(resetState){if(needsParticleFrames())reset();clock=t;post.reset();}
 if(needsParticleFrames())bind();
 if(settings.flowEnabled&&needsParticleFrames()){const i=pair(action)[0];await Promise.all(Array.from({length:settings.history+1},(_,k)=>raw(node,Math.max(0,i-k*4))));}
}
function musicDrive(t){return settings.musicMatch?Math.min(1,.12+settings.audioGain*(musicCurve('accent',t)*.65+musicCurve('bass',t)*.25+musicCurve('energy',t)*.1)):1;}
function applyEffects(){const [fi,fj,ft]=pair(action),fa=FACE.regions[fi],fb=FACE.regions[fj];R.faceRegion.value.set(...fa.map((v,k)=>v+(fb[k]-v)*ft));R.faceWorld.value.set(manifest.world_width,manifest.world_height);
 const mapped=sourceTime(musicTime),strength=settings.effectsMix*musicDrive(musicTime),react=settings.beatSync?settings.audioGain*strength:0;
 playing=!paused&&heldAction===null&&mapped.entry.kind!=='rupture';
 const authored=settings.bursts?Math.max(mapped.entry.kind==='rupture'?burstEnvelope(mapped.local):0,...(MUSIC.events||[]).map(e=>burstEnvelope(musicTime-e.start))):0;
 const manual=burstEnvelope(performance.now()/1000-manualBurst);
 R.blast.value=rawMode?0:Math.max(authored,manual)*settings.burstStrength*strength;
 R.blastTime.value=mapped.entry.kind==='rupture'?mapped.local:Math.max(0,performance.now()/1000-manualBurst);
 R.bassPulse.value=musicCurve('bass',musicTime)*react;R.accentPulse.value=musicCurve('accent',musicTime)*react;
 R.glitchGain.value=rawMode?0:signalEnvelope(musicTime)*strength;R.signalTime.value=musicTime;
 R.density.value=settings.density*strength;R.grain.value=settings.grain;R.shape.value=settings.shape;
 R.faceStrength.value=1-settings.faceEffects;R.faceRadius.value=settings.faceRadius;
 R.fade.value=settings.particleOpacity;R.ceramic.value=1;
 points.visible=settings.particlesEnabled&&!rawMode&&strength>0;trails=settings.flowEnabled&&!rawMode&&strength>0;
 vortex=settings.vortex*settings.vortex*.5*strength;release=vortex*.5;strata=settings.strata*strength;
 U.brushRadius.value=settings.brushRadius;U.emission.value=settings.emission*strength;U.effectStrength.value=strength;
 // The master removes effects, never the underlying footage. A particle-only
 // look reveals an opaque source layer as its master amount is reduced.
 const sourceFallback=settings.effectsMix<1||settings.musicMatch;
 videoPlane.visible=rawMode||settings.videoEnabled||sourceFallback;
 videoMaterial.opacity=rawMode||sourceFallback?1:settings.videoOpacity;
 renderer.setClearColor(settings.background,1);
 // Mark visibility separately from actual simulated tracks.
 metrics.renderedSurfels=points.visible?seeds.reduce((n,v)=>n+(v<=settings.density*strength),0):0;
}
async function syncVideo(force=false){
 const target=action+manifest.source_timestamp_origin;
 source.playbackRate=MUSIC.source_rate*settings.speed;
 const shouldPlay=!paused&&heldAction===null&&sourceTime(musicTime).entry.kind!=='rupture';
 if(!shouldPlay)source.pause();
 if(force||Math.abs(source.currentTime-target)>.075){
  if(Math.abs(source.currentTime-target)>.002){
   source.currentTime=target;
   if(force)await new Promise(resolve=>{const timer=setTimeout(done,2500);function done(){clearTimeout(timer);source.removeEventListener('seeked',done);resolve();}source.addEventListener('seeked',done,{once:true});});
  }
 }
 if(shouldPlay&&source.paused)source.play().catch(()=>{});
}
function framing(t){const keys=[[0,1,0],[5,1,0],[7,.68,.55],[10,.68,.55],[12,1,0],[38,1,0],[42,.73,.48],[45,.73,.48],[48,1,0],[55,1,0]];let a=keys[0],b=keys.at(-1);for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){a=keys[i-1];b=keys[i];break;}const q=smooth((t-a[0])/(b[0]-a[0]));return {scale:T.MathUtils.lerp(a[1],b[1],q),y:T.MathUtils.lerp(a[2],b[2],q)};}
function draw(){
 const rect=viewport.getBoundingClientRect();camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
 const f=settings.autoCamera&&!rawMode?(activeClip.new?{scale:1-.06*Math.sin(musicTime/MUSIC.duration*Math.PI)**2,y:0}:framing(musicTime)):{scale:1,y:0};
 const cameraStrength=rawMode?0:settings.effectsMix*musicDrive(musicTime);
 const distance=5.4*T.MathUtils.lerp(1,f.scale,cameraStrength)/T.MathUtils.lerp(1,settings.zoom,cameraStrength),cx=settings.panX*cameraStrength,cy=(settings.panY+f.y)*cameraStrength;
 const y=settings.yaw*cameraStrength*Math.PI/180,p=settings.pitch*cameraStrength*Math.PI/180;
 camera.position.set(cx+Math.sin(y)*Math.cos(p)*distance,cy+Math.sin(p)*distance,Math.cos(y)*Math.cos(p)*distance);camera.lookAt(cx,cy,0);
 const r=R.faceRegion.value,world=R.faceWorld.value;
 const center=new T.Vector3((r.x-.5)*world.x,(.5-r.y)*world.y,0).project(camera);
 const edge=new T.Vector3((r.x-.5+r.z*settings.faceRadius)*world.x,(.5-r.y+r.w*settings.faceRadius)*world.y,0).project(camera);
 const screenFace=new T.Vector4(center.x*.5+.5,center.y*.5+.5,Math.abs(edge.x-center.x)*.5,Math.abs(edge.y-center.y)*.5);
 post.render(scene,camera,{raw:rawMode,time:musicTime,pulse:Math.max(R.accentPulse.value,R.blast.value),drive:musicDrive(musicTime),face:screenFace});lastDraw=performance.now();
}
function resize(){if(exportBusy)return;const r=viewport.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);dirty=true;}
new ResizeObserver(resize).observe(viewport);
function ui(){
 $('#play').textContent=paused?'▶ Play':'Ⅱ Pause';$('#play').setAttribute('aria-pressed',String(!paused));
 $('#time').textContent=musicTime.toFixed(2);if(!scrubbing)$('#timeline').value=musicTime;
 $('#sourceTime').textContent=`SOURCE ${action.toFixed(2)}s`;
 $('#status').textContent=rawMode?'CLEAN VIDEO':heldAction!==null?'MOMENT HELD':paused?'PAUSED':'LIVE';
 $('#counts').textContent=`${metrics.renderedSurfels.toLocaleString()} eligible grains · ${metrics.flowLineSegments??0} lines`;
 $('#fps').textContent=lastFrame?`${Math.round(1000/lastFrame)} FPS`:'— FPS';
 $('#freeze').classList.toggle('active',heldAction!==null);$('#freeze').textContent=heldAction===null?'Hold moment':'Release moment';
}
async function animate(now){
 requestAnimationFrame(animate);if(!ready||tickBusy||contextLost||captureRequested)return;
 tickBusy=true;try{
  const dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(dt)lastFrame=lastFrame?lastFrame*.9+dt*1000*.1:dt*1000;
  if(pendingSeek){const job=pendingSeek;pendingSeek=null;await setMoment(job.t,true);audio.currentTime=musicTime;await syncVideo(true);lastTrailKey='';applyEffects();updateTrails();draw();ui();job.resolve(true);return;}
  let t=musicTime;
  if(!paused){t=!audio.muted&&!audio.paused?audio.currentTime:musicTime+dt*settings.speed;if(t>=MUSIC.duration-.005){if(settings.loop){t=0;heldAction=null;audio.currentTime=0;await setMoment(0,true);if(!audio.muted)audio.play().catch(()=>{});}else{t=MUSIC.duration-.006;paused=true;audio.pause();}}}
  if(!paused||dirty){await setMoment(t);dirty=false;}
  applyEffects();acc+=dt;const count=Math.min(8,Math.floor(acc/STEP));for(let i=0;i<count;i++)step(false);acc=Math.max(0,acc-count*STEP);if(acc>STEP*8)acc=0;
  await syncVideo();updateTrails();draw();ui();
 }catch(e){paused=true;audio.pause();metrics.errors.push(String(e));notice('Playback paused: '+e.message);}finally{tickBusy=false;}
}
let tickBusy=false;
function syncControls(){
 for(const el of document.querySelectorAll('[data-setting]')){const value=settings[el.dataset.setting];if(el.type==='checkbox')el.checked=value;else el.value=value;}
 for(const el of document.querySelectorAll('[data-value]')){const k=el.dataset.value,c=controls.flatMap(g=>g[3]).find(c=>c[0]===k);el.textContent=c?.[5]==='%'?Math.round(settings[k]*100)+'%':Number(settings[k]).toFixed(k==='vortex'?3:k==='effectsMix'||c?.[4]<1?2:0)+(c?.[5]??'');}
 for(const el of document.querySelectorAll('[data-layer]')){const enabled=settings[el.dataset.layer];el.classList.toggle('layer-off',!enabled);}
 for(const b of document.querySelectorAll('[data-preset]'))b.classList.toggle('active',b.dataset.preset===activePreset&&!rawMode);
 $('#mixName').textContent=rawMode?'Clean comparison':activePreset;$('#raw').setAttribute('aria-pressed',String(rawMode));$('#raw').classList.toggle('active',rawMode);
 $('#sound').textContent=audio.muted?'Sound off':'Sound on';$('#sound').setAttribute('aria-pressed',String(!audio.muted));
 $('#timeline').max=MUSIC.duration-.001;$('#duration').textContent=MUSIC.duration.toFixed(2);$('#background').value=settings.background;
 $('#restoreA').disabled=!savedA;$('#matchMusic').classList.toggle('active',settings.musicMatch);$('#matchMusic').setAttribute('aria-pressed',String(settings.musicMatch));
}
function buildControls(){
 $('#presets').innerHTML=Object.keys(presets).map(name=>`<button data-preset="${name}">${name}</button>`).join('');
 $('#controls').innerHTML=controls.map(([number,title,toggle,rows])=>`<details ${['01','02','03','05'].includes(number)?'open':''} ${toggle?`data-layer="${toggle}"`:''}><summary><span class="section-number">${number}</span><span>${title}</span>${toggle?`<input aria-label="Enable ${title}" data-setting="${toggle}" type="checkbox">`:'<span class="chevron">+</span>'}</summary><div class="fields">${rows.map(c=>c.length===2?`<label class="check-row"><span>${c[1]}</span><input type="checkbox" data-setting="${c[0]}" aria-label="${c[1]}"></label>`:`<label class="slider-row"><span>${c[1]}</span><output data-value="${c[0]}"></output><input type="range" data-setting="${c[0]}" aria-label="${c[1]}" min="${c[2]}" max="${c[3]}" step="${c[4]}"></label>`).join('')}${number==='07'?'<button id="resetCamera" class="wide">Reset framing</button><p class="hint">Orbit is limited to ±8°: this is a moving depth relief.</p>':''}${number==='05'?'<p class="hint">0 = calm face; 1 = full effects. Includes scatter, tears, trails and image glitches. Face area adjusts the feathered region.</p>':''}</div></details>`).join('');
 document.querySelectorAll('[data-setting]').forEach(el=>{el.addEventListener('click',e=>e.stopPropagation());el.addEventListener('input',()=>change(el.dataset.setting,el.type==='checkbox'?el.checked:+el.value));});
 document.querySelectorAll('[data-preset]').forEach(el=>el.onclick=()=>{applySettings({...presets[el.dataset.preset],effectsMix:settings.effectsMix,faceEffects:settings.faceEffects},el.dataset.preset);$('#looksDialog').close();});
 $('#resetCamera').onclick=()=>applySettings({...settings,autoCamera:false,zoom:1,panX:0,panY:0,yaw:0,pitch:0});
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function snapshot(){
 captureRequested=true;try{while(tickBusy)await new Promise(r=>setTimeout(r,10));source.pause();await syncVideo(true);applyEffects();draw();
 const blob=await new Promise(resolve=>$('#canvas').toBlob(resolve,'image/png'));if(!blob)throw Error('Could not capture this frame.');download(blob,`afterimage-${musicTime.toFixed(2)}.png`);notice('PNG saved at the current viewport resolution.');
 }finally{captureRequested=false;last=0;}
}
buildControls();
document.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
// Open with the signature particle artwork. Migrate the old clean landing state,
// while preserving intentionally saved mixes after this default was introduced.
let restoredMix=null;
try{const stored=JSON.parse(localStorage.getItem(storageKey));if(stored?.version===1){const clean=['particlesEnabled','flowEnabled','glitchEnabled','macroEnabled','moshEnabled','sortEnabled','crushEnabled'].every(k=>!stored.settings?.[k]);if(stored.defaultExample===3)restoredMix=stored.settings;}}catch{}
applySettings(restoredMix||presets['Original particles'],restoredMix?'Saved mix':'Original particles');
$('#matchMusic').onclick=()=>{applySettings({...settings,musicMatch:!settings.musicMatch,beatSync:true},activePreset);notice(settings.musicMatch?'Music match on · enabled effects follow the soundtrack':'Music match off · manual effect amounts restored');};
$('#raw').onclick=toggleRaw;$('#play').onclick=togglePlay;$('#sound').onclick=sound;
$('#freeze').onclick=()=>{heldAction=heldAction===null?action:null;dirty=true;};
$('#burst').onclick=()=>{if(!settings.particlesEnabled){settings.particlesEnabled=true;syncControls();}rawMode=false;manualBurst=performance.now()/1000;dirty=true;};
$('#reform').onclick=()=>{manualBurst=-100;settings.vortex=settings.strata=0;settings.bursts=false;U.brush.value.set(100,100,0);reset();dirty=true;saveLocal();syncControls();};
$('#backFrame').onclick=()=>seek(musicTime-1/24);$('#nextFrame').onclick=()=>seek(musicTime+1/24);
$('#timeline').onpointerdown=()=>scrubbing=true;$('#timeline').oninput=e=>seek(+e.target.value);$('#timeline').onchange=()=>scrubbing=false;$('#timeline').onpointerup=()=>scrubbing=false;
$('#restart').onclick=()=>seek(0);$('#snapshot').onclick=()=>snapshot().catch(e=>notice(e.message));
$('#background').oninput=e=>change('background',e.target.value);
$('#saveA').onclick=()=>{savedA={...settings};syncControls();notice('A stored. Change the mix, then use A ↔ B to compare.');};
$('#restoreA').onclick=()=>{const next=savedA;savedA={...settings};applySettings(next,'A / B mix');};
$('#saveMix').onclick=()=>download(new Blob([JSON.stringify({version:1,asset:node,presentation:musicTime,settings},null,2)],{type:'application/json'}),`afterimage-${node}-mix.json`);
$('#loadMix').onclick=()=>$('#mixFile').click();$('#mixFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('Settings file is too large.');const value=JSON.parse(await file.text());if(value.version!==1||!value.settings)throw Error('Use an Afterimage version 1 mix file.');if(value.asset&&value.asset!==node&&LIBRARY.clips.some(c=>c.id===value.asset&&c.ready))await switchClip(value.asset);applySettings(value.settings,'Imported mix');if(Number.isFinite(value.presentation))await seek(value.presentation);notice('Mix loaded.');}catch(e){notice(e.message);}finally{e.target.value='';}};
$('#resetAll').onclick=()=>applySettings(presets['Original particles'],'Original particles');
$('#fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('#stagePanel').requestFullscreen().catch(e=>notice(e.message));};
$('#help').onclick=()=>$('#helpDialog').showModal();$('#closeHelp').onclick=()=>$('#helpDialog').close();
$('#canvas').onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY,yaw:settings.yaw,pitch:settings.pitch,orbit:e.shiftKey||$('#pointerMode').value==='orbit'};e.target.setPointerCapture(e.pointerId);};
$('#canvas').onpointermove=e=>{if(!pointer)return;if(pointer.orbit){change('yaw',T.MathUtils.clamp(pointer.yaw+(e.clientX-pointer.x)*.08,-8,8));change('pitch',T.MathUtils.clamp(pointer.pitch+(e.clientY-pointer.y)*.05,-10,10));}else if(!rawMode){const r=viewport.getBoundingClientRect(),v=new T.Vector3((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2,.5).unproject(camera),d=v.sub(camera.position).normalize();U.brush.value.copy(camera.position.clone().addScaledVector(d,-camera.position.z/d.z));}};
function stopBrush(){pointer=null;U.brush.value.set(100,100,0);}$('#canvas').onpointerup=stopBrush;$('#canvas').onpointercancel=stopBrush;$('#canvas').onlostpointercapture=stopBrush;
$('#canvas').addEventListener('wheel',e=>{e.preventDefault();change('zoom',T.MathUtils.clamp(settings.zoom-e.deltaY*.0005,.65,2));},{passive:false});
addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,button,dialog'))return;if(e.code==='Space'){e.preventDefault();togglePlay();}else if(e.key.toLowerCase()==='v')toggleRaw();else if(e.key.toLowerCase()==='f')$('#freeze').click();else if(e.key.toLowerCase()==='r')$('#reform').click();else if(e.key.toLowerCase()==='d')$('#burst').click();else if(e.key==='ArrowRight'){e.preventDefault();seek(musicTime+1/24);}else if(e.key==='ArrowLeft'){e.preventDefault();seek(musicTime-1/24);}else if(e.key==='?')$('#help').click();});
$('#canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;audio.pause();source.pause();$('#loading').hidden=false;$('#loadText').textContent='Graphics context lost. Reload this page to restore your saved mix.';});
function videoGeometry(m){const ratio=(source.videoWidth||16)/(source.videoHeight||9),h=Math.min(m.world_height,m.world_width/ratio);return new T.PlaneGeometry(h*ratio,h);}
manifest=await prepare(node,0);videoPlane=new T.Mesh(new T.PlaneGeometry(manifest.world_width,manifest.world_height),videoMaterial);videoPlane.renderOrder=-10;scene.add(videoPlane);
await new Promise((resolve,reject)=>{if(source.readyState>=2)return resolve();source.addEventListener('loadeddata',resolve,{once:true});source.addEventListener('error',()=>reject(Error('Source video could not load.')),{once:true});});
videoPlane.geometry.dispose();videoPlane.geometry=videoGeometry(manifest);reset();ready=true;showcase=true;await setMoment(0,true);await syncVideo(true);resize();applyEffects();draw();syncControls();ui();$('#loading').hidden=true;
document.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);syncControls();
window.studio={ready:true,settings,defaults,presets,applySettings,seek,togglePlay,toggleRaw,snapshot,
 state:()=>({presentation:musicTime,action,paused,rawMode,heldAction,sourceTime:source.currentTime,sourceDrift:source.currentTime-action-manifest.source_timestamp_origin,audioTime:audio.currentTime,audioMuted:audio.muted,audioDrift:audio.currentTime-musicTime,settings:{...settings},layers:{video:videoPlane.visible,particles:points.visible,flow:trails},blast:R.blast.value,glitch:R.glitchGain.value,face:R.faceStrength.value,simulatedParticles:N,eligibleGrains:metrics.renderedSurfels,lines:metrics.flowLineSegments,errors:metrics.errors,rawFrames:rawCache.size,gpuFrames:gpuCache.size}),
 sample(){const p=new Float32Array(N*4);renderer.readRenderTargetPixels(pos[ping],0,0,W,H,p);return {nonfinite:p.reduce((n,v)=>n+!Number.isFinite(v),0)};}};
requestAnimationFrame(animate);

// Collection browser and atomic actor swaps. Appended after the renderer runtime.
let switching=false,onlyFavorites=false,libraryPage=0;
let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem('afterimage-favorites')||'[]'));}catch{}
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clipCard(c,compact=false){return `<article class="clip-card ${c.id===node?'selected':''}" style="--clip-color:${c.color}"><button class="clip-image" data-clip="${c.id}" aria-label="Load ${escapeHTML(c.title)}"><img src="${c.poster}" alt="${escapeHTML(c.actor)} in ${escapeHTML(c.title)} couture" loading="lazy">${c.preview&&!compact?`<video muted playsinline loop preload="none" data-preview="${c.preview}"></video>`:''}<span class="clip-number">${String(LIBRARY.clips.indexOf(c)+1).padStart(2,'0')}</span><span class="clip-play">↗</span></button><div class="clip-caption"><button data-clip="${c.id}"><strong>${escapeHTML(c.title)}</strong><span>${escapeHTML(c.actor)} · ${escapeHTML(c.genre)}</span></button>${!compact?`<button class="favorite ${favorites.has(c.id)?'active':''}" data-favorite="${c.id}" aria-label="Favorite ${escapeHTML(c.title)}" aria-pressed="${favorites.has(c.id)}">${favorites.has(c.id)?'♥':'♡'}</button>`:''}</div>${!compact?`<div class="clip-tags"><span>${c.bpm?c.bpm+' BPM':'ORIGINAL AUDIO'}</span><span>${c.duration.toFixed(1)} SEC</span><span>${c.local?'LOCAL VIDEO':'H3 MAX'}</span></div>`:''}</article>`;}
function wireCards(root){
 root.querySelectorAll('[data-clip]').forEach(b=>b.onclick=()=>switchClip(b.dataset.clip));
 root.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{const id=b.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);localStorage.setItem('afterimage-favorites',JSON.stringify([...favorites]));renderLibrary();});
 root.querySelectorAll('.clip-image video').forEach(v=>{const p=v.parentElement;p.addEventListener('pointerenter',()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(!v.src)v.src=v.dataset.preview;v.play().catch(()=>{});});p.addEventListener('pointerleave',()=>{v.pause();});});
}
function renderLibrary(){
 const query=$('#collectionSearch').value.toLowerCase(),genre=$('#genreFilter').value;
 const rows=LIBRARY.clips.filter(c=>c.ready&&(!onlyFavorites||favorites.has(c.id))&&(!genre||c.genre===genre)&&`${c.title} ${c.actor} ${c.genre}`.toLowerCase().includes(query));
 const size=innerWidth<600?(innerHeight<600?2:4):(innerHeight<620?3:6),pages=Math.max(1,Math.ceil(rows.length/size));libraryPage=Math.min(libraryPage,pages-1);$('#libraryPage').textContent=`${libraryPage+1} / ${pages}`;$('#libraryPrev').disabled=libraryPage===0;$('#libraryNext').disabled=libraryPage===pages-1;$('#collectionGrid').style.gridTemplateRows=`repeat(${size>3?2:1},minmax(0,1fr))`;
 $('#collectionGrid').innerHTML=rows.slice(libraryPage*size,(libraryPage+1)*size).map(c=>clipCard(c)).join('')||'<p class="empty-state">No performances match. Try another name or genre.</p>';wireCards($('#collectionGrid'));
 $('#libraryCount').textContent=`${rows.length} performances`;
 $('#favoritesOnly').classList.toggle('active',onlyFavorites);$('#favoritesOnly').setAttribute('aria-pressed',String(onlyFavorites));
}
function updateClipInfo(){
 $('#clipTitle').textContent=activeClip.title;$('#clipActor').textContent=`${activeClip.actor} / ${activeClip.genre} / ${activeClip.bpm?activeClip.bpm+' BPM':'ORIGINAL AUDIO'}`;
 $('#clipDescription').textContent=activeClip.description;$('#lyricText').textContent=activeClip.lyrics||'Instrumental';
 $('#downloadClip').href=activeClip.download;$('#downloadSong').href=activeClip.song;
 $('#collectionCount').textContent=`${LIBRARY.clips.filter(c=>c.new).length} new performances`;
 document.documentElement.style.setProperty('--actor-accent',activeClip.color);document.title=`${activeClip.title} — AFTERIMAGE`;
 renderLibrary();
}
async function switchClip(id,push=true){
 const next=LIBRARY.clips.find(c=>c.id===id&&c.ready);if(!next||switching)return false;
 if(next.id===node){$('#collectionDialog').close();return true;}
 switching=true;captureRequested=true;$('#collectionDialog').close();$('#switchNotice').hidden=false;$('#switchNotice').textContent=`Preparing ${next.title}…`;
 const previousClip=activeClip,oldSource=source.src;paused=true;audio.pause();source.pause();pendingSeek?.resolve(false);pendingSeek=null;
 document.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
 try{
  while(tickBusy)await new Promise(r=>setTimeout(r,10));
  const fetchJSON=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Missing performance asset');return r.json();};
  const [m,music,face]=await Promise.all([prepare(next.id,0),fetchJSON(`../data/${next.id}/score.json`),fetchJSON(`../data/${next.id}/face-regions.json`)]);
  // Keep the prior rendered frame visible until all new numerical assets and video are ready.
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('Video load timed out')),20000);function done(err){clearTimeout(timer);source.removeEventListener('loadeddata',loaded);source.removeEventListener('error',failed);err?reject(err):resolve();}function loaded(){done();}function failed(){done(Error('Video could not load'));}source.addEventListener('loadeddata',loaded,{once:true});source.addEventListener('error',failed,{once:true});source.src=next.video;source.load();});
  node=next.id;manifest=m;MUSIC=music;FACE=face;activeClip=next;action=musicTime=clock=0;manualBurst=-100;heldAction=null;acc=0;last=0;
  audio.src=MUSIC.audio;audio.load();audio.playbackRate=settings.speed;audio.volume=settings.volume;
  clearTrails();lastTrailKey='';for(const g of gpuCache.values())Object.values(g).forEach(t=>t.dispose());gpuCache.clear();
  for(const key of [...rawCache.keys()])if(!key.startsWith(node+':'))rawCache.delete(key);
  videoPlane.geometry.dispose();videoPlane.geometry=videoGeometry(m);post.reset();reset();
  if(!$('#keepMix').checked)applySettings({...presets['Original particles'],effectsMix:settings.effectsMix,faceEffects:settings.faceEffects},'Original particles');
  await setMoment(0,true);await syncVideo(true);applyEffects();draw();ui();syncControls();updateClipInfo();
  if(push){const url=new URL(location.href);url.searchParams.set('clip',id);history.pushState({clip:id},'',url);}
  notice(`${next.title} is ready. Your mix controls are live.`);return true;
 }catch(e){metrics.errors.push(String(e));source.src=oldSource;activeClip=previousClip;notice(e.message);return false;}
 finally{switching=false;captureRequested=false;dirty=true;$('#switchNotice').hidden=true;document.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);syncControls();layoutControls();renderLibrary();readingPages();}
}
$('#openCollection').onclick=()=>{libraryPage=0;$('#collectionDialog').showModal();renderLibrary();};$('#closeCollection').onclick=()=>{$('#collectionDialog').querySelectorAll('video').forEach(v=>v.pause());$('#collectionDialog').close();};
$('#collectionDialog').addEventListener('close',()=>$('#collectionDialog').querySelectorAll('video').forEach(v=>v.pause()));
$('#collectionSearch').oninput=()=>{libraryPage=0;renderLibrary();};$('#genreFilter').innerHTML='<option value="">All sounds</option>'+[...new Set(LIBRARY.clips.map(c=>c.genre))].sort().map(g=>`<option>${escapeHTML(g)}</option>`).join('');$('#genreFilter').onchange=()=>{libraryPage=0;renderLibrary();};
$('#favoritesOnly').onclick=()=>{onlyFavorites=!onlyFavorites;libraryPage=0;renderLibrary();};
$('#nextClip').onclick=()=>{const a=LIBRARY.clips.filter(c=>c.ready);switchClip(a[(a.findIndex(c=>c.id===node)+1)%a.length].id);};
$('#previousClip').onclick=()=>{const a=LIBRARY.clips.filter(c=>c.ready);switchClip(a[(a.findIndex(c=>c.id===node)-1+a.length)%a.length].id);};
addEventListener('popstate',()=>switchClip(new URLSearchParams(location.search).get('clip')||LIBRARY.clips[0].id,false));
window.studio.switchClip=switchClip;window.studio.collection=LIBRARY;const originalState=window.studio.state;window.studio.state=()=>({...originalState(),clip:activeClip.id,switching});
updateClipInfo();
$('#libraryPrev').onclick=()=>{libraryPage--;renderLibrary();};$('#libraryNext').onclick=()=>{libraryPage++;renderLibrary();};
const tabNames=['Video','Pigment','Flow','Tears','Face','Forces','Camera','Playback','Blocks','Datamosh','Sorting','Bit-crush'];
let layerIndex=1,parameterPage=0;
$('#layerTabs').innerHTML=controls.map((c,i)=>`<button role="tab" id="layer-${i}" aria-controls="panel-${i}" data-tab="${i}">${tabNames[i]}</button>`).join('');
function layoutControls(){
 const available=$('#controls').clientHeight,perPage=Math.max(1,Math.floor((available-48)/57));
 [...$('#controls').children].forEach((g,i)=>{g.id=`panel-${i}`;g.setAttribute('role','tabpanel');g.setAttribute('aria-labelledby',`layer-${i}`);g.hidden=i!==layerIndex;g.open=true;g.querySelector('summary').onclick=e=>e.preventDefault();const fields=[...g.querySelector('.fields').children].filter(x=>!x.classList.contains('hint'));g.querySelectorAll('.hint').forEach(x=>x.hidden=true);const pages=Math.max(1,Math.ceil(fields.length/perPage));if(i===layerIndex){parameterPage=Math.min(parameterPage,pages-1);$('#paramPage').textContent=`Controls ${parameterPage+1} / ${pages}`;$('#paramPrev').disabled=parameterPage===0;$('#paramNext').disabled=parameterPage===pages-1;}fields.forEach((f,j)=>f.hidden=Math.floor(j/perPage)!==parameterPage);});
 document.querySelectorAll('[data-tab]').forEach((b,i)=>{b.classList.toggle('active',i===layerIndex);b.setAttribute('aria-selected',i===layerIndex);});
}
$('#layerTabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b){layerIndex=+b.dataset.tab;parameterPage=0;layoutControls();}};
$('#paramPrev').onclick=()=>{parameterPage--;layoutControls();};$('#paramNext').onclick=()=>{parameterPage++;layoutControls();};
new ResizeObserver(layoutControls).observe($('#controls'));
const well=document.querySelector('.stage-well');new ResizeObserver(()=>{const w=Math.min(well.clientWidth,well.clientHeight*16/9);$('#viewport').style.width=w+'px';$('#viewport').style.height=w*9/16+'px';}).observe(well);
$('#openLooks').onclick=()=>$('#looksDialog').showModal();$('#closeLooks').onclick=()=>$('#looksDialog').close();
const helpPages=[['Build your mix','Start with clean H3 video. Select a layer, switch it on, then adjust its controls. Arrow buttons reveal additional parameters. Clean / mix temporarily bypasses everything without losing your settings.'],['Hands on','Drag to brush pigment. Shift + drag to orbit the shallow relief. Use the wheel over the preview to zoom. The Face tab has its own effects amount: 0 calms the face and 1 applies full effects. Its feathered area also controls scatter, flow and post effects.'],['Keyboard','Space: play / pause. V: clean / mix. F: hold action while music continues. D: scatter. R: reform. Left / right: step one frame. Releasing a hold rejoins the current performance time.'],['Save an experiment','Store A remembers your mix; A ↔ B swaps it with the current settings. Save frame downloads a PNG. Save mix stores settings and the selected performer. Export video renders the current effects to an MP4 with audio. Download film provides the source film.'],['About the material','131,072 tracked particles are simulated; density controls eligible grains. This is single-view depth relief with a shallow orbit. Datamosh uses image feedback, not codec corruption. Bit-crush reduces image color depth. Sound can drive effects without any audio visualization.']];
let helpIndex=0,notesIndex=0;
function readingPages(){const h=helpPages[helpIndex];$('#helpContent').innerHTML=`<h3>${h[0]}</h3><p>${h[1]}</p>`;$('#helpPage').textContent=`${helpIndex+1} / ${helpPages.length}`;$('#helpPrev').disabled=!helpIndex;$('#helpNext').disabled=helpIndex===helpPages.length-1;
 const lines=(activeClip.lyrics||'Instrumental').split('\n').filter(Boolean),pages=1+Math.ceil(lines.length/4);notesIndex=Math.min(notesIndex,pages-1);$('#clipDescription').hidden=notesIndex!==0;$('#lyricText').hidden=notesIndex===0;$('#lyricText').textContent=lines.slice((notesIndex-1)*4,notesIndex*4).join('\n');$('#notesPage').textContent=`${notesIndex+1} / ${pages}`;$('#notesPrev').disabled=!notesIndex;$('#notesNext').disabled=notesIndex===pages-1;}
$('#helpPrev').onclick=()=>{helpIndex--;readingPages();};$('#helpNext').onclick=()=>{helpIndex++;readingPages();};$('#help').onclick=()=>{readingPages();$('#helpDialog').showModal();};
$('#openNotes').onclick=()=>{notesIndex=0;readingPages();$('#notesDialog').showModal();};$('#closeNotes').onclick=()=>$('#notesDialog').close();$('#notesPrev').onclick=()=>{notesIndex--;readingPages();};$('#notesNext').onclick=()=>{notesIndex++;readingPages();};
addEventListener('resize',()=>{renderLibrary();layoutControls();});
// Prevent document/panel scrolling while preserving canvas zoom and native range controls.
document.addEventListener('wheel',e=>{if(!e.target.closest('#canvas,input'))e.preventDefault();},{passive:false});
layoutControls();readingPages();


// Local media workflow. All requests go to the loopback server, never a hosted API.
const waitMedia=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let importing=false,exportCancelled=false;
$('#cancelExport').disabled=true;
$('#openImport').onclick=()=>$('#importDialog').showModal();$('#closeImport').onclick=()=>$('#importDialog').close();
$('#videoFile').onchange=async e=>{
 const file=e.target.files[0];if(!file||importing)return;
 if(file.size>2*1024**3){$('#importStatus').textContent='Choose a video smaller than 2 GB.';return;}
 importing=true;$('#videoFile').disabled=true;$('#importProgress').value=0;$('#importStatus').textContent='Preparing your video in this browser…';
 try{
  const clip=await importVideo(file,(progress,text)=>{$('#importProgress').value=progress;$('#importStatus').textContent=text+' · '+Math.round(progress*100)+'%';});const j={clip};
  LIBRARY.clips.push(j.clip);$('#genreFilter').innerHTML='<option value="">All sounds</option>'+[...new Set(LIBRARY.clips.map(c=>c.genre))].sort().map(g=>`<option>${escapeHTML(g)}</option>`).join('');renderLibrary();
  $('#importStatus').textContent='Ready. Saved in this browser and added to your collection.';$('#importProgress').value=1;
  if(!exportBusy){await switchClip(j.clip.id);$('#importDialog').close();}
 }catch(e){$('#importStatus').textContent='Import failed: '+e.message.slice(0,220);}
 finally{importing=false;$('#videoFile').disabled=false;$('#videoFile').value='';}
};
$('#openExport').onclick=()=>{if(!exportBusy){$('#cancelExport').disabled=true;$('#exportStart').value=0;$('#exportEnd').value=MUSIC.duration.toFixed(3);$('#exportEnd').max=MUSIC.duration;$('#exportStart').max=MUSIC.duration;$('#exportStatus').textContent='Ready to render.';}$('#exportDialog').showModal();};
$('#closeExport').onclick=()=>{if(!exportBusy)$('#exportDialog').close();};
$('#exportDialog').addEventListener('cancel',e=>{if(exportBusy)e.preventDefault();});
$('#cancelExport').onclick=()=>{exportCancelled=true;$('#exportStatus').textContent='Cancelling after the current frame…';};
async function renderVideo(){
 if(exportBusy||switching||importing)return;
 const start=Number($('#exportStart').value),end=Math.min(Number($('#exportEnd').value),MUSIC.duration),width=Number($('#exportSize').value),height=width*9/16;
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start){$('#exportStatus').textContent='Choose a valid start and end time.';return;}
 const old={time:musicTime,paused,held:heldAction,raw:rawMode,ratio:renderer.getPixelRatio(),manual:manualBurst};
 const locked=[...document.querySelectorAll('button,input,select')].map(el=>[el,el.disabled]);let jobId=null,browserExport=null;
 exportBusy=true;captureRequested=true;exportCancelled=false;$('#exportDownload').hidden=true;$('#exportProgress').value=0;
 locked.forEach(([el])=>el.disabled=true);$('#cancelExport').disabled=false;
 try{
  while(tickBusy)await waitMedia(10);
  paused=true;audio.pause();source.pause();heldAction=null;manualBurst=-100;U.brush.value.set(100,100,0);
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);R.ratio.value=1;post.reset();clearTrails();lastTrailKey='';
  browserExport=await createBrowserExport($('#canvas'),{start,end,width,height,speed:settings.speed,volume:settings.volume,sound:$('#exportSound').checked},MUSIC.audio,text=>$('#exportStatus').textContent=text);const j=browserExport;
  await setMoment(0,true);clock=0;let simulated=0;
  for(let i=0;i<j.expected;i++){
   if(exportCancelled)throw Error('Export cancelled.');
   const t=Math.min(end-.00001,start+i/24*settings.speed);
   // Fixed simulation steps, with real source timestamps at each step. Warm up
   // from the beginning so a selected range has the same simulation history.
   while(simulated+STEP*settings.speed<=t+1e-8){
    simulated+=STEP*settings.speed;await setMoment(simulated);paused=false;applyEffects();step(false);paused=true;
    if(exportCancelled)throw Error('Export cancelled.');
   }
   await setMoment(t);await syncVideo(true);applyEffects();updateTrails();draw();
   await browserExport.frame(i);
   $('#exportProgress').value=(i+1)/j.expected*.9;$('#exportStatus').textContent=`Rendering frame ${i+1} / ${j.expected}`;
   await waitMedia(0);
  }
  $('#cancelExport').disabled=true;$('#exportStatus').textContent='Finishing your video…';
  const blob=await browserExport.finish(),link=$('#exportDownload');if(link.dataset.objectUrl)URL.revokeObjectURL(link.dataset.objectUrl);link.href=link.dataset.objectUrl=URL.createObjectURL(blob);link.download='afterimage.'+browserExport.extension;link.textContent='Download '+browserExport.extension.toUpperCase()+' ↓';link.hidden=false;$('#exportProgress').value=1;$('#exportStatus').textContent=`Ready · ${width} × ${height} · 24 fps.`;
 }catch(e){if(browserExport)await browserExport.cancel().catch(()=>{});$('#exportStatus').textContent=e.message.slice(0,220);}
 finally{
  paused=true;heldAction=null;manualBurst=old.manual;rawMode=old.raw;
  renderer.setPixelRatio(old.ratio);R.ratio.value=old.ratio;exportBusy=false;resize();
  await setMoment(old.time,true);await syncVideo(true);heldAction=old.held;audio.currentTime=old.time;paused=old.paused;last=0;acc=0;
  applyEffects();updateTrails();draw();captureRequested=false;dirty=true;
  locked.forEach(([el,disabled])=>el.disabled=disabled);$('#cancelExport').disabled=true;syncControls();layoutControls();renderLibrary();readingPages();
  if(!paused&&!audio.muted)audio.play().catch(()=>{});
 }
}
$('#startExport').onclick=renderVideo;
window.studio.renderVideo=renderVideo;

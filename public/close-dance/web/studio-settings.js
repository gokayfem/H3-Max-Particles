// User parameters are independent of the authored score and simulation state.
export const defaults={musicMatch:false,faceEffects:.25,effectsMix:1,classicTiming:false,videoEnabled:true,videoOpacity:1,particlesEnabled:false,density:.24,grain:6.4,particleOpacity:.8,shape:0,flowEnabled:false,lineOpacity:.75,lineDensity:1,lineLength:1,history:4,combs:true,chromatic:.6,glitchEnabled:false,glitch:.65,faceStrength:1,faceRadius:1.15,beatSync:true,audioGain:1,bursts:false,burstStrength:1,emission:1,vortex:0,strata:0,brushRadius:.45,autoCamera:false,zoom:1,panX:0,panY:0,yaw:0,pitch:0,background:'#ffffff',speed:1,volume:.8,loop:true};
Object.assign(defaults,{macroEnabled:false,macroAmount:.6,blockSize:32,blockFall:.4,moshEnabled:false,moshAmount:.8,rgbSplit:.45,sortEnabled:false,sortAmount:.6,sortSpan:96,sortVertical:false,crushEnabled:false,colorBits:4,crushAmount:.8});
export const settings={...defaults};
export const presets={
 'Clean video':{...defaults},
 'Video + filaments':{...defaults,flowEnabled:true,lineOpacity:.85,lineLength:1.8,glitch:.35},
 'Pigment overlay':{...defaults,particlesEnabled:true,particleOpacity:.65,density:.13,grain:8,flowEnabled:true,lineOpacity:.5,glitchEnabled:true,glitch:.35},
 'Original particles':{...defaults,classicTiming:true,videoEnabled:false,particlesEnabled:true,density:.24,grain:6.4,particleOpacity:1,flowEnabled:true,lineOpacity:1,history:6,lineLength:1,chromatic:1,glitchEnabled:true,glitch:1,faceStrength:1,faceRadius:1,bursts:true,autoCamera:true},
 'Face / focus':{...defaults,videoEnabled:false,particlesEnabled:true,particleOpacity:1,flowEnabled:true,glitchEnabled:true,bursts:true,autoCamera:true},
 'Signal storm':{...defaults,videoEnabled:false,particlesEnabled:true,density:.18,grain:9,particleOpacity:1,flowEnabled:true,lineLength:2.5,lineDensity:1.5,chromatic:1.5,glitchEnabled:true,glitch:1.5,bursts:true,burstStrength:1.2},
 'Quiet squares':{...defaults,videoEnabled:false,particlesEnabled:true,particleOpacity:.95,density:.12,grain:10,flowEnabled:true,lineOpacity:.3,chromatic:0,emission:.3}
};
// [key, label, min, max, step, unit]; booleans use [key,label].
export const controls=[
 ['01','Source video','videoEnabled',[
  ['videoOpacity','Opacity',0,1,.01,'%']]],
 ['02','Square pigment','particlesEnabled',[
  ['density','Particle density',.01,1,.01,'%'],['grain','Grain size',1,20,.1,'px'],['particleOpacity','Opacity',0,1,.01,'%'],['shape','Square → round',0,1,.01,'%'],['emission','Motion shedding',0,3,.05,'×']]],
 ['03','Flow filaments','flowEnabled',[
  ['lineOpacity','Opacity',0,1,.01,'%'],['lineDensity','Line density',.25,3,.05,'×'],['lineLength','Stretch',0,4,.05,'×'],['history','Trail history',1,6,1,''],['combs','Parallel combs'],['chromatic','Color echoes',0,2,.05,'×']]],
 ['04','Signal distortion','glitchEnabled',[
  ['glitch','Tear strength',0,2,.01,'×'],['beatSync','Follow musical accents'],['audioGain','Beat intensity',0,2,.05,'×']]],
 ['05','Face effects',null,[
  ['faceEffects','Face effects',0,1,.01,'%'],['faceRadius','Face area',.65,2,.05,'×']]],
 ['06','Destruction & forces',null,[
  ['bursts','Short scored scatter hits'],['burstStrength','Burst strength',0,2,.05,'×'],['vortex','Vortex force',0,2,.001,'×'],['strata','Depth strata',0,1,.01,'%'],['brushRadius','Brush radius',.1,1.5,.05,'']]],
 ['07','Camera',null,[
  ['autoCamera','Additional camera motion'],['zoom','Zoom',.65,2,.01,'×'],['panX','Horizontal framing',-2,2,.01,''],['panY','Vertical framing',-1.5,1.5,.01,''],['yaw','Shallow orbit',-8,8,.1,'°'],['pitch','Tilt',-10,10,.1,'°']]],
 ['09','Macroblock collapse','macroEnabled',[
  ['macroAmount','Block mosaic',0,1,.01,'%'],['blockSize','Block size',8,128,1,'px'],['blockFall','Falling slabs',0,2,.01,'×']]],
 ['10','Datamosh-style feedback','moshEnabled',[
  ['moshAmount','Frame persistence',0,1.2,.01,'×'],['rgbSplit','RGB separation',0,2,.01,'×']]],
 ['11','Pixel sorting','sortEnabled',[
  ['sortAmount','Sorted mix',0,1,.01,'%'],['sortSpan','Sorting span',16,256,1,'px'],['sortVertical','Vertical sorting']]],
 ['12','Color bit-crush','crushEnabled',[
  ['colorBits','Bits per channel',1,8,1,'bit'],['crushAmount','Crushed mix',0,1,.01,'%']]],
 ['08','Playback & sound',null,[
  ['musicMatch','Match music to effects'],['speed','Playback speed',.25,1.5,.05,'×'],['volume','Sound volume',0,1,.01,'%'],['loop','Loop performance']]]
];
controls.sort((a,b)=>Number(a[0])-Number(b[0]));
Object.assign(presets,{
 'Digital collapse':{...defaults,macroEnabled:true,macroAmount:.65,blockSize:38,blockFall:1,moshEnabled:true,moshAmount:.75,rgbSplit:.6,faceStrength:1},
 'Sorted signal':{...defaults,sortEnabled:true,sortAmount:.82,sortSpan:128,crushEnabled:true,colorBits:4,crushAmount:.55,faceStrength:1},
 'Broken transmission':{...defaults,particlesEnabled:true,density:.1,grain:9,particleOpacity:.4,flowEnabled:true,lineOpacity:.45,moshEnabled:true,moshAmount:1.05,macroEnabled:true,macroAmount:.25,blockFall:.5,crushEnabled:true,colorBits:5,crushAmount:.6}
});
export function validateSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('This is not a settings object.');
 const out={...defaults},ranges=new Map(controls.flatMap(c=>c[3]).filter(c=>c.length>2).map(c=>[c[0],c]));
 for(const [k,v] of Object.entries(defaults)){
  if(!(k in input))continue;
  if(typeof v==='boolean'){if(typeof input[k]==='boolean')out[k]=input[k];}
  else if(typeof v==='number'){if(typeof input[k]==='number'&&Number.isFinite(input[k])){const c=k==='effectsMix'?['effectsMix','Effects',0,1,.01]:ranges.get(k);out[k]=c?Math.max(c[2],Math.min(c[3],input[k])):v;if(k==='history')out[k]=Math.round(out[k]);}}
  else if(k==='background'&&/^#[0-9a-f]{6}$/i.test(input[k]))out[k]=input[k];
 }
 if(!('faceEffects' in input)&&typeof input.faceStrength==='number')out.faceEffects=1-Math.max(0,Math.min(1,input.faceStrength));
 return out;
}

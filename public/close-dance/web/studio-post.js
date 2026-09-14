import {settings} from './studio-settings.js?v=color-4';

// Image-space effects. Motion mosh is temporal feedback, not a corrupted codec stream.
export function createPostEffects(T,renderer){
 // Work in linear light throughout; encode to display sRGB only in the final copy.
 const makeTarget=()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType});
 const input=makeTarget(),history=[makeTarget(),makeTarget()];
 for(const r of [input,...history]){r.texture.colorSpace=T.LinearSRGBColorSpace;r.depthBuffer=r===input;}
 const uniforms={current:{value:input.texture},previous:{value:history[0].texture},size:{value:new T.Vector2(1,1)},time:{value:0},pulse:{value:0},valid:{value:0},face:{value:new T.Vector4(.5,.7,.1,.1)},protect:{value:1},macro:{value:0},blockSize:{value:32},fall:{value:0},mosh:{value:0},sort:{value:0},sortSpan:{value:64},vertical:{value:0},bits:{value:8},crush:{value:0},rgb:{value:0}};
 const quadScene=new T.Scene(),cam=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,vertexShader:vertex,fragmentShader:`
 precision highp float;varying vec2 vUv;uniform sampler2D current,previous;uniform vec2 size;uniform vec4 face;
 uniform float time,pulse,valid,protect,macro,blockSize,fall,mosh,sort,sortSpan,vertical,bits,crush,rgb;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
 float subject(vec3 c){c=sRGBTransferOETF(vec4(c,1.)).rgb;return 1.-smoothstep(.82,.985,min(c.r,min(c.g,c.b)));}
 vec3 sampleAt(vec2 uv){return texture2D(current,clamp(uv,vec2(0.),vec2(1.))).rgb;}
 void main(){
  vec2 uv=vUv;vec3 clean=sampleAt(uv);float faceMask=(1.-smoothstep(.65,1.2,length((uv-face.xy)/max(face.zw,vec2(.001)))))*protect;
  float safe=1.-faceMask;float mask=subject(clean);vec2 grid=size/max(4.,blockSize),cell=floor(uv*grid);float chosen=step(.58,hash(cell));
  vec2 q=uv;
  if(macro>0.||fall>0.){
   vec2 snapped=(cell+.5)/grid;
   q=mix(q,snapped,macro*safe*mask);
   float drop=fall*safe*chosen*(.18+pulse*.82);
   q.y+=drop*(.06+hash(cell+4.)*.21);q.x+=sin(cell.y*3.1+time*4.)*drop*.035;
  }
  vec3 color=sampleAt(q);
  if(sort>0.){
   vec2 axis=vertical>.5?vec2(0.,1.):vec2(1.,0.);float pixel=dot(q*size,axis),base=floor(pixel/sortSpan)*sortSpan;
   vec3 values[8];
   for(int i=0;i<8;i++){vec2 coord=q+axis*((base+(float(i)+.5)*sortSpan/8.-pixel)/dot(size,axis));values[i]=sampleAt(coord);}
   // Bounded odd-even sort of eight real neighboring image samples by brightness.
   for(int pass=0;pass<8;pass++){for(int j=0;j<7;j++){if((j+pass)%2==0&&luma(values[j])>luma(values[j+1])){vec3 temp=values[j];values[j]=values[j+1];values[j+1]=temp;}}}
   int rank=int(clamp(floor(fract(pixel/sortSpan)*8.),0.,7.));vec3 sorted=values[0];for(int i=0;i<8;i++)if(i==rank)sorted=values[i];
   float edge=step(.16,luma(clean))*subject(clean);color=mix(color,sorted,sort*safe*edge);
  }
  if(rgb>0.){vec2 shift=vec2(rgb*(.002+pulse*.005)*safe,0.);color.r=sampleAt(q+shift).r;color.b=sampleAt(q-shift).b;}
  if(mosh>0.&&valid>.5){
   vec2 d=1./size;float gx=luma(sampleAt(q+vec2(d.x*4.,0.)))-luma(sampleAt(q-vec2(d.x*4.,0.)));
   float gy=luma(sampleAt(q+vec2(0.,d.y*4.)))-luma(sampleAt(q-vec2(0.,d.y*4.)));
   vec2 drift=vec2(gx,-gy)*.026+vec2(sin(cell.y*.8+time*.7)*.0015,-.0015);
   vec3 old=texture2D(previous,clamp(q-drift*mosh,vec2(0.),vec2(1.))).rgb;
   float change=length(clean-old);float persistence=clamp(mosh*.82,0.,.96)*safe*max(mask,subject(old));
   color=mix(color,old,persistence*(.5+.5*smoothstep(.025,.28,change)));
  }
  if(crush>0.){float levels=pow(2.,bits)-1.;vec3 display=sRGBTransferOETF(vec4(color,1.)).rgb;vec3 quantized=sRGBTransferEOTF(vec4(floor(display*levels+.5)/levels,1.)).rgb;color=mix(color,quantized,crush*safe);}
  color=mix(color,clean,faceMask);gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
 }`});
 const copyUniform={map:{value:history[0].texture}};
 const copy=new T.ShaderMaterial({uniforms:copyUniform,depthTest:false,depthWrite:false,vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D map;void main(){gl_FragColor=texture2D(map,vUv);#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});
 const plane=new T.Mesh(new T.PlaneGeometry(2,2),material);quadScene.add(plane);let index=0,valid=false,width=0,height=0;
 const api={
  reset(){valid=false;},
  render(scene,camera,{raw,time,pulse,face,drive=1}){
   const strength=settings.effectsMix*drive;
   const enabled=!raw&&strength>0&&(settings.macroEnabled||settings.moshEnabled||settings.sortEnabled||settings.crushEnabled);
   if(!enabled){valid=false;renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
   const w=renderer.domElement.width,h=renderer.domElement.height;
   if(w!==width||h!==height){width=w;height=h;for(const r of [input,...history])r.setSize(w,h);valid=false;}
   uniforms.size.value.set(w,h);uniforms.time.value=time;uniforms.pulse.value=pulse;uniforms.face.value.copy(face);uniforms.protect.value=1-settings.faceEffects;
   uniforms.macro.value=settings.macroEnabled?settings.macroAmount*strength:0;uniforms.blockSize.value=settings.blockSize*renderer.getPixelRatio();uniforms.fall.value=settings.macroEnabled?settings.blockFall*strength:0;
   uniforms.mosh.value=settings.moshEnabled?settings.moshAmount*strength:0;uniforms.sort.value=settings.sortEnabled?settings.sortAmount*strength:0;uniforms.sortSpan.value=settings.sortSpan*renderer.getPixelRatio();uniforms.vertical.value=settings.sortVertical?1:0;
   uniforms.bits.value=8-(8-settings.colorBits)*strength;uniforms.crush.value=settings.crushEnabled?settings.crushAmount*strength:0;uniforms.rgb.value=settings.moshEnabled?settings.rgbSplit*strength:0;
   renderer.setRenderTarget(input);renderer.render(scene,camera);
   const next=1-index;uniforms.previous.value=history[index].texture;uniforms.valid.value=valid?1:0;plane.material=material;
   renderer.setRenderTarget(history[next]);renderer.render(quadScene,cam);
   copyUniform.map.value=history[next].texture;plane.material=copy;renderer.setRenderTarget(null);renderer.render(quadScene,cam);index=next;valid=true;
  },
  dispose(){for(const r of [input,...history])r.dispose();plane.geometry.dispose();material.dispose();copy.dispose();}
 };
 return api;
}

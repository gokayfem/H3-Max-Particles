// Deterministic audio accents and local patch correspondence; no model services.
export function audioCurves(samples,rate,duration,fps=120){
 const count=Math.ceil(duration*fps),energy=[],bass=[],treble=[],accent=[];
 let low=0,prevLow=0,previous=0;
 for(let k=0;k<count;k++){
  let e=0,b=0,h=0,n=0;
  for(let i=Math.floor(k*rate/fps);i<Math.min(samples.length,Math.floor((k+1)*rate/fps));i++){
   const x=samples[i];low+=.025*(x-low);e+=x*x;b+=low*low;h+=(x-low)**2;n++;
  }
  const value=Math.sqrt(e/Math.max(1,n));energy.push(value);bass.push(Math.sqrt(b/Math.max(1,n)));treble.push(Math.sqrt(h/Math.max(1,n)));
  accent.push(Math.max(0,value-previous)*4+Math.max(0,bass[k]-prevLow)*2);previous=value;prevLow=bass[k];
 }
 for(const list of [energy,bass,treble,accent]){const sorted=[...list].sort((a,b)=>a-b),scale=sorted[Math.floor(sorted.length*.97)]||1;for(let i=0;i<list.length;i++)list[i]=Math.min(1,list[i]/scale);}
 // Fast attack, short decay: avoid long destruction holds.
 for(let i=1;i<count;i++)accent[i]=Math.max(accent[i],accent[i-1]*.83);
 const events=[];for(let i=2;i<count-2;i++)if(accent[i]>.78&&accent[i]>=accent[i-1]&&accent[i]>accent[i+1]&&i/fps-(events.at(-1)?.start??-10)>1.5)events.push({start:i/fps,strength:accent[i]});
 return {curve_fps:fps,curves:{energy,bass,treble,accent},events};
}
export function gray(rgba){const out=new Float32Array(rgba.length/4);for(let i=0;i<out.length;i++)out[i]=(.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2])/255;return out;}
export function flowField(before,after,w,h){
 const step=5,cols=Math.ceil(w/step),rows=Math.ceil(h/step),field=new Float32Array(cols*rows*3);
 if(!before)return {field,cols,rows,step};
 function patch(a,b,x,y,dx,dy){let cost=0;for(let v=-1;v<=1;v++)for(let u=-1;u<=1;u++)cost+=Math.abs(a[(y+v)*w+x+u]-b[(y+v+dy)*w+x+u+dx]);return cost;}
 for(let y=6;y<h-6;y+=step)for(let x=6;x<w-6;x+=step){
  let best=Infinity,bx=0,by=0;
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const score=patch(before,after,x,y,dx,dy)+.002*(dx*dx+dy*dy);if(score<best){best=score;bx=dx;by=dy;}}
  let reverse=Infinity,rx=0,ry=0;
  if(x+bx>5&&x+bx<w-5&&y+by>5&&y+by<h-5)for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const score=patch(after,before,x+bx,y+by,dx,dy)+.002*(dx*dx+dy*dy);if(score<reverse){reverse=score;rx=dx;ry=dy;}}
  const j=(Math.floor(y/step)*cols+Math.floor(x/step))*3;field[j]=bx;field[j+1]=by;field[j+2]=best<1.2&&Math.hypot(bx+rx,by+ry)<1.5?1:0;
 }
 return {field,cols,rows,step};
}

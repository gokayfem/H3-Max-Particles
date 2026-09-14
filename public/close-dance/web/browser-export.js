import * as M from './vendor/mediabunny.mjs';
export async function createBrowserExport(canvas,options,audioURL,onStatus){
 const {width,height,start,end,speed,volume,sound}=options;
 const avc=await M.canEncodeVideo('avc',{width,height}),aac=!sound||await M.canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2});
 const mp4=avc&&aac,codec=mp4?'avc':await M.getFirstEncodableVideoCodec(['vp9','vp8'],{width,height});
 if(!codec)throw Error('Video export is unavailable in this browser. Use current Chrome or Edge.');
 if(sound&&!mp4&&!await M.canEncodeAudio('opus',{sampleRate:48000,numberOfChannels:2}))throw Error('Audio encoding is unavailable. Export without sound or use Chrome.');
 const expected=Math.ceil((end-start)/speed*24),target=new M.BufferTarget(),output=new M.Output({format:mp4?new M.Mp4OutputFormat():new M.WebMOutputFormat(),target});
 const video=new M.CanvasSource(canvas,{codec,quality:new M.Quality('high'),keyFrameInterval:2});output.addVideoTrack(video,{frameRate:24});
 let audioSource=null,renderedAudio=null;
 if(sound){
  onStatus('Preparing the soundtrack…');
  const ctx=new AudioContext();let decoded;
  try{const response=await fetch(audioURL);if(!response.ok)throw Error('The soundtrack could not load.');decoded=await ctx.decodeAudioData(await response.arrayBuffer());}catch(e){await ctx.close();throw Error('Soundtrack decoding failed. Try export without sound. '+e.message);}await ctx.close();
  const offline=new OfflineAudioContext(2,Math.ceil(expected/24*48000),48000),node=offline.createBufferSource(),gain=offline.createGain();node.buffer=decoded;node.playbackRate.value=speed;gain.gain.value=volume;node.connect(gain).connect(offline.destination);node.start(0,start,end-start);renderedAudio=await offline.startRendering();
  audioSource=new M.AudioBufferSource({codec:mp4?'aac':'opus',quality:new M.Quality({bitrate:192000})});output.addAudioTrack(audioSource);
 }
 try{
  await output.start();
  // Closing the audio source before frame submission allows muxer queues to drain.
  if(audioSource){await audioSource.add(renderedAudio);audioSource.close();renderedAudio=null;}
 }catch(e){await output.cancel().catch(()=>{});throw e;}
 return {expected,extension:mp4?'mp4':'webm',async frame(i){await video.add(i/24,1/24);},async finish(){video.close();await output.finalize();return new Blob([target.buffer],{type:mp4?'video/mp4':'video/webm'});},async cancel(){await output.cancel();}};
}

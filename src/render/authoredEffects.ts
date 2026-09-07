import Phaser from 'phaser';
import {EFFECT_MANIFEST,type EffectAssetId} from './effectManifest';

const requested=new Set<string>();
const key=(id:EffectAssetId,direction:number,frame:number)=>`effect:${id}:${direction}:${frame}`;
const url=(id:EffectAssetId,direction:number,frame:number)=>{const meta=EFFECT_MANIFEST[id];return `${import.meta.env.BASE_URL}assets/effects/${meta.path}/${direction}_${meta.action}_${meta.start+frame}.png`;};

/** About 2.7 MB across every directional first frame; prevents an empty first cast. */
export function preloadEffectFirstFrames(scene:Phaser.Scene):void{
  for(const id of Object.keys(EFFECT_MANIFEST) as EffectAssetId[]){const meta=EFFECT_MANIFEST[id],texture=key(id,0,0);requested.add(texture);scene.load.image(texture,url(id,0,0));if(meta.directions===8)for(let direction=1;direction<8;direction++){const directional=key(id,direction,0);requested.add(directional);scene.load.image(directional,url(id,direction,0));}}
}

export function requestEffectSequence(scene:Phaser.Scene,id:EffectAssetId,direction=0):void{
  const meta=EFFECT_MANIFEST[id],resolved=meta.directions===8?Math.max(0,Math.min(7,direction)):0;
  for(let frame=0;frame<meta.frames;frame++){const texture=key(id,resolved,frame);if(scene.textures.exists(texture)||requested.has(texture))continue;requested.add(texture);scene.load.image(texture,url(id,resolved,frame));}
  if(!scene.load.isLoading())scene.load.start();
}

export function applyEffectFrame(scene:Phaser.Scene,image:Phaser.GameObjects.Image,id:EffectAssetId,direction:number,frame:number):boolean{
  const meta=EFFECT_MANIFEST[id],resolved=meta.directions===8?Math.max(0,Math.min(7,direction)):0,index=((frame%meta.frames)+meta.frames)%meta.frames,texture=key(id,resolved,index);
  requestEffectSequence(scene,id,resolved);
  if(scene.textures.exists(texture))image.setTexture(texture);else{const fallback=key(id,resolved,0);if(!scene.textures.exists(fallback))return false;image.setTexture(fallback);}
  return true;
}

export {EFFECT_MANIFEST};
export type {EffectAssetId};

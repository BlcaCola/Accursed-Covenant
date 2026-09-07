import Phaser from 'phaser';
import type { CharacterId } from '../core/types';
import { SPRITE_MANIFEST, type SpriteAction, type SpriteAssetMeta } from './spriteManifest';

export type SpriteCategory='character'|'monster'|'npc'|'wing'|'boss';
const ROOT:Record<SpriteCategory,string>={character:'characters',monster:'monsters',npc:'npc',wing:'wings',boss:'bosses'};
const requested=new Set<string>();

export const authoredKey=(category:SpriteCategory,id:string,direction:number,action:SpriteAction,frame:number)=>
  `auth:${category}:${id}:${direction}:${action}:${frame}`;

function meta(category:SpriteCategory,id:string):SpriteAssetMeta|undefined{
  return SPRITE_MANIFEST[`${category}:${id}` as keyof typeof SPRITE_MANIFEST] as SpriteAssetMeta|undefined;
}

function resolve(category:SpriteCategory,id:string,direction:number,action:SpriteAction):{action:SpriteAction;direction:number;count:number}|undefined{
  const asset=meta(category,id);if(!asset)return;
  const candidates:Array<[SpriteAction,number]>=[[action,direction],['stand',direction],[action,4],['stand',4]];
  for(const [candidateAction,candidateDirection] of candidates){
    const count=asset.frames[candidateAction]?.[String(candidateDirection)];
    if(count)return{action:candidateAction,direction:candidateDirection,count};
  }
  // Stationary bosses may provide only direction 0. Fall back to the first authored direction.
  for(const candidateAction of [action,'stand'] as SpriteAction[]){const first=Object.entries(asset.frames[candidateAction]??{})[0];if(first)return{action:candidateAction,direction:Number(first[0]),count:first[1]};}
}

function url(category:SpriteCategory,id:string,direction:number,action:SpriteAction,frame:number):string{
  return `${import.meta.env.BASE_URL}assets/${ROOT[category]}/${id}/${direction}_${action}_${frame}.png`;
}

/** Queue one action/direction only. A 450 MB library never becomes an initial page download. */
export function requestAuthoredSequence(scene:Phaser.Scene,category:SpriteCategory,id:string,direction:number,action:SpriteAction):void{
  const sequence=resolve(category,id,direction,action);if(!sequence)return;
  for(let frame=0;frame<sequence.count;frame++){
    const key=authoredKey(category,id,sequence.direction,sequence.action,frame);
    if(scene.textures.exists(key)||requested.has(key))continue;
    requested.add(key);scene.load.image(key,url(category,id,sequence.direction,sequence.action,frame));
  }
  if(!scene.load.isLoading())scene.load.start();
}

export function preloadAuthoredCharacters(scene:Phaser.Scene):void{
  for(const id of ['sorceress','necromancer','bloodknight'] as CharacterId[])for(let direction=0;direction<8;direction++){
    const key=authoredKey('character',id,direction,'stand',0);
    requested.add(key);scene.load.image(key,url('character',id,direction,'stand',0));
  }
}

/** Preload one lightweight victory pose per wing so a newly earned cosmetic is
 * visible immediately even when the runtime loader is still draining boss art. */
export function preloadWingVictoryPoses(scene:Phaser.Scene):void{
  for(let index=1;index<=16;index++){
    const id=`wing-${String(index).padStart(2,'0')}`,sequence=resolve('wing',id,4,'stand');if(!sequence)continue;
    const key=authoredKey('wing',id,sequence.direction,sequence.action,0);if(requested.has(key))continue;
    requested.add(key);scene.load.image(key,url('wing',id,sequence.direction,sequence.action,0));
  }
}

export function authoredSprite(scene:Phaser.Scene,category:SpriteCategory,id:string,x:number,y:number,height:number):Phaser.GameObjects.Image{
  const sequence=resolve(category,id,4,'stand')!;
  const key=authoredKey(category,id,sequence.direction,sequence.action,0);
  requestAuthoredSequence(scene,category,id,4,'stand');
  const ready=scene.textures.exists(key);
  const image=scene.add.image(x,y,ready?key:'__WHITE');
  if(!ready)image.setScale(0);
  applyAuthoredFrame(scene,image,category,id,4,'stand',0,height);
  return image;
}

/** Keep a fixed canvas anchor across every frame, preventing animation foot sliding. */
export function applyAuthoredFrame(scene:Phaser.Scene,image:Phaser.GameObjects.Image,category:SpriteCategory,id:string,direction:number,action:SpriteAction,frame:number,height:number):boolean{
  const asset=meta(category,id),sequence=resolve(category,id,direction,action);if(!asset||!sequence)return false;
  const index=((frame%sequence.count)+sequence.count)%sequence.count;
  const key=authoredKey(category,id,sequence.direction,sequence.action,index);
  if(!scene.textures.exists(key)){
    requestAuthoredSequence(scene,category,id,sequence.direction,sequence.action);
    const fallback=authoredKey(category,id,sequence.direction,sequence.action,0);
    if(!scene.textures.exists(fallback))return false;
    image.setTexture(fallback);
  }else image.setTexture(key);
  image.resetPipeline();image.setFlipX(false).setOrigin(asset.originX,asset.originY).setScale(height/asset.visibleHeight);
  return true;
}

export function actionFrame(sceneTime:number,fps:number,countHint=999):number{return Math.floor(sceneTime*fps)%countHint;}

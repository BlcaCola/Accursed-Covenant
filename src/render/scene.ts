import Phaser from 'phaser';
import { Run, idleInput } from '../core/run';
import { QUALITY_ORDER, RARITY_COLORS, WEAPONS } from '../core/equipment';
import { findWalkPath, TILE } from '../core/dungeon';
import { Random, fixed2 } from '../core/random';
import { THEMES,THEME_IDS } from '../core/themes';
import {THEME_DESIGNS,type FloorMotif} from '../core/themeDesigns';
import type { EnvironmentProp, Vec, VisualEvent } from '../core/types';
import { directionFrame, propSprite, registerArt, sprite } from './art';
import { actionFrame, applyAuthoredFrame, authoredSprite, preloadAuthoredCharacters,preloadWingVictoryPoses } from './authoredSprites';
import type { AudioBus } from './audio';
import {t as tr} from '../i18n';
import {applyEffectFrame,EFFECT_MANIFEST,preloadEffectFirstFrames,type EffectAssetId} from './authoredEffects';

// The gallery is larger than campaign maps. Every world object uses this stable
// isometric origin while campaign terrain is baked into high-resolution chunks.
const OFFSET = 11000;
const WALL_FRAME:Record<string,number>={cave:0,dungeon:2,cathedral:1,abandonedVillage:15,inferno:7,mountain:12,town:5,palace:4,catacomb:11,sewer:10,frozenRuins:6,swamp:8,mine:15,desertTemple:14,abyssFortress:13};
export const project = (v: Vec): Vec => ({ x: v.x - v.y + OFFSET, y: (v.x + v.y) * .5 + 64 });
const unproject = (v: Vec): Vec => ({ x: (v.x - OFFSET) / 2 + v.y - 64, y: v.y - 64 - (v.x - OFFSET) / 2 });
interface Fx { event: VisualEvent; life: number; duration: number }
interface DeathSprite { image:Phaser.GameObjects.Image; event:VisualEvent; life:number }

export interface SceneBridge {
  run: Run;
  started: boolean;
  audio: AudioBus;
  onFrame: () => void;
  onCommand: (command: string) => void;
  onReady: () => void;
  onLoading: (visible:boolean,progress?:number,label?:string) => void;
  reducedMotion: boolean;
}

/** Phaser owns rendering/input only. Domain logic advances with a fixed 1/60 second step. */
export class GameScene extends Phaser.Scene {
  private bridge!: SceneBridge;
  private boundRun?: Run;
  private boundRevision = -1;
  private worldObjects: Phaser.GameObjects.GameObject[] = [];
  private entities = new Map<number, Phaser.GameObjects.Image>();
  private enemyLabels = new Map<number, Phaser.GameObjects.Text>();
  private drops = new Map<number, Phaser.GameObjects.Image>();
  private xpDrops = new Map<number, Phaser.GameObjects.Image>();
  private dropLabels=new Map<number,Phaser.GameObjects.Text>();
  private corpseImages=new Map<number,Phaser.GameObjects.Image>();
  private minionImages = new Map<number, Phaser.GameObjects.Image>();
  private pillars: Phaser.GameObjects.Image[] = [];
  private braziers: Vec[] = [];
  private chestImages: Phaser.GameObjects.Image[] = [];
  private barrierImages: Phaser.GameObjects.Image[] = [];
  private hero!: Phaser.GameObjects.Image;
  private wing?:Phaser.GameObjects.Image;
  private npcImages:Array<{id:string;image:Phaser.GameObjects.Image}>=[];
  private deathSprites:DeathSprite[]=[];
  private ground!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private shadows!: Phaser.GameObjects.Graphics;
  private warnings!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private fx: Fx[] = [];
  private authoredTextureFx: Phaser.GameObjects.Image[]=[];
  private authoredTextureCursor=0;
  private fog!: Phaser.GameObjects.Graphics;
  private fogRevision = -1;
  private encounterLabels: Phaser.GameObjects.Text[] = [];
  private encounterImages: Phaser.GameObjects.Image[] = [];
  private showcaseLabels:Array<{text:Phaser.GameObjects.Text;position:Vec}>=[];
  private floorTextureKeys:string[]=[];
  private floorChunks:Array<{image:Phaser.GameObjects.Image;x:number;y:number}>=[];
  private wallPanels:Array<{image:Phaser.GameObjects.Image;x:number;y:number;footY:number}>=[];
  private numbers: { text: Phaser.GameObjects.Text; life: number }[] = [];
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private accumulator = 0;
  private elapsed = 0;
  private pointerActive = false;
  private pendingActions = new Set<string>();
  private clickMoveTarget?:Vec;
  private clickMovePath:Vec[]=[];
  private clickMoveNavigationState='';
  private playerMoving=false;
  private hitStop = 0;
  private pendingBuildRevision = -1;
  private rebuilding=false;
  private localizedLabels:Array<{text:Phaser.GameObjects.Text;source:string}>=[];

  /** Switch world-space labels immediately without rebuilding high-resolution terrain. */
  refreshLanguage():void{
    for(const label of this.localizedLabels)if(label.text.active)label.text.setText(tr(label.source));
  }

  constructor(bridge: SceneBridge) { super('dungeon'); this.bridge = bridge; }
  preload(): void {
    this.load.image('atlas', `${import.meta.env.BASE_URL}assets/environment/runtime-atlas-v1.png`);
    this.load.image('floor-tiles',`${import.meta.env.BASE_URL}assets/environment/floor-tiles-v2.png`);
    this.load.image('wall-tiles-l',`${import.meta.env.BASE_URL}assets/environment/wall-tiles-v2-l.png`);
    this.load.image('wall-tiles-r',`${import.meta.env.BASE_URL}assets/environment/wall-tiles-v2-r.png`);
    this.load.image('user-props-1',`${import.meta.env.BASE_URL}assets/environment/5x5-1.png`);
    this.load.image('user-props-2',`${import.meta.env.BASE_URL}assets/environment/5x5-2.png`);
    preloadAuthoredCharacters(this);preloadWingVictoryPoses(this);
    preloadEffectFirstFrames(this);
    this.load.image('merchant-stall',`${import.meta.env.BASE_URL}assets/effects/merchant-stall.png`);
    this.load.image('equipment-atlas',`${import.meta.env.BASE_URL}assets/equipment/atlas-v4.png`);
    this.load.spritesheet('corpse-remains',`${import.meta.env.BASE_URL}assets/effects/corpse/corpse-remains-v1.png`,{frameWidth:443,frameHeight:315});
    this.load.on('loaderror', () => this.bridge.onCommand('load-error'));
  }
  create(): void {
    registerArt(this);
    for(const key of ['floor-tiles','wall-tiles-l','wall-tiles-r']){const texture=this.textures.get(key),source=texture.getSourceImage();for(let row=0;row<4;row++)for(let col=0;col<4;col++)texture.add(String(row*4+col),0,col*source.width/4,row*source.height/4,source.width/4,source.height/4);}
    for(const key of ['user-props-1','user-props-2']){
      const texture=this.textures.get(key),source=texture.getSourceImage() as HTMLImageElement,cellW=source.width/5,cellH=source.height/5,canvas=document.createElement('canvas');canvas.width=cellW;canvas.height=cellH;const context=canvas.getContext('2d',{willReadFrequently:true})!;
      for(let row=0;row<5;row++)for(let col=0;col<5;col++){
        const id=row*5+col,x=col*cellW,y=row*cellH;texture.add(String(id),0,x,y,cellW,cellH);context.clearRect(0,0,cellW,cellH);context.drawImage(source,x,y,cellW,cellH,0,0,cellW,cellH);
        const pixels=context.getImageData(0,0,cellW,cellH).data;let minX=cellW,minY=cellH,maxX=-1,maxY=-1;for(let py=0;py<cellH;py++)for(let px=0;px<cellW;px++)if(pixels[(py*cellW+px)*4+3]>8){minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);}
        if(maxX>=minX)texture.add(`trim-${id}`,0,x+minX,y+minY,maxX-minX+1,maxY-minY+1);
      }
    }
    this.cameras.main.setBackgroundColor('#090d10');
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q,E,R,F,I,ESC,TAB,M', false) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (this.bridge.started && this.bridge.run.phase === 'playing' && ['Space','KeyQ','KeyR','KeyE','Digit1','Digit2','Digit3','Digit4'].includes(event.code)) this.pendingActions.add(event.code);
      const commands: Record<string, string> = { KeyI: 'inventory', KeyF:'pickup',Escape: 'pause', Tab: 'map', KeyM: 'sound' };
      if (this.bridge.started && this.bridge.run.phase === 'playing' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
      if (event.code === 'Tab' && this.bridge.run.phase !== 'playing') return;
      if (commands[event.code]) this.bridge.onCommand(commands[event.code]);
    });
    this.input.on('pointermove', () => { this.pointerActive = true; });
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
      if(!this.bridge.started||this.bridge.run.phase!=='playing')return;this.pointerActive=true;
      if(pointer.button===0)this.setClickMoveTarget(pointer);else if(pointer.button===2)this.pendingActions.add('PointerRight');
    });
    this.scale.on('resize', () => this.configureCamera());
    this.rebuilding=true;void this.buildWorld().then(()=>{this.rebuilding=false;this.bridge.onReady();});
  }
  private configureCamera(): void {
    const width = this.scale.width;
    this.cameras.main.setZoom(Math.min(1.25, Math.max(.75, width / 1280)));
  }
  private setClickMoveTarget(pointer:Phaser.Input.Pointer):void{
    this.clickMoveTarget=unproject(this.cameras.main.getWorldPoint(pointer.x,pointer.y));this.rebuildClickPath();
  }
  private navigationState():string{const run=this.bridge.run;return`${run.worldRevision}:${run.activeRoomEncounter?.room??-1}:${Number(run.bossUnlocked)}:${Number(run.guardianSpawned)}`;}
  private navigationAllowed(x:number,y:number):boolean{
    const run=this.bridge.run,locked=run.activeRoomEncounter;if(locked){const room=run.dungeon.rooms[locked.room];return x>=room.x&&x<room.x+room.w&&y>=room.y&&y<room.y+room.h;}
    if(!run.showcaseMode&&!run.bossUnlocked&&!run.guardianSpawned){const room=run.dungeon.rooms[run.dungeon.bossRoom];if(x>=room.x&&x<room.x+room.w&&y>=room.y&&y<room.y+room.h)return false;}
    return true;
  }
  private rebuildClickPath():void{
    if(!this.clickMoveTarget)return;const run=this.bridge.run;this.clickMoveNavigationState=this.navigationState();this.clickMovePath=findWalkPath(run.dungeon,run.player,this.clickMoveTarget,10,(x,y)=>this.navigationAllowed(x,y));
    if(!this.clickMovePath.length)this.clickMoveTarget=undefined;
  }
  private paintThemeMotif(floor:Phaser.GameObjects.Graphics,c:Vec,motif:FloorMotif,accent:number):void{
    floor.lineStyle(2,accent,.34);floor.fillStyle(accent,.08);
    if(motif==='rings'){for(let i=0;i<3;i++)floor.strokeEllipse(c.x,c.y,60+i*35,30+i*17);}
    else if(motif==='chains'){for(let i=-2;i<=2;i++){floor.strokeEllipse(c.x+i*34,c.y+(i%2)*8,28,13);if(i<2)floor.lineBetween(c.x+i*34+14,c.y,c.x+(i+1)*34-14,c.y);}}
    else if(motif==='hearth'){floor.fillEllipse(c.x,c.y,105,45);for(let i=0;i<8;i++){const a=i*Math.PI/4;floor.lineBetween(c.x+Math.cos(a)*30,c.y+Math.sin(a)*15,c.x+Math.cos(a)*92,c.y+Math.sin(a)*46);}}
    else if(motif==='runes'||motif==='sigil'){const points=[{x:c.x,y:c.y-58},{x:c.x+110,y:c.y},{x:c.x,y:c.y+58},{x:c.x-110,y:c.y}];floor.strokePoints(points,true);floor.strokeEllipse(c.x,c.y,82,41);if(motif==='sigil'){floor.lineBetween(c.x-110,c.y,c.x+110,c.y);floor.lineBetween(c.x,c.y-58,c.x,c.y+58);}}
    else if(motif==='strata'){for(let i=-3;i<=3;i++)floor.lineBetween(c.x-130,c.y+i*13+Math.sin(i)*7,c.x+130,c.y+i*13-Math.sin(i)*7);}
    else if(motif==='lanes'){for(let i=-1;i<=1;i++){floor.lineBetween(c.x-145,c.y+i*30,c.x+145,c.y+i*30);for(let j=-2;j<=2;j++)floor.fillRect(c.x+j*55,c.y+i*30-2,22,4);}}
    else if(motif==='crown'){floor.strokeRect(c.x-105,c.y-52,210,104);for(let i=-2;i<=2;i++)floor.lineBetween(c.x+i*42,c.y-52,c.x+i*21,c.y-78);}
    else if(motif==='bones'){for(let i=-2;i<=2;i++){floor.lineBetween(c.x+i*42-12,c.y-25,c.x+i*42+12,c.y+25);floor.strokeEllipse(c.x+i*42-15,c.y-28,10,7);floor.strokeEllipse(c.x+i*42+15,c.y+28,10,7);}}
    else if(motif==='drains'){floor.strokeRect(c.x-120,c.y-48,240,96);for(let i=-4;i<=4;i++)floor.lineBetween(c.x+i*25,c.y-48,c.x+i*25,c.y+48);}
    else if(motif==='snowflake'){for(let i=0;i<6;i++){const a=i*Math.PI/3;floor.lineBetween(c.x,c.y,c.x+Math.cos(a)*120,c.y+Math.sin(a)*60);}}
    else if(motif==='reeds'){for(let i=-5;i<=5;i++){const x=c.x+i*22;floor.lineBetween(x,c.y+38,x+Math.sin(i)*9,c.y-35-Math.abs(i%3)*7);}}
    else if(motif==='rails'){floor.lineBetween(c.x-140,c.y-34,c.x+140,c.y-34);floor.lineBetween(c.x-140,c.y+34,c.x+140,c.y+34);for(let i=-5;i<=5;i++)floor.lineBetween(c.x+i*25,c.y-45,c.x+i*25,c.y+45);}
    else if(motif==='sun'){floor.strokeEllipse(c.x,c.y,78,39);for(let i=0;i<12;i++){const a=i*Math.PI/6;floor.lineBetween(c.x+Math.cos(a)*48,c.y+Math.sin(a)*24,c.x+Math.cos(a)*125,c.y+Math.sin(a)*62);}}
  }
  private async buildWorld(): Promise<void> {
    this.bridge.onLoading(this.bridge.started,12,tr('解析随机房间与碰撞…'));
    for (const o of this.worldObjects) o.destroy(); this.worldObjects = [];
    for (const image of this.entities.values()) image.destroy(); this.entities.clear();
    for (const label of this.enemyLabels.values())label.destroy();this.enemyLabels.clear();
    for (const image of this.drops.values()) image.destroy(); this.drops.clear();for(const image of this.xpDrops.values())image.destroy();this.xpDrops.clear();for(const image of this.corpseImages.values())image.destroy();this.corpseImages.clear();
    for(const label of this.dropLabels.values())label.destroy();this.dropLabels.clear();
    for (const image of this.minionImages.values()) image.destroy(); this.minionImages.clear();
    for(const death of this.deathSprites)death.image.destroy();this.deathSprites=[];this.npcImages=[];this.wing=undefined;
    this.pillars = []; this.braziers = [];
    for(const image of this.authoredTextureFx)image.destroy();this.authoredTextureFx=[];
    this.encounterLabels=[]; this.encounterImages=[];this.showcaseLabels=[];this.localizedLabels=[]; this.fogRevision=-1;
    for (const n of this.numbers) n.text.destroy(); this.numbers = []; this.fx = [];
    for(const key of this.floorTextureKeys)if(this.textures.exists(key))this.textures.remove(key);this.floorTextureKeys=[];this.floorChunks=[];this.wallPanels=[];
    this.boundRun = this.bridge.run;this.boundRevision=this.boundRun.worldRevision;
    const run = this.boundRun, map = run.dungeon, theme=THEMES[map.theme], rng = new Random(map.seed + 13),themeIndex=THEME_IDS.indexOf(map.theme);
    const sealedHiddenTile=(x:number,y:number)=>map.hiddenRooms.some(index=>{const room=map.rooms[index],wall=map.breakableWalls.find(value=>value.revealedRoom===index);return !!wall&&!wall.destroyed&&x>=room.x&&x<room.x+room.w&&y>=room.y&&y<room.y+room.h;});
    const roomMinX=Math.min(...map.rooms.map(room=>room.x)),roomMaxX=Math.max(...map.rooms.map(room=>room.x+room.w)),roomMinY=Math.min(...map.rooms.map(room=>room.y)),roomMaxY=Math.max(...map.rooms.map(room=>room.y+room.h));
    const minTileX=map.showcase?Math.max(0,roomMinX-3):0,maxTileX=map.showcase?Math.min(map.size-1,roomMaxX+3):map.size-1,minTileY=map.showcase?Math.max(0,roomMinY-3):0,maxTileY=map.showcase?Math.min(map.size-1,roomMaxY+16):map.size-1;
    const floor = this.add.graphics().setDepth(.2);
    const quality={high:{scale:.75,chunk:1024},standard:{scale:.5,chunk:1536},performance:{scale:.34,chunk:2048}}[run.graphicsQuality],renderScale=quality.scale,chunkSize=quality.chunk,chunkPad=128;
    const floorSource=this.textures.get('floor-tiles').getSourceImage() as HTMLImageElement,cell=floorSource.width/4,sourceX=(themeIndex%4)*cell,sourceY=Math.floor(themeIndex/4)*cell,wallFrameL=WALL_FRAME[map.theme],wallFrameR=Math.floor(wallFrameL/4)*4+3-wallFrameL%4;
    const floorVariants=[-5,0,5].map((hue,index)=>{const variant=document.createElement('canvas');variant.width=variant.height=cell;const brush=variant.getContext('2d')!;brush.filter=`hue-rotate(${hue}deg) brightness(${.91+index*.035})`;brush.drawImage(floorSource,sourceX,sourceY,cell,cell,0,0,cell,cell);return variant;});
    type FloorChunk={canvas:HTMLCanvasElement;context:CanvasRenderingContext2D;originX:number;originY:number;key:string};
    const chunks=new Map<string,FloorChunk>(),chunkFor=(p:Vec):FloorChunk=>{
      const cx=Math.floor(p.x/chunkSize),cy=Math.floor(p.y/chunkSize),id=`${cx}:${cy}`;let chunk=chunks.get(id);if(chunk)return chunk;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=(chunkSize+chunkPad*2)*renderScale;
      const key=`floor-chunk-${map.seed}-${this.boundRevision}-${chunks.size}`,context=canvas.getContext('2d')!,originX=cx*chunkSize-chunkPad,originY=cy*chunkSize-chunkPad;
      context.imageSmoothingEnabled=false;
      chunk={canvas,context,originX,originY,key};chunks.set(id,chunk);return chunk;
    };
    const qualityLabel=run.graphicsQuality==='high'?'高清':run.graphicsQuality==='standard'?'标准':'性能';
    this.bridge.onLoading(this.bridge.started,34,tr(`烘焙${qualityLabel}地板与墙体…`));
    const nextFrame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    if(map.showcase){
      // The gallery is intentionally very long. Drawing its sparse geometry as
      // contiguous isometric strips avoids uploading dozens of giant canvas
      // textures when entering or leaving through the portal.
      for(let y=minTileY;y<=maxTileY;y++){
        if((y-minTileY)%8===0){this.bridge.onLoading(this.bridge.started,34+(y-minTileY)/Math.max(1,maxTileY-minTileY)*30,tr('分片铺设陈列回廊…'));await nextFrame();}
        let x=minTileX;
        while(x<=maxTileX){
          while(x<=maxTileX&&!map.tiles[y*map.size+x])x++;
          if(x>maxTileX)break;
          const start=x;while(x<=maxTileX&&map.tiles[y*map.size+x])x++;
          const a=project({x:start*TILE,y:y*TILE}),b=project({x:x*TILE,y:y*TILE}),c=project({x:x*TILE,y:(y+1)*TILE}),d=project({x:start*TILE,y:(y+1)*TILE});
          const shade=theme.floor[Math.abs(y*7+map.seed)%theme.floor.length];
          floor.fillStyle(shade,.98).fillPoints([a,b,c,d],true);
          floor.lineStyle(1,theme.accent,.12).lineBetween(a.x,a.y,b.x,b.y).lineBetween(d.x,d.y,c.x,c.y);
        }
      }
      // Tall dark-and-metal edges keep every specimen chamber readable while
      // preserving the gaps between its single branch and its neighbours.
      floor.lineStyle(18,0x111317,.98);floor.lineStyle(5,theme.accent,.42);
      for(const room of map.rooms){
        const top=project({x:room.x*TILE,y:room.y*TILE}),right=project({x:(room.x+room.w)*TILE,y:room.y*TILE}),left=project({x:room.x*TILE,y:(room.y+room.h)*TILE});
        floor.lineStyle(18,0x090b0d,.98).lineBetween(top.x,top.y,right.x,right.y).lineBetween(top.x,top.y,left.x,left.y);
        floor.lineStyle(3,theme.accent,.55).lineBetween(top.x,top.y-7,right.x,right.y-7).lineBetween(top.x,top.y-7,left.x,left.y-7);
      }
    }else for(let y=minTileY;y<=maxTileY;y++){
      if((y-minTileY)%8===0){this.bridge.onLoading(this.bridge.started,34+(y-minTileY)/Math.max(1,maxTileY-minTileY)*30,tr('分片烘焙高清地板…'));await nextFrame();}
      for(let x=minTileX;x<=maxTileX;x++)if(map.tiles[y*map.size+x]){
        const world=project({x:x*TILE,y:y*TILE}),chunk=chunkFor(world),context=chunk.context,p={x:(world.x-chunk.originX)*renderScale,y:(world.y-chunk.originY)*renderScale},variant=floorVariants[Math.abs(x*17+y*31+map.seed)%floorVariants.length];
        context.globalAlpha=1;context.fillStyle=`#${theme.floor[Math.abs(x*11+y*7+map.seed)%theme.floor.length].toString(16).padStart(6,'0')}`;context.beginPath();context.moveTo(p.x,p.y);context.lineTo(p.x+33*renderScale,p.y+16*renderScale);context.lineTo(p.x,p.y+33*renderScale);context.lineTo(p.x-33*renderScale,p.y+16*renderScale);context.closePath();context.fill();
        context.globalAlpha=.94+((x*13+y*7+map.seed)%7)*.009;context.drawImage(variant,p.x-38*renderScale,p.y-21*renderScale,76*renderScale,76*renderScale);
      }
    }
    const addWall=(key:'wall-tiles-l'|'wall-tiles-r',frame:number,world:Vec,length:number)=>{
      const width=78+length*34,footY=world.y+29,image=this.add.image(world.x,footY,key,String(frame)).setOrigin(.5,1).setDisplaySize(width,150).setDepth(footY);
      this.worldObjects.push(image);this.wallPanels.push({image,x:world.x,y:world.y-46,footY});
    };
    // One authored wall panel spans up to three boundary tiles. Grouping straight
    // runs removes duplicate end posts at convex corners and closes concave seams.
    if(!map.showcase){
      for(let y=minTileY;y<=maxTileY;y++)for(let x=minTileX;x<=maxTileX;){if(map.tiles[y*map.size+x]&&!sealedHiddenTile(x,y)&&(y===0||!map.tiles[(y-1)*map.size+x])){let end=x+1;while(end<=maxTileX&&map.tiles[y*map.size+end]&&!sealedHiddenTile(end,y)&&(y===0||!map.tiles[(y-1)*map.size+end]))end++;for(let start=x;start<end;start+=3){const length=Math.min(3,end-start),middle=start+(length-1)/2;addWall('wall-tiles-l',wallFrameL,project({x:middle*TILE,y:y*TILE}),length);}x=end;}else x++;}
      for(let x=minTileX;x<=maxTileX;x++)for(let y=minTileY;y<=maxTileY;){if(map.tiles[y*map.size+x]&&!sealedHiddenTile(x,y)&&(x===0||!map.tiles[y*map.size+x-1])){let end=y+1;while(end<=maxTileY&&map.tiles[end*map.size+x]&&!sealedHiddenTile(x,end)&&(x===0||!map.tiles[end*map.size+x-1]))end++;for(let start=y;start<end;start+=3){const length=Math.min(3,end-start),middle=start+(length-1)/2;addWall('wall-tiles-r',wallFrameR,project({x:x*TILE,y:middle*TILE}),length);}y=end;}else y++;}
    }
    for(const chunk of chunks.values()){this.textures.addCanvas(chunk.key,chunk.canvas);this.floorTextureKeys.push(chunk.key);const image=this.add.image(chunk.originX,chunk.originY,chunk.key).setOrigin(0).setScale(1/renderScale);this.worldObjects.push(image);this.floorChunks.push({image,x:chunk.originX+chunkSize/2,y:chunk.originY+chunkSize/2});}
    // Each wall panel is a separate object whose depth is its ground contact.
    // Actors behind that line are covered; actors walking in front draw above it.
    this.bridge.onLoading(this.bridge.started,72,tr('铺设房间纹样与场景物件…'));
    // Inlaid geometric stonework gives each chamber an identifiable center.
    for (const room of map.rooms) {
      const c = project({ x: (room.x + room.w / 2) * TILE, y: (room.y + room.h / 2) * TILE });
      floor.lineStyle(2, room.type === 'sanctum' ? 0x764742 : 0x65614e, .5);
      floor.strokeEllipse(c.x, c.y, 210, 105); floor.strokeEllipse(c.x, c.y, 185, 92);
      floor.lineStyle(1, 0x8b7751, .25); floor.lineBetween(c.x - 115, c.y, c.x + 115, c.y); floor.lineBetween(c.x, c.y - 60, c.x, c.y + 60);
      // Worn ceremonial paths, with dark gutters rather than floating featureless tiles.
      const start = project({ x: (room.x + 2) * TILE, y: (room.y + 2) * TILE });
      const east = project({ x: (room.x + room.w - 2) * TILE, y: (room.y + 2) * TILE });
      const south = project({ x: (room.x + room.w - 2) * TILE, y: (room.y + room.h - 2) * TILE });
      const west = project({ x: (room.x + 2) * TILE, y: (room.y + room.h - 2) * TILE });
      floor.lineStyle(10, 0x0d1314, .65); floor.strokePoints([start, east, south, west], true);
      floor.lineStyle(1, 0x817254, .35); floor.strokePoints([start, east, south, west], true);
      if (room.type !== 'entry') { floor.fillStyle(room.type === 'sanctum' ? 0x573126 : 0x3d3929, .4); floor.fillEllipse(c.x + 45, c.y + 20, 120, 45); }
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; floor.fillStyle(0x8c7a58, .45); floor.fillRect(c.x + Math.cos(a) * 97, c.y + Math.sin(a) * 48, 3, 3); }
      if(map.theme==='cathedral'){
        // Each cathedral archetype has its own readable floor plan and landmark.
        const archetype=room.archetype??'nave';floor.lineStyle(3,0xa58b58,.42);
        if(archetype==='narthex'||archetype==='nave'){floor.lineBetween(c.x-150,c.y-1,c.x+150,c.y-1);floor.lineStyle(1,0xc5ad78,.28);for(let i=-2;i<=2;i++)floor.strokeEllipse(c.x+i*46,c.y,31,17);}
        else if(archetype==='transept'){floor.lineBetween(c.x-145,c.y,c.x+145,c.y);floor.lineBetween(c.x,c.y-72,c.x,c.y+72);floor.fillStyle(0x71452f,.32);floor.fillEllipse(c.x,c.y,58,29);}
        else if(archetype==='reliquary'){floor.strokeRect(c.x-58,c.y-29,116,58);floor.strokeRect(c.x-42,c.y-21,84,42);floor.fillStyle(0xb99356,.14);floor.fillEllipse(c.x,c.y,95,42);}
        else if(archetype==='choir'){for(let i=0;i<4;i++)floor.strokeEllipse(c.x,c.y+8,115-i*20,58-i*10);floor.lineStyle(4,0x7d332d,.36);floor.lineBetween(c.x-120,c.y+38,c.x+120,c.y+38);}
        else {floor.lineStyle(2,0x796b55,.36);for(let i=0;i<5;i++)floor.strokeEllipse(c.x+(i-2)*38,c.y+12,25,13);}
        // Stained-glass color falls across the stone without changing collision.
        floor.fillStyle(archetype==='choir'?0x8f2f35:archetype==='reliquary'?0xd0a85c:0x486e91,.08);floor.fillEllipse(c.x+55,c.y-18,190,42);
      }else this.paintThemeMotif(floor,c,THEME_DESIGNS[map.theme].motif,theme.accent);
    }
    this.worldObjects.push(floor);
    this.fog = this.add.graphics().setDepth(900000); this.worldObjects.push(this.fog);
    this.ground = this.add.graphics().setDepth(1); this.shadows = this.add.graphics().setDepth(2);
    this.effects = this.add.graphics().setDepth(5000); this.warnings = this.add.graphics().setDepth(6000); this.bars = this.add.graphics().setDepth(6100);
    this.worldObjects.push(this.ground, this.shadows, this.effects, this.warnings, this.bars);
    for(const prop of map.props??[]){
      const p=project(prop);let image:Phaser.GameObjects.Image;
      if(prop.kind==='user'){const frame=this.textures.get(prop.atlas!).get(`trim-${prop.frame}`);image=this.add.image(p.x,p.y,prop.atlas!,`trim-${prop.frame}`).setOrigin(.5,1).setScale(prop.height/frame.height);}
      else image=prop.kind==='theme'?propSprite(this,prop.frame,p.x,p.y,prop.height):sprite(this,prop.frame,p.x,p.y,prop.height);
      image.setDepth(p.y);this.worldObjects.push(image);this.pillars.push(image);
      if(prop.kind==='pillar'){const fire=sprite(this,13,p.x+28,p.y+12,58).setDepth(p.y+13);this.worldObjects.push(fire);this.braziers.push({x:p.x+28,y:p.y+12});}
    }
    const altar = project(map.altar);
    this.worldObjects.push(sprite(this, 14, altar.x, altar.y, 80).setDepth(altar.y));
    const altarSource='贪 欲 祭 坛',altarLabel = this.add.text(altar.x, altar.y - 88, tr(altarSource), { fontFamily: 'serif', fontSize: '12px', color: '#c69b68', stroke: '#101012', strokeThickness: 3 }).setOrigin(.5).setDepth(7000);this.localizedLabels.push({text:altarLabel,source:altarSource});
    this.worldObjects.push(altarLabel);
    this.chestImages = map.chests.map(c => { const p = project(c), image = sprite(this, 8, p.x, p.y, 45).setDepth(p.y); this.worldObjects.push(image); return image; });
    this.barrierImages=[];
    for(const wall of map.breakableWalls)if(!wall.destroyed){const p=project(wall),left=wall.orientation==='L',key=left?'wall-tiles-l':'wall-tiles-r',frame=left?wallFrameL:wallFrameR,image=this.add.image(p.x,p.y,key,String(frame)).setOrigin(.5,.82).setDisplaySize(155,155).setTint(theme.accent).setDepth(p.y+28);this.worldObjects.push(image);this.barrierImages.push(image);}
    for(const mechanism of map.mechanisms){const p=project(mechanism),frame={spikes:7,flameVent:1,frostVent:1,healingShrine:4,urn:3,ancientLever:6}[mechanism.kind],image=propSprite(this,frame,p.x,p.y,mechanism.kind==='healingShrine'?90:62).setTint(mechanism.kind==='frostVent'?0x91d9ee:mechanism.used?0x555555:0xffffff).setDepth(p.y);this.worldObjects.push(image);}
    for(const specimen of map.showcaseRooms??[]){const room=map.rooms[specimen.room],position={x:(room.x+room.w/2)*TILE,y:(room.y+room.h-.4)*TILE},door=project(position),source=`${specimen.boss?'♜ ':''}${specimen.label}`,label=this.add.text(door.x,door.y+12,tr(source),{fontFamily:'serif',fontSize:specimen.boss?'13px':'11px',color:specimen.boss?'#ef9d75':'#d8c48e',backgroundColor:'#090a0bd9',padding:{x:5,y:3},stroke:'#000',strokeThickness:2}).setOrigin(.5).setDepth(4900);this.worldObjects.push(label);this.showcaseLabels.push({text:label,position});this.localizedLabels.push({text:label,source});}
    for (const encounter of run.encounters) {
      const p = project(encounter);
      const image = propSprite(this, encounter.kind === 'cursed' ? 5 : encounter.kind==='sacrifice'?4:6, p.x, p.y, 90).setTint(encounter.kind === 'sacrifice' ? 0xda8989 : 0xc8b3ed).setDepth(p.y);
      const source={cursed:'诅咒宝箱',sacrifice:'血誓祭坛',hunt:'猎杀契约'}[encounter.kind],label = this.add.text(p.x,p.y-85,tr(source),{fontFamily:'serif',fontSize:'13px',color:'#e6c999',stroke:'#000',strokeThickness:4}).setOrigin(.5).setDepth(4900);this.localizedLabels.push({text:label,source});
      this.worldObjects.push(image,label);this.encounterImages.push(image);this.encounterLabels.push(label);
    }
    const p = project(run.player);
    if(run.session.equippedWing&&!this.wing){this.wing=authoredSprite(this,'wing',run.session.equippedWing,p.x,p.y-34,72).setDepth(p.y+8);this.worldObjects.push(this.wing);}
    this.hero = authoredSprite(this,'character',run.characterId,p.x,p.y,88).setDepth(p.y+10); this.worldObjects.push(this.hero);
    for(const id of run.activeNpcs){const location=run.npcPosition(id),np=project(location);if(id==='merchant'){const stall=this.add.image(np.x,np.y-24,'merchant-stall').setOrigin(.5,.72).setDisplaySize(210,150).setDepth(np.y-2);this.worldObjects.push(stall);}const image=authoredSprite(this,'npc',id,np.x,np.y,82).setDepth(np.y);this.worldObjects.push(image);this.npcImages.push({id,image});const source={merchant:'商人',blacksmith:'铁匠',beggar:'乞丐','distant-traveler':'远方旅客'}[id],label=this.add.text(np.x,np.y-88,tr(source),{fontFamily:'serif',fontSize:'12px',color:'#d7b778',stroke:'#090a0b',strokeThickness:4}).setOrigin(.5).setDepth(7000);this.localizedLabels.push({text:label,source});this.worldObjects.push(label);}
    this.clickMoveTarget=undefined;this.clickMovePath=[];this.clickMoveNavigationState='';this.configureCamera(); this.cameras.main.centerOn(p.x, p.y);this.bridge.onLoading(this.bridge.started,96,tr('唤醒怪物与光效…'));
    this.accumulator = 0;
  }

  update(_time: number, delta: number): void {
    if(this.rebuilding){const run=this.bridge.run;if(run.session.equippedWing&&this.hero){const p=project(run.player);if(!this.wing){this.wing=authoredSprite(this,'wing',run.session.equippedWing,p.x,p.y-34,72).setDepth(p.y+8);this.worldObjects.push(this.wing);}applyAuthoredFrame(this,this.wing,'wing',run.session.equippedWing,directionFrame(run.player.facing),'stand',0,72);this.wing.setPosition(p.x,p.y-34).setDepth(p.y+8);}this.bridge.onFrame();return;}if(!this.hero)return;
    if (this.boundRun !== this.bridge.run||this.boundRevision!==this.bridge.run.worldRevision){
      const revision=this.bridge.run.worldRevision;
      if(this.pendingBuildRevision!==revision){this.pendingBuildRevision=revision;this.bridge.onLoading(true,5,tr('读取地图种子…'));return;}
      this.rebuilding=true;void this.buildWorld().then(()=>{this.pendingBuildRevision=-1;this.rebuilding=false;this.bridge.onLoading(false,100,tr('地图已完成'));});return;
    }
    const run = this.bridge.run, dt = Math.min(delta / 1000, .05);
    this.elapsed += dt;
    const input = idleInput();
    if (this.bridge.started && run.phase === 'playing') {
      const sx = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
      const sy = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
      // Translate screen directions into the isometric ground plane.
      input.x = sx / 2 + sy; input.y = sy - sx / 2;
      if(sx||sy){this.clickMoveTarget=undefined;this.clickMovePath=[];}
      else if(this.clickMoveTarget){
        if(this.clickMoveNavigationState!==this.navigationState())this.rebuildClickPath();
        const p=run.player;while(this.clickMovePath.length&&Math.hypot(this.clickMovePath[0].x-p.x,this.clickMovePath[0].y-p.y)<12)this.clickMovePath.shift();
        const destination=this.clickMovePath[0];if(!destination)this.clickMoveTarget=undefined;
        else{const length=Math.hypot(destination.x-p.x,destination.y-p.y)||1;input.x=(destination.x-p.x)/length;input.y=(destination.y-p.y)/length;}
      }
      if (this.pointerActive) { const pointer = this.input.activePointer; const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); input.aim = unproject(point); }
      // Buffer edge-triggered commands: a short tap between slow frames must not vanish.
      input.dash = this.pendingActions.has('Space');
      input.burst = this.pendingActions.has('KeyQ');
      input.potion = this.pendingActions.has('KeyR');
      input.interact = this.pendingActions.has('KeyE');
      input.basicAttack=this.pendingActions.has('PointerRight')||this.input.activePointer.rightButtonDown();
      const manualCode=['Digit1','Digit2','Digit3','Digit4'].findIndex(code=>this.pendingActions.has(code));if(manualCode>=0)input.skillSlot=manualCode;
      this.playerMoving=Math.hypot(input.x,input.y)>0;
      if(this.hitStop>0)this.hitStop=Math.max(0,this.hitStop-dt);else this.accumulator += dt;
      while (this.accumulator >= 1 / 60) { run.update(1 / 60, input); this.accumulator -= 1 / 60; this.pendingActions.clear(); input.dash = input.burst = input.potion = input.interact = input.basicAttack = false;input.skillSlot=undefined; }
    } else {
      this.accumulator = 0;
      this.pendingActions.clear();
      this.playerMoving=false;
    }
    if(this.boundRun !== this.bridge.run||this.boundRevision!==this.bridge.run.worldRevision){this.pendingBuildRevision=this.bridge.run.worldRevision;this.bridge.onLoading(true);return;}
    this.renderWorld(dt);
    this.bridge.onFrame();
  }

  private renderWorld(dt: number): void {
    const run = this.bridge.run, player = run.player, pos = project(player), playing = this.bridge.started && run.phase === 'playing';
    const t = this.elapsed;
    if(!this.wing&&run.session.equippedWing){this.wing=authoredSprite(this,'wing',run.session.equippedWing,pos.x,pos.y-34,72).setDepth(pos.y+8);this.worldObjects.push(this.wing);}
    this.hero.setPosition(pos.x,pos.y);
    const moving = playing&&this.playerMoving;
    // While moving, locomotion owns the facing direction. Attacks still switch
    // animation immediately, but only retarget the sprite after movement stops.
    const facing=!moving&&(player.attackPose>0||player.skillPose>0)&&player.attackFacing?player.attackFacing:player.facing,direction=directionFrame(facing);
    const heroAction=player.skillPose>0?'skill':player.attackPose>0?'attack':moving?'run':player.invulnerable>0&&playing?'hit':'stand';
    const heroFrame=heroAction==='skill'?Math.floor((.65-player.skillPose)*11):heroAction==='attack'?Math.floor((.48-player.attackPose)*15):actionFrame(t,heroAction==='run'?10:heroAction==='hit'?12:6);
    applyAuthoredFrame(this,this.hero,'character',run.characterId,direction,heroAction,heroFrame,88);
    if(this.wing&&run.session.equippedWing){applyAuthoredFrame(this,this.wing,'wing',run.session.equippedWing,direction,heroAction,heroFrame,72);this.wing.setPosition(pos.x,pos.y-34).setDepth(pos.y+8).setAlpha(this.hero.alpha);}
    for(const npc of this.npcImages)applyAuthoredFrame(this,npc.image,'npc',npc.id,4,'stand',actionFrame(t,6),82);
    this.hero.setRotation(0);
    this.hero.setDepth(pos.y + 10);
    this.hero.setAlpha(player.dashTime > 0 ? .5 : player.invulnerable > 0 && player.invulnerable < .5 && playing ? .7 + Math.sin(t * 35) * .2 : 1);
    const cam = this.cameras.main;
    const nearbyBoss=run.enemies.find(enemy=>enemy.rank==='boss'&&run.isExplored(enemy)&&Phaser.Math.Distance.Between(enemy.x,enemy.y,player.x,player.y)<900),finalBossVisible=nearbyBoss?.artId?.startsWith('final/')??false,bossVisible=!!nearbyBoss;
    const baseZoom=Math.min(1.25,Math.max(.75,this.scale.width/1280));cam.setZoom(finalBossVisible ? .62 : bossVisible ? .82 : baseZoom);
    // Camera movement is exact: the hero's feet remain at the viewport center
    // during walking, dashing, room transitions and boss zoom changes.
    cam.centerOn(pos.x,pos.y);
    const activeDistance=Math.max(this.scale.width,this.scale.height)/cam.zoom*.9+1150;
    for(const chunk of this.floorChunks)chunk.image.setVisible(Math.abs(chunk.x-pos.x)<activeDistance&&Math.abs(chunk.y-pos.y)<activeDistance);
    for(const panel of this.wallPanels)panel.image.setVisible(Math.abs(panel.x-pos.x)<activeDistance&&Math.abs(panel.y-pos.y)<activeDistance);
    this.authoredTextureCursor=0;
    for(const npc of this.npcImages){const close=Phaser.Math.Distance.Between(npc.image.x,npc.image.y,pos.x,pos.y)<125,id:EffectAssetId=close?'npc-alert':'npc-question';this.paintAuthoredEffect(id,0,this.loopEffectFrame(id,t,7),npc.image.x,npc.image.y-105,28,44,close?.95:.58,0,7001);}
    if (this.fogRevision !== run.explorationRevision) {
      this.fogRevision=run.explorationRevision;this.fog.clear();
      const map=run.dungeon;
      const tx=Math.floor(run.player.x/TILE),ty=Math.floor(run.player.y/TILE),range=map.showcase?34:map.size,minX=map.showcase?Math.max(0,tx-range):0,maxX=map.showcase?Math.min(map.size-1,tx+range):map.size-1,minY=map.showcase?Math.max(0,ty-range):0,maxY=map.showcase?Math.min(map.size-1,ty+range):map.size-1;
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(map.tiles[y*map.size+x]&&!run.explored[y*map.size+x]) {
        const p=project({x:x*TILE,y:y*TILE}),edge=[-1,1,-map.size,map.size].some(d=>run.explored[y*map.size+x+d]),alpha=edge?.68:.96;
        this.fog.fillStyle(0x030507,alpha);this.fog.fillPoints([{x:p.x,y:p.y-1},{x:p.x+33,y:p.y+16},{x:p.x,y:p.y+33},{x:p.x-33,y:p.y+16}],true);
        // Walls are baked into terrain chunks and rise above the floor diamond.
        // Matching vertical fog faces keep those silhouettes hidden until their
        // supporting tile is explored instead of revealing adjacent rooms.
        if(y===0||!map.tiles[(y-1)*map.size+x]){const b=project({x:(x+1)*TILE,y:y*TILE});this.fog.fillStyle(0x020304,edge?.76:.985);this.fog.fillPoints([{x:p.x-5,y:p.y+7},{x:b.x+5,y:b.y+7},{x:b.x+5,y:b.y-126},{x:p.x-5,y:p.y-126}],true);}
        if(x===0||!map.tiles[y*map.size+x-1]){const b=project({x:x*TILE,y:(y+1)*TILE});this.fog.fillStyle(0x020304,edge?.76:.985);this.fog.fillPoints([{x:p.x+5,y:p.y+7},{x:b.x-5,y:b.y+7},{x:b.x-5,y:b.y-126},{x:p.x+5,y:p.y-126}],true);}
      }
    }
    run.encounters.forEach((e,i)=>{this.encounterImages[i].setVisible(run.isExplored(e)).setAlpha(e.state==='available'||e.state==='active'?1:.25);this.encounterLabels[i].setVisible(run.isExplored(e)).setText(tr(`${{cursed:'诅咒宝箱',sacrifice:'血誓祭坛',hunt:'猎杀契约'}[e.kind]}${e.state==='won'?' · 完成':e.state==='failed'?' · 失败':''}`));});
    for(const label of this.showcaseLabels)label.text.setVisible(run.isExplored(label.position));
    this.ground.clear(); this.effects.clear(); this.shadows.clear(); this.warnings.clear(); this.bars.clear();
    // Keep dangerous off-screen elites and ranged attackers readable without
    // moving the camera away from the player.
    const view=cam.worldView,margin=54;
    for(const enemy of run.enemies){if(!run.isExplored(enemy)||Phaser.Math.Distance.Between(enemy.x,enemy.y,player.x,player.y)>1050||enemy.rank==='normal'&&!['ranged','support'].includes(enemy.role))continue;const ep=project(enemy);if(view.contains(ep.x,ep.y))continue;const dx=ep.x-pos.x,dy=ep.y-pos.y,scale=Math.min((view.width/2-margin)/Math.max(1,Math.abs(dx)),(view.height/2-margin)/Math.max(1,Math.abs(dy))),x=pos.x+dx*scale,y=pos.y+dy*scale,a=Math.atan2(dy,dx),size=enemy.rank==='boss'?15:10,color=enemy.rank==='boss'?0xff5d4b:enemy.rank==='superElite'?0xef9b57:0xd4b56c;this.bars.fillStyle(color,.85);this.bars.fillTriangle(x+Math.cos(a)*size,y+Math.sin(a)*size,x+Math.cos(a+2.45)*size,y+Math.sin(a+2.45)*size,x+Math.cos(a-2.45)*size,y+Math.sin(a-2.45)*size);}
    const chamber=run.activeRoomEncounter;
    if(chamber){
      const room=run.dungeon.rooms[chamber.room],corners=[project({x:room.x*TILE,y:room.y*TILE}),project({x:(room.x+room.w)*TILE,y:room.y*TILE}),project({x:(room.x+room.w)*TILE,y:(room.y+room.h)*TILE}),project({x:room.x*TILE,y:(room.y+room.h)*TILE})];
      this.ground.lineStyle(5,0xb74f42,.2);this.ground.strokePoints(corners,true);this.ground.lineStyle(2,0xe59a66,.7);this.ground.strokePoints(corners,true);
      const doors=[{x:(room.x+room.w/2)*TILE,y:room.y*TILE},{x:(room.x+room.w)*TILE,y:(room.y+room.h/2)*TILE},{x:(room.x+room.w/2)*TILE,y:(room.y+room.h)*TILE},{x:room.x*TILE,y:(room.y+room.h/2)*TILE}];
      for(const door of doors){const d=project(door);this.paintAuthoredEffect('red-aura-wheel',0,this.loopEffectFrame('red-aura-wheel',t,8),d.x,d.y-16,76,76,.58,0,d.y+2);this.ground.lineStyle(4,0xd6614d,.75);this.ground.strokeEllipse(d.x,d.y,70,28);}
    }
    if(!run.showcaseMode&&!run.bossUnlocked&&!run.guardianSpawned){const seal=project(run.dungeon.exit),pulse=.55+Math.sin(t*3)*.12;this.paintAuthoredEffect('red-aura-wheel',0,this.loopEffectFrame('red-aura-wheel',t,8),seal.x,seal.y-42,155,155,pulse,0,seal.y+2);this.paintAuthoredEffect('red-ground-ring',0,this.loopEffectFrame('red-ground-ring',t,7),seal.x,seal.y,190,105,.45,0,4);this.ground.lineStyle(5,0x9e342f,.35);this.ground.strokeEllipse(seal.x,seal.y,175,70);}
    for(const object of this.worldObjects)if(object instanceof Phaser.GameObjects.Image&&object!==this.hero&&!object.texture.key.startsWith('floor-chunk-')&&!object.texture.key.startsWith('wall-tiles-')&&!this.barrierImages.includes(object))object.setVisible(run.isExplored(unproject(object)));
    for(const panel of this.wallPanels)panel.image.setVisible(panel.image.visible&&run.isExplored(unproject({x:panel.x,y:panel.footY})));
    for(const image of this.barrierImages){const point=unproject(image);image.setVisible(run.isExplored(point));}
    for (const pillar of this.pillars) pillar.setAlpha(Math.abs(pillar.x - pos.x) < 52 && pillar.y > pos.y && pillar.y - pos.y < 110 ? .28 : 1);
    for (const fire of this.braziers) {
      if(!run.isExplored(unproject(fire)))continue;
      const flame=this.braziers.indexOf(fire)%2?'flame-column-alt':'flame-column';this.paintAuthoredEffect(flame,0,this.loopEffectFrame(flame,t,10),fire.x,fire.y-36,flame==='flame-column'?44:50,82,.72,0,fire.y+1);

    }
    const ambient={cave:[0x8d8065,.09],dungeon:[0x9d7558,.07],cathedral:[0xd0bd83,.08],abandonedVillage:[0x9b7755,.08],inferno:[0xf05d32,.2],mountain:[0xb8c6c8,.1],town:[0x8f7b54,.08],palace:[0xc6a16f,.1],catacomb:[0xada17d,.08],sewer:[0x63a779,.14],frozenRuins:[0x8ddcf2,.18],swamp:[0x8ca85d,.16],mine:[0xc28a4c,.09],desertTemple:[0xd8b066,.13],abyssFortress:[0xc259df,.2]}[run.dungeon.theme] as [number,number];
    const ambientRooms=run.graphicsQuality==='performance'?2:run.graphicsQuality==='standard'?4:7;
    for(let i=0;i<Math.min(ambientRooms,run.dungeon.rooms.length);i++){const room=run.dungeon.rooms[i],world={x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2)*TILE};if(!run.isExplored(world))continue;const c=project(world),phase=t*(.35+i*.04)+i*1.7,id:EffectAssetId=run.dungeon.theme==='inferno'?'burning-ground':run.dungeon.theme==='swamp'||run.dungeon.theme==='sewer'?'poison-cloud':run.dungeon.theme==='abyssFortress'?'arcane-ultimate':run.dungeon.theme==='frozenRuins'?'blue-glow':'sparkle',large=id!=='sparkle';this.paintAuthoredEffect(id,0,this.loopEffectFrame(id,t,large?6:8,i),c.x+Math.cos(phase)*90,c.y-28+Math.sin(phase*1.3)*22,large?130:28,large?80:28,ambient[1]*2.2,0,c.y+2);}
    for (const corpse of run.corpses) { const c = project(corpse),scale=(corpse.rank==='boss'?2.6:corpse.rank==='superElite'?1.8:corpse.rank==='elite'?1.35:1)*.5; this.ground.fillStyle(corpse.blood??0x412722, Math.min(.58, corpse.ttl / 7)); this.ground.fillEllipse(c.x, c.y, 27*scale, 11*scale); this.ground.lineStyle(1, 0x95866c, .28); this.ground.lineBetween(c.x - 7*scale, c.y - 3*scale, c.x + 6*scale, c.y + 3*scale); }
    this.shadows.fillStyle(0x000000, .4); this.shadows.fillEllipse(pos.x, pos.y, 40, 18);
    this.ground.lineStyle(1, 0xb7dfdb, .55); this.ground.strokeEllipse(pos.x, pos.y, 40, 20);
    if(run.showcaseMode||run.showcaseUnlocked&&run.floor===1){const gate=project(run.showcasePortalPosition),pulse=.72+Math.sin(t*3.6)*.12;this.paintPortal(gate,t,pulse);this.effects.lineStyle(3,0xd99bff,.38);this.effects.strokeEllipse(gate.x,gate.y-50,185+Math.sin(t*4)*4,132);this.ground.lineStyle(3,0xbd58e8,.7);this.ground.strokeEllipse(gate.x,gate.y,180,62);}
    if(run.exitUnlocked&&run.floor<8){
      const gate=project(run.dungeon.exit),accent=THEMES[run.dungeon.theme].accent,pulse=.72+Math.sin(t*3)*.12;
      this.paintPortal(gate,t,pulse);
      this.effects.lineStyle(7,accent,.13);this.effects.strokeEllipse(gate.x,gate.y-50,190+Math.sin(t*3)*5,136);
      this.ground.lineStyle(5,accent,.25);this.ground.strokeEllipse(gate.x,gate.y,190,66);this.ground.lineStyle(2,0xf5d997,.72);this.ground.strokeEllipse(gate.x,gate.y,150,50);
    }
    if(player.shield>0)this.paintAuthoredEffect('blue-aura-wheel',0,this.loopEffectFrame('blue-aura-wheel',t,7),pos.x,pos.y-31,92,92,.55+Math.sin(t*3)*.08,0,pos.y+11);
    if(run.skills.some(s=>s.id==='blades'&&s.branch!=='wide'))for(let i=0;i<3;i++){
      const a=t*2.8+i*Math.PI*2/3;this.paintAuthoredEffect('character-shuriken',directionFrame({x:Math.cos(a),y:Math.sin(a)}),this.loopEffectFrame('character-shuriken',t,10,i),pos.x+Math.cos(a)*76,pos.y+Math.sin(a)*38,42,50,.9,a,pos.y+20);
    }
    if(run.activeEncounter){const p=project(run.activeEncounter),id:EffectAssetId=run.activeEncounter.kind==='hunt'?'red-ground-ring':'green-ground-ring';this.paintAuthoredEffect(id,0,this.loopEffectFrame(id,t,7),p.x,p.y,410,215,.3,0,5);this.paintAuthoredEffect(run.activeEncounter.kind==='hunt'?'red-aura-wheel':'blue-aura-wheel',0,this.loopEffectFrame(run.activeEncounter.kind==='hunt'?'red-aura-wheel':'blue-aura-wheel',t,7),p.x,p.y-20,132,132,.35,0,6);this.ground.lineStyle(2,0xbc92ea,.55);this.ground.strokeEllipse(p.x,p.y,320*2.8,320*1.4);}
    const minionIds = new Set(run.minions.map(m => m.id));
    for (const [id, image] of this.minionImages) if (!minionIds.has(id)) { image.destroy(); this.minionImages.delete(id); }
    for (const minion of run.minions) {
      const p = project(minion); let image = this.minionImages.get(minion.id);
      if (!image) { image = sprite(this, 2, p.x, p.y, 57).setTint(0xabc99d); this.minionImages.set(minion.id, image); }
      image.setPosition(p.x, p.y).setDepth(p.y).setRotation(minion.hitPose > 0 ? -.12 : 0).setAlpha(Math.min(.92, minion.ttl));
      this.ground.lineStyle(1, 0xa9cd92, .65); this.ground.strokeEllipse(p.x, p.y, 28, 14);
    }
    const ids = new Set(run.enemies.filter(e => e.hp > 0).map(e => e.id));
    for (const [id, image] of this.entities) if (!ids.has(id)) { image.destroy(); this.entities.delete(id); }
    for(const [id,label] of this.enemyLabels)if(!ids.has(id)){label.destroy();this.enemyLabels.delete(id);}
    for (const e of run.enemies) {
      if (e.hp <= 0) continue;
      const p = project(e); let image = this.entities.get(e.id),finalBoss=e.rank==='boss'&&e.artId?.startsWith('final/');
      const enemyHeight=finalBoss?960:e.rank==='boss'?(e.stationary?570:480):e.elite?102:e.kind==='zombie'?72:82;
      if(!image){image=e.legacyFrame!==undefined?sprite(this,e.legacyFrame,p.x,p.y,enemyHeight):authoredSprite(this,e.rank==='boss'?'boss':'monster',e.artId??'skeleton',p.x,p.y,enemyHeight);this.entities.set(e.id,image);}
      image.setVisible(run.isExplored(e));
      image.setPosition(p.x,p.y).setDepth(p.y);
      let label=this.enemyLabels.get(e.id);
      const labelY=p.y-(finalBoss?760:e.rank==='boss'?enemyHeight*.82:112);
      const enemyLabel=`${e.rank==='superElite'?'◆ 超级精英 · ':e.rank==='boss'?'♜ 首领 · ':'精英 · '}${e.name??'怪物'} · Lv.${e.level??1}`;
      if(e.rank!=='normal'&&!label){label=this.add.text(p.x,labelY,tr(enemyLabel),{fontFamily:'serif',fontSize:finalBoss?'16px':e.rank==='superElite'?'12px':'11px',color:e.rank==='superElite'?'#e79858':'#e4bc78',stroke:'#08090a',strokeThickness:3}).setOrigin(.5).setDepth(6101);this.enemyLabels.set(e.id,label);}
      label?.setText(tr(enemyLabel)).setPosition(p.x,labelY).setVisible(run.isExplored(e));
      if(!run.isExplored(e))continue;
      const enemyAction=(e.skillPose??0)>0?'skill':(e.basicWindup??0)>0||e.windup>0?'attack':e.hitFlash>0?'hit':e.moving?'run':'stand';
      if(e.artId)applyAuthoredFrame(this,image,e.rank==='boss'?'boss':'monster',e.artId,directionFrame(e.facing),enemyAction,actionFrame(t+e.id*.071,enemyAction==='attack'?10:enemyAction==='hit'?12:e.moving?Math.min(11,5+e.speed/14):6),enemyHeight);
      if (e.hitFlash > 0) image.setTint(0xffc5a0); else image.clearTint();
      image.setRotation(e.stagger>.025?Math.sin(e.id)*.07:e.moving?Math.sin((t+e.id)*10)*.012:0);
      if (e.slow > 0 && e.hitFlash <= 0) image.setTint(0x9cdeed);
      this.shadows.fillStyle(0x000000, .3); this.shadows.fillEllipse(p.x, p.y, e.radius * 2.3, e.radius);
      if(e.tactic&&run.isExplored(e)&&e.windup>0){const id=this.enemyCastEffect(e.tactic);this.paintAuthoredEffect(id,directionFrame(e.facing),this.loopEffectFrame(id,t,10,e.id),p.x,p.y-42,e.rank==='boss'?210:105,e.rank==='boss'?235:118,.72,0,6000);}
      if (e.elite) { this.ground.lineStyle(1.5, e.kind === 'boss' ? 0xc65746 : 0xc79c54, .6); this.ground.strokeEllipse(p.x, p.y, e.radius * 3, e.radius * 1.5); }
      if(e.shield>0){this.ground.lineStyle(2,0x83c9ef,.7);this.ground.strokeEllipse(p.x,p.y,e.radius*3.4,e.radius*1.7);}
      if (e.hp < e.maxHp || e.elite) {
        const width = finalBoss?240:e.rank==='boss'?130:e.elite ? 42 : 25, y = p.y - (finalBoss?720:e.rank==='boss'?enemyHeight*.75:e.elite ? 99 : 75);
        this.bars.fillStyle(0x080b0d, .85); this.bars.fillRect(p.x - width / 2, y, width, 4);
        this.bars.fillStyle(e.elite ? 0xc0a16d : 0x9f4b42); this.bars.fillRect(p.x - width / 2, y, width * Math.max(0, e.hp / e.maxHp), 3);
      }
    }
    this.chestImages.forEach((image, index) => image.setAlpha(run.chestsOpened.has(index) ? .3 : 1));
    for (const z of run.zones) { const p=project(z),id:EffectAssetId=z.color===0xec9a54?'burning-ground':z.color===0xa7be66?'poison-cloud':'lightning-spread';this.paintAuthoredEffect(id,0,this.loopEffectFrame(id,t,8,z.id),p.x,p.y,z.radius*2.8,z.radius*1.65,.42,0,3); }
    // Hostile warnings are intentionally above friendly effects in the display list.
    for (const h of run.hazards) {
      const p = project(h);
      const hazardId=this.hazardEffect(h);
      if(h.shape==='line'&&h.target){const to=project(h.target),angle=Math.atan2(to.y-p.y,to.x-p.x);this.paintAuthoredEffect(hazardId,0,this.loopEffectFrame(hazardId,t,11,h.id),(p.x+to.x)/2,(p.y+to.y)/2,Math.max(55,Math.hypot(to.x-p.x,to.y-p.y)),75,h.fired?.92:.38,angle-Math.PI/2,6001);this.warnings.lineStyle(h.fired?4:2,0xff956d,.85);this.warnings.lineBetween(p.x,p.y,to.x,to.y);continue;}
      this.paintAuthoredEffect(hazardId,0,this.loopEffectFrame(hazardId,t,10,h.id),p.x,p.y-(hazardId==='lightning-strike'?h.radius*.8:0),h.radius*3.1,hazardId==='lightning-strike'?h.radius*4.8:h.radius*1.8,h.fired?.82:.34,0,6001);
      if(h.shape==='ring'){this.warnings.lineStyle(3,0xffa270,.9);this.warnings.strokeEllipse(p.x,p.y,h.radius*2.8,h.radius*1.4);continue;}
      const alpha = h.fired ? .5 : .1 + .15 * (1 - Math.max(0, h.delay) / 1.25);
      this.warnings.fillStyle(0xf16848, alpha); this.warnings.fillEllipse(p.x, p.y, h.radius * 2.8, h.radius * 1.4);
      this.warnings.lineStyle(2, 0xee8f61, .9); this.warnings.strokeEllipse(p.x, p.y, h.radius * 2.8, h.radius * 1.4);
      const inner = h.fired ? 1 : Math.max(0, 1 - h.delay / 1.25); this.warnings.lineStyle(1, 0xffca95, .7); this.warnings.strokeEllipse(p.x, p.y, h.radius * 2.8 * inner, h.radius * 1.4 * inner);
    }
    for(const e of run.enemies)if((e.basicWindup??0)>0&&e.basicTarget){
      const p=project(e),to=project(e.basicTarget),progress=1-Math.min(1,e.basicWindup!/(e.basicAttack==='shot'?.38:.24));
      const castId=this.enemyBasicEffect(e.basicAttack??'melee');this.paintAuthoredEffect(castId,directionFrame(e.facing),Math.floor(progress*EFFECT_MANIFEST[castId].frames),p.x,p.y-36,e.rank==='boss'?230:115,e.rank==='boss'?250:125,.55+progress*.35,0,6000);
      this.warnings.lineStyle(1+progress*2,0xffa279,.45+progress*.45);
      if(e.basicAttack==='shot')this.warnings.lineBetween(p.x,p.y-28,to.x,to.y);
      else this.warnings.strokeEllipse(p.x,p.y,e.radius*2.8+16,e.radius*1.4+8);
    }
    const corpseIds=new Set(run.corpses.map(corpse=>corpse.id));for(const[id,image]of this.corpseImages)if(!corpseIds.has(id)){image.destroy();this.corpseImages.delete(id);}
    for(const corpse of run.corpses){const p=project(corpse),frame=Math.floor((18-corpse.ttl)*3.5+corpse.id)%4,size=corpse.rank==='boss'?72.5:corpse.rank==='superElite'?61:54;let image=this.corpseImages.get(corpse.id);if(!image){image=this.add.image(p.x,p.y,'corpse-remains',frame).setOrigin(.5,.82);this.corpseImages.set(corpse.id,image);}image.setFrame(frame).setPosition(p.x,p.y+2).setDisplaySize(size,size*315/443).setDepth(p.y-.5).setAlpha(Math.min(1,corpse.ttl*1.5)).setVisible(run.isExplored(corpse));}
    const lootIds = new Set(run.loot.filter(l => l.item).map(l => l.id));
    for (const [id, image] of this.drops) if (!lootIds.has(id)) { image.destroy(); this.drops.delete(id); }
    const xpIds=new Set(run.loot.filter(l=>!l.item&&l.xp>0).map(l=>l.id));for(const[id,image]of this.xpDrops)if(!xpIds.has(id)){image.destroy();this.xpDrops.delete(id);}
    for(const [id,label] of this.dropLabels)if(!lootIds.has(id)){label.destroy();this.dropLabels.delete(id);}
    for (const l of run.loot) {
      const p = project(l);
      if (l.item) {
        const color = RARITY_COLORS[l.item.rarity];
        this.ground.fillStyle(color, .12); this.ground.fillEllipse(p.x, p.y, 48, 23);
        const rarityIndex=Math.max(0,QUALITY_ORDER.indexOf(l.item.rarity)),beamHeight=[82,105,132,162,184,208,236][rarityIndex]??82,beamWidth=[28,32,38,44,48,54,62][rarityIndex]??28,beamAlpha=[.38,.48,.58,.68,.72,.78,.86][rarityIndex]??.38;
        // A single authored blue beam is hue-tinted by rarity. Height, width and
        // intensity make valuable drops readable before the ground label appears.
        this.paintAuthoredEffect('blue-glow',0,this.loopEffectFrame('blue-glow',t,10,l.id),p.x,p.y-beamHeight*.48,beamWidth,beamHeight,beamAlpha,0,p.y, true,color);
        let image = this.drops.get(l.id); if (!image) {
          const frame=l.item.weaponKind?WEAPONS[l.item.weaponKind].icon:{offhand:8,head:9,chest:10,feet:11,amulet:12,ring1:13,ring2:13,weapon:0}[l.item.slot];
          image=this.add.image(p.x,p.y,'equipment-atlas',String(frame)).setOrigin(.5,.82).setScale(30/(1254/4)).setDepth(p.y+1);this.drops.set(l.id,image);
        }
        const landing=l.age<.46?Math.sin(Math.max(0,l.age)/.46*Math.PI)*22:0;
        image.setPosition(p.x, p.y - 3 - landing - Math.sin(t * 3) * 2).setRotation(l.age<.46?(1-l.age/.46)*.18:0);
        const accepted=run.lootFilter==='all'||QUALITY_ORDER.indexOf(l.item.rarity)>=QUALITY_ORDER.indexOf(run.lootFilter==='rare'?'rare':'epic');let label=this.dropLabels.get(l.id);
        if(!label){label=this.add.text(p.x,p.y-43,`${l.item.name}\nLv.${l.item.level??l.item.power}`,{fontFamily:'serif',fontSize:'10px',align:'center',color:`#${color.toString(16).padStart(6,'0')}`,stroke:'#050708',strokeThickness:3}).setOrigin(.5,1).setDepth(6200);this.dropLabels.set(l.id,label);}
        label.setPosition(p.x,p.y-38-landing-Math.sin(t*3)*2).setAlpha(accepted?1:.28);image.setAlpha(accepted?1:.25);
      } else if(l.xp>0){
        const row=l.xp>=80?3:l.xp>=35?2:l.xp>=15?1:0,frame=this.loopEffectFrame('experience-orb',t,9,l.id),height=[30,38,48,58][row];let image=this.xpDrops.get(l.id);
        if(!image){image=this.add.image(p.x,p.y,'effect:experience-orb:0:0').setOrigin(.5,.78).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y+2);this.xpDrops.set(l.id,image);}
        applyEffectFrame(this,image,'experience-orb',0,frame);image.setPosition(p.x,p.y-4-Math.sin(t*4+l.id)*3).setDisplaySize(height,height*1.35).setVisible(run.isExplored(l)).setTint([0x75efff,0x7d93ff,0xc26aff,0xffd872][row]);
        this.ground.fillStyle([0x5edced,0x657cff,0xa852e8,0xf2c45f][row],.22);this.ground.fillEllipse(p.x,p.y,18+row*5,8+row*2);
      }
    }
    for(const b of run.projectiles){const p=project(b),red=(b.color>>16)&255,green=(b.color>>8)&255,blue=b.color&255,id:EffectAssetId=b.returning?'character-shuriken':b.enemy&&green>red*1.15?'poison-cloud':red>blue*1.18?'red-energy-orb':'blue-energy-orb',direction=directionFrame({x:b.vx,y:b.vy});this.paintAuthoredEffect(id,direction,this.loopEffectFrame(id,t,12,b.id),p.x,p.y,b.returning?56:44,b.returning?62:44,.92,0,b.enemy?6001:5001);}
    for (const event of run.events.splice(0)) {
      this.bridge.audio.play(event);
      const duration = event.type === 'burst'||event.type==='execute'||event.type==='interrupt' ? .65 : event.type === 'death' ? .5 : event.type==='playerHit' ? .42 : event.type==='cast'?.55:.3;
      this.fx.push({ event, life: duration, duration });
      if(event.type==='death'&&event.artId){const p=project(event),boss=event.artId.includes('/'),image=authoredSprite(this,boss?'boss':'monster',event.artId,p.x,p.y,boss?170:82).setDepth(p.y);this.deathSprites.push({image,event,life:.85});}
      if (['hit','playerHit','execute','interrupt','heal','status'].includes(event.type) && this.numbers.length < 42 && (event.type!=='hit'||event.critical || event.heavy || event.blocked || this.numbers.length < 12)) {
        const p = project(event),label=event.label??fixed2(event.amount??0), text = this.add.text(p.x + (Math.random() - .5) * 20, p.y-(event.type==='status'?82:55), label, { fontFamily: 'Georgia, serif', fontStyle:event.critical?'bold':'normal', fontSize: event.type==='execute'?'28px':event.critical ? '20px' : event.type==='status'?'16px':'14px', color:event.blocked?'#8ed7ff':event.type==='heal'?'#80dfa0':event.type==='status'?`#${event.color.toString(16).padStart(6,'0')}`:event.type==='interrupt'?'#a9efff':event.type==='execute'?'#ffb06b':event.color === 0xee7072 ? '#f48a83' : event.critical ? '#f2d596' : '#c7d0c9', stroke: '#0b1012', strokeThickness: 3 }).setOrigin(.5).setDepth(7200);
        this.numbers.push({ text, life: .65 });
      }
      if (event.type === 'burst' && !this.bridge.reducedMotion && run.shakeLevel) cam.shake(100, .001*run.shakeLevel);
      if(event.type==='hit'||event.type==='execute'||event.type==='interrupt'){
        const stop=(event.lethal ? .034 : event.critical ? .026 : .008)+(event.impact??0)*.018;
        this.hitStop=Math.max(this.hitStop,Math.min(.065,stop));
        if(!this.bridge.reducedMotion&&run.shakeLevel&&(event.critical||event.lethal||(event.impact??0)>.55))cam.shake(38+(event.impact??0)*48,.00055*run.shakeLevel*Math.max(.35,event.impact??0));
      }
      if(event.type==='playerHit'){
        this.hitStop=Math.max(this.hitStop,.035+(event.impact??0)*.018);
        if(!this.bridge.reducedMotion){cam.flash(75,115,10,12,false);if(run.shakeLevel)cam.shake(90,.0012*run.shakeLevel*Math.max(.4,event.impact??0));}
      }
    }
    for(const death of this.deathSprites){death.life-=dt;const direction=directionFrame(death.event.facing??{x:0,y:1}),boss=death.event.artId?.includes('/');applyAuthoredFrame(this,death.image,boss?'boss':'monster',death.event.artId!,direction,'death',Math.floor((.85-death.life)*9),boss?170:82);death.image.setAlpha(Math.min(1,death.life*4));if(death.life<=0)death.image.destroy();}
    this.deathSprites=this.deathSprites.filter(death=>death.life>0);
    for (const f of this.fx) {
      f.life -= dt; const p = project(f.event), alpha = Math.max(0, f.life / f.duration), progress = 1 - alpha, color = f.event.color;
      if(!run.isExplored(f.event)) continue;
      if(f.event.type==='lightning'&&f.event.target){
        const to=project(f.event.target); p.y-=35;to.y-=30;const length=Math.max(40,Math.hypot(to.x-p.x,to.y-p.y));
        this.paintAuthoredEffect('lightning-bolt',0,this.eventEffectFrame('lightning-bolt',progress),(p.x+to.x)/2,(p.y+to.y)/2,62,length,alpha,Math.atan2(to.y-p.y,to.x-p.x)-Math.PI/2,5002);this.paintAuthoredEffect('lightning-spread',0,this.eventEffectFrame('lightning-spread',progress),to.x,to.y+30,145,82,alpha*.85,0,5002);
      }else if(['hit','playerHit','ring','burst','slash','heal','corpse','summon','death','dash','loot','execute','interrupt','status','cast','shield','teleport','revive'].includes(f.event.type)){
        const r=f.event.radius??(f.event.type==='loot'?65:f.event.type==='playerHit'?70:['hit','execute','interrupt'].includes(f.event.type)?22+(f.event.impact??0)*36:35);
        const authored=this.visualEventEffect(f.event),direction=directionFrame(f.event.facing??{x:0,y:1}),size=this.eventEffectSize(f.event,r);this.paintAuthoredEffect(authored,direction,this.eventEffectFrame(authored,progress),p.x,p.y-(EFFECT_MANIFEST[authored].directions===8?28:0),size.w,size.h,alpha*.88,0,f.event.type==='playerHit'||f.event.type==='status'?6002:5002);
      }
    }
    for(let i=this.authoredTextureCursor;i<this.authoredTextureFx.length;i++)this.authoredTextureFx[i].setVisible(false);
    this.fx = this.fx.filter(f => f.life > 0).slice(-180);
    for (const n of this.numbers) { n.life -= dt; n.text.y -= dt * 25; n.text.setAlpha(Math.min(1, n.life * 3)); if (n.life <= 0) n.text.destroy(); }
    this.numbers = this.numbers.filter(n => n.life > 0);
  }
  /** Bounded image pool: code composes the user's transparent effect frames. */
  private loopEffectFrame(id:EffectAssetId,time:number,fps:number,offset=0):number{return Math.floor(time*fps+offset)%EFFECT_MANIFEST[id].frames;}
  private eventEffectFrame(id:EffectAssetId,progress:number):number{return Math.min(EFFECT_MANIFEST[id].frames-1,Math.floor(progress*EFFECT_MANIFEST[id].frames));}
  private paintAuthoredEffect(id:EffectAssetId,direction:number,frame:number,x:number,y:number,width:number,height:number,alpha:number,rotation=0,depth=5001,additive=true,tint?:number):void{
    const limit=this.bridge.run.graphicsQuality==='performance'?90:this.bridge.run.graphicsQuality==='standard'?150:220;if(this.authoredTextureCursor>=limit)return;
    let image=this.authoredTextureFx[this.authoredTextureCursor];if(!image){image=this.add.image(x,y,'__WHITE').setOrigin(.5).setVisible(false);this.authoredTextureFx.push(image);}
    const ready=applyEffectFrame(this,image,id,direction,frame);image.setVisible(ready);if(ready){image.setPosition(x,y).setDisplaySize(width,height).setAlpha(alpha).setRotation(rotation).setDepth(depth).setBlendMode(additive?Phaser.BlendModes.ADD:Phaser.BlendModes.NORMAL).clearTint();if(tint!==undefined)image.setTintFill(tint);}this.authoredTextureCursor++;
  }
  private paintPortal(point:Vec,time:number,alpha:number):void{
    // All three source canvases share a 328 px reference width. Keeping one
    // uniform scale and compensating their transparent padding makes the gold
    // body, inner energy and floor rune meet at the same visual center.
    this.paintAuthoredEffect('portal/ground',0,this.loopEffectFrame('portal/ground',time,8),point.x+34,point.y+20,269,160,alpha*.82,0,point.y-3);
    this.paintAuthoredEffect('portal/interior',0,this.loopEffectFrame('portal/interior',time,3),point.x+2,point.y-34,92,157,alpha*.92,0,point.y-2);
    this.paintAuthoredEffect('portal/gold-body',0,this.loopEffectFrame('portal/gold-body',time,10),point.x+37,point.y-33,269,207,alpha,0,point.y-1);
  }
  private enemyCastEffect(tactic:string):EffectAssetId{return tactic.includes('heal')?'character-heal':tactic.includes('teleport')?'character-blue-cast':tactic.includes('poison')?'character-flamethrower':tactic.includes('shield')?'character-shockwave':tactic.includes('meteor')||tactic.includes('fire')?'character-fire-cast':'character-lightning-cast';}
  private enemyBasicEffect(attack:string):EffectAssetId{return attack==='shot'?'character-blue-cast':attack==='charge'||attack==='nova'?'character-shockwave':attack==='beam'||attack==='jail'?'character-lightning-cast':attack==='poison'?'character-flamethrower':attack==='meteor'?'character-fire-cast':attack==='summon'?'bone-projectile':attack==='leap'?'character-diagonal-slash':'character-claw';}
  private hazardEffect(h:{status?:string;sourceName?:string;shape?:string}):EffectAssetId{const source=(h.sourceName??'').toLowerCase();if(source.includes('meteor')||source.includes('陨石'))return'meteor-impact';if(source.includes('rock')||source.includes('boulder')||source.includes('塌'))return'boulder-impact';if(h.status==='poison')return'poison-spread';if(h.status==='burn')return'fire-impact';if(h.status==='curse'||h.shape==='ring')return'red-ground-ring';if(h.shape==='line')return'lightning-strike';return'ground-spikes';}
  private visualEventEffect(event:VisualEvent):EffectAssetId{
    if(event.type==='cast'){const id=event.label??'';if(id.includes('lightning')||id.includes('storm'))return'character-lightning-cast';if(id.includes('fire'))return'character-fire-cast';if(id.includes('poison')||id.includes('arcane')||id.includes('frost'))return'character-blue-cast';if(id.includes('blade')||id.includes('lance'))return'character-shuriken';if(id.includes('blood')||id.includes('cleave'))return'character-diagonal-slash';if(id.includes('shield')||id.includes('warcry'))return'character-shockwave';return'bone-projectile';}
    if(event.type==='heal'||event.type==='revive')return'character-heal';if(event.type==='corpse'||event.type==='summon'||event.type==='death')return event.type==='death'?'explosion':'emerge';if(event.type==='teleport'||event.type==='dash')return'sparkle';if(event.type==='status')return'poison-cloud';if(event.type==='playerHit')return'character-claw';if(event.type==='slash'||event.type==='execute')return event.heavy?'character-vertical-slash':'character-horizontal-slash';if(event.type==='interrupt')return'great-flash';if(event.type==='burst')return event.radius&&event.radius>180?'dragon-impact':'lightning-ultimate';if(event.type==='shield')return'blue-aura-wheel';if(event.type==='ring')return event.color===0xa7be66?'green-ground-ring':event.color===0xec9a54?'fire-impact':'red-aura-wheel';if(event.type==='loot')return'blue-glow';return'character-diagonal-slash';
  }
  private eventEffectSize(event:VisualEvent,radius:number):{w:number;h:number}{const directional=EFFECT_MANIFEST[this.visualEventEffect(event)].directions===8,large=event.type==='burst'||event.type==='interrupt';return{w:large?radius*3.5:directional?Math.max(82,radius*3):radius*2.9,h:large?radius*3:directional?Math.max(96,radius*3.3):radius*1.9};}

}

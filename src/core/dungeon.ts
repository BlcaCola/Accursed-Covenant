import { Random } from './random';
import type { Dungeon, EnvironmentProp, Room, ThemeId, Vec } from './types';
import {roomIdentity,THEME_DESIGNS,type LayoutPattern} from './themeDesigns';
import {THEMES} from './themes';

export const TILE = 32;
export const CAMPAIGN_FLOORS = 8;
export const roomsForFloor = (floor:number):number => [5,6,8,9,11,12,14,15][Math.max(0,Math.min(7,floor-1))];

/**
 * Diablo-like macro generation: shuffled room presets form a graph, a minimum
 * spanning tree guarantees a route, optional graph edges create loops, then
 * corridors and room tiles are carved. Combat never depends on renderer state.
 */
export function generateDungeon(seed:number,roomCount=5,theme:ThemeId='cathedral',floor=1):Dungeon{
  const rng=new Random(seed),size=122,tiles=new Uint8Array(size*size),grid=4,cell=24,margin=3;
  roomCount=Math.max(5,Math.min(15,roomCount));
  const allCells:Array<{x:number;y:number}>=[];
  for(let y=0;y<grid;y++)for(let x=0;x<grid;x++)allCells.push({x,y});
  const startCell={x:0,y:rng.int(0,3)};
  // roomCount describes playable main-route rooms. The hidden treasury is an
  // additional room, so a five-room opening map always contains entry, boss
  // and three combat/event rooms before the secret room is added.
  const cells=[startCell,...rng.shuffle(allCells.filter(c=>c.x!==startCell.x||c.y!==startCell.y)).slice(0,roomCount-1)];
  let bossCandidate=1,bossDistance=-1;for(let i=1;i<cells.length;i++){const d=Math.abs(cells[i].x-startCell.x)+Math.abs(cells[i].y-startCell.y);if(d>bossDistance){bossDistance=d;bossCandidate=i;}}
  const roomTypes:Room['type'][]=['crypt','altar','treasury'];
  const rooms=cells.map((c,i):Room=>{
    const boss=i===bossCandidate,w=i===0?20:boss?(floor===CAMPAIGN_FLOORS?30:24):rng.int(14,20),h=i===0?20:boss?(floor===CAMPAIGN_FLOORS?30:24):rng.int(14,20),jx=rng.int(0,Math.max(0,cell-w-1)),jy=rng.int(0,Math.max(0,cell-h-1));
    const type=i===0?'entry':boss?'sanctum':roomTypes[(i-1)%roomTypes.length];
    return{x:margin+c.x*cell+jx,y:margin+c.y*cell+jy,w,h,type,archetype:roomIdentity(theme,type,i).archetype};
  });
  // Keep the secret treasury beyond the southern generation grid. Main-route
  // corridors can never accidentally carve through it before its wall opens.
  rooms.push({x:rng.int(10,75),y:101,w:18,h:18,type:'treasury',archetype:THEME_DESIGNS[theme].secretArchetype});
  const center=(r:Room):Vec=>({x:Math.floor(r.x+r.w/2),y:Math.floor(r.y+r.h/2)});
  const carve=(x:number,y:number)=>{if(x>1&&y>1&&x<size-2&&y<size-2)tiles[y*size+x]=1};
  const carvedByLayout=(layout:LayoutPattern,r:Room,ix:number,iy:number):boolean=>{
    // Boss arenas must be fully paved. Large themed cut-outs looked like
    // missing textures and also reduced the usable space around giant bosses.
    if(r.type==='entry'||r.type==='sanctum')return true;
    const cx=(r.w-1)/2,cy=(r.h-1)/2,cornerDepth=Math.min(ix,r.w-1-ix)+Math.min(iy,r.h-1-iy);
    if(layout==='block')return true;
    if(layout==='organic')return cornerDepth>0||rng.next()>.5;
    if(layout==='cruciform'||layout==='streets'||layout==='islands')return ix>=2&&ix<r.w-2||iy>=2&&iy<r.h-2;
    if(layout==='ruined')return cornerDepth>1||(ix+iy)%3!==0;
    if(layout==='fractured')return ix>=1&&ix<r.w-1&&iy>=1&&iy<r.h-1||Math.abs(ix-cx)<2||Math.abs(iy-cy)<2;
    if(layout==='ridge')return Math.abs(iy-cy)<Math.max(3,r.h*.34)||Math.abs(ix-cx)<1.5;
    if(layout==='symmetric')return cornerDepth>0;
    if(layout==='crypt')return cornerDepth>1||Math.abs(ix-cx)<2||Math.abs(iy-cy)<2;
    if(layout==='channels')return ix>=1&&ix<r.w-1||Math.abs(iy-cy)<2;
    if(layout==='frost'||layout==='stepped')return Math.abs(ix-cx)+Math.abs(iy-cy)<(r.w+r.h)*.38;
    if(layout==='shafts')return Math.abs(ix-cx)<2.5||Math.abs(iy-cy)<3.5;
    return Math.abs(ix-cx)+Math.abs(iy-cy)<Math.min(r.w,r.h)*.72;
  };
  for(const r of rooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
    const corner=(x===r.x||x===r.x+r.w-1)&&(y===r.y||y===r.y+r.h-1);
    if(carvedByLayout(THEME_DESIGNS[theme].layout,r,x-r.x,y-r.y)&&(!corner||!['cave','swamp','mine'].includes(theme)||rng.next()>.55))carve(x,y);
  }
  // The final room is a sealed side room. Main progression is always connected;
  // the side room becomes reachable only after its cracked wall is destroyed.
  const hiddenRoom=rooms.length-1,mainCount=rooms.length-1;
  const edges:Array<[number,number]>=[],connected=new Set([0]);
  while(connected.size<mainCount){let best:[number,number]=[0,1],score=Infinity;
    for(const a of connected)for(let b=0;b<mainCount;b++)if(!connected.has(b)){
      const ca=center(rooms[a]),cb=center(rooms[b]),d=Math.abs(ca.x-cb.x)+Math.abs(ca.y-cb.y)+rng.next()*3;
      if(d<score){score=d;best=[a,b]}
    }edges.push(best);connected.add(best[1]);
  }
  const existing=(a:number,b:number)=>edges.some(e=>(e[0]===a&&e[1]===b)||(e[0]===b&&e[1]===a));
  for(let i=0;i<Math.min(1+Math.floor(floor/2),4);i++){
    const a=rng.int(0,mainCount-1),b=rng.int(0,mainCount-1);if(a!==b&&!existing(a,b))edges.push([a,b]);
  }
  let hiddenParent=0,hiddenDistance=Infinity;for(let i=0;i<mainCount;i++){const a=center(rooms[i]),b=center(rooms[hiddenRoom]),d=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(d<hiddenDistance){hiddenDistance=d;hiddenParent=i}}
  const corridorRadius=['cave','sewer','mine'].includes(theme)?1:2;
  const connect=(a:Room,b:Room)=>{const from=center(a),to=center(b),path:Vec[]=[];let{x,y}=from;const horizontalFirst=rng.next()<.5;
    const stepX=()=>{path.push({x,y});for(let oy=-corridorRadius;oy<=corridorRadius;oy++)carve(x, y+oy);x+=Math.sign(to.x-x)};
    const stepY=()=>{path.push({x,y});for(let ox=-corridorRadius;ox<=corridorRadius;ox++)carve(x+ox,y);y+=Math.sign(to.y-y)};
    if(horizontalFirst){while(x!==to.x)stepX();while(y!==to.y)stepY()}else{while(y!==to.y)stepY();while(x!==to.x)stepX()}
    for(let ox=-corridorRadius;ox<=corridorRadius;ox++)for(let oy=-corridorRadius;oy<=corridorRadius;oy++)carve(x+ox,y+oy);path.push({x,y});return path;
  };
  for(const[a,b]of edges)connect(rooms[a],rooms[b]);
  // More late-game route rooms create more corridors. Clear a two-tile moat
  // around the secret after all main corridors are carved, then rebuild the
  // treasury and its single controlled approach. This guarantees that a
  // random loop can never bypass the breakable wall.
  const secretRoom=rooms[hiddenRoom];for(let y=secretRoom.y-2;y<=secretRoom.y+secretRoom.h+1;y++)for(let x=secretRoom.x-2;x<=secretRoom.x+secretRoom.w+1;x++)if(x>0&&y>0&&x<size-1&&y<size-1)tiles[y*size+x]=0;
  for(let y=secretRoom.y;y<secretRoom.y+secretRoom.h;y++)for(let x=secretRoom.x;x<secretRoom.x+secretRoom.w;x++)if(carvedByLayout(THEME_DESIGNS[theme].layout,secretRoom,x-secretRoom.x,y-secretRoom.y))carve(x,y);
  const hiddenPath=connect(rooms[hiddenParent],rooms[hiddenRoom]);
  const inside=(p:Vec,r:Room)=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;
  const reachable=()=>{const seen=new Uint8Array(tiles.length),q=[Math.floor(center(rooms[0]).y)*size+Math.floor(center(rooms[0]).x)];seen[q[0]]=1;for(let n=0;n<q.length;n++){const i=q[n],x=i%size;for(const j of [i-size,i+size,...(x?[i-1]:[]),...(x<size-1?[i+1]:[])])if(j>=0&&j<tiles.length&&tiles[j]&&!seen[j]){seen[j]=1;q.push(j)}}return seen};
  let bx=hiddenPath[Math.floor(hiddenPath.length/2)].x,by=hiddenPath[Math.floor(hiddenPath.length/2)].y,wallTiles:number[]=[],wallOrientation:'L'|'R'='R';
  for(let pathIndex=hiddenPath.length-2;pathIndex>=1;pathIndex--){
    const point=hiddenPath[pathIndex];if(inside(point,rooms[hiddenRoom]))continue;
    const towardSecret=hiddenPath[pathIndex+1],away=hiddenPath[pathIndex-1],horizontal=towardSecret.x!==point.x||(towardSecret.x===point.x&&towardSecret.y===point.y&&away.x!==point.x),removed:number[]=[];
    const offsets=Array.from({length:corridorRadius*2+1},(_,i)=>i-corridorRadius);
    for(const offset of offsets){const x=point.x+(horizontal?0:offset),y=point.y+(horizontal?offset:0),index=y*size+x;if(index>=0&&index<tiles.length&&tiles[index]){tiles[index]=0;removed.push(index)}}
    const seen=reachable(),mainOpen=rooms.slice(0,mainCount).every(r=>seen[Math.floor(center(r).y)*size+Math.floor(center(r).x)]),secretClosed=!seen[Math.floor(center(rooms[hiddenRoom]).y)*size+Math.floor(center(rooms[hiddenRoom]).x)];
    if(mainOpen&&secretClosed){bx=point.x;by=point.y;wallTiles=removed;wallOrientation=horizontal?'R':'L';break}for(const index of removed)tiles[index]=1;
  }
  const bossRoom=bossCandidate;
  const world=(v:Vec):Vec=>({x:(v.x+.5)*TILE,y:(v.y+.5)*TILE});
  const start=world(center(rooms[0])),exit=world(center(rooms[bossRoom]));
  const chestCount=Math.max(2,Math.floor(roomCount/3)),chestRooms=[hiddenRoom,...rng.shuffle(rooms.map((_,i)=>i).filter(i=>i!==0&&i!==bossRoom&&i!==hiddenRoom))].slice(0,chestCount);
  const mechanismKinds=['spikes','flameVent','frostVent','healingShrine','urn','ancientLever'] as const;
  const mechanismRooms=rng.shuffle(rooms.map((_,i)=>i).filter(i=>i!==0&&i!==bossRoom&&i!==hiddenRoom)).slice(0,Math.min(5,2+Math.floor(floor/2)));
  const userSet=['cathedral','dungeon','catacomb','abandonedVillage','town'].includes(theme)?'user-props-1':'user-props-2';
  const userFrames:Record<string,number[]>={cathedral:[0,2,7,20],dungeon:[7,9,10,15],catacomb:[2,3,5,21],abandonedVillage:[10,11,12,18],town:[0,9,10,24],inferno:[4,10,13,14],mountain:[0,1,2,6],palace:[1,2,7,15],sewer:[8,13,14,18],frozenRuins:[0,2,6,10],swamp:[8,10,11,18],mine:[2,11,12,16],desertTemple:[0,1,2,15],abyssFortress:[2,4,7,16],cave:[6,8,10,18]};
  const props:EnvironmentProp[]=[];let propId=0;
  rooms.forEach((room,roomIndex)=>{
    if(roomIndex===hiddenRoom)return;
    // Rendering and collision share these ground anchors. Door axes and the
    // central combat area remain clear, while heavy scenery hugs room edges.
    const edge=2.35,corners:[[number,number],[number,number],[number,number],[number,number]]=[[edge,edge],[room.w-edge,edge],[edge,room.h-edge],[room.w-edge,room.h-edge]];
    for(const [dx,dy] of corners){const p=world({x:room.x+dx,y:room.y+dy});props.push({id:propId++,room:roomIndex,...p,kind:'pillar',frame:12,height:126,radius:22,solid:true});}
    const decor=room.type==='sanctum'?[THEMES[theme].props[0],6]:room.type==='treasury'?[5,THEMES[theme].props[1]??1]:room.type==='altar'?[4,THEMES[theme].props[0]]:THEMES[theme].props.slice(0,2);
    [3.7,room.w-3.7].forEach((dx,n)=>{const p=world({x:room.x+dx,y:room.y+3.2});props.push({id:propId++,room:roomIndex,...p,kind:'theme',frame:decor[n]??decor[0],height:n?105:130,radius:n?17:22,solid:true});});
    const landmark=world({x:room.x+room.w*.5,y:room.y+room.h-2.8});props.push({id:propId++,room:roomIndex,...landmark,kind:'user',frame:rng.pick(userFrames[theme]??[0]),height:room.type==='sanctum'?125:88,radius:room.type==='sanctum'?24:17,solid:true,atlas:userSet as EnvironmentProp['atlas']});
    if(['cathedral','catacomb','dungeon'].includes(theme)&&room.w>=16)for(let j=-1;j<=1;j++){const p=world({x:room.x+room.w*.5+j*2.2,y:room.y+2.35});props.push({id:propId++,room:roomIndex,...p,kind:'tomb',frame:15,height:52,radius:9,solid:false});}
  });
  return{size,tiles,rooms,start,exit,seed,theme,floor,bossRoom,hiddenRooms:[hiddenRoom],breakableWalls:[{...world({x:bx,y:by}),tiles:wallTiles,revealedRoom:hiddenRoom,destroyed:false,orientation:wallOrientation}],mechanisms:mechanismRooms.map((i,n)=>({...world(center(rooms[i])),x:world(center(rooms[i])).x+55,y:world(center(rooms[i])).y+35,kind:mechanismKinds[(n+floor)%mechanismKinds.length],used:false})),altar:{x:start.x+110,y:start.y-95},chests:chestRooms.map(i=>world(center(rooms[i]))),props};
}

export function walkable(map:Dungeon,x:number,y:number,radius=10):boolean{
  for(const[ox,oy]of[[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){
    const tx=Math.floor((x+ox)/TILE),ty=Math.floor((y+oy)/TILE);
    if(tx<0||ty<0||tx>=map.size||ty>=map.size||!map.tiles[ty*map.size+tx])return false;
  }
  for(const prop of map.props??[])if(prop.solid&&(x-prop.x)**2+(y-prop.y)**2<(radius+prop.radius)**2)return false;
  return true;
}
export function moveOnMap(map:Dungeon,body:Vec,dx:number,dy:number,radius=10):void{
  if(walkable(map,body.x+dx,body.y,radius))body.x+=dx;if(walkable(map,body.x,body.y+dy,radius))body.y+=dy;
}
export function buildFlow(map:Dungeon,target:Vec):Int16Array{
  const dist=new Int16Array(map.tiles.length).fill(-1),index=Math.floor(target.y/TILE)*map.size+Math.floor(target.x/TILE),queue=new Int32Array(map.tiles.length);
  let head=0,tail=1;queue[0]=index;dist[index]=0;
  while(head<tail){const i=queue[head++],x=i%map.size,candidates=[i-map.size,i+map.size];if(x>0)candidates.push(i-1);if(x<map.size-1)candidates.push(i+1);
    for(const next of candidates)if(next>=0&&next<dist.length&&map.tiles[next]&&dist[next]===-1){dist[next]=dist[i]+1;queue[tail++]=next}}
  return dist;
}

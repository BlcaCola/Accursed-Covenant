import { Random } from './random';
import type { Dungeon, EnvironmentProp, Room, ThemeId, Vec } from './types';
import {roomIdentity,THEME_DESIGNS} from './themeDesigns';
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
  const mine=theme==='mine',rng=new Random(seed),size=mine?138:122,tiles=new Uint8Array(size*size),grid=4,cell=mine?27:24,margin=3;
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
    const boss=i===bossCandidate,w=i===0?(mine?22:20):boss?(floor===CAMPAIGN_FLOORS?30:mine?27:24):rng.int(mine?20:14,mine?24:20),h=i===0?(mine?22:20):boss?(floor===CAMPAIGN_FLOORS?30:mine?27:24):rng.int(mine?20:14,mine?24:20),jx=rng.int(0,Math.max(0,cell-w-1)),jy=rng.int(0,Math.max(0,cell-h-1));
    const type=i===0?'entry':boss?'sanctum':roomTypes[(i-1)%roomTypes.length];
    return{x:margin+c.x*cell+jx,y:margin+c.y*cell+jy,w,h,type,archetype:roomIdentity(theme,type,i).archetype};
  });
  // Keep the secret treasury beyond the southern generation grid. Main-route
  // corridors can never accidentally carve through it before its wall opens.
  const secretSize=mine?20:18;
  rooms.push({x:rng.int(10,size-secretSize-29),y:size-secretSize-3,w:secretSize,h:secretSize,type:'treasury',archetype:THEME_DESIGNS[theme].secretArchetype});
  const center=(r:Room):Vec=>({x:Math.floor(r.x+r.w/2),y:Math.floor(r.y+r.h/2)});
  const carve=(x:number,y:number)=>{if(x>1&&y>1&&x<size-2&&y<size-2)tiles[y*size+x]=1};
  // Every room owns one complete rectangular floor footprint. Theme identity
  // now comes from tiles, props, hazards and encounters instead of cutting
  // holes out of the playable room, which also makes combat navigation stable.
  for(const r of rooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)carve(x,y);
  // The final room is a sealed side room. Main progression is always connected;
  // the side room becomes reachable only after its cracked wall is destroyed.
  const hiddenRoom=rooms.length-1,mainCount=rooms.length-1;
  // Build the playable network without the boss room, then attach the boss as
  // one final leaf. A sealed boss arena can therefore never cut the player off
  // from an uncleared combat room.
  const routeRooms=Array.from({length:mainCount},(_,index)=>index).filter(index=>index!==bossCandidate);
  const edges:Array<[number,number]>=[],connected=new Set([0]);
  while(connected.size<routeRooms.length){let best:[number,number]=[0,routeRooms.find(index=>index!==0)!],score=Infinity;
    for(const a of connected)for(const b of routeRooms)if(!connected.has(b)){
      const ca=center(rooms[a]),cb=center(rooms[b]),d=Math.abs(ca.x-cb.x)+Math.abs(ca.y-cb.y)+rng.next()*3;
      if(d<score){score=d;best=[a,b]}
    }edges.push(best);connected.add(best[1]);
  }
  const existing=(a:number,b:number)=>edges.some(e=>(e[0]===a&&e[1]===b)||(e[0]===b&&e[1]===a));
  for(let i=0;i<Math.min(1+Math.floor(floor/2),4);i++){
    const a=rng.pick(routeRooms),b=rng.pick(routeRooms);if(a!==b&&!existing(a,b))edges.push([a,b]);
  }
  let bossParent=routeRooms[0],bossParentDistance=Infinity;for(const index of routeRooms){const a=center(rooms[index]),b=center(rooms[bossCandidate]),distance=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(distance<bossParentDistance){bossParent=index;bossParentDistance=distance}}
  edges.push([bossParent,bossCandidate]);
  let hiddenParent=0,hiddenDistance=Infinity;for(let i=0;i<mainCount;i++){const a=center(rooms[i]),b=center(rooms[hiddenRoom]),d=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(d<hiddenDistance){hiddenDistance=d;hiddenParent=i}}
  const corridorRadius=['cave','sewer','mine'].includes(theme)?1:2;
  const connect=(a:Room,b:Room,avoid?:Room)=>{
    const from=center(a),to=center(b),path:Vec[]=[];
    if(avoid){
      // Find a short tile route around the sealed arena. The avoidance margin
      // includes corridor width, so carving cannot nick a second boss doorway.
      const previous=new Int32Array(size*size).fill(-2),queue=new Int32Array(size*size),start=from.y*size+from.x,target=to.y*size+to.x;let head=0,tail=1;queue[0]=start;previous[start]=-1;
      const blocked=(x:number,y:number)=>x>=avoid.x-corridorRadius&&x<avoid.x+avoid.w+corridorRadius&&y>=avoid.y-corridorRadius&&y<avoid.y+avoid.h+corridorRadius;
      while(head<tail&&previous[target]===-2){const index=queue[head++],x=index%size,y=Math.floor(index/size);for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(nx<=1||ny<=1||nx>=size-2||ny>=size-2||blocked(nx,ny))continue;const next=ny*size+nx;if(previous[next]!==-2)continue;previous[next]=index;queue[tail++]=next;}}
      if(previous[target]!==-2){for(let index=target;index!==-1;index=previous[index])path.push({x:index%size,y:Math.floor(index/size)});path.reverse();}
    }
    if(!path.length){let{x,y}=from;const horizontalFirst=rng.next()<.5;const stepX=()=>{path.push({x,y});x+=Math.sign(to.x-x)},stepY=()=>{path.push({x,y});y+=Math.sign(to.y-y)};if(horizontalFirst){while(x!==to.x)stepX();while(y!==to.y)stepY()}else{while(y!==to.y)stepY();while(x!==to.x)stepX()}path.push({x,y});}
    for(const point of path)for(let ox=-corridorRadius;ox<=corridorRadius;ox++)for(let oy=-corridorRadius;oy<=corridorRadius;oy++)carve(point.x+ox,point.y+oy);return path;
  };
  for(const[a,b]of edges)connect(rooms[a],rooms[b],a===bossCandidate||b===bossCandidate?undefined:rooms[bossCandidate]);
  // More late-game route rooms create more corridors. Clear a two-tile moat
  // around the secret after all main corridors are carved, then rebuild the
  // treasury and its single controlled approach. This guarantees that a
  // random loop can never bypass the breakable wall.
  const secretRoom=rooms[hiddenRoom];for(let y=secretRoom.y-2;y<=secretRoom.y+secretRoom.h+1;y++)for(let x=secretRoom.x-2;x<=secretRoom.x+secretRoom.w+1;x++)if(x>0&&y>0&&x<size-1&&y<size-1)tiles[y*size+x]=0;
  for(let y=secretRoom.y;y<secretRoom.y+secretRoom.h;y++)for(let x=secretRoom.x;x<secretRoom.x+secretRoom.w;x++)carve(x,y);
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
  const chestCount=Math.max(3,Math.ceil(roomCount/2)),chestRooms=[hiddenRoom,...rng.shuffle(rooms.map((_,i)=>i).filter(i=>i!==0&&i!==bossRoom&&i!==hiddenRoom))].slice(0,chestCount);
  const mechanismKinds=['spikes','flameVent','frostVent','healingShrine','urn','ancientLever'] as const;
  const mechanismRooms=rng.shuffle(rooms.map((_,i)=>i).filter(i=>i!==0&&i!==bossRoom&&i!==hiddenRoom)).slice(0,Math.min(5,2+Math.floor(floor/2)));
  const userSet=['cathedral','dungeon','catacomb','abandonedVillage','town'].includes(theme)?'user-props-1':'user-props-2';
  const userFrames:Record<string,number[]>={cathedral:[0,2,7,20],dungeon:[7,9,10,15],catacomb:[2,3,5],abandonedVillage:[10,11,12,18],town:[0,9,10,24],inferno:[4,10,13,14],mountain:[0,1,2,6],palace:[1,2,7,15],sewer:[8,13,14,18],frozenRuins:[0,2,6,10],swamp:[8,10,11,18],mine:[2,11,12,16],desertTemple:[0,1,2,15],abyssFortress:[2,4,7,16],cave:[6,8,10,18]};
  const props:EnvironmentProp[]=[];let propId=0;
  rooms.forEach((room,roomIndex)=>{
    if(roomIndex===hiddenRoom)return;
    // Rendering and collision share these ground anchors. Door axes and the
    // central combat area remain clear, while heavy scenery hugs room edges.
    const edge=2.35,corners:[[number,number],[number,number],[number,number],[number,number]]=[[edge,edge],[room.w-edge,edge],[edge,room.h-edge],[room.w-edge,room.h-edge]];
    for(const [dx,dy] of corners){const p=world({x:room.x+dx,y:room.y+dy});props.push({id:propId++,room:roomIndex,...p,kind:'pillar',frame:12,height:126,radius:22,solid:true});}
    const decor=room.type==='sanctum'?[THEMES[theme].props[0],6]:room.type==='treasury'?[THEMES[theme].props[0],THEMES[theme].props[1]??1]:room.type==='altar'?[4,THEMES[theme].props[0]]:THEMES[theme].props.slice(0,2);
    [3.7,room.w-3.7].forEach((dx,n)=>{const p=world({x:room.x+dx,y:room.y+3.2});props.push({id:propId++,room:roomIndex,...p,kind:'theme',frame:decor[n]??decor[0],height:n?105:130,radius:n?17:22,solid:true});});
    const landmark=world({x:room.x+room.w*.5,y:room.y+room.h-2.8});props.push({id:propId++,room:roomIndex,...landmark,kind:'user',frame:rng.pick(userFrames[theme]??[0]),height:room.type==='sanctum'?125:88,radius:room.type==='sanctum'?24:17,solid:true,atlas:userSet as EnvironmentProp['atlas']});
    if(['cathedral','catacomb','dungeon'].includes(theme)&&room.w>=16)for(let j=-1;j<=1;j++){const p=world({x:room.x+room.w*.5+j*2.2,y:room.y+2.35});props.push({id:propId++,room:roomIndex,...p,kind:'tomb',frame:15,height:52,radius:9,solid:false});}
  });
  return{size,tiles,rooms,start,exit,seed,theme,floor,bossRoom,hiddenRooms:[hiddenRoom],breakableWalls:[{...world({x:bx,y:by}),tiles:wallTiles,revealedRoom:hiddenRoom,destroyed:false,orientation:wallOrientation}],mechanisms:mechanismRooms.map((i,n)=>({...world(center(rooms[i])),x:world(center(rooms[i])).x+55,y:world(center(rooms[i])).y+35,kind:mechanismKinds[(n+floor)%mechanismKinds.length],used:false})),altar:{x:start.x+110,y:start.y-95},chests:chestRooms.map((i,n)=>({...world(center(rooms[i])),reward:n===0||n%2===0?'gear':'gold',gold:rng.int(18,45)+floor*4})),props};
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

/**
 * Finds the shortest player-sized route over the same geometry used by
 * moveOnMap. Diagonal steps cannot cut between two blocked cardinal tiles.
 * If the requested point is blocked or disconnected, the route ends at the
 * reachable tile centre nearest to that point.
 */
export function findWalkPath(map:Dungeon,start:Vec,target:Vec,radius=10,allowed:(x:number,y:number)=>boolean=()=>true):Vec[]{
  const size=map.size,count=map.tiles.length,inside=(x:number,y:number)=>x>=0&&y>=0&&x<size&&y<size;
  const center=(index:number):Vec=>({x:(index%size+.5)*TILE,y:(Math.floor(index/size)+.5)*TILE});
  const passability=new Int8Array(count);passability.fill(-1);
  const passable=(x:number,y:number)=>{if(!inside(x,y))return false;const index=y*size+x;if(passability[index]<0)passability[index]=Number(allowed(x,y)&&walkable(map,(x+.5)*TILE,(y+.5)*TILE,radius));return passability[index]===1;};
  const sx=Math.max(0,Math.min(size-1,Math.floor(start.x/TILE))),sy=Math.max(0,Math.min(size-1,Math.floor(start.y/TILE))),startIndex=sy*size+sx;
  const tx=Math.max(0,Math.min(size-1,Math.floor(target.x/TILE))),ty=Math.max(0,Math.min(size-1,Math.floor(target.y/TILE))),targetIndex=ty*size+tx,targetExact=allowed(tx,ty)&&walkable(map,target.x,target.y,radius);
  const costs=new Float32Array(count);costs.fill(Infinity);costs[startIndex]=0;
  const previous=new Int32Array(count);previous.fill(-1);const closed=new Uint8Array(count),heap:number[]=[];
  const swap=(a:number,b:number)=>{const value=heap[a];heap[a]=heap[b];heap[b]=value;};
  const push=(index:number)=>{heap.push(index);let child=heap.length-1;while(child>0){const parent=(child-1)>>1;if(costs[heap[parent]]<=costs[heap[child]])break;swap(parent,child);child=parent;}};
  const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let parent=0;while(true){const left=parent*2+1,right=left+1;let child=parent;if(left<heap.length&&costs[heap[left]]<costs[heap[child]])child=left;if(right<heap.length&&costs[heap[right]]<costs[heap[child]])child=right;if(child===parent)break;swap(parent,child);parent=child;}}return first;};
  push(startIndex);let best=startIndex,bestDistance=Infinity,reached=false;
  const directions=[[-1,0,10],[1,0,10],[0,-1,10],[0,1,10],[-1,-1,14],[1,-1,14],[-1,1,14],[1,1,14]] as const;
  while(heap.length){const index=pop();if(closed[index])continue;closed[index]=1;const x=index%size,y=Math.floor(index/size),point=center(index),targetDistance=(point.x-target.x)**2+(point.y-target.y)**2;
    if(targetDistance<bestDistance||(targetDistance===bestDistance&&costs[index]<costs[best])){best=index;bestDistance=targetDistance;}
    if(index===targetIndex&&targetExact){best=index;reached=true;break;}
    for(const[dx,dy,step]of directions){const nx=x+dx,ny=y+dy;if(!passable(nx,ny))continue;if(dx&&dy&&(!passable(x+dx,y)||!passable(x,y+dy)))continue;const next=ny*size+nx,nextCost=costs[index]+step;if(nextCost>=costs[next])continue;costs[next]=nextCost;previous[next]=index;push(next);}
  }
  if(best===startIndex)return reached?[target]:[];
  const indexes:number[]=[];for(let index=best;index!==startIndex&&index>=0;index=previous[index])indexes.push(index);indexes.reverse();
  const path=indexes.map(center);if(reached)path[path.length-1]=target;return path;
}

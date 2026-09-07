import {FINAL_BOSSES,MONSTER_DEFINITIONS,THEME_BOSSES,type MonsterProfile} from './bestiary';
import {TILE} from './dungeon';
import type {Dungeon,Room,ShowcaseRoom,Vec} from './types';

const bossProfiles=[...new Map(Object.values(THEME_BOSSES).flat().map(profile=>[profile.artId,profile])).values(),...FINAL_BOSSES];
export const SHOWCASE_PROFILES:Record<string,MonsterProfile>=Object.fromEntries([...Object.values(MONSTER_DEFINITIONS),...bossProfiles].map(profile=>[profile.artId!,profile]));

/** A single straight trunk with spaced one-room twigs on its north side. */
export function generateShowcaseDungeon(seed:number):Dungeon{
  const profiles=Object.values(SHOWCASE_PROFILES),roomSize=22,pitch=30,hallY=33,lastX=10+(profiles.length-1)*pitch;
  const size=lastX+roomSize+8,tiles=new Uint8Array(size*size),rooms:Room[]=[{x:2,y:27,w:10,h:14,type:'entry',archetype:'showcase-entry'}],showcaseRooms:ShowcaseRoom[]=[];
  const carve=(x:number,y:number)=>{if(x>0&&y>0&&x<size-1&&y<size-1)tiles[y*size+x]=1;};
  for(let y=27;y<41;y++)for(let x=2;x<12;x++)carve(x,y);
  for(let y=hallY;y<hallY+4;y++)for(let x=8;x<=lastX+roomSize/2;x++)carve(x,y);
  profiles.forEach((profile,index)=>{
    const x=10+index*pitch,y=4,roomIndex=rooms.length;
    const room:Room={x,y,w:roomSize,h:roomSize,type:profile.rank==='boss'?'sanctum':'crypt',archetype:`showcase-${profile.artId}`};rooms.push(room);
    for(let ry=y;ry<y+roomSize;ry++)for(let rx=x;rx<x+roomSize;rx++)carve(rx,ry);
    const doorX=x+Math.floor(roomSize/2);for(let ry=y+roomSize;ry<=hallY;ry++)for(let rx=doorX-1;rx<=doorX+1;rx++)carve(rx,ry);
    showcaseRooms.push({room:roomIndex,profileId:profile.artId!,label:profile.name,boss:profile.rank==='boss'});
  });
  const world=(v:Vec):Vec=>({x:(v.x+.5)*TILE,y:(v.y+.5)*TILE}),start=world({x:7,y:34});
  return{size,tiles,rooms,start,exit:{x:start.x+115,y:start.y},altar:{x:start.x-105,y:start.y-40},chests:[],seed,theme:'abyssFortress',floor:0,bossRoom:-1,hiddenRooms:[],breakableWalls:[],mechanisms:[],props:[],showcase:true,showcaseRooms};
}

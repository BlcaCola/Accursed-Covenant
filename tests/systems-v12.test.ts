import {describe,expect,it} from 'vitest';
import {generateDungeon,TILE} from '../src/core/dungeon';
import {freshSession,Run} from '../src/core/run';
import {SHOWCASE_PROFILES} from '../src/core/showcase';
import {TALENT_TREES,talentTreeCost} from '../src/core/talents';

const idle={x:0,y:0,dash:false,burst:false,potion:false,interact:false};

describe('expanded progression, arenas and monster gallery',()=>{
  it('gives every character three six-node branches with an eight-to-ten-run price target',()=>{
    for(const [character,nodes] of Object.entries(TALENT_TREES)){
      expect(nodes).toHaveLength(18);
      for(const branch of ['offense','mastery','survival'])expect(nodes.filter(node=>node.branch===branch)).toHaveLength(6);
      expect(talentTreeCost(character as keyof typeof TALENT_TREES)).toBeGreaterThanOrEqual(30000);
      expect(talentTreeCost(character as keyof typeof TALENT_TREES)).toBeLessThanOrEqual(35000);
    }
  });

  it('uses large combat rooms and a substantially larger final arena',()=>{
    const first=generateDungeon(91,15,'cathedral',1),last=generateDungeon(91,15,'abyssFortress',8);
    expect(first.rooms.filter((_,index)=>index!==first.bossRoom&&!first.hiddenRooms.includes(index)).slice(1).every(room=>room.w>=14&&room.h>=14)).toBe(true);
    expect(first.rooms[first.bossRoom].w).toBe(24);expect(first.rooms[first.bossRoom].h).toBe(24);
    expect(last.rooms[last.bossRoom].w).toBe(30);expect(last.rooms[last.bossRoom].h).toBe(30);
    const finalRoom=last.rooms[last.bossRoom];
    expect(Array.from({length:finalRoom.h},(_,dy)=>Array.from({length:finalRoom.w},(_,dx)=>last.tiles[(finalRoom.y+dy)*last.size+finalRoom.x+dx])).flat().every(Boolean)).toBe(true);
  });

  it('unlocks the gallery only with its code and keeps specimens reward-free and renewable',()=>{
    const run=new Run(132,'sorceress',freshSession());run.skills.length=0;run.phase='merchant';
    expect(run.unlockShowcase('000000')).toBe(false);expect(run.unlockShowcase('132584')).toBe(true);run.phase='playing';run.enterShowcase();
    expect(run.showcaseMode).toBe(true);expect(run.dungeon.showcaseRooms).toHaveLength(Object.keys(SHOWCASE_PROFILES).length);
    const galleryRooms=run.dungeon.showcaseRooms!.map(specimen=>run.dungeon.rooms[specimen.room]);
    expect(galleryRooms.every(room=>room.w===22&&room.h===22)).toBe(true);
    expect(galleryRooms.every((room,index)=>galleryRooms.every((other,otherIndex)=>index===otherIndex||room.x+room.w<=other.x||other.x+other.w<=room.x||room.y+room.h<=other.y||other.y+other.h<=room.y))).toBe(true);
    expect(new Set(galleryRooms.map(room=>room.y))).toEqual(new Set([4]));
    expect(galleryRooms.slice(1).every((room,index)=>room.x-(galleryRooms[index].x+galleryRooms[index].w)>=8)).toBe(true);
    const specimen=run.dungeon.showcaseRooms![0],room=run.dungeon.rooms[specimen.room];Object.assign(run.player,{x:(room.x+room.w/2)*TILE,y:(room.y+room.h+2)*TILE,invulnerable:999});run.update(1/60,idle);
    const enemy=run.enemies.find(value=>value.showcaseRoom===specimen.room);expect(enemy).toBeTruthy();run.hit(enemy!,999999);expect(run.loot).toHaveLength(0);run.update(1/60,idle);expect(run.enemies.some(value=>value.showcaseRoom===specimen.room&&value.hp>0)).toBe(true);
    run.player.invulnerable=0;run.hurt(999999,'测试');expect(run.phase).toBe('playing');expect(run.player.x).toBe(run.dungeon.start.x);
    Object.assign(run.player,run.showcasePortalPosition);run.interact();expect(run.showcaseMode).toBe(false);expect(run.phase).toBe('playing');run.update(1/60,idle);expect(run.floor).toBe(1);
  });
});

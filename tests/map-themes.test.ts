import {describe,expect,it} from 'vitest';
import {buildFlow,generateDungeon,TILE,walkable} from '../src/core/dungeon';
import {THEME_DESIGNS,THEME_RELICS,roomIdentity} from '../src/core/themeDesigns';
import {THEME_IDS} from '../src/core/themes';
import {THEME_ROSTERS} from '../src/core/bestiary';
import {freshSession,idleInput,Run} from '../src/core/run';

describe('fifteen complete map directions',()=>{
  it('gives every theme a unique layout, motif, hazard and complete room language',()=>{
    expect(new Set(THEME_IDS.map(id=>THEME_DESIGNS[id].layout)).size).toBe(15);
    expect(new Set(THEME_IDS.map(id=>THEME_DESIGNS[id].motif)).size).toBe(15);
    expect(new Set(THEME_IDS.map(id=>THEME_DESIGNS[id].hazard)).size).toBe(15);
    expect(new Set(THEME_IDS.flatMap(id=>[...THEME_RELICS[id]])).size).toBe(30);
    for(const id of THEME_IDS){
      const design=THEME_DESIGNS[id];expect(design.formations).toHaveLength(3);expect(new Set(design.formations.map(value=>value.name)).size).toBe(3);
      for(const formation of design.formations){expect(formation.units.length).toBeGreaterThanOrEqual(3);expect(Math.max(...formation.units)).toBeLessThan(THEME_ROSTERS[id].length);}
      for(const type of ['entry','crypt','altar','treasury','sanctum'] as const){expect(roomIdentity(id,type,0).name.length).toBeGreaterThan(2);expect(design.archetypes[type].length).toBeGreaterThan(0);}
    }
  });
  it('guarantees a named relic from every map guardian',()=>{
    for(const [index,theme] of THEME_IDS.entries()){
      const run=new Run(90000+index,'sorceress',freshSession(),theme);run.roomEncounters.filter(value=>value.key).forEach(value=>value.state='cleared');Object.assign(run.player,run.dungeon.exit);run.update(1/60,idleInput());expect(run.floorGuardian).toBeDefined();run.hit(run.floorGuardian!,999999);
      const relic=run.loot.find(drop=>drop.item?.originTheme===theme)?.item;expect(relic?.name).toBe(THEME_RELICS[theme][(run.seed+run.floor)%2]);
    }
  });
  it('keeps every authored room center and main route reachable across all themes',()=>{
    for(const [themeIndex,theme] of THEME_IDS.entries())for(let sample=0;sample<8;sample++){
      const map=generateDungeon(70000+themeIndex*101+sample,15,theme,8),flow=buildFlow(map,map.start);expect(map.rooms).toHaveLength(16);
      expect(new Set(map.rooms.map(room=>room.archetype)).size).toBeGreaterThanOrEqual(4);
      for(const [index,room] of map.rooms.entries()){
        const point={x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2)*TILE};expect(walkable(map,point.x,point.y),`${theme}:${index}`).toBe(true);
        if(!map.hiddenRooms.includes(index))expect(flow[Math.floor(point.y/TILE)*map.size+Math.floor(point.x/TILE)],`${theme}:${index}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('spawns the configured room formation and preserves an eighteen-second entrance grace period',()=>{
    for(const [index,theme] of THEME_IDS.entries()){
      const run=new Run(80000+index,'sorceress',freshSession(),theme),roomIndex=run.dungeon.rooms.findIndex((_room,i)=>i>0&&i!==run.dungeon.bossRoom&&!run.dungeon.hiddenRooms.includes(i));
      const formation=(run as any).spawnThemeFormation(4,roomIndex);expect(formation).toHaveLength(4);expect(THEME_ROSTERS[theme]).toContain(formation[0].artId);
      run.enemies=[];for(let step=0;step<600;step++)run.update(1/60,idleInput());expect(run.enemies,theme).toHaveLength(0);
      (run as any).themeTimer=0;(run as any).updateThemeMechanic(1/60);expect(run.messages.at(-1)?.text).toContain(THEME_DESIGNS[theme].hazardName);
    }
  });
});

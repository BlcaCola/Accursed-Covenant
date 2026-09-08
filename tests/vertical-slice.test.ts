import {describe,expect,it} from 'vitest';
import {generateDungeon,TILE,walkable} from '../src/core/dungeon';
import {freshSession,idleInput,Run} from '../src/core/run';

describe('Demo 0.10 cathedral vertical slice',()=>{
  it('builds named rectangular cathedral rooms while preserving their centers',()=>{
    const map=generateDungeon(41010,11,'cathedral',5);
    expect(map.rooms.every(room=>room.archetype)).toBe(true);
    expect(map.rooms[0].archetype).toBe('narthex');
    expect(map.rooms[map.bossRoom].archetype).toBe('choir');
    expect(new Set(map.rooms.map(room=>room.archetype)).size).toBeGreaterThanOrEqual(5);
    for(const room of map.rooms){
      const center={x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2)*TILE};expect(walkable(map,center.x,center.y),room.archetype).toBe(true);
      for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++)expect(map.tiles[y*map.size+x],`${room.archetype} ${x},${y}`).toBe(1);
    }
  });
  it('uses the same grounded prop anchors for rendering clearance and collision',()=>{
    const map=generateDungeon(41010,11,'cathedral',5),solid=map.props.find(prop=>prop.solid)!;
    expect(map.props.length).toBeGreaterThan(map.rooms.length*5);
    expect(walkable(map,solid.x,solid.y,10)).toBe(false);
    for(const room of map.rooms.slice(0,-1)){const center={x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2)*TILE};expect(walkable(map,center.x,center.y,10)).toBe(true);}
  });
  it('spawns an authored shield-line formation inside a discovered chapel',()=>{
    const run=new Run(41010,'sorceress',freshSession());run.dungeon=generateDungeon(41010,15,'cathedral',8);
    const roomIndex=run.dungeon.rooms.findIndex((room,index)=>index>0&&index!==run.dungeon.bossRoom&&room.archetype==='chapel');
    expect(roomIndex).toBeGreaterThan(0);
    const formation=(run as any).spawnThemeFormation(5,roomIndex);
    expect(formation).toHaveLength(5);expect(formation[0].artId).toBe('skeleton-guardian');
    const room=run.dungeon.rooms[roomIndex];for(const enemy of formation)expect(enemy.x).toBeGreaterThanOrEqual(room.x*TILE);
  });
});

describe('combat feedback telemetry',()=>{
  it('classifies critical/lethal hits and records dealt and received damage',()=>{
    const run=new Run(88,'sorceress',freshSession()),enemy=run.spawnEnemy('zombie')!;enemy.hp=enemy.maxHp=1;enemy.armor=0;
    run.hit(enemy,100,0xffffff);const hit=run.events.find(event=>event.type==='hit');
    expect(hit?.lethal).toBe(true);expect(hit?.impact).toBeGreaterThan(.5);expect(run.telemetry.damageDealt).toBeGreaterThan(0);expect(run.telemetry.kills).toBe(1);
    run.player.invulnerable=0;run.hurt(20,'验收攻击');
    expect(run.events.some(event=>event.type==='playerHit')).toBe(true);expect(run.telemetry.damageTaken).toBeGreaterThan(0);
    run.update(1/60,idleInput());expect(run.corpses[0].blood).toBeDefined();
  });
  it('labels blocked hits, healing and ailments for distinct combat readouts',()=>{
    const run=new Run(89,'bloodknight',freshSession());run.events=[];run.player.invulnerable=0;run.player.shield=100;run.hurt(20,'盾击测试');expect(run.events.at(-1)).toMatchObject({type:'playerHit',blocked:true,label:'格挡',amount:0});
    (run as any).applyPlayerStatus('poison',4,2,'毒雾测试');expect(run.events.at(-1)).toMatchObject({type:'status',label:'中毒'});
    run.player.hp=run.stats.maxHp-80;run.player.potionCooldown=0;run.drinkPotion();expect(run.events.at(-1)?.type).toBe('heal');expect(run.events.at(-1)?.label).toMatch(/^\+/);
  });
  it('runs a readable three-phase boss cast that a heavy hit can interrupt',()=>{
    const run=new Run(91,'sorceress',freshSession()),boss=run.spawnEnemy('boss',true)!;run.skills.length=0;boss.armor=0;boss.hp=boss.maxHp*.3;
    run.update(1/60,idleInput());expect(run.bossPhase).toBe(3);
    for(let i=0;i<80;i++)run.update(1/60,idleInput());expect(run.bossCast).not.toBeNull();
    run.hit(boss,boss.maxHp*.03,0xffffff,false,'打断测试');
    expect(run.bossCast).toBeNull();expect(run.events.some(event=>event.type==='interrupt')).toBe(true);expect(run.telemetry.bySource['打断测试']).toBeGreaterThan(0);
  });
  it('quick-picks only nearby equipment accepted by the active filter',()=>{
    const run=new Run(92,'sorceress',freshSession()),item={id:880,name:'测试稀有剑',slot:'weapon' as const,rarity:'rare' as const,power:5,damage:3,health:0,haste:0,crit:0,description:'测试'};
    run.loot.push({id:881,x:run.player.x+80,y:run.player.y,item,xp:0,gold:0,age:1});run.setLootFilter('epic');expect(run.pickupNearestItem()).toBe(false);
    run.setLootFilter('rare');expect(run.pickupNearestItem()).toBe(true);expect(run.inventory.some(value=>value.id===item.id)).toBe(true);
  });
});

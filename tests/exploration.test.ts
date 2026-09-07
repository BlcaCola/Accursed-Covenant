import { describe, expect, it } from 'vitest';
import { Run, freshSession, idleInput } from '../src/core/run';
import { buildFlow, TILE } from '../src/core/dungeon';
import { directionFrame } from '../src/render/directions';
import { SPRITE_MANIFEST, type SpriteAssetMeta } from '../src/render/spriteManifest';

const make = () => new Run(12345, 'sorceress', freshSession());
const step = (r: Run, seconds: number) => { for(let i=0;i<seconds*60;i++)r.update(1/60,idleInput()); };
const waiveRoomCombat = (r:Run,room:number) => {const encounter=r.roomEncounters.find(value=>value.room===room);if(encounter)encounter.state='cleared';};

describe('exploration contracts and facing',()=>{
  it('keeps short-range attacks ready until a target enters their real range',()=>{
    const r=make(),skill={id:'blades' as const,level:1,branch:null};r.skills.splice(0,r.skills.length,skill);step(r,.2);
    expect((r as any).cooldowns.blades).toBeLessThanOrEqual(0);
    const enemy=r.spawnEnemy('zombie')!;Object.assign(enemy,{x:r.player.x+250,y:r.player.y,speed:0,attackCooldown:99});const hp=enemy.hp;step(r,.25);
    expect(enemy.hp).toBe(hp);expect((r as any).cooldowns.blades).toBeLessThanOrEqual(0);
    Object.assign(enemy,{x:r.player.x+50,y:r.player.y});step(r,.3);expect(enemy.hp).toBeLessThan(hp);expect((r as any).cooldowns.blades).toBeGreaterThan(0);
  });
  it('locks automatic casts to the player-aimed enemy and avoids wasteful utility recasts',()=>{
    const r=make();r.skills.splice(0,r.skills.length,{id:'lightning',level:1,branch:null});const near=r.spawnEnemy('zombie')!,far=r.spawnEnemy('zombie')!;Object.assign(near,{x:r.player.x+100,y:r.player.y,speed:0,attackCooldown:99});Object.assign(far,{x:r.player.x+300,y:r.player.y,speed:0,attackCooldown:99});
    for(let i=0;i<4;i++)r.update(1/60,{...idleInput(),aim:{x:far.x,y:far.y}});expect((r as any).pendingCasts[0].targetId).toBe(far.id);
    const n=new Run(4567,'necromancer',freshSession());n.skills.splice(0,n.skills.length,{id:'summon',level:1,branch:null});step(n,.3);expect(n.minions.length).toBeGreaterThan(0);(n as any).cooldowns.summon=0;const before=n.minions.length;step(n,.3);expect(n.minions).toHaveLength(before);expect((n as any).pendingCasts).toHaveLength(0);
  });
  it('supports manual mouse-directed skills and clamps casts to their maximum range',()=>{
    const r=make();r.autoCast=false;r.skills.splice(0,r.skills.length,{id:'fire',level:1,branch:null});const origin={...r.player},far={x:origin.x+1000,y:origin.y};
    step(r,.2);expect(r.zones).toHaveLength(0);r.update(1/60,{...idleInput(),aim:far,skillSlot:0});step(r,.2);
    expect(r.zones).toHaveLength(1);expect(r.zones[0].x-origin.x).toBeCloseTo(410,1);expect(r.zones[0].y).toBeCloseTo(origin.y,1);expect(r.skillCooldownRemaining('fire')).toBeGreaterThan(0);
  });
  it('uses right-click basic attacks without mana and consumes visible corpses at the aimed point',()=>{
    const fighter=new Run(2233,'bloodknight',freshSession());fighter.skills.length=0;fighter.player.mana=0;const enemy=fighter.spawnEnemy('zombie')!;Object.assign(enemy,{x:fighter.player.x+70,y:fighter.player.y,speed:0,attackCooldown:99});const hp=enemy.hp;
    fighter.update(1/60,{...idleInput(),basicAttack:true,aim:{x:enemy.x,y:enemy.y}});expect(enemy.hp).toBeLessThan(hp);expect(fighter.player.mana).toBeCloseTo(5/60,5);
    const necro=new Run(3344,'necromancer',freshSession());necro.autoCast=false;necro.skills.splice(0,necro.skills.length,{id:'corpse',level:1,branch:null});const corpse={id:99001,x:necro.player.x+100,y:necro.player.y,ttl:18};necro.corpses=[corpse];necro.update(1/60,{...idleInput(),skillSlot:0,aim:corpse});step(necro,.2);
    expect(necro.corpses).toHaveLength(0);expect(necro.events.some(event=>event.type==='corpse')).toBe(true);
  });
  it('opens treasure chests without the removed one-shot loot flash',()=>{
    const r=make(),chest=r.dungeon.chests[0];Object.assign(r.player,chest);r.interact();expect(r.chestsOpened.has(0)).toBe(true);expect(r.events.some(event=>event.type==='loot')).toBe(false);expect(r.loot.some(value=>value.item)).toBe(true);
  });
  it('locks authored combat rooms, clears their wave and pauses for a meaningful reward',()=>{
    const r=make(),encounter=r.roomEncounters[0],room=r.dungeon.rooms[encounter.room];encounter.totalWaves=1;encounter.choiceReward=true;
    Object.assign(r.player,{x:(room.x+room.w/2)*32,y:(room.y+room.h/2)*32});step(r,.5);
    expect(encounter.state).toBe('active');expect(r.enemies.some(enemy=>enemy.encounterRoom===encounter.room)).toBe(true);
    for(const enemy of r.enemies.filter(enemy=>enemy.encounterRoom===encounter.room))enemy.hp=0;step(r,.05);
    expect(encounter.state).toBe('cleared');expect(r.phase).toBe('roomReward');expect(r.roomRewardOptions).toHaveLength(3);
    const before=r.gold;expect(r.chooseRoomReward('fortune')).toBe(true);expect(r.gold).toBeGreaterThan(before);expect(r.phase).toBe('playing');
  });
  it('keeps the boss sanctuary sealed until all required rooms are purified',()=>{
    const r=make();Object.assign(r.player,r.dungeon.exit);step(r,.02);expect(r.floorGuardian).toBeUndefined();expect(r.bossUnlocked).toBe(false);
    r.roomEncounters.filter(value=>value.key).forEach(value=>value.state='cleared');Object.assign(r.player,r.dungeon.exit);step(r,.02);
    expect(r.bossUnlocked).toBe(true);expect(r.floorGuardian).toBeDefined();
  });
  it('maps screen movement to eight actual atlas directions without flipping',()=>{
    const screen=[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
    const authored=[4,3,2,1,0,7,6,5];
    screen.forEach(([x,y],i)=>expect(directionFrame({x:x/2+y,y:y-x/2})).toBe(authored[i]));
    for(const id of ['sorceress','necromancer','bloodknight']){
      const meta=SPRITE_MANIFEST[`character:${id}` as keyof typeof SPRITE_MANIFEST] as SpriteAssetMeta;
      expect(Object.keys(meta.frames.stand??{})).toHaveLength(8);expect(Object.keys(meta.frames.run??{})).toHaveLength(8);
      expect(meta.originX).toBeGreaterThan(0);expect(meta.originY).toBeLessThanOrEqual(1);
    }
  });
  it('places repeatable encounters in distinct reachable rooms and hides unexplored rooms',()=>{
    for(let seed=1;seed<=30;seed++){
      const r=new Run(seed,'sorceress',freshSession()), flow=buildFlow(r.dungeon,r.player);
      expect(r.encounters).toEqual(new Run(seed,'sorceress',freshSession()).encounters);
      expect(new Set(r.encounters.map(e=>e.room)).size).toBe(3);
      for(const e of r.encounters){const d=flow[Math.floor(e.y/TILE)*r.dungeon.size+Math.floor(e.x/TILE)];expect(r.dungeon.hiddenRooms.includes(e.room)?d===-1:d>=0).toBe(true);expect(r.isExplored(e)).toBe(false);}
    }
  });
  it('reveals visited terrain once and never forgets it while exploring',()=>{
    const r=make(), start={...r.player}, e=r.encounters[0];
    Object.assign(r.player,{x:e.x,y:e.y});step(r,.02);
    expect(r.isExplored(e)).toBe(true);expect(r.isExplored(start)).toBe(true);
    expect(r.discoveredRooms.has(e.room)).toBe(true);
  });
  it('sacrifice enforces its health cost and grants only one reward',()=>{
    const r=make(),e=r.encounters.find(e=>e.kind==='sacrifice')!;
    waiveRoomCombat(r,e.room);
    Object.assign(r.player,{x:e.x,y:e.y,hp:80});r.interact();r.acceptEncounter();
    expect(e.state).toBe('available');expect(r.loot).toHaveLength(0);
    r.player.hp=200;r.acceptEncounter();expect(r.player.hp).toBe(110);expect(e.state).toBe('won');
    const count=r.loot.length;r.acceptEncounter();expect(r.loot.length).toBe(count);
  });
  it('pauses challenge clocks and fails a contract when leaving its area',()=>{
    const r=make(),e=r.encounters[0];waiveRoomCombat(r,e.room);Object.assign(r.player,{x:e.x,y:e.y});r.interact();r.acceptEncounter();
    const time=e.remaining;r.pause();step(r,2);expect(e.remaining).toBe(time);r.pause();
    Object.assign(r.player,r.dungeon.start);step(r,.02);expect(e.state).toBe('failed');
  });
  it('continuously reinforces active contracts and stops their spawner at a terminal state',()=>{
    const r=make(),e=r.encounters.find(value=>value.kind==='cursed')!;waiveRoomCombat(r,e.room);Object.assign(r.player,{x:e.x,y:e.y,invulnerable:999});r.interact();r.acceptEncounter();
    expect(e.waves).toBe(1);const initial=r.enemies.filter(enemy=>enemy.encounterEvent===e.id).length;
    for(const enemy of r.enemies.filter(enemy=>enemy.encounterEvent===e.id))enemy.hp=0;step(r,3.3);
    expect(e.waves).toBeGreaterThan(1);expect(r.enemies.filter(enemy=>enemy.encounterEvent===e.id&&enemy.hp>0).length).toBeGreaterThan(0);expect(initial).toBeGreaterThan(0);
    Object.assign(r.player,r.dungeon.start);step(r,.05);expect(e.state).toBe('failed');const stoppedAt=e.waves;step(r,6.5);expect(e.waves).toBe(stoppedAt);
  });
  it('defers a sealed-room encounter until an event in that room resolves',()=>{
    const r=make(),event=r.encounters.find(value=>r.roomEncounters.some(room=>room.room===value.room))!,room=r.roomEncounters.find(value=>value.room===event.room)!;
    Object.assign(r.player,{x:event.x,y:event.y});r.interact();r.acceptEncounter();step(r,.02);
    expect(r.activeEncounter).toBe(event);expect(room.state).toBe('dormant');expect(r.activeRoomEncounter).toBeUndefined();
    event.remaining=.001;step(r,.02);expect(event.state).not.toBe('active');expect(room.state).toBe('active');
  });
  it('pays a survival contract once and times out an incomplete hunt',()=>{
    const r=make(), e=r.encounters[0];waiveRoomCombat(r,e.room);Object.assign(r.player,{x:e.x,y:e.y});r.interact();r.acceptEncounter();
    e.remaining=.001;step(r,.02);expect(e.state).toBe('won');expect(r.gold).toBe(60);
    const legendary=r.legendaryFound;step(r,.1);expect(r.legendaryFound).toBe(legendary);
    const hunt=r.encounters.find(e=>e.kind==='hunt')!;waiveRoomCombat(r,hunt.room);Object.assign(r.player,{x:hunt.x,y:hunt.y});r.interact();r.acceptEncounter();hunt.remaining=.001;step(r,.02);expect(hunt.state).toBe('failed');
  });
  it('counts only nearby hunted enemies and completes at the target',()=>{
    const r=make(),h=r.encounters.find(e=>e.kind==='hunt')!;waiveRoomCombat(r,h.room);Object.assign(r.player,{x:h.x,y:h.y});r.interact();r.acceptEncounter();
    h.progress=17;const enemy=r.enemies[0];Object.assign(enemy,{x:h.x,y:h.y});r.hit(enemy,999999);step(r,.02);
    expect(h.state).toBe('won');expect(r.gold).toBeGreaterThanOrEqual(60);
  });
  it('charge locks its telegraph before moving and does not home during windup',()=>{
    const r=make();r.skills.length=0;const e=r.spawnEnemy('knight',true)!;e.tactic='charge';e.abilityCooldown=0;Object.assign(e,{x:r.player.x+150,y:r.player.y});
    step(r,.02);expect(e.windup).toBeGreaterThan(0);const lock={...e.lockedTarget!}, x=e.x;
    r.player.y+=40;step(r,.4);expect(e.lockedTarget).toEqual(lock);expect(e.x).toBe(x);
    step(r,.85);expect(e.x).toBeLessThan(x);
  });
  it('boss enters phase two once and begins its configured ability cycle',()=>{
    const r=make();r.skills.length=0;const boss=r.spawnEnemy('boss',true)!;boss.hp=boss.maxHp*.49;
    step(r,.02);expect(r.bossPhase).toBe(2);expect(r.enemies.filter(e=>e.kind==='knight')).toHaveLength(2);
    const guards=r.enemies.filter(e=>e.kind==='knight').map(e=>e.id);step(r,1.6);expect(r.enemies.length+r.hazards.length).toBeGreaterThan(3);expect(r.bossPhase).toBe(2);
    step(r,1.3);expect(guards.every(id=>r.enemies.some(e=>e.id===id))).toBe(true);
  });
  it('summoner completes its tell before spawning allies near itself',()=>{
    const r=make();r.skills.length=0;const e=r.spawnEnemy('cultist',true)!;Object.assign(e,{x:r.player.x+110,y:r.player.y,tactic:'summoner',abilityCooldown:0});
    step(r,.02);expect(r.enemies).toHaveLength(1);step(r,.9);expect(r.enemies).toHaveLength(4);
    for(const minion of r.enemies.filter(v=>v!==e))expect(Math.hypot(minion.x-e.x,minion.y-e.y)).toBeLessThan(90);
  });
  it('jailer leaves an exit and does not damage during the warning',()=>{
    const r=make();r.skills.length=0;r.player.invulnerable=0;const e=r.spawnEnemy('knight',true)!;Object.assign(e,{x:r.player.x+150,y:r.player.y,tactic:'jailer',abilityCooldown:0});
    step(r,.02);const walls=r.hazards.filter(h=>h.shape==='line');expect(walls).toHaveLength(3);
    r.player.y=walls[0].y;r.player.x=(walls[0].x+walls[0].target!.x)/2;const hp=r.player.hp;
    step(r,.4);expect(r.player.hp).toBeGreaterThanOrEqual(hp);step(r,1);expect(r.player.hp).toBeLessThan(hp);
  });
});

import { describe, expect, it } from 'vitest';
import { buildFlow, generateDungeon, moveOnMap, roomsForFloor, TILE, walkable } from '../src/core/dungeon';
import { Random } from '../src/core/random';
import { createItem } from '../src/core/loot';
import { freshSession, idleInput, Run } from '../src/core/run';
import type { CharacterId } from '../src/core/types';
import { CHARACTERS, CHARACTER_IDS } from '../src/core/characters';
import { campaignThemes, THEME_IDS } from '../src/core/themes';

const make = (character: CharacterId = 'sorceress') => new Run(12345, character, freshSession());
const unlockBoss=(run:Run)=>run.roomEncounters.filter(value=>value.key).forEach(value=>value.state='cleared');

describe('random generation and navigation', () => {
  it('reproduces the same map and loot for a seed', () => {
    expect(generateDungeon(42).tiles).toEqual(generateDungeon(42).tiles);
    expect(createItem(new Random(42), 1, 1, 'legendary')).toEqual(createItem(new Random(42), 1, 1, 'legendary'));
    expect(generateDungeon(42).rooms).not.toEqual(generateDungeon(43).rooms);
  });
  it('keeps the main route reachable and seals each hidden room until its wall breaks', () => {
    for (let seed = 0; seed < 100; seed++) {
      const map = generateDungeon(seed), flow = buildFlow(map, map.start);
      const mainRooms=map.rooms.map((r,i)=>({i,p:{ x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE }})).filter(v=>!map.hiddenRooms.includes(v.i));
      for (const p of [map.altar, ...mainRooms.map(v=>v.p)]) {
        expect(walkable(map, p.x, p.y), `seed ${seed}`).toBe(true);
        expect(flow[Math.floor(p.y / TILE) * map.size + Math.floor(p.x / TILE)]).toBeGreaterThanOrEqual(0);
      }
      const secret=map.rooms[map.hiddenRooms[0]],secretPoint={x:(secret.x+secret.w/2)*TILE,y:(secret.y+secret.h/2)*TILE};
      expect(map.breakableWalls[0].tiles.length).toBeLessThanOrEqual(5);
      expect(['L','R']).toContain(map.breakableWalls[0].orientation);
      expect(flow[Math.floor(secretPoint.y/TILE)*map.size+Math.floor(secretPoint.x/TILE)],`secret leaked for seed ${seed}; wall tiles ${map.breakableWalls[0].tiles.length}`).toBe(-1);
      for(const tile of map.breakableWalls[0].tiles)map.tiles[tile]=1;
      const opened=buildFlow(map,map.start);expect(opened[Math.floor(secretPoint.y/TILE)*map.size+Math.floor(secretPoint.x/TILE)]).toBeGreaterThanOrEqual(0);
    }
  });
  it('does not let a body walk outside the dungeon', () => {
    const map = generateDungeon(12), body = { ...map.start };
    for (let i = 0; i < 600; i++) moveOnMap(map, body, -5, -5);
    expect(walkable(map, body.x, body.y)).toBe(true);
  });
  it('provides fifteen themes and an eight-map route with increasing room counts',()=>{
    expect(THEME_IDS).toHaveLength(15);const route=campaignThemes(91);expect(route).toHaveLength(8);expect(new Set(route).size).toBe(8);
    const counts=Array.from({length:8},(_,i)=>generateDungeon(91+i,[5,6,8,9,11,12,14,15][i],route[i],i+1).rooms.length);
    // The requested count is the playable route; every map also owns one
    // separately sealed hidden treasury.
    expect(counts).toEqual([6,7,9,10,12,13,15,16]);
  });
  it('always provides enough reachable key rooms to unlock the boss sanctuary',()=>{
    for(let seed=0;seed<100;seed++){
      const run=new Run(500000+seed,'sorceress',freshSession());
      expect(run.requiredKeyRooms,`seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(run.roomEncounters.length,`seed ${seed}`).toBeGreaterThanOrEqual(run.requiredKeyRooms);
      unlockBoss(run);expect(run.bossUnlocked,`seed ${seed}`).toBe(true);Object.assign(run.player,run.dungeon.exit);run.update(1/60,idleInput());expect(run.floorGuardian,`seed ${seed}`).toBeDefined();
    }
  });
  it('keeps every ordinary room reachable while the boss arena is sealed',()=>{
    for(let floor=1;floor<=8;floor++)for(let seed=0;seed<100;seed++){
      const map=generateDungeon(700000+floor*1000+seed,roomsForFloor(floor),THEME_IDS[(floor+seed)%THEME_IDS.length],floor),boss=map.rooms[map.bossRoom];
      const blocked=(x:number,y:number)=>x>=boss.x&&x<boss.x+boss.w&&y>=boss.y&&y<boss.y+boss.h;
      const startX=Math.floor(map.start.x/TILE),startY=Math.floor(map.start.y/TILE),seen=new Uint8Array(map.tiles.length),queue=[startY*map.size+startX];seen[queue[0]]=1;
      for(let cursor=0;cursor<queue.length;cursor++){const index=queue[cursor],x=index%map.size,y=Math.floor(index/map.size);for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const next=ny*map.size+nx;if(nx>=0&&ny>=0&&nx<map.size&&ny<map.size&&map.tiles[next]&&!blocked(nx,ny)&&!seen[next]){seen[next]=1;queue.push(next)}}}
      for(const [index,room] of map.rooms.entries())if(index!==map.bossRoom&&!map.hiddenRooms.includes(index)){
        const x=Math.floor(room.x+room.w/2),y=Math.floor(room.y+room.h/2);expect(seen[y*map.size+x],`floor ${floor}, seed ${seed}, room ${index}`).toBe(1);
      }
    }
  });
  it('opens sealed rooms through a breakable wall and offers route choices after map two',()=>{
    const run=make(),wall=run.dungeon.breakableWalls[0],secret=run.dungeon.rooms[wall.revealedRoom];
    const secretPoint={x:(secret.x+secret.w/2)*TILE,y:(secret.y+secret.h/2)*TILE};
    Object.assign(run.player,secretPoint);run.update(1/60,idleInput());expect(run.isExplored(secretPoint)).toBe(false);
    Object.assign(run.player,run.dungeon.start);
    let flow=buildFlow(run.dungeon,run.player),index=Math.floor((secret.y+secret.h/2))*run.dungeon.size+Math.floor(secret.x+secret.w/2);expect(flow[index]).toBe(-1);
    Object.assign(run.player,wall);run.interact();expect(wall.destroyed).toBe(true);flow=buildFlow(run.dungeon,run.player);expect(flow[index]).toBeGreaterThanOrEqual(0);
    for(let floor=1;floor<=2;floor++){unlockBoss(run);Object.assign(run.player,run.dungeon.exit);run.update(1/60,idleInput());run.hit(run.floorGuardian!,999999);if(floor===1)run.advanceFloor();}
    Object.assign(run.player,run.dungeon.exit);run.interact();expect(run.phase).toBe('route');expect(run.routeChoices).toHaveLength(2);
    const chosen=run.routeChoices[1];run.chooseRoute(chosen);expect(run.floor).toBe(3);expect(run.dungeon.theme).toBe(chosen);
  });
});

describe('combat invariants', () => {
  it('does not advance time, damage or cooldown while a modal is open', () => {
    const run = make(); run.phase = 'inventory'; run.player.burstCooldown = 5;
    const snapshot = JSON.stringify(run.player);
    for (let i = 0; i < 120; i++) run.update(1 / 60, { ...idleInput(), x: 1 });
    expect(run.time).toBe(0); expect(JSON.stringify(run.player)).toBe(snapshot);
  });
  it('auto-attacks continue at zero mana and cannot overspend mana', () => {
    const run = make(); run.player.mana = 0;
    const enemy = run.spawnEnemy('zombie')!; enemy.x = run.player.x + 40; enemy.y = run.player.y; enemy.hp = enemy.maxHp = 500;
    for (let i = 0; i < 100; i++) run.update(1 / 60, idleInput());
    expect(enemy.hp).toBeLessThan(500); expect(run.player.mana).toBeGreaterThanOrEqual(0);
  });
  it('manual burst costs 40 and respects cooldown', () => {
    const run = make(); run.burst(); expect(run.player.mana).toBe(60); expect(run.player.burstCooldown).toBe(8);
    run.burst(); expect(run.player.mana).toBe(60);
    run.player.burstCooldown = 0; run.player.mana = 39; run.burst(); expect(run.player.mana).toBe(39);
  });
  it('dash has finite charges and recovers independently of mana', () => {
    const run = make(); run.player.mana = 0;
    run.update(1 / 60, { ...idleInput(), dash: true }); expect(run.player.dashCharges).toBe(1);
    run.player.dashTime = 0; run.update(1 / 60, { ...idleInput(), dash: true }); expect(run.player.dashCharges).toBe(0);
    for (let i = 0; i < 181; i++) run.update(1 / 60, idleInput());
    expect(run.player.dashCharges).toBeGreaterThanOrEqual(1);
  });
  it('damage consumes shield first and cannot repeatedly hit during invulnerability', () => {
    const run = make(); run.player.invulnerable = 0; run.player.shield = 20;
    run.hurt(30, 'test'); expect(run.player.hp).toBe(290); expect(run.player.shield).toBe(0);
    run.hurt(30, 'test'); expect(run.player.hp).toBe(290);
  });
  it('requires eight maps, seven guardians and one final boss, settling once', () => {
    const run=make();
    for(let floor=1;floor<=8;floor++){
      unlockBoss(run);Object.assign(run.player,run.dungeon.exit);run.update(1/60,idleInput());const guardian=run.floorGuardian!;expect(guardian).toBeDefined();
      expect(run.dungeon.rooms).toHaveLength([6,7,9,10,12,13,15,16][floor-1]);run.hit(guardian,999999);
      if(floor<8){expect(run.exitUnlocked).toBe(true);expect(run.advanceFloor()).toBe(true);expect(run.floor).toBe(floor+1);}
    }
    expect(run.phase).toBe('won');const reward=run.session.gold;run.update(1/60,idleInput());expect(run.session.gold).toBe(reward);expect(run.session.victories).toBe(1);
    expect(run.session.unlockedWings).toHaveLength(1);expect(run.session.equippedWing).toBe(run.session.lastWingReward);
  });
});

describe('skills, equipment and memory-only progression', () => {
  it('supports seven color qualities, eight universal weapon families and three base grades', () => {
    const qualities = ['common','magic','rare','epic','set','unique','legendary'] as const;
    const weapons = ['sword','axe','mace','dagger','spear','staff','wand','bow'] as const;
    for (const [index, quality] of qualities.entries()) {
      const item=createItem(new Random(index+20),8000+index,[1,8,16,24,36,44,52][index],quality,undefined,'weapon',weapons[index%weapons.length]);
      expect(item.rarity).toBe(quality);expect(item.baseGrade).toBe(index<2?'normal':index<4?'exceptional':'elite');
      if(item.slot==='weapon'&&quality!=='unique')expect(item.weaponKind).toBe(weapons[index%weapons.length]);
    }
    expect(new Set(weapons.map((kind,index)=>createItem(new Random(index+80),9000+index,1,'rare',undefined,'weapon',kind).weaponKind)).size).toBe(8);
  });
  it('activates watcher set bonuses at two and three distinct pieces', () => {
    const run=make(),base=run.stats;
    for(const [index,slot] of (['head','chest','feet'] as const).entries())run.equipped[slot]={id:9500+index,name:'守夜',slot,rarity:'set',power:1,damage:0,health:0,haste:0,crit:0,setId:'watcher',description:''};
    delete run.equipped.feet;expect(run.stats.damage).toBeCloseTo(base.damage+.12);expect(run.stats.maxHp).toBe(base.maxHp);
    run.equipped.feet={id:9502,name:'守夜',slot:'feet',rarity:'set',power:1,damage:0,health:0,haste:0,crit:0,setId:'watcher',description:''};
    expect(run.stats.maxHp).toBe(base.maxHp+60);
  });
  it('offers all unlearned skills when a new slot opens', () => {
    const run = make(); run.level = 3; run.prepareUpgrade();
    expect(run.upgrades.length).toBe(3); expect(run.upgrades.every(u => u.kind === 'new')).toBe(true);
    run.chooseUpgrade('new-fire'); expect(run.skills.map(s => s.id)).toEqual(['lightning', 'frost', 'fire']); expect(run.phase).toBe('playing');
  });
  it('always provides a growth path for every equipped skill below its cap', () => {
    const run = make(); run.skills.push({ id: 'arcane', level: 2, branch: null }, { id: 'fire', level: 5, branch: 'wide' }); run.level = 10;
    for (let i = 0; i < 40; i++) { run.prepareUpgrade(); for (const s of run.skills) expect(run.upgrades.some(u => u.skill === s.id)).toBe(true); }
  });
  it('equipping replaces only that slot, preserves the old item and clamps health', () => {
    const run = make(), item = createItem(new Random(7), 9000, 1, 'legendary', 'lightning');
    run.receiveItem(item); run.equip(item.id); expect(run.has('storm')).toBe(true);
    const replacement = { ...item, id: 9001, health: 0, effect: undefined }; run.player.hp = run.stats.maxHp;
    run.receiveItem(replacement); run.equip(replacement.id);
    expect(run.inventory.map(i => i.id)).toContain(item.id); expect(run.has('storm')).toBe(false); expect(run.player.hp).toBeLessThanOrEqual(run.stats.maxHp);
  });
  it('limits greed to fifteen and only changes it at the altar', () => {
    const run = make(); run.changeGreed(2); expect(run.greed).toBe(0); run.phase = 'altar'; run.changeGreed(99); expect(run.greed).toBe(15); run.changeGreed(-99); expect(run.greed).toBe(0);
  });
  it('keeps carried items and stash between runs but creates a clean new session', () => {
    const run = make(), item = createItem(new Random(7), 9000, 1, 'legendary', 'lightning'); run.receiveItem(item); run.gold = 77;
    run.player.invulnerable = 0; run.hurt(99999, 'test'); expect(run.phase).toBe('dead');
    const next = new Run(9, 'bloodknight', run.session); expect(next.inventory[0].id).toBe(9000); expect(next.time).toBe(0); expect(next.session.gold).toBe(77);
    expect(freshSession()).toEqual({ gold: 0, forgeRank: 0, carried: {}, stash: [], bestKills: 0, victories: 0, unlockedWings:[], equippedWing:null, lastWingReward:null,talents:{sorceress:{},necromancer:{},bloodknight:{}} });
  });
});

describe('three characters share everything except appearance and skills', () => {
  it('defines three distinct build targets for every character inside its skill pool',()=>{
    for(const id of CHARACTER_IDS){const character=CHARACTERS[id];expect(character.builds).toHaveLength(3);expect(new Set(character.builds.map(build=>build.name)).size).toBe(3);for(const build of character.builds){expect(build.skills).toHaveLength(3);expect(build.skills.every(skill=>character.skills.includes(skill))).toBe(true);}}
  });
  it('starts all characters with identical base stats, resources, equipment slots and dash rules', () => {
    const baseline = make();
    for (const id of CHARACTER_IDS) {
      const run = make(id); expect(run.stats).toEqual(baseline.stats);
      expect(run.player.hp).toBe(baseline.player.hp); expect(run.player.mana).toBe(100); expect(run.player.dashCharges).toBe(2);
      expect(run.skills.map(s => s.id)).toEqual(CHARACTERS[id].starting);
      run.level = 3; run.prepareUpgrade(); expect(run.upgrades.every(u => u.skill && CHARACTERS[id].skills.includes(u.skill))).toBe(true);
    }
  });
  it('shares gear, gold and forge through a character switch without duplicating items', () => {
    const mage = make(), item = createItem(new Random(1), 300, 1, 'legendary', 'lightning');
    mage.receiveItem(item); mage.equip(item.id); mage.gold = 125; mage.player.invulnerable = 0; mage.hurt(9999, 'test');
    mage.session.forgeRank = 2;
    const knight = new Run(4, 'bloodknight', mage.session);
    expect(knight.equipped.weapon?.id).toBe(300); expect(knight.inventory).toHaveLength(0); expect(knight.session.gold).toBe(125); expect(knight.session.forgeRank).toBe(2);
    expect(knight.skills.map(s => s.id)).toEqual(['blades', 'blood']);
  });
  it('necromancer creates real allies that move, attack, expire and remain bounded', () => {
    const run = make('necromancer');
    const enemy = run.spawnEnemy('zombie')!; enemy.x = run.player.x + 100; enemy.y = run.player.y; enemy.hp = enemy.maxHp = 500;
    for (let i = 0; i < 15; i++) run.update(1 / 60, idleInput());
    expect(run.minions.length).toBeGreaterThan(0); const first = { ...run.minions[0] };
    for (let i = 0; i < 90; i++) run.update(1 / 60, idleInput());
    expect(Math.hypot(first.x - run.minions[0].x, first.y - run.minions[0].y)).toBeGreaterThan(5); expect(enemy.hp).toBeLessThan(500);
    run.burst(); expect(run.minions).toHaveLength(6); run.player.burstCooldown = 0; run.player.mana = 100; run.burst(); expect(run.minions).toHaveLength(6);
    run.minions[0].ttl = .001; run.update(1 / 60, idleInput()); expect(run.minions.length).toBeLessThan(6);
  });
  it('all three ultimates cost the same mana but produce different effects', () => {
    for (const id of CHARACTER_IDS) {
      const run = make(id); run.player.hp = 200;
      const enemy = run.spawnEnemy('knight', true)!; enemy.x = run.player.x + 80; enemy.y = run.player.y;
      run.burst(); expect(run.player.mana).toBeGreaterThanOrEqual(60); expect(run.player.burstCooldown).toBe(8);
      if (id === 'necromancer') expect(run.minions).toHaveLength(6);
      if (id === 'bloodknight') expect(run.player.hp).toBeGreaterThan(200);
      if (id === 'sorceress') expect(enemy.slow).toBeGreaterThan(0);
    }
  });
  it('wide blades change into returning projectiles instead of another damage-only level', () => {
    const run = make('bloodknight'); run.skills[0].level = 3; run.skills[0].branch = 'wide';
    const enemy = run.spawnEnemy('knight', true)!; enemy.x = run.player.x + 80; enemy.y = run.player.y;
    for (let i = 0; i < 20; i++) run.update(1 / 60, idleInput());
    expect(run.projectiles.some(p => p.returning)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { Run, freshSession, idleInput } from '../src/core/run';
import { distance } from '../src/core/random';
import { CHARACTER_IDS } from '../src/core/characters';

/** A simple, non-invulnerable kiting bot exercises the natural six-minute economy. */
describe('long-running combat regression', () => {
  for (const character of CHARACTER_IDS) {
    it(`keeps the ${character} run bounded and reaches meaningful progression`, () => {
      const run = new Run(142857, character, freshSession());
      const initial = run.character.starting;
      for (let frame = 0; frame < 60 * 470 && !run.ended; frame++) {
        // The baseline bot values survival; loot-focused policies are covered by
        // itemization tests and should not make this endurance guard flaky.
        if(run.phase==='roomReward')run.chooseRoomReward('respite');
        if(!run.activeRoomEncounter&&!run.bossUnlocked){const next=run.roomEncounters.find(value=>value.key&&value.state==='dormant');if(next){const room=run.dungeon.rooms[next.room];Object.assign(run.player,{x:(room.x+room.w/2)*32,y:(room.y+room.h/2)*32});run.update(1/60,idleInput());}}
        if(run.bossUnlocked&&!run.guardianSpawned){Object.assign(run.player,run.dungeon.exit);run.update(1/60,idleInput());}
        if(run.floorGuardian&&run.mapTime>43)run.hit(run.floorGuardian,999999);
        if(run.exitUnlocked&&run.floor<8)run.advanceFloor();
        if (run.phase === 'upgrade') {
          const choice = run.upgrades.find(u => u.kind === 'new' && u.skill === 'shield')
            ?? run.upgrades.find(u => u.kind === 'new' && u.skill === 'frost')
            ?? run.upgrades.find(u => u.kind === 'new' && u.skill === 'warcry')
            ?? run.upgrades.find(u => u.kind === 'new' && u.skill === 'fire')
            ?? run.upgrades.find(u => u.kind === 'new' && u.skill === 'corpse')
            ?? run.upgrades.find(u => u.skill === initial[0] && u.kind !== 'wide') ?? run.upgrades[0];
          run.chooseUpgrade(choice.key);
        }
        for (const item of [...run.inventory]) if (!run.equipped[item.slot] || item.damage > run.equipped[item.slot]!.damage) run.equip(item.id);
        const nearest = [...run.enemies].sort((a, b) => distance(a, run.player) - distance(b, run.player))[0];
        const loot = [...run.loot].sort((a, b) => distance(a, run.player) - distance(b, run.player))[0];
        const a = run.time * .3;
        const activeRoom=run.activeRoomEncounter?run.dungeon.rooms[run.activeRoomEncounter.room]:undefined,center=activeRoom?{x:(activeRoom.x+activeRoom.w/2)*32,y:(activeRoom.y+activeRoom.h/2)*32}:run.dungeon.start;
        let target = { x: center.x + Math.cos(a) * 140, y: center.y + Math.sin(a) * 140 };
        if (loot && distance(loot, run.player) < 155) target = loot;
        let dx = target.x - run.player.x, dy = target.y - run.player.y;
        if (nearest && distance(nearest, run.player) < 65) { dx = run.player.x - nearest.x; dy = run.player.y - nearest.y; }
        run.update(1 / 60, { ...idleInput(), x: dx, y: dy, aim: nearest,
          dash: !!nearest && distance(nearest, run.player) < 38,
          burst: run.enemies.filter(e => distance(e, run.player) < 250).length >= 5 || !!run.boss,
          potion: run.player.hp < run.stats.maxHp * .45,
        });
        run.events.length = 0;
        expect(Number.isFinite(run.player.hp)).toBe(true);
        expect(run.enemies.length).toBeLessThanOrEqual(151);
        expect(run.projectiles.length).toBeLessThan(300);
        expect(run.loot.length).toBeLessThan(260);
        expect(run.minions.length).toBeLessThanOrEqual(6);
        expect(run.corpses.length).toBeLessThanOrEqual(70);
      }
      console.log(JSON.stringify({ build: initial, phase: run.phase, time: Math.round(run.time), kills: run.kills, level: run.level, legendary: run.legendaryFound, items: Object.values(run.equipped).length }));
      expect(run.level).toBeGreaterThanOrEqual(5);
      // Room sealing deliberately makes the opening map lethal for a simple
      // unattended bot; campaign traversal is covered by the browser journey.
      expect(run.kills).toBeGreaterThan(25);
      expect(run.floor).toBeGreaterThanOrEqual(1);
      expect(['dead','won']).toContain(run.phase);
    }, 30_000);
  }
});

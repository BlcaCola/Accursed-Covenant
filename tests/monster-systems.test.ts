import {describe,expect,it} from 'vitest';
import {MONSTER_DEFINITIONS,THEME_ROSTERS} from '../src/core/bestiary';
import {createItem} from '../src/core/loot';
import {Random} from '../src/core/random';
import {freshSession,Run} from '../src/core/run';

describe('monster ecology and item depth',()=>{
  it('spawns themed packs and drives a grounded movement state',()=>{
    const run=new Run(123,'sorceress',freshSession()),pack=(run as any).spawnThemePack(6,'normal');
    expect(pack).toHaveLength(6);for(const enemy of pack)expect(THEME_ROSTERS[run.dungeon.theme]).toContain(enemy.artId);
    const enemy=pack[0];run.enemies=[enemy];Object.assign(enemy,{x:run.dungeon.exit.x,y:run.dungeon.exit.y,role:'frontline',attack:'melee',attackCooldown:99,stagger:0});(run as any).updateEnemies(1/30);
    expect(enemy.moving).toBe(true);expect(enemy.facing.x).not.toBe(0);
  });
  it('supports shielding, revival and persistent player ailments',()=>{
    const run=new Run(321,'sorceress',freshSession()),spawn=(id:keyof typeof MONSTER_DEFINITIONS)=>(run as any).spawnEnemyProfile(MONSTER_DEFINITIONS[id]);
    const support=spawn('minotaur-ice-mage'),ally=spawn('skeleton')!;expect(support).toBeTruthy();Object.assign(support,{x:ally.x,y:ally.y,supportCooldown:0});(run as any).updateSupport(support,.1);expect(ally.shield).toBeGreaterThan(0);
    const hp=run.player.hp;(run as any).applyPlayerStatus('poison',8,2,'测试毒素');(run as any).updatePlayerStatuses(.6);expect(run.player.hp).toBeLessThan(hp);expect(run.player.statuses.poison).toBeTruthy();
  });
  it('rolls tiered affixes with values rounded to two decimals',()=>{
    const item=createItem(new Random(99),1,48,'legendary');expect(item.affixes).toHaveLength(4);expect(new Set(item.affixes!.map(a=>a.group))).toEqual(new Set(['prefix','suffix']));
    for(const value of [item.damage,item.health,item.haste,item.crit,...item.affixes!.map(a=>a.value)])expect(Math.abs(value*100-Math.round(value*100))).toBeLessThan(1e-8);
  });
});


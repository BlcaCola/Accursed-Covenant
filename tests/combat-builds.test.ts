import {describe,expect,it} from 'vitest';
import {EVOLUTION_RELICS} from '../src/core/buildMechanics';
import {WEAPONS} from '../src/core/equipment';
import {createItem} from '../src/core/loot';
import {Random} from '../src/core/random';
import {freshSession,Run} from '../src/core/run';

describe('combat build identities',()=>{
  it('defines 30 evolution-linked legendary covenants',()=>{
    expect(Object.values(EVOLUTION_RELICS).flatMap(Object.values)).toHaveLength(30);
    const item=createItem(new Random(14),1,30,'legendary','lightning',undefined,undefined,'wide');
    expect(item.evolution).toMatchObject({skill:'lightning',branch:'wide'});
    expect(item.description).toContain('冷却缩短 8%');
  });

  it('gives every weapon an authored attack template',()=>{
    expect(new Set(Object.values(WEAPONS).map(profile=>`${profile.range}/${profile.cadence}/${profile.damageScale}/${profile.arc}/${profile.pierce}`)).size).toBe(8);
    expect(WEAPONS.bow.range).toBeGreaterThan(WEAPONS.spear.range);
    expect(WEAPONS.dagger.cadence).toBeLessThan(WEAPONS.mace.cadence);
  });

  it('charges and consumes the sorceress class loop',()=>{
    const run=new Run(77,'sorceress',freshSession());
    const combat=run as unknown as {cast:(skill:Run['skills'][number])=>void};
    const skill=run.skills[0];
    for(let i=0;i<9;i++)combat.cast(skill);
    expect(run.classResource?.ready).toBe(true);
    combat.cast(skill);
    expect(run.classResource?.value).toBe(12);
  });

  it('restores Soulfire and Bloodrage as active combat loops',()=>{
    const necro=new Run(88,'necromancer',freshSession()),victim=necro.spawnEnemy('zombie')!;victim.hp=1;necro.hit(victim,999,0x79c86d,false,'召唤物');
    expect(necro.classResource).toMatchObject({name:'魂火',value:14,ready:false});
    const knight=new Run(89,'bloodknight',freshSession()),target=knight.spawnEnemy('zombie')!;Object.assign(target,{x:knight.player.x+60,y:knight.player.y,speed:0,attackCooldown:99});
    knight.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:false,basicAttack:true,aim:{x:target.x,y:target.y}});
    expect(knight.classResource.value).toBeGreaterThanOrEqual(3);
    knight.player.invulnerable=0;knight.hurt(25,'resource test');
    expect(knight.classResource.value).toBeGreaterThan(7);
  });
});

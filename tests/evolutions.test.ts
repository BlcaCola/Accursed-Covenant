import {describe,expect,it} from 'vitest';
import {SKILL_EVOLUTIONS} from '../src/core/evolutions';
import {freshSession,Run} from '../src/core/run';
import type {SkillId} from '../src/core/types';

describe('skill evolution identities',()=>{
  it('defines two named paths and an apex effect for every skill',()=>{
    const ids=Object.keys(SKILL_EVOLUTIONS) as SkillId[];expect(ids).toHaveLength(15);
    for(const id of ids)for(const branch of ['wide','focused'] as const){const evolution=SKILL_EVOLUTIONS[id][branch];expect(evolution.name.length).toBeGreaterThan(2);expect(evolution.description.length).toBeGreaterThan(8);expect(evolution.apex.length).toBeGreaterThan(8);}
  });

  it('offers named mutually exclusive paths and keeps the choice through apex',()=>{
    const run=new Run(1901,'sorceress',freshSession()),skill=run.skills[0];skill.level=2;run.skills[1].level=6;run.level=2;run.prepareUpgrade();
    expect(run.upgrades.map(choice=>choice.title)).toEqual(expect.arrayContaining([SKILL_EVOLUTIONS[skill.id].wide.name,SKILL_EVOLUTIONS[skill.id].focused.name]));
    run.chooseUpgrade(`wide-${skill.id}`);expect(skill).toMatchObject({level:3,branch:'wide'});
    skill.level=5;run.prepareUpgrade();const apex=run.upgrades.find(choice=>choice.skill===skill.id)!;expect(apex.title).toContain(SKILL_EVOLUTIONS[skill.id].wide.name);expect(apex.description).toContain(SKILL_EVOLUTIONS[skill.id].wide.apex);
  });

  it('turns an apex wide lightning skill into a large chaining web',()=>{
    const run=new Run(1902,'sorceress',freshSession()),skill=run.skills[0];run.skills.splice(1);Object.assign(skill,{level:6,branch:'wide'});
    run.enemies=[];for(let i=0;i<12;i++){const enemy=run.spawnEnemy('zombie')!;Object.assign(enemy,{x:run.player.x+80+Math.cos(i*.45)*90,y:run.player.y+Math.sin(i*.45)*90,hp:9999,maxHp:9999,armor:0});}
    run.events=[];(run as any).cast(skill,{x:run.enemies[0].x,y:run.enemies[0].y});expect(run.events.filter(event=>event.type==='lightning').length).toBeGreaterThanOrEqual(8);
  });

  it('gives focused defensive evolutions a thicker personal shield',()=>{
    const wide=new Run(1903,'necromancer',freshSession()),focused=new Run(1903,'necromancer',freshSession()),a={id:'shield',level:6,branch:'wide'} as const,b={id:'shield',level:6,branch:'focused'} as const;
    (wide as any).cast(a);(focused as any).cast(b);expect(focused.player.shield).toBeGreaterThan(wide.player.shield);
  });
});

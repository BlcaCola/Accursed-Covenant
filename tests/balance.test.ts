import {describe,expect,it} from 'vitest';
import {THEME_BOSSES,THEME_MONSTERS,FINAL_BOSSES,MONSTER_ART_IDS,THEME_ROSTERS} from '../src/core/bestiary';
import {enemyDamageMultiplier,enemyHealthMultiplier,enemyLevel,itemLevelFrom} from '../src/core/difficulty';
import {QUALITY_ORDER,rarityRates,rollRarity} from '../src/core/equipment';
import {createItem} from '../src/core/loot';
import {Random} from '../src/core/random';
import {THEME_IDS} from '../src/core/themes';

describe('campaign balance contract',()=>{
  it('provides ten monsters and five bosses for every theme plus three final bosses',()=>{
    for(const theme of THEME_IDS){expect(THEME_MONSTERS[theme]).toHaveLength(10);expect(THEME_BOSSES[theme]).toHaveLength(5);expect(new Set(THEME_MONSTERS[theme].map(m=>m.attack)).size,theme).toBeGreaterThanOrEqual(3);expect(new Set(THEME_MONSTERS[theme].map(m=>m.role)).size,theme).toBeGreaterThanOrEqual(3);}
    expect(new Set(Object.values(THEME_ROSTERS).flat())).toEqual(new Set(MONSTER_ART_IDS));
    expect(FINAL_BOSSES).toHaveLength(1);expect(FINAL_BOSSES[0].artId).toBe('final/dark-sovereign');
  });
  it('keeps purple and higher qualities locked below greed ten',()=>{
    for(let greed=0;greed<10;greed++){const rng=new Random(100+greed);for(let i=0;i<2000;i++)expect(QUALITY_ORDER.indexOf(rollRarity(rng,true,greed,8))).toBeLessThanOrEqual(QUALITY_ORDER.indexOf('rare'));}
    const rng=new Random(9);expect(Array.from({length:2000},()=>rollRarity(rng,true,10,8)).some(r=>QUALITY_ORDER.indexOf(r)>QUALITY_ORDER.indexOf('rare'))).toBe(true);
  });
  it('exposes exact normalized rarity rates for the greed screen',()=>{
    for(const greed of [0,9,10,15])for(const elite of [false,true]){
      const rates=rarityRates(elite,greed,8);
      expect(Object.values(rates).reduce((sum,value)=>sum+value,0)).toBeCloseTo(1,10);
      if(greed<10)for(const rarity of QUALITY_ORDER.slice(3))expect(rates[rarity]).toBe(0);
    }
    expect(rarityRates(true,15,8).legendary).toBeGreaterThan(rarityRates(false,15,8).legendary);
  });
  it('raises enemy level, threat and item level through the eight maps',()=>{
    const levels=Array.from({length:8},(_,i)=>enemyLevel(i+1,1+i*2,30,0));
    expect(levels).toEqual([...levels].sort((a,b)=>a-b));expect(levels[7]).toBeGreaterThan(levels[1]*3);
    expect(enemyHealthMultiplier(levels[7],0)).toBeGreaterThan(enemyHealthMultiplier(levels[1],0)*3);
    expect(enemyDamageMultiplier(levels[7],0)).toBeGreaterThan(enemyDamageMultiplier(levels[1],0)*2);
    const low=createItem(new Random(1),1,itemLevelFrom(levels[0],1,0,.5),'rare'),high=createItem(new Random(1),2,itemLevelFrom(levels[7],8,0,.5),'rare');
    expect(high.level!).toBeGreaterThan(low.level!);expect(high.damage+high.health).toBeGreaterThan((low.damage+low.health)*3);
  });
});

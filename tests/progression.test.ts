import {describe,expect,it} from 'vitest';
import {FINAL_BOSSES,THEME_BOSSES} from '../src/core/bestiary';
import {enemyLevel,itemLevelFrom} from '../src/core/difficulty';
import {rarityRates} from '../src/core/equipment';
import {freshSession,Run} from '../src/core/run';
import {buyTalent,refundTalent} from '../src/core/talents';

describe('camp economy, NPCs and authored bosses',()=>{
  it('keeps greed out of levels while improving rarity and combat pressure',()=>{
    expect(enemyLevel(5,14,90,0)).toBe(enemyLevel(5,14,90,15));
    expect(itemLevelFrom(30,5,0,.5)).toBe(itemLevelFrom(30,5,15,.5));
    expect(rarityRates(false,9,3).rare).toBeGreaterThan(rarityRates(false,0,3).rare);
    const low=new Run(50,'sorceress',freshSession()),high=new Run(50,'sorceress',freshSession());high.greed=15;
    const a=(low as any).spawnEnemyProfile(THEME_BOSSES.cave[0]),b=(high as any).spawnEnemyProfile(THEME_BOSSES.cave[0]);
    expect(b.level).toBe(a.level);expect(b.maxHp).toBeGreaterThan(a.maxHp);expect(b.damage).toBeGreaterThan(a.damage);expect(b.armor).toBeGreaterThan(a.armor);
  });
  it('uses separate refundable character trees with prerequisite protection',()=>{
    const session=freshSession();session.gold=2000;const base=new Run(3,'sorceress',session).stats.damage;
    expect(buyTalent(session,'sorceress','s-ember')).toBe(true);expect(buyTalent(session,'sorceress','s-overload')).toBe(false);
    expect(buyTalent(session,'sorceress','s-ember')).toBe(true);expect(buyTalent(session,'sorceress','s-ember')).toBe(true);expect(buyTalent(session,'sorceress','s-overload')).toBe(true);
    expect(new Run(4,'sorceress',session).stats.damage).toBeGreaterThan(base);expect(session.talents.necromancer).toEqual({});
    expect(refundTalent(session,'sorceress','s-ember')).toBe(0);expect(refundTalent(session,'sorceress','s-overload')).toBeGreaterThan(0);
  });
  it('runs merchant, blacksmith and the one-time beggar repayment loop',()=>{
    const session=freshSession();session.gold=2000;const run=new Run(88,'bloodknight',session);
    expect(run.activeNpcs).toEqual(expect.arrayContaining(['merchant','blacksmith']));expect(run.shopOffers).toHaveLength(4);
    const before=run.walletGold;run.phase='merchant';expect(run.buyShopItem(0)).toBe(true);expect(run.walletGold).toBeLessThan(before);expect(run.inventory).toHaveLength(1);
    const item=run.inventory[0];item.level=1;run.level=8;run.phase='blacksmith';expect(run.smithMatchLevel(item.id)).toBe(true);expect(item.level).toBeGreaterThan(1);
    run.gold=200;run.session.gold=0;run.beggarCurrent=true;run.beggarAppeared=true;run.phase='beggar';expect(run.payBeggar()).toBe(true);expect(run.beggarPayment).toBe(100);
    run.exitUnlocked=true;expect(run.advanceFloor()).toBe(true);expect(run.activeNpcs).toContain('distant-traveler');run.phase='traveler';expect(run.claimTraveler()).toBe(true);expect(run.gold).toBe(400);
  });
  it('marks fixed bosses stationary and uses the authored final ruler',()=>{
    const fixed=THEME_BOSSES.cave.find(boss=>boss.stationary)!;expect(fixed.artId).toContain('static');
    const run=new Run(19,'sorceress',freshSession()),enemy=(run as any).spawnEnemyProfile(fixed);const before={x:enemy.x,y:enemy.y};run.enemies=[enemy];(run as any).updateEnemies(.5);expect({x:enemy.x,y:enemy.y}).toEqual(before);
    expect(FINAL_BOSSES[0].name).toBe('黑暗统治者');expect(FINAL_BOSSES[0].artId).toBe('final/dark-sovereign');
  });
});

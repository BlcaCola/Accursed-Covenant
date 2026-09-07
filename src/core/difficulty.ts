/** Centralized curves: all combat and loot scaling should be reviewable here. */
export const MAX_GREED=15;
export function enemyLevel(floor:number,playerLevel:number,mapTime:number,_greed=0):number{
  return Math.max(1,Math.round(1+(floor-1)*6.5+Math.min(4,mapTime/30)+Math.max(0,playerLevel-floor*2)*.45));
}
export const enemyHealthMultiplier=(level:number,greed:number,elite=false)=>Math.pow(1.045,level-1)*(1+greed*.075)*(elite?2.15:1);
export const enemyDamageMultiplier=(level:number,greed:number,elite=false)=>Math.pow(1.035,level-1)*(1+greed*.065)*(elite?1.3:1);
export const itemLevelFrom=(enemyLevel:number,floor:number,_greed:number,roll:number)=>Math.max(1,Math.round(enemyLevel+floor*1.5+(roll*5-2)));
export const greedHealthBonus=(greed:number)=>1+greed*.075;
export const greedDamageBonus=(greed:number)=>1+greed*.065;

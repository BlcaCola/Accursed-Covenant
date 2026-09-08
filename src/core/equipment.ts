import type { Item, Rarity, WeaponKind } from './types';
import type { Random } from './random';

/** Quality and base grade are independent: a later base does not imply a special effect. */
export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xd4d4d4, magic: 0x6b93ff, rare: 0xf0d56b, epic: 0xbb86e8,
  set: 0x79d878, unique: 0xc7aa70, legendary: 0xf69b46,
};
export const QUALITY_ORDER: Rarity[] = ['common','magic','rare','epic','set','unique','legendary'];
export const BASE_NAMES = { normal: '基础', exceptional: '卓越', elite: '精英' };
export interface WeaponProfile {name:string;damage:number;health:number;haste:number;crit:number;icon:number;mechanic:string;ranged:boolean;range:number;cadence:number;damageScale:number;arc:number;pierce:number}
export const WEAPONS: Record<WeaponKind, WeaponProfile> = {
  sword: { name:'长剑',damage:3,health:10,haste:0,crit:0,icon:0,ranged:false,range:120,cadence:.55,damageScale:1,arc:1.25,pierce:0,mechanic:'第三次连续攻击变为重斩；每次攻击顺劈附近一名敌人。' },
  axe: { name:'战斧',damage:8,health:0,haste:0,crit:0,icon:1,ranged:false,range:125,cadence:.78,damageScale:1.18,arc:1.65,pierce:0,mechanic:'大范围重击；对生命低于 30% 的普通怪造成 25% 额外伤害。' },
  mace: { name:'战锤',damage:3,health:24,haste:0,crit:0,icon:2,ranged:false,range:118,cadence:.86,damageScale:1.12,arc:1.15,pierce:0,mechanic:'沉重攻击有 24% 概率击晕目标 0.65 秒。' },
  dagger: { name:'匕首',damage:0,health:0,haste:.035,crit:.02,icon:3,ranged:false,range:105,cadence:.34,damageScale:.78,arc:1,pierce:0,mechanic:'每次攻击追加 55% 伤害的副手刺击；暴击缩短技能冷却 12%。' },
  spear: { name:'长矛',damage:4,health:6,haste:0,crit:.012,icon:4,ranged:false,range:165,cadence:.62,damageScale:1.05,arc:.75,pierce:0,mechanic:'窄幅远距突刺，贯穿目标并对其后方敌人造成 45% 伤害。' },
  staff: { name:'法杖',damage:5,health:0,haste:.01,crit:0,icon:5,ranged:true,range:465,cadence:.68,damageScale:1.08,arc:0,pierce:2,mechanic:'发射贯穿法弹；每第五次攻击释放一次 65% 伤害秘法新星。' },
  wand: { name:'魔杖',damage:2,health:0,haste:.04,crit:0,icon:6,ranged:true,range:430,cadence:.5,damageScale:.86,arc:0,pierce:0,mechanic:'快速发射双生魔弹；直接攻击有 18% 概率弹射一次。' },
  bow: { name:'长弓',damage:2,health:0,haste:0,crit:.045,icon:7,ranged:true,range:540,cadence:.58,damageScale:1.12,arc:0,pierce:1,mechanic:'远距穿透射击；距离超过 220 时造成 20% 额外伤害。' },
};
export const protectedItem = (item: Item): boolean => ['set','unique','legendary'].includes(item.rarity);
export const watcherPieces = (items: Item[]): number => new Set(items.filter(i => i.setId === 'watcher').map(i => i.slot)).size;
export const SET_NAMES:Record<string,string>={watcher:'守夜者',tempest:'风暴使者',plague:'疫病之主',bloodOath:'血誓骑士',pilgrim:'灰烬朝圣者'};
export const setPieces=(items:Item[],setId:string):number=>new Set(items.filter(item=>item.setId===setId).map(item=>item.slot)).size;

/** Shared by the roll and UI so displayed probabilities cannot drift from combat rules. */
export function rarityWeights(elite=false,greed=0,floor=1):number[]{
  const f=Math.max(1,Math.min(8,floor));
  const weights=greed<10
    ? [Math.max(3,58-f*6-greed*3),28+f*2+greed*.8,8+f*4+greed*2.2,0,0,0,0]
    : [Math.max(1,16-f*2-(greed-10)),Math.max(4,27-f*2),38-f*2,18+f*2,4+f+(greed-10),2+f+(greed-10),1+f+(greed-10)];
  if(elite){weights[0]*=.15;weights[1]*=.45;weights[2]*=1.35;if(greed>=10)for(let i=3;i<weights.length;i++)weights[i]*=1.65;}
  return weights;
}
export function rarityRates(elite=false,greed=0,floor=1):Record<Rarity,number>{
  const weights=rarityWeights(elite,greed,floor),total=weights.reduce((sum,value)=>sum+value,0);
  return Object.fromEntries(QUALITY_ORDER.map((rarity,index)=>[rarity,weights[index]/total])) as Record<Rarity,number>;
}

/** Explicit weights keep drop rates reviewable and reproducible with the run seed. */
export function rollRarity(rng: Random, elite = false, greed = 0, floor = 1): Rarity {
  const weights=rarityWeights(elite,greed,floor);
  let roll = rng.next() * weights.reduce((a,b) => a+b,0);
  for (let i=0; i<weights.length; i++) { roll -= weights[i]; if (roll < 0) return QUALITY_ORDER[i]; }
  return 'legendary';
}

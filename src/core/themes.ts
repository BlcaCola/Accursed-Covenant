import type { ThemeId } from './types';
import { Random } from './random';

export interface Theme { id:ThemeId; name:string; subtitle:string; floor:number[]; stone:number[]; edge:number; accent:number; props:number[] }
export const THEMES:Record<ThemeId,Theme>={
  cave:{id:'cave',name:'回声洞穴',subtitle:'ECHOING CAVERNS',floor:[0x222725,0x292d29,0x1c2220],stone:[0x3b413b],edge:0x0b100e,accent:0x70805a,props:[3,7]},
  dungeon:{id:'dungeon',name:'遗忘地牢',subtitle:'FORGOTTEN DUNGEON',floor:[0x242a2c,0x2c3031,0x202729],stone:[0x54594f],edge:0x0d1316,accent:0xa16b43,props:[0,2,7]},
  cathedral:{id:'cathedral',name:'沉没圣堂',subtitle:'THE SUNKEN CATHEDRAL',floor:[0x25292b,0x303032,0x202427],stone:[0x625d53],edge:0x0b0c0d,accent:0xb99356,props:[0,1,6]},
  abandonedVillage:{id:'abandonedVillage',name:'荒弃村庄',subtitle:'THE ABANDONED VILLAGE',floor:[0x2d2b25,0x373229,0x24231f],stone:[0x685942],edge:0x13110e,accent:0x9e7548,props:[3,4,7]},
  inferno:{id:'inferno',name:'焦灼地狱',subtitle:'THE BURNING INFERNO',floor:[0x2c1715,0x3a1d16,0x211113],stone:[0x703122],edge:0x120707,accent:0xee6331,props:[1,4,6]},
  mountain:{id:'mountain',name:'断脊山道',subtitle:'THE BROKEN RIDGE',floor:[0x292d2e,0x343839,0x222628],stone:[0x727773],edge:0x101314,accent:0xa9b8b2,props:[2,3,7]},
  town:{id:'town',name:'疫病城镇',subtitle:'THE PLAGUED TOWN',floor:[0x302c27,0x39332b,0x25231f],stone:[0x76634d],edge:0x15110e,accent:0xb78b4c,props:[3,4,6]},
  palace:{id:'palace',name:'灰冠皇宫',subtitle:'THE ASHEN PALACE',floor:[0x302d32,0x3b353b,0x252329],stone:[0x806d69],edge:0x130f14,accent:0xd0a55f,props:[0,1,6]},
  catacomb:{id:'catacomb',name:'王室墓窟',subtitle:'THE ROYAL CATACOMBS',floor:[0x242524,0x2e2d2a,0x1c201f],stone:[0x5d594c],edge:0x0d0e0d,accent:0x9b8a63,props:[2,6,7]},
  sewer:{id:'sewer',name:'腐水下道',subtitle:'THE DROWNED SEWERS',floor:[0x202928,0x263230,0x192221],stone:[0x4f665a],edge:0x091210,accent:0x68a178,props:[2,3,7]},
  frozenRuins:{id:'frozenRuins',name:'霜封遗迹',subtitle:'THE FROZEN RUINS',floor:[0x273237,0x303d43,0x202a2f],stone:[0x7895a0],edge:0x0b1115,accent:0x8fd5e6,props:[0,2,7]},
  swamp:{id:'swamp',name:'哀嚎沼泽',subtitle:'THE WAILING MARSH',floor:[0x252b20,0x303627,0x1d241b],stone:[0x596446],edge:0x0b1008,accent:0x92a95e,props:[3,4,7]},
  mine:{id:'mine',name:'黑铁矿井',subtitle:'THE BLACK IRON MINE',floor:[0x292824,0x34312a,0x211f1c],stone:[0x685b49],edge:0x110e0b,accent:0xd18b45,props:[2,3,6]},
  desertTemple:{id:'desertTemple',name:'流沙神殿',subtitle:'THE BURIED TEMPLE',floor:[0x393128,0x44392c,0x2d2822],stone:[0x8c7657],edge:0x18130e,accent:0xe0b466,props:[0,1,6]},
  abyssFortress:{id:'abyssFortress',name:'深渊要塞',subtitle:'THE ABYSSAL FORTRESS',floor:[0x211d28,0x2b2233,0x18151e],stone:[0x654d70],edge:0x09060d,accent:0xc45ae0,props:[0,1,6]},
};
export const THEME_IDS=Object.keys(THEMES) as ThemeId[];

/** A run samples without replacement; dangerous final themes are reserved for later floors. */
export function campaignThemes(seed:number):ThemeId[]{
  const early:ThemeId[]=['cave','dungeon','cathedral','abandonedVillage','mountain','town','catacomb','sewer','swamp','mine'];
  const late:ThemeId[]=['palace','frozenRuins','desertTemple','inferno','abyssFortress'];
  const pick=<T>(a:T[],salt:number)=>new Random(seed+salt).shuffle(a);
  return [...pick(early,17).slice(0,5),...pick(late,71).slice(0,3)];
}

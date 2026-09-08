import { Random } from './random';
import { WEAPONS } from './equipment';
import { SLOTS } from './catalog';
import type { Item, Rarity, SkillId, Slot, WeaponKind } from './types';
import { round2 } from './random';
import {EVOLUTION_RELICS,type EvolutionRelic} from './buildMechanics';
import type {SkillBranch} from './evolutions';

const NAMES: Record<Slot, string[]> = {
  weapon: ['守墓人的长剑', '灰烬仪式刃'], offhand: ['沉默骨盾', '裂纹圣典'],
  head: ['失落者兜帽', '荆棘冠冕'], chest: ['守夜人胸甲', '暮色法衣'],
  feet: ['流亡者长靴', '幽影踏靴'], amulet: ['月蚀吊坠', '不灭骨符'],
  ring1: ['回响指环', '苍白誓约'], ring2: ['余烬指环', '暮光印记'],
};
const LEGENDARIES: Pick<Item, 'name' | 'slot' | 'effect' | 'description'>[] = [
  { name: '风暴之心', slot: 'weapon', effect: 'storm', description: '链雷额外跳跃 2 次；每次施放最多 3 次暴击恢复 4 法力。' },
  { name: '霜行者', slot: 'feet', effect: 'frost', description: '闪避留下持续 3 秒的冰径，伤害并减速经过的敌人。' },
  { name: '饥渴圣杯', slot: 'amulet', effect: 'vampire', description: '直接技能命中恢复 1 生命（每秒至多 12）；血矛伤害提高 25%。' },
  { name: '送葬者的脊骨', slot: 'offhand', effect: 'corpse', description: '亡灵侍从击杀后触发尸爆；尸爆不能再触发自身。' },
  { name: '逆火王冠', slot: 'head', effect: 'inferno', description: '陨落余烬范围扩大 40%，持续时间延长 2 秒。' },
  { name: '不眠守望', slot: 'chest', effect: 'guard', description: '白骨圣盾冷却减少 30%，获得的护盾增加 40%。' },
  { name: '裂空回响', slot: 'ring1', effect: 'chainNova', description: '每第五次直接技能命中释放一次秘法新星。' },
  { name: '血路行者', slot: 'feet', effect: 'bloodTrail', description: '闪避留下血痕，伤害敌人并少量恢复生命。' },
  { name: '亡军冠冕', slot: 'head', effect: 'summonerCrown', description: '亡灵侍从上限增加 2，持续时间延长 25%。' },
  { name: '双星余烬', slot: 'amulet', effect: 'meteorEcho', description: '陨落余烬有 25% 概率在附近再次爆发。' },
  { name: '荆棘圣骸', slot: 'chest', effect: 'thorns', description: '承受近身伤害时反弹 18% 给攻击者。' },
  { name: '贪欲之眼', slot: 'ring2', effect: 'treasureHunter', description: '普通怪装备掉率提高 25%，拾取半径提高 40%。' },
];
const AFFIXES=[
 {id:'cruel',name:'残酷',stat:'damage',group:'prefix',base:1.8},{id:'vital',name:'坚韧',stat:'health',group:'prefix',base:5.5},{id:'swift',name:'迅捷',stat:'haste',group:'prefix',base:.012},{id:'deadly',name:'致命',stat:'crit',group:'prefix',base:.01},
 {id:'giant',name:'巨人',stat:'health',group:'suffix',base:7},{id:'wind',name:'疾风',stat:'moveSpeed',group:'suffix',base:.012},{id:'warding',name:'守护',stat:'statusResist',group:'suffix',base:.018},{id:'hunter',name:'猎魔',stat:'eliteDamage',group:'suffix',base:.02},{id:'seeking',name:'寻宝',stat:'pickup',group:'suffix',base:.03},
] as const;
const AFFIX_COUNT:Record<Rarity,number>={common:0,magic:1,rare:2,epic:3,set:3,unique:4,legendary:4};

export function createItem(rng: Random, id: number, itemLevel: number, rarity: Rarity, preferred?: SkillId, forcedSlot?: Slot, forcedKind?: WeaponKind,preferredBranch?:SkillBranch): Item {
  const slot = forcedSlot ?? (rng.next() < .3 ? 'weapon' : rng.pick(SLOTS));
  const level=Math.max(1,Math.round(itemLevel)),quality={common:.62,magic:.82,rare:1,epic:1.22,set:1.28,unique:1.38,legendary:1.48}[rarity];
  const item: Item = {
    id, name: rng.pick(NAMES[slot]), slot, rarity, power: level, level,
    damage: (rng.int(2,4)+level*.24)*quality, health: (rng.int(5,11)+level*1.15)*quality,
    haste: Math.min(.055,(rng.int(0,2)+level*.045)/100)*quality, crit: Math.min(.045,(rng.int(0,2)+level*.035)/100)*quality,
    description: '历经灰烬洗礼的装备，增加伤害与生命上限。',
  };
  const affixTier=Math.min(6,1+Math.floor((level-1)/10)),available=rng.shuffle(AFFIXES).slice(0,AFFIX_COUNT[rarity]);
  item.affixes=available.map(def=>{const value=round2(def.base*affixTier*(.82+rng.next()*.36));return{id:def.id,name:def.name,tier:affixTier,value,stat:def.stat,group:def.group};});
  for(const affix of item.affixes){if(affix.stat==='damage')item.damage+=affix.value;if(affix.stat==='health')item.health+=affix.value;if(affix.stat==='haste')item.haste+=affix.value;if(affix.stat==='crit')item.crit+=affix.value;}
  const prefix=item.affixes.find(a=>a.group==='prefix'),suffix=item.affixes.find(a=>a.group==='suffix');
  if(prefix)item.name=`${prefix.name}的${item.name}`;if(suffix)item.name+=`·${suffix.name}`;
  if (rarity === 'common') { item.haste = 0; item.crit = 0; }
  if (rarity === 'magic') item.crit *= .5;
  if (rarity === 'epic') item.haste += .008;
  if (rarity === 'legendary') {
    const relic:EvolutionRelic|undefined=preferred&&preferredBranch?EVOLUTION_RELICS[preferred][preferredBranch]:undefined;
    const preferredEffect = { lightning: 'storm', summon: 'corpse', fire: 'inferno', shield: 'guard', blood: 'vampire', frost: 'frost', blades: 'vampire', poison: 'frost', arcane: 'frost', stormOrb: 'storm', corpse: 'corpse', bones: 'guard', cleave: 'vampire', warcry: 'guard', lance: 'vampire' }[preferred ?? 'lightning'];
    const template = preferred ? LEGENDARIES.find(i => i.effect === preferredEffect)! : rng.pick(LEGENDARIES);
    Object.assign(item, template);
    if(relic){item.name=relic.name;item.description=relic.description;item.evolution={skill:relic.skill,branch:relic.branch,name:relic.name,description:relic.description};}
    item.health += 12+level*.35; item.crit += .018;
  }
  if (rarity === 'set') {
    const sets=[{id:'watcher',slots:['head','chest','feet'] as Slot[],names:['守夜者的冠冕','守夜者的誓甲','守夜者的足迹'],description:'2 件：技能伤害 +12%；3 件：生命 +60。'},{id:'tempest',slots:['weapon','offhand','amulet'] as Slot[],names:['风暴之锋','雷鸣圣典','暴雨之眼'],description:'2 件：冷却缩减 +8%；3 件：连锁技能多跳跃 2 次。'},{id:'plague',slots:['head','chest','ring1'] as Slot[],names:['疫王面纱','腐沼法衣','枯萎指环'],description:'2 件：持续伤害 +18%；3 件：击杀扩散毒雾。'},{id:'bloodOath',slots:['weapon','chest','amulet'] as Slot[],names:['血誓刃','猩红重甲','殉道骨符'],description:'2 件：近战伤害 +15%；3 件：暴击恢复 1.50 生命。'},{id:'pilgrim',slots:['feet','ring1','ring2'] as Slot[],names:['朝圣者足迹','灰烬印记','归途印记'],description:'2 件：移动速度 +10%；3 件：拾取半径 +80%。'}],set=rng.pick(sets),piece=rng.int(0,2);
    item.slot=set.slots[piece];item.setId=set.id;item.name=set.names[piece];item.description=`${set.id==='watcher'?'守夜者':set.id==='tempest'?'风暴使者':set.id==='plague'?'疫病之主':set.id==='bloodOath'?'血誓骑士':'灰烬朝圣者'}套装：${set.description}`;
  }
  if (rarity === 'unique') {
    const unique = rng.pick([
      { name: '断钟者', weaponKind: 'sword', effect: 'execute', description: '直接技能对生命低于 30% 的敌人伤害提高 25%。' },
      { name: '守夜灯杖', weaponKind: 'staff', effect: 'clarity', description: '主动绝技消耗降低至 32 法力，冷却保持 8 秒。' },
      { name: '城垒之誓', weaponKind: 'mace', effect: 'bulwark', description: '闪避时护盾至少恢复至 12 点；不会叠加或覆盖更高护盾。' },
      { name: '雷语者', weaponKind: 'wand', effect: 'chainNova', description: '每第五次直接技能命中释放 65% 伤害秘法新星。' },
      { name: '疫行', weaponKind: 'bow', effect: 'treasureHunter', description: '普通怪装备掉率提高 25%，拾取半径提高 40%。' },
      { name: '亡军权杖', weaponKind: 'staff', effect: 'summonerCrown', description: '亡灵侍从上限增加 2，持续时间延长 25%。' },
      { name: '赤路', weaponKind: 'dagger', effect: 'bloodTrail', description: '闪避留下伤害敌人的血痕。' },
      { name: '双星', weaponKind: 'staff', effect: 'meteorEcho', description: '陨落余烬有 25% 概率在附近再次爆发。' },
    ] as const);
    Object.assign(item, unique); item.slot = 'weapon';
  }
  item.baseGrade = level >= 36 ? 'elite' : level >= 16 ? 'exceptional' : 'normal';
  if (item.slot === 'weapon') {
    item.weaponKind ??= forcedKind ?? rng.pick(Object.keys(WEAPONS) as WeaponKind[]);
    const base = WEAPONS[item.weaponKind];
    item.damage += base.damage; item.health += base.health; item.haste += base.haste; item.crit += base.crit;
    if (!item.effect) {
      item.name = rng.pick(['灰烬', '守墓', '暮光', '流亡']) + base.name;
      item.description = '通用武器：基础属性对所有角色与技能生效。';
    }
  }
  item.damage=round2(item.damage);item.health=round2(item.health);item.haste=round2(item.haste);item.crit=round2(item.crit);
  return item;
}

export const itemValue = (item: Item): number => ({ common: 3, magic: 6, rare: 10, epic: 18, set: 25, unique: 32, legendary: 40 })[item.rarity] + Math.ceil((item.level??item.power)*1.4);

import type { EnemyKind, SkillId, Slot } from './types';

export const SKILLS: Record<SkillId, { name: string; subtitle: string; description: string; color: number; icon: string; cooldown: number }> = {
  lightning: { name: '连锁闪电', subtitle: '雷电 · 连锁', description: '闪电在附近敌人间跳跃。暴击与法力装备让雷暴持续运转。', color: 0x7ccefa, icon: 'ϟ', cooldown: 1.35 },
  blades: { name: '幽魂旋刃', subtitle: '物理 · 环绕', description: '旋转刀刃周期性切割近处敌人，适合贴身突破怪群。', color: 0xcadce5, icon: '✧', cooldown: 0.9 },
  frost: { name: '寒霜新星', subtitle: '冰霜 · 控制', description: '释放冰环伤害并减速敌人，为走位和爆发创造窗口。', color: 0x98e5ed, icon: '❄', cooldown: 3.8 },
  fire: { name: '陨落余烬', subtitle: '火焰 · 范围', description: '在敌人密集处引爆余烬，留下持续燃烧的火域。', color: 0xec9a54, icon: '♨', cooldown: 2.8 },
  blood: { name: '穿心血矛', subtitle: '血系 · 穿透', description: '向目标投出穿透血矛，命中时少量恢复生命。', color: 0xe26e78, icon: '†', cooldown: 1.45 },
  poison: { name: '腐蚀迷雾', subtitle: '毒素 · 持续', description: '在前方留下毒雾，持续侵蚀敌人，适合边退边打。', color: 0xa7be66, icon: '☷', cooldown: 4.2 },
  summon: { name: '亡灵侍从', subtitle: '召唤 · 追击', description: '召唤独立寻敌的骸骨侍从，持续追击与攻击，数量随等级增加。', color: 0xa9bd88, icon: '♜', cooldown: 3 },
  shield: { name: '白骨圣盾', subtitle: '防御 · 反击', description: '周期性获得骨盾，并震伤贴近的敌人。护盾不会无限叠加。', color: 0xdbd1ad, icon: '◈', cooldown: 5.5 },
  arcane: { name: '秘法飞矢', subtitle: '秘法 · 多重', description: '向目标扇形发射秘法弹。广域增加弹数，凝聚提高穿透能力。', color: 0xb2a4e1, icon: 'ϟ', cooldown: 1.3 },
  stormOrb: { name: '雷电法球', subtitle: '雷电 · 阵地', description: '在前方建立放电区域；终极法球同时在周围多处放电。', color: 0x82b4ee, icon: '◈', cooldown: 4 },
  corpse: { name: '尸骸爆破', subtitle: '亡灵 · 连爆', description: '消耗附近遗骸引发尸爆。没有尸体时凝成一具灵骸，首领战仍可施放。', color: 0xa9c095, icon: '☷', cooldown: 2.5 },
  bones: { name: '白骨长矛', subtitle: '亡灵 · 穿透', description: '释放骨矛穿透敌阵。终极形态追加两道扇形骨矛。', color: 0xd9d2b6, icon: '†', cooldown: 1.7 },
  cleave: { name: '裂地重斩', subtitle: '近战 · 击退', description: '向敌人方向挥出重斩并击退目标。终极形态追加余震。', color: 0xe2b18b, icon: '†', cooldown: 2.1 },
  warcry: { name: '铁血战吼', subtitle: '防御 · 震慑', description: '战吼获得护盾，同时击退并减速贴近的敌人。', color: 0xd6a089, icon: '◈', cooldown: 5.5 },
  lance: { name: '回旋飞刃', subtitle: '物理 · 回返', description: '向前掷出重刃后返回，去程与回程均能命中敌人。', color: 0xd0b1a2, icon: '✧', cooldown: 1.9 },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const SLOT_NAMES: Record<Slot, string> = { weapon: '武器', offhand: '副手', head: '头部', chest: '胸甲', feet: '足部', amulet: '项链', ring1: '戒指 Ⅰ', ring2: '戒指 Ⅱ' };
export const SLOTS = Object.keys(SLOT_NAMES) as Slot[];
export const RARITY_NAMES = { common: '普通', magic: '魔法', rare: '稀有', epic: '史诗', set: '套装', unique: '暗金', legendary: '传奇' };
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; damage: number; radius: number; sprite: number; xp: number }> = {
  skeleton: { hp: 52, speed: 55, damage: 11, radius: 12, sprite: 2, xp: 3 }, zombie: { hp: 88, speed: 36, damage: 15, radius: 14, sprite: 3, xp: 4 },
  archer: { hp: 48, speed: 42, damage: 13, radius: 12, sprite: 4, xp: 5 }, knight: { hp: 145, speed: 43, damage: 20, radius: 20, sprite: 5, xp: 12 },
  cultist: { hp: 64, speed: 38, damage: 17, radius: 13, sprite: 6, xp: 8 }, wraith:{hp:58,speed:67,damage:16,radius:12,sprite:6,xp:7},
  brute:{hp:185,speed:31,damage:24,radius:21,sprite:5,xp:10},shaman:{hp:72,speed:37,damage:14,radius:13,sprite:6,xp:8},
  stalker:{hp:70,speed:75,damage:18,radius:13,sprite:3,xp:7},spitter:{hp:61,speed:40,damage:15,radius:12,sprite:4,xp:7},
  guardian:{hp:850,speed:35,damage:28,radius:25,sprite:5,xp:70},boss:{hp:5200,speed:28,damage:34,radius:34,sprite:7,xp:250},
};
export const MAX_ENEMIES = 150;
export const MAX_INVENTORY = 24;

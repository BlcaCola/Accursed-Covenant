import type { CharacterId, SkillId } from './types';

export interface CharacterDefinition {
  id: CharacterId; name: string; english: string; epithet: string; description: string;
  color: number; row: number; starting: [SkillId, SkillId]; skills: SkillId[];
  burst: { name: string; description: string; icon: string };
  builds:{name:string;skills:SkillId[];description:string}[];
}

/** Character identity changes ONLY appearance and skills. Economy and base stats live in Run. */
export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
  sorceress: {
    id: 'sorceress', name: '雷霆术士', english: 'THE SORCERESS', epithet: '以雷霆，审判黑夜。',
    description: '让闪电穿过怪潮，以寒霜控制距离。积蓄法力，在雷霆降临时清空战场。',
    color: 0x8ebfe1, row: 0, starting: ['lightning', 'frost'], skills: ['lightning', 'frost', 'fire', 'arcane', 'stormOrb'],
    burst: { name: '雷霆审判', description: '对周围敌人降下雷霆并减速，击碎范围内的敌方投射物。', icon: 'lightning' },
    builds:[{name:'雷暴共鸣',skills:['lightning','stormOrb','arcane'],description:'法球建立阵地，链雷清场，秘法飞矢补足单体。'},{name:'霜火禁域',skills:['frost','fire','stormOrb'],description:'先冻结敌群，再用余烬和法球持续灼烧。'},{name:'秘法棱镜',skills:['arcane','lightning','frost'],description:'多重投射、暴击链雷与寒霜控制形成安全远程构筑。'}],
  },
  necromancer: {
    id: 'necromancer', name: '亡灵召唤师', english: 'THE NECROMANCER', epithet: '死亡，只是另一种召唤。',
    description: '驱使骸骨侍从追击敌人，以尸体引发爆炸。用骨盾与毒雾建立你的亡灵阵线。',
    color: 0xa9bd88, row: 1, starting: ['summon', 'poison'], skills: ['summon', 'poison', 'shield', 'corpse', 'bones'],
    burst: { name: '亡者归来', description: '召回最多六名强化骸骨侍从，震伤周围敌人，并引爆附近遗骸。', icon: 'summon' },
    builds:[{name:'尸潮统御',skills:['summon','corpse','shield'],description:'侍从制造尸骸，连续尸爆，骨盾保护召唤阵线。'},{name:'疫病骨矛',skills:['poison','bones','corpse'],description:'毒雾压缩敌群，骨矛贯穿，尸爆完成连锁。'},{name:'不死壁垒',skills:['summon','shield','poison'],description:'高数量侍从与周期骨盾构成持续推进的防线。'}],
  },
  bloodknight: {
    id: 'bloodknight', name: '血刃骑士', english: 'THE BLOOD KNIGHT', epithet: '让鲜血，铭刻你的誓言。',
    description: '以旋刃切开包围，以血矛穿透敌阵。把握近身窗口，处决负伤敌人并汲取生命。',
    color: 0xd58477, row: 2, starting: ['blades', 'blood'], skills: ['blades', 'blood', 'cleave', 'warcry', 'lance'],
    burst: { name: '猩红处决', description: '斩击近处敌人，对半血以下目标造成双倍伤害，命中恢复生命。', icon: 'blades' },
    builds:[{name:'旋刃屠场',skills:['blades','cleave','warcry'],description:'战吼控场，旋刃贴身切割，重斩清出突破口。'},{name:'血矛回环',skills:['blood','lance','blades'],description:'双重穿透与回返刃覆盖直线，旋刃处理近身敌人。'},{name:'铁血处刑',skills:['cleave','warcry','blood'],description:'护盾换取贴身窗口，对受控和低生命目标连续处决。'}],
  },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

import type {Skill,SkillId} from './types';

export type SkillBranch=Exclude<Skill['branch'],null>;
export interface SkillEvolution{name:string;description:string;apex:string;tag:string}

/** Every regular skill has two mutually exclusive identities at level three. */
export const SKILL_EVOLUTIONS:Record<SkillId,Record<SkillBranch,SkillEvolution>>={
  lightning:{wide:{name:'分裂雷网',description:'额外跳跃 2 次，单段伤害降低 15%，优先覆盖更多目标。',apex:'万雷织网：额外获得 3 次跳跃。',tag:'清群'},focused:{name:'裁决雷核',description:'伤害提高 35%，剩余跳跃转化为对首要目标的追加伤害。',apex:'天罚回响：最后一次命中再次轰击首要目标。',tag:'首领'}},
  blades:{wide:{name:'逐猎飞刃',description:'旋刃改为向外飞出并返回，可从安全距离持续切割。',apex:'五星轮舞：飞刃数量增加至 5 枚。',tag:'回返'},focused:{name:'贴身绞杀',description:'伤害提高 35%，保留贴身环斩与更稳定的命中覆盖。',apex:'双重绞杀：环斩后追加一次反向斩击。',tag:'近战'}},
  frost:{wide:{name:'永冻环域',description:'冰环半径扩大 30%，更适合控制大群敌人。',apex:'霜原残响：留下大范围持续冰域。',tag:'控制'},focused:{name:'极寒之心',description:'伤害提高 35%，寒冷持续时间显著延长。',apex:'绝对零度：冻结中心敌人并留下高伤冰域。',tag:'冻结'}},
  fire:{wide:{name:'焚城余烬',description:'燃烧区域扩大 30%，覆盖更多通道与怪群。',apex:'陨火群落：额外生成两处燃烧区域。',tag:'范围'},focused:{name:'坠星熔核',description:'伤害提高 35%，将火力集中在较小区域。',apex:'熔核震爆：落地时立即造成一次爆发伤害。',tag:'爆发'}},
  blood:{wide:{name:'血潮贯阵',description:'血矛额外贯穿 3 名敌人，适合直线怪群。',apex:'三叉血潮：同时投出三根血矛。',tag:'穿透'},focused:{name:'噬心血枪',description:'伤害提高 35%，强化单体吸血与处决能力。',apex:'心脉贯穿：主血矛伤害额外提高 25%。',tag:'吸血'}},
  poison:{wide:{name:'腐国迷雾',description:'毒雾范围扩大 30%，持续封锁更宽阔的区域。',apex:'瘟疫蔓延：额外生成两片毒雾。',tag:'持续'},focused:{name:'蚀骨毒沼',description:'伤害提高 35%，毒雾集中并快速侵蚀目标。',apex:'剧毒迸发：施放时立即侵蚀区域内敌人。',tag:'腐蚀'}},
  summon:{wide:{name:'骸骨军团',description:'召唤上限增加 1 名，以数量建立前线。',apex:'亡军列阵：再增加 1 名侍从并延长持续时间。',tag:'数量'},focused:{name:'骸骨冠军',description:'侍从伤害提高 35%，以精锐单位追击强敌。',apex:'死者先锋：侍从攻击造成更强硬直。',tag:'精锐'}},
  shield:{wide:{name:'白骨城垒',description:'震击半径扩大 30%，保护更大的近身区域。',apex:'骸骨圣域：获得护盾时释放第二次外环震击。',tag:'防线'},focused:{name:'不破骨铠',description:'技能伤害提高 35%，并获得更厚的个人护盾。',apex:'不朽甲胄：护盾量额外提高 35%。',tag:'护盾'}},
  arcane:{wide:{name:'秘法弹幕',description:'额外发射 2 枚飞矢，形成更宽的扇形弹幕。',apex:'七星棱镜：再增加 2 枚飞矢。',tag:'多重'},focused:{name:'贯界飞矢',description:'伤害提高 35%，每枚飞矢额外贯穿 3 名敌人。',apex:'棱镜重叠：中心飞矢造成一次追加命中。',tag:'贯穿'}},
  stormOrb:{wide:{name:'雷云领域',description:'放电区域扩大 30%，适合长时间封锁战场。',apex:'群星布雷：额外建立两处小型雷区。',tag:'阵地'},focused:{name:'超载雷核',description:'伤害提高 35%，法球集中轰击较小区域。',apex:'雷核坍缩：施放时立即释放一次电击。',tag:'爆发'}},
  corpse:{wide:{name:'尸潮连爆',description:'爆炸半径扩大 30%，并一次消耗最多 5 具遗骸。',apex:'葬场共鸣：每具遗骸引发更宽的连锁爆炸。',tag:'连锁'},focused:{name:'骸骨炸弹',description:'伤害提高 35%，集中引爆距离目标最近的遗骸。',apex:'血肉压缩：主爆炸追加一次中心震爆。',tag:'单体'}},
  bones:{wide:{name:'骨矛方阵',description:'骨矛额外贯穿 3 名敌人，覆盖完整敌阵。',apex:'三重骨阵：同时释放三道骨矛。',tag:'穿透'},focused:{name:'葬王骨枪',description:'伤害提高 35%，强化对精英与首领的单体打击。',apex:'王骨贯心：主骨矛伤害额外提高 25%。',tag:'首领'}},
  cleave:{wide:{name:'裂地横扫',description:'斩击半径扩大 30%，清出更宽的突破口。',apex:'大地余震：斩击后留下范围余震。',tag:'击退'},focused:{name:'断首重斩',description:'伤害提高 35%，集中斩击鼠标方向的敌人。',apex:'行刑回斩：对低生命敌人追加一次斩击。',tag:'处决'}},
  warcry:{wide:{name:'军团怒吼',description:'震慑半径扩大 30%，击退并减速更大范围敌人。',apex:'战场回声：短暂延续减速与压制区域。',tag:'控场'},focused:{name:'钢铁意志',description:'伤害提高 35%，并获得更厚的个人护盾。',apex:'不屈战魂：护盾量额外提高 35%。',tag:'生存'}},
  lance:{wide:{name:'三路回刃',description:'回旋飞刃变为三路扇形投掷，覆盖更多敌人。',apex:'六刃归潮：回返时获得额外穿透。',tag:'扇形'},focused:{name:'追魂飞刃',description:'伤害提高 35%，强化正面飞刃的贯穿伤害。',apex:'往返绝杀：回程伤害进一步提高。',tag:'单体'}},
};

export const evolutionFor=(skill:Skill):SkillEvolution|undefined=>skill.branch?SKILL_EVOLUTIONS[skill.id][skill.branch]:undefined;

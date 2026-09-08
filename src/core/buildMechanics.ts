import {SKILL_EVOLUTIONS,type SkillBranch} from './evolutions';
import type {Item,Skill,SkillId} from './types';

export interface EvolutionRelic {skill:SkillId;branch:SkillBranch;name:string;description:string;damage:number;area:number;cooldown:number}

/** One deterministic legendary covenant for every one of the 30 evolution paths. */
export const EVOLUTION_RELICS=Object.fromEntries(Object.entries(SKILL_EVOLUTIONS).map(([skill,branches])=>[
  skill,Object.fromEntries((['wide','focused'] as SkillBranch[]).map(branch=>{const evolution=branches[branch];return[branch,{
    skill:skill as SkillId,branch,name:`${evolution.name}之契`,
    description:branch==='wide'?`${evolution.name}获得 18% 范围、1 个额外目标或投射物，冷却缩短 8%。`:`${evolution.name}伤害提高 22%，冷却缩短 8%。`,
    damage:branch==='focused'?1.22:1.1,area:branch==='wide'?1.18:1,cooldown:.92,
  } satisfies EvolutionRelic]}))
])) as Record<SkillId,Record<SkillBranch,EvolutionRelic>>;

export const matchingEvolutionRelic=(items:Item[],skill:Skill):EvolutionRelic|undefined=>{
  if(!skill.branch)return;
  const match=items.find(item=>item.evolution?.skill===skill.id&&item.evolution.branch===skill.branch);
  return match?EVOLUTION_RELICS[skill.id][skill.branch]:undefined;
};

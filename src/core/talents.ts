import type {CharacterId,Session} from './types';

export type TalentStat='damage'|'maxHp'|'maxMana'|'crit'|'haste'|'speed'|'potionPower'|'goldFind'|'statusResist'|'eliteDamage'|'shopDiscount'|'armor';
export type TalentBranch='offense'|'mastery'|'survival';
export interface TalentNode{id:string;name:string;description:string;branch:TalentBranch;tier:1|2|3|4|5|6;maxRank:number;baseCost:number;requires?:string;stat:TalentStat;perRank:number;x:number;y:number}
const COST=[0,320,360,400,450,500,560] as const;
// Centers measured from the 1536×1024 sockets in talent-tree-v2.png. The
// arrays run from tier one at the root toward tier six at the crown.
const POSITIONS:Record<TalentBranch,readonly [number,number][]>= {
  offense:[[38.71,73.42],[34.41,62.64],[31.37,51.39],[28.48,40.02],[25.20,29.00],[21.21,17.87]],
  mastery:[[50,73.42],[50,62.64],[50,51.50],[50,40.37],[50,29.00],[50,17.52]],
  survival:[[61.05,73.05],[65.49,62.87],[68.55,51.39],[71.68,40.02],[74.41,27.95],[78.32,17.52]],
};
type NodeSpec=readonly[id:string,name:string,description:string,stat:TalentStat,perRank:number];
const branch=(kind:TalentBranch,specs:readonly NodeSpec[]):TalentNode[]=>specs.map((spec,index)=>{const[id,name,description,stat,perRank]=spec,tier=(index+1) as TalentNode['tier'],[x,y]=POSITIONS[kind][index];return{id,name,description,branch:kind,tier,maxRank:3,baseCost:COST[tier],requires:index?specs[index-1][0]:undefined,stat,perRank,x,y};});

/** Eighteen nodes and 54 ranks per character. A full tree costs about nine average victories. */
export const TALENT_TREES:Record<CharacterId,TalentNode[]>={
  sorceress:[
    ...branch('offense',[
      ['s-ember','余烬铭刻','所有伤害提高 2.00% / 级。','damage',.02],['s-overload','过载回路','暴击率提高 1.00% / 级。','crit',.01],['s-conduit','雷霆导体','冷却缩减提高 1.50% / 级。','haste',.015],['s-pierce','元素穿刺','精英与首领伤害提高 3.00% / 级。','eliteDamage',.03],['s-cataclysm','灾变增幅','所有伤害提高 2.50% / 级。','damage',.025],['s-tempest','无尽雷暴','精英与首领伤害提高 4.00% / 级。','eliteDamage',.04],
    ]),
    ...branch('mastery',[
      ['s-flow','秘法回流','冷却缩减提高 1.00% / 级。','haste',.01],['s-vessel','法力容器','最大法力提高 5.00 / 级。','maxMana',5],['s-step','相位步法','移动速度提高 2.00% / 级。','speed',.02],['s-focus','奥术专注','暴击率提高 0.75% / 级。','crit',.0075],['s-bargain','符文议价','商店价格降低 2.00% / 级。','shopDiscount',.02],['s-archon','执政官回响','最大法力提高 8.00 / 级。','maxMana',8],
    ]),
    ...branch('survival',[
      ['s-ward','寒冰护体','最大生命提高 8.00 / 级。','maxHp',8],['s-calm','元素沉静','状态抗性提高 3.00% / 级。','statusResist',.03],['s-tonic','炼金血剂','血瓶治疗提高 4.00% / 级。','potionPower',.04],['s-shell','结晶外壳','受到的伤害降低 1.00% / 级。','armor',.01],['s-reserve','秘能储备','最大生命提高 12.00 / 级。','maxHp',12],['s-barrier','棱晶壁垒','受到的伤害降低 1.50% / 级。','armor',.015],
    ]),
  ],
  necromancer:[
    ...branch('offense',[
      ['n-bone','骨文研习','所有伤害提高 2.00% / 级。','damage',.02],['n-harvest','灵魂收割','精英与首领伤害提高 2.50% / 级。','eliteDamage',.025],['n-spite','墓穴恶意','暴击率提高 1.00% / 级。','crit',.01],['n-plaguefire','疫火灌注','所有伤害提高 2.00% / 级。','damage',.02],['n-reaper','死神凝视','精英与首领伤害提高 3.50% / 级。','eliteDamage',.035],['n-crown','亡军冠冕','暴击率提高 1.25% / 级。','crit',.0125],
    ]),
    ...branch('mastery',[
      ['n-ritual','迅捷仪式','冷却缩减提高 1.00% / 级。','haste',.01],['n-offering','丰饶祭品','金币获取提高 3.00% / 级。','goldFind',.03],['n-march','亡者行军','移动速度提高 2.00% / 级。','speed',.02],['n-vessel','灵魂容器','最大法力提高 5.00 / 级。','maxMana',5],['n-whisper','亡者低语','商店价格降低 2.00% / 级。','shopDiscount',.02],['n-covenant','永夜契约','冷却缩减提高 1.50% / 级。','haste',.015],
    ]),
    ...branch('survival',[
      ['n-flesh','借尸还魂','最大生命提高 9.00 / 级。','maxHp',9],['n-plague','疫病适应','状态抗性提高 3.00% / 级。','statusResist',.03],['n-elixir','尸花药剂','血瓶治疗提高 4.00% / 级。','potionPower',.04],['n-carapace','骸骨甲片','受到的伤害降低 1.00% / 级。','armor',.01],['n-marrow','不朽骨髓','最大生命提高 13.00 / 级。','maxHp',13],['n-shell','骨甲王座','受到的伤害降低 1.50% / 级。','armor',.015],
    ]),
  ],
  bloodknight:[
    ...branch('offense',[
      ['b-edge','血刃磨砺','所有伤害提高 2.00% / 级。','damage',.02],['b-hunt','猎首者','精英与首领伤害提高 2.50% / 级。','eliteDamage',.025],['b-thirst','猩红渴望','暴击率提高 1.00% / 级。','crit',.01],['b-rend','撕裂锻炼','所有伤害提高 2.00% / 级。','damage',.02],['b-execution','行刑者','精英与首领伤害提高 3.50% / 级。','eliteDamage',.035],['b-frenzy','猩红狂热','暴击率提高 1.25% / 级。','crit',.0125],
    ]),
    ...branch('mastery',[
      ['b-stride','战场步法','移动速度提高 2.00% / 级。','speed',.02],['b-plunder','染血战利品','金币获取提高 3.00% / 级。','goldFind',.03],['b-tempo','连斩节奏','冷却缩减提高 1.00% / 级。','haste',.01],['b-reserve','战意储备','最大法力提高 5.00 / 级。','maxMana',5],['b-dealer','佣兵门路','商店价格降低 2.00% / 级。','shopDiscount',.02],['b-onslaught','无休猛攻','冷却缩减提高 1.50% / 级。','haste',.015],
    ]),
    ...branch('survival',[
      ['b-vigor','铁血体魄','最大生命提高 10.00 / 级。','maxHp',10],['b-draught','烈性血瓶','血瓶治疗提高 4.00% / 级。','potionPower',.04],['b-resolve','钢铁意志','状态抗性提高 3.00% / 级。','statusResist',.03],['b-mail','染血锁甲','受到的伤害降低 1.00% / 级。','armor',.01],['b-colossus','巨像血脉','最大生命提高 15.00 / 级。','maxHp',15],['b-plate','重甲誓约','受到的伤害降低 1.50% / 级。','armor',.015],
    ]),
  ],
};

const RANK_MULTIPLIER=[1,1.35,1.75] as const;
export const talentRankCost=(node:TalentNode,currentRank:number)=>Math.round(node.baseCost*RANK_MULTIPLIER[Math.max(0,Math.min(2,currentRank))]);
export const talentTreeCost=(character:CharacterId)=>TALENT_TREES[character].reduce((sum,node)=>sum+Array.from({length:node.maxRank},(_,rank)=>talentRankCost(node,rank)).reduce((a,b)=>a+b,0),0);
export function talentBonus(session:Session,character:CharacterId,stat:TalentStat):number{return TALENT_TREES[character].reduce((sum,node)=>sum+(node.stat===stat?(session.talents[character]?.[node.id]??0)*node.perRank:0),0);}
export function canBuyTalent(session:Session,character:CharacterId,id:string):boolean{const node=TALENT_TREES[character].find(value=>value.id===id);if(!node)return false;const rank=session.talents[character]?.[id]??0;return rank<node.maxRank&&(!node.requires||(session.talents[character]?.[node.requires]??0)>=3)&&session.gold>=talentRankCost(node,rank);}
export function buyTalent(session:Session,character:CharacterId,id:string):boolean{const node=TALENT_TREES[character].find(value=>value.id===id);if(!node||!canBuyTalent(session,character,id))return false;const rank=session.talents[character][id]??0;session.gold-=talentRankCost(node,rank);session.talents[character][id]=rank+1;return true;}
export function refundTalent(session:Session,character:CharacterId,id:string):number{const node=TALENT_TREES[character].find(value=>value.id===id),rank=session.talents[character]?.[id]??0;if(!node||rank<=0||TALENT_TREES[character].some(child=>child.requires===id&&(session.talents[character]?.[child.id]??0)>0))return 0;const refund=Math.floor(talentRankCost(node,rank-1)/2);session.talents[character][id]=rank-1;session.gold+=refund;return refund;}

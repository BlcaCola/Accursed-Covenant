import {THEME_DESIGNS} from './core/themeDesigns';

export type Locale='zh'|'en';

let locale:Locale='zh';
export const getLocale=():Locale=>locale;
export const setLocale=(value:Locale):void=>{locale=value;if(typeof document!=='undefined')document.documentElement.lang=value==='zh'?'zh-CN':'en';};

const phrases:Record<string,string>={
  // Campaign themes.
  '回声洞穴':'Echoing Caverns','遗忘地牢':'Forgotten Dungeon','沉没圣堂':'Sunken Cathedral','荒弃村庄':'Abandoned Village','焦灼地狱':'Burning Inferno',
  '断脊山道':'Broken Ridge','疫病城镇':'Plagued Town','灰冠皇宫':'Ashen Palace','王室墓窟':'Royal Catacombs','腐水下道':'Drowned Sewers',
  '霜封遗迹':'Frozen Ruins','哀嚎沼泽':'Wailing Marsh','黑铁矿井':'Black Iron Mine','流沙神殿':'Buried Temple','深渊要塞':'Abyssal Fortress',
  // Skills, ultimates, builds, and statuses shown during play.
  '连锁闪电':'Chain Lightning','幽魂旋刃':'Spectral Blades','寒霜新星':'Frost Nova','陨落余烬':'Falling Ember','穿心血矛':'Heartpiercer',
  '腐蚀迷雾':'Corrosive Mist','亡灵侍从':'Undead Retinue','白骨圣盾':'Bone Aegis','秘法飞矢':'Arcane Bolts','雷电法球':'Storm Orb',
  '尸骸爆破':'Corpse Burst','白骨长矛':'Bone Spear','裂地重斩':'Earthsplitter','铁血战吼':'Iron Warcry','回旋飞刃':'Returning Blade',
  '雷霆审判':'Storm Judgment','亡者归来':'Return of the Dead','猩红处决':'Crimson Execution','幽影闪避':'Shadow Dash',
  '雷暴共鸣':'Tempest Resonance','霜火禁域':'Frostfire Dominion','秘法棱镜':'Arcane Prism','尸潮统御':'Corpse Dominion','疫病骨矛':'Plague Spear','不死壁垒':'Undying Bastion','旋刃屠场':'Blade Slaughter','血矛回环':'Blood Lance Cycle','铁血处刑':'Ironblood Execution',
  '中毒':'Poisoned','流血':'Bleeding','眩晕':'Stunned','寒冷':'Chilled','诅咒':'Cursed','燃烧':'Burning',
  '选择你的契约者':'CHOOSE YOUR COVENANT','选择角色':'Choose character','选择此角色':'Choose character','◆ 已选定':'◆ SELECTED','灰 烬 契 约':'ASHBOUND',
  '初始技能与专属技能池':'Starting skills and exclusive skill pool','初始':'STARTING','共用行囊 · 装备与成长跨角色继承':'Shared stash · Gear and progress carry across characters',
  '天赋树':'Talent Tree','正在唤醒圣堂…':'Awakening the sanctuary…','每局可重新选择角色 · 三名角色拥有独立天赋树 · 刷新或关闭页面后清空进度':'Choose a character for every run · Each has a separate talent tree · Refreshing or closing clears all progress',
  '游戏设置':'Game settings','声音开关 [M]':'Sound [M]','关闭音效':'Mute sound','开启音效':'Enable sound','全屏':'Fullscreen','切换全屏':'Toggle fullscreen','暂停 [Esc]':'Pause [Esc]','暂停游戏':'Pause game',
  '已放逐':'BANISHED','灰烬金币':'ASH GOLD','圣堂地图':'SANCTUARY MAP','展开或收起地图':'Expand or collapse map','◆ 你':'◆ YOU','◆ 宝箱':'◆ CHEST','◆ 事件':'◆ EVENT',
  '在怪潮中成长':'Grow within the horde','收集经验，构筑你的第一个流派':'Gather essence and shape your first build','贪 欲':'GREED','地图首领':'MAP GUARDIAN',
  '生命':'Life','法力':'Mana','血瓶':'Potion','移动':'Move','装备':'Gear','请使用电脑键盘游玩 · 建议横屏或全屏':'Keyboard play recommended · Use landscape or fullscreen',
  '正在构筑地图':'FORGING THE MAP','解析随机房间与碰撞…':'Resolving random rooms and collision…','地图已完成':'Map complete','唤醒怪物与光效…':'Awakening monsters and effects…',
  '烘焙高清地板与墙体…':'Baking high-resolution floors and walls…','烘焙标准地板与墙体…':'Baking standard floors and walls…','烘焙性能地板与墙体…':'Baking optimized floors and walls…','分片铺设陈列回廊…':'Laying out gallery sections…','分片烘焙高清地板…':'Baking high-resolution floor sections…','铺设房间纹样与场景物件…':'Placing chamber motifs and scenery…','读取地图种子…':'Reading map seed…',
  '契约者的行装':'Covenant Gear','关闭装备':'Close inventory','当前构筑方向：':'Current build: ','当前特殊效果':'Active special effects','战利品':'LOOT','比较与换装时战斗暂停':'Combat pauses while comparing gear',
  '行囊仍然空着':'The pack is still empty','返回战斗':'Return to battle','可用金币':'Available gold','分解装备会转为本局金币':'Salvaged gear becomes run gold',
  '流亡商人的珍藏':'The Exile Merchant’s Stock','铁匠的灰烬锻台':'The Blacksmith’s Ash Forge','结束交易':'End trade','离开锻台':'Leave forge','商人':'Merchant','铁匠':'Blacksmith','乞丐':'Beggar','远方旅客':'Distant Traveler',
  '下一道门通往何处？':'Where does the next gate lead?','踏入此门':'Enter this gate','选择后立即进入下一张地图':'Choosing immediately enters the next map',
  '从净化的圣印中选择回报':'Choose a reward from the purified seal','房间回报':'CHAMBER REWARD','接受回报':'Take reward','战斗已暂停':'Combat paused','首领封印进度':'Boss seal progress',
  '诅咒宝箱':'Cursed Chest','血誓祭坛':'Blood Oath Altar','贪 欲 祭 坛':'GREED ALTAR','猎杀契约':'Hunt Contract','限时猎杀':'Timed Hunt','完成':'Complete','失败':'Failed','接受契约':'Accept covenant','暂不接受 · 返回探索':'Decline · Return to exploration',
  '力量，理应有代价。':'Power must have a price.','当前装备品质概率':'Current gear rarity rates','普通来源　精英/首领':'Normal source　Elite/Boss','降低一阶':'Lower one rank','提高贪欲':'Raise Greed','完成祭献，返回战斗':'Complete offering and return',
  '圣堂，暂归寂静。':'The sanctuary falls silent.','你的远征已暂停。':'Your expedition is paused.','继续远征':'Continue expedition','画质档位':'Graphics quality','画面震动':'Screen shake','自动法力增幅':'Automatic mana amplification','开启':'On','关闭':'Off','高清':'High','标准':'Standard','性能':'Performance','轻微':'Low',
  '八重门扉，尽数破碎。':'All eight gates lie shattered.','你归于灰烬。':'You return to ash.','远征时间':'Run time','放逐敌人':'Enemies banished','总伤害':'Total damage','暴击率':'Critical rate','最大一击':'Largest hit','承受伤害':'Damage taken','伤害来源':'Damage sources','角色传承树':'Character legacy tree','打开天赋树':'Open talent tree','返回营地 · 更换角色':'Return to camp · Change character',
  '怪物陈列回廊 · 自由测试':'Bestiary Gallery · Free testing','北侧房间各陈列一种怪物 · 离开镜头即销毁 · 击杀后重生 · 死亡返回入口':'Each north room holds one monster · Offscreen monsters despawn · Kills respawn · Death returns you to the entrance',
  '封门围攻':'Sealed Siege','精英阵列':'Elite Formation','守住圣印':'Defend the Seal','猎杀目标':'Hunt the Target','机关杀阵':'Trap Gauntlet','宝藏伏击':'Treasure Ambush','房门封闭':'DOORS SEALED','首领圣所已经开启':'BOSS SANCTUM UNLOCKED','净化关键房间，解除首领封印':'Purify key chambers to break the boss seal','关键房间':'Key chambers','剩余敌人':'Enemies remaining',
  '已发现':'Discovered','发现 ·':'Discovered ·','圣堂已经苏醒。移动，击杀，收集灰烬。':'The sanctuary awakens. Move, kill, and gather ash.','击碎裂纹墙壁 · 发现隐藏房间':'Break the cracked wall · Reveal a hidden chamber',
  '怪物陈列回廊 · 无掉落测试区域':'Bestiary Gallery · No-drop testing area','地图守卫':'Map Guardian','击败黑暗统治者':'Defeat the Dark Sovereign','击败地图首领':'Defeat the Map Guardian',
  ' · 地图 ':' · Map ',' · 敌人 Lv.':' · Enemies Lv.',' 房间':' chambers','噩梦':'Nightmare','坚韧':'Resilient','狂乱':'Frenzied','虫群':'Swarming','易爆':'Volatile','丰饶':'Bountiful',
  '通往下一地图的出口已开启':'The exit to the next map is open','装备你的第一件战利品':'Equip your first piece of loot','按 I 打开装备 · 比较时战斗暂停':'Press I for gear · Combat pauses while comparing',
  '躲开攻击预警，保留法力用于':'Dodge telegraphed attacks and reserve mana for ','前往主路径末端的传送门 · 下一站':'Reach the portal at the end of the main path · Next: ',
  '坚守':'Hold for','离开事件区域将失败':'Leaving the event area will fail it','诅咒试炼 · 坚守此地':'Cursed Trial · Hold your ground',
  // Tutorial and common interaction copy.
  '闪避':'Dash',
  '使用 ':'Use ',' 或方向键探索房间。':' or the arrow keys to explore.','按 ':'Press ',' 穿过危险区域；拥有两次充能。':' to pass through danger; it has two charges.','受伤后按 ':'When injured, press ',' 恢复半管生命。':' to restore half your life.',
  '在入口祭坛按 ':'At the entrance altar, press ',' 调整贪欲：敌人更强、密度更高，装备品质更好。':' to adjust Greed: enemies become tougher and denser, while loot quality improves.','靠近装备按 ':'Near gear, press ',' 快捷取走，按 ':' to pick it up, then press ',' 比较词缀与特殊机制。':' to compare affixes and special mechanics.',
  '地面装备 ·':'Ground loot ·','拾取':'Pick up','战力':'Power','对比 ':'Compared with ','该槽位尚未装备':'Nothing equipped in this slot',
  // Character copy on the selection screen.
  '以雷霆，审判黑夜。':'Judge the night with thunder.','死亡，只是另一种召唤。':'Death is only another summons.','让鲜血，铭刻你的誓言。':'Let blood engrave your oath.',
  '让闪电穿过怪潮，以寒霜控制距离。积蓄法力，在雷霆降临时清空战场。':'Chain lightning through the horde and use frost to control distance. Gather mana, then clear the field with thunder.',
  '驱使骸骨侍从追击敌人，以尸体引发爆炸。用骨盾与毒雾建立你的亡灵阵线。':'Command skeletal servants and detonate the fallen. Build an undead front with bone shields and poison mist.',
  '以旋刃切开包围，以血矛穿透敌阵。把握近身窗口，处决负伤敌人并汲取生命。':'Carve through encirclement with spinning blades and pierce ranks with blood lances. Execute the wounded and drain their life.',
  '雷霆术士':'Storm Sorceress','亡灵召唤师':'Necromancer','血刃骑士':'Blood Knight','黄色稀有装备':'Rare gear','高阶装备':'High-tier gear','普通':'Normal','精英':'Elite','超级精英':'Super Elite','首领':'Boss',
  '普通品质':'Common','魔法品质':'Magic','稀有品质':'Rare','史诗品质':'Epic','套装品质':'Set','暗金品质':'Unique','传奇品质':'Legendary','金币':'Gold','地图':'Map','剩余':'Remaining','波次':'Wave','级解锁':' unlocks','级':' Lv.'
};

// Room labels already have stable English archetype IDs. Reuse them so every
// procedurally selected chamber name follows the language toggle without a
// second hand-maintained list.
const humanize=(value:string)=>value.split('-').map(word=>word[0]?.toUpperCase()+word.slice(1)).join(' ');
for(const design of Object.values(THEME_DESIGNS)){
  for(const type of Object.keys(design.roomNames) as Array<keyof typeof design.roomNames>){
    const names=design.roomNames[type],archetypes=design.archetypes[type];
    names.forEach((name,index)=>{phrases[name]=humanize(archetypes[index%archetypes.length]);});
  }
  phrases[design.secretName]=humanize(design.secretArchetype);
  phrases[design.hazardName]=humanize(design.hazard);
}

const ordered=Object.entries(phrases).sort((a,b)=>b[0].length-a[0].length);
export function t(value:string):string{
  if(locale==='zh'||!value)return value;
  let translated=phrases[value]??value;
  if(translated===value)for(const[from,to]of ordered)translated=translated.replaceAll(from,to);
  return translated;
}

/** Translate generated UI after each render while preserving icons and values. */
const originalText=new WeakMap<Node,string>(),originalAttributes=new WeakMap<HTMLElement,Record<string,string>>();
export function localizeDom(root:HTMLElement):void{
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;
  while((node=walker.nextNode()))if(node.nodeValue?.trim()){
    const known=originalText.get(node),source=known??node.nodeValue;originalText.set(node,source);node.nodeValue=locale==='en'?t(source):source;
  }
  for(const element of root.querySelectorAll<HTMLElement>('[title],[aria-label],[placeholder]')){
    const stored=originalAttributes.get(element)??{};
    for(const attr of ['title','aria-label','placeholder']){const value=stored[attr]??element.getAttribute(attr);if(value){stored[attr]=value;element.setAttribute(attr,locale==='en'?t(value):value);}}
    originalAttributes.set(element,stored);
  }
}

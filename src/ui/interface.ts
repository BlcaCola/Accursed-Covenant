import { RARITY_NAMES, SKILLS, SLOT_NAMES, SLOTS } from '../core/catalog';
import { CHARACTERS, CHARACTER_IDS } from '../core/characters';
import { BASE_NAMES, QUALITY_ORDER, RARITY_COLORS, SET_NAMES, WEAPONS, rarityRates, setPieces } from '../core/equipment';
import { itemValue } from '../core/loot';
import type { Run } from '../core/run';
import type { CharacterId, Item, SkillId } from '../core/types';
import { icon, slotIcon } from './icons';
import { THEMES } from '../core/themes';
import { wingName } from '../core/cosmetics';
import { fixed2 } from '../core/random';
import {buyTalent,refundTalent,TALENT_TREES,talentRankCost,talentTreeCost} from '../core/talents';
import {getLocale,localizeDom,setLocale} from '../i18n';
import {evolutionFor} from '../core/evolutions';

interface Callbacks { start: (character: CharacterId) => void; command: (command: string) => void; forge: () => void; language?:()=>void; }
const timeText = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const hex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;

/** DOM UI is refreshed at 10 Hz; modals rebuild only when their relevant state changes. */
export class Interface {
  private root: HTMLElement;
  private modal: HTMLElement;
  private lastUpdate = 0;
  private modalKey = '';
  private selected: CharacterId = 'sorceress';
  private ready = false;
  private started = false;
  private mapExpanded = false;
  private sound = true;
  private minimap: HTMLCanvasElement;
  private current?: Run;
  private focusBeforeModal?: HTMLElement;
  private campTalentOpen=false;
  private loadingTimer?:number;
  private explainedHighLoot=false;

  constructor(private callbacks: Callbacks) {
    this.root = document.querySelector('#interface')!;
    this.root.innerHTML = `
      <div class="vignette" aria-hidden="true"></div>
      <header class="topbar">
        <div class="wordmark"><span class="brand-sigil">♜</span><div>ACCURSED COVENANT<small>诅 咒 契 约</small></div><span class="build-tag">DEMO 15</span></div>
        <div class="region"><span class="eyebrow" id="theme-subtitle">THE SUNKEN CATHEDRAL</span><span id="stage-name">沉没圣堂 · 地图 1 / 8</span></div>
        <nav aria-label="游戏设置"><button class="icon-button language-button" data-command="language" id="language-button" title="中文 / English" aria-label="切换中英文">${getLocale()==='zh'?'EN':'中'}</button><button class="icon-button" data-command="sound" id="sound-button" title="声音开关 [M]" aria-label="关闭音效">♪</button><button class="icon-button" data-command="fullscreen" title="全屏" aria-label="切换全屏">⛶</button><button class="icon-button" data-command="pause" title="暂停 [Esc]" aria-label="暂停游戏">Ⅱ</button></nav>
      </header>
      <div class="run-info" id="run-info"><div class="clock"><span id="timer">00:00</span><small id="character-name">雷霆术士</small></div><span class="info-divider"></span><div><b id="kills">0</b><small>已放逐</small></div><div><b id="gold">0</b><small>全部金币</small></div></div>
      <aside class="map-panel" id="map-panel"><div class="map-heading"><span>圣堂地图</span><button data-command="map" aria-label="展开或收起地图">TAB ↗</button></div><canvas id="minimap" width="192" height="156" aria-label="地图：青色为你，红色为祭坛，金色为未开启宝箱"></canvas><div class="map-legend"><span>◆ 你</span><span>◆ 宝箱</span><span>◆ 事件</span></div></aside>
      <div class="objective" id="objective"><span class="objective-marker">◇</span><div><strong id="objective-title">在怪潮中成长</strong><span id="objective-detail">收集经验，构筑你的第一个流派</span></div></div>
      <div class="status-effects" id="status-effects"></div>
      <div class="greed-tag" id="greed-tag"><span>贪 欲</span><b id="greed-value">Ⅰ</b><div id="greed-pips"></div></div>
      <div class="boss-bar" id="boss-bar" hidden><span id="boss-name">地图首领</span><div><i id="boss-fill"></i></div><small id="boss-percent"></small></div>
      <div class="notifications" id="notifications" aria-live="polite"></div>
      <div class="interact-prompt" id="interact-prompt" hidden></div>
      <div class="quick-compare" id="quick-compare" hidden></div>
      <div class="item-tooltip" id="item-tooltip" hidden role="tooltip"></div>
      <div class="map-loading" id="map-loading" hidden role="status" aria-live="polite"><div class="loading-rune"><i></i><b>◆</b></div><span class="eyebrow">DESCENDING INTO DARKNESS</span><strong>正在构筑地图</strong><small id="loading-label">解析随机房间与碰撞…</small><div class="loading-progress"><i id="loading-progress"></i></div><b id="loading-percent">0.00%</b></div>
      <footer class="hud" id="hud">
        <div class="hud-art"><img src="assets/ui/hud-frame-v1.png" alt="" aria-hidden="true" />
        <div class="class-resource" id="class-resource" title=""><header><b id="class-resource-name">元素共鸣</b><span id="class-resource-value">0.00 / 100.00</span></header><div><i id="class-resource-fill"></i></div><small id="class-resource-hint"></small></div>
        <div class="orb-group life-group"><div class="orb-mount"><div class="wing wing-left"></div><div class="wing wing-right"></div><div class="orb life-orb" role="meter" aria-label="生命" aria-valuemin="0" aria-valuemax="100" id="life-meter"><div class="orb-liquid" id="life-liquid"><i></i></div><div class="glass"></div><div class="orb-shield" id="orb-shield"></div></div><span class="mount-jewel">◆</span></div><div class="orb-caption"><div class="orb-label"><span>生命</span><small>LIFE</small></div><div class="orb-value" id="life-value">300 <span>/ 300</span></div></div></div>
        <div class="hotbar"><div class="experience"><span id="level">LV. 1</span><div><i id="xp-fill"></i></div><span id="xp-label">0 / 25</span></div><div class="skill-slots" id="skill-slots"></div><div class="hotbar-bottom"><button data-command="potion" id="potion-button"><kbd>R</kbd> 血瓶 <b>3</b></button><span class="movement-hint"><kbd>W A S D</kbd> 移动</span><button data-command="inventory" id="inventory-button"><kbd>I</kbd> 装备 <b>0</b></button></div></div>
        <div class="orb-group mana-group"><div class="orb-mount"><div class="wing wing-left"></div><div class="wing wing-right"></div><div class="orb mana-orb" role="meter" aria-label="法力" aria-valuemin="0" aria-valuemax="100" id="mana-meter"><div class="orb-liquid" id="mana-liquid"><i></i></div><div class="glass"></div></div><span class="mount-jewel">◆</span></div><div class="orb-caption"><div class="orb-label"><span>法力</span><small>MANA</small></div><div class="orb-value" id="mana-value">100 <span>/ 100</span></div></div></div>
        </div>
      </footer>
      <div class="modal-layer" id="modal-layer"></div>
      <div class="compact-notice">请使用电脑键盘游玩 · 建议横屏或全屏</div>
    `;
    this.modal = this.root.querySelector('#modal-layer')!;
    this.minimap = this.root.querySelector('#minimap')!;
    this.root.addEventListener('click', e => this.click(e));
    this.root.addEventListener('keydown', e => this.trapFocus(e));
    this.root.addEventListener('pointerover',e=>this.showItemTooltip(e as PointerEvent));
    this.root.addEventListener('pointermove',e=>this.positionItemTooltip(e as PointerEvent));
    this.root.addEventListener('pointerout',e=>{const from=(e.target as HTMLElement).closest<HTMLElement>('[data-item-tooltip]'),related=e.relatedTarget,to=related instanceof Element?related.closest<HTMLElement>('[data-item-tooltip]'):null;if(from&&from!==to)this.hideItemTooltip();});
    this.showStart();
  }
  setReady(): void { this.ready = true;if(!this.campTalentOpen)this.showStart(); }
  bind(run:Run):void{this.current=run;}
  setLoading(visible:boolean,progress=0,label='正在构筑地图…'):void{
    const loading=this.root.querySelector<HTMLElement>('#map-loading')!;
    if(this.loadingTimer!==undefined){window.clearTimeout(this.loadingTimer);this.loadingTimer=undefined;}
    if(visible){loading.hidden=false;loading.classList.add('visible');(this.root.querySelector('#loading-progress') as HTMLElement).style.width=`${progress}%`;this.root.querySelector('#loading-percent')!.textContent=`${fixed2(progress)}%`;this.root.querySelector('#loading-label')!.textContent=label;localizeDom(this.root);return;}
    // Keep the completed loading composition on screen briefly so a fast map
    // does not produce a distracting single-frame flash.
    this.loadingTimer=window.setTimeout(()=>{loading.classList.remove('visible');loading.hidden=true;this.loadingTimer=undefined;},320);
  }
  showStart(): void {
    this.started = false;this.campTalentOpen=false; this.root.classList.add('at-title'); this.modalKey = '';
    const character = CHARACTERS[this.selected], session = this.current?.session;
    this.modal.dataset.character = this.selected;
    this.modal.innerHTML = `<div class="selection-camp" aria-hidden="true"></div><section class="start-screen" role="dialog" aria-modal="true" aria-labelledby="game-title"><button class="selection-language" data-command="language" title="中文 / English">${getLocale()==='zh'?'EN':'中'}</button><header class="selection-header"><div class="start-rule"><span>◆</span> 选择你的契约者 <span>◆</span></div><div class="start-wordmark">ACCURSED COVENANT</div><h1 id="game-title">诅 咒 契 约</h1></header><div class="character-choices" aria-label="选择角色">${CHARACTER_IDS.map(id => { const c = CHARACTERS[id]; return `<button class="character-choice ${this.selected === id ? 'selected' : ''}" data-character="${id}" aria-pressed="${this.selected === id}" style="--character-color:${hex(c.color)}"><span class="character-mark">${icon(c.burst.icon)}</span><small>${c.english}</small><h2>${c.name}</h2><p>${c.epithet}</p><span class="character-chosen">${this.selected === id ? '◆ 已选定' : '选择此角色'}</span></button>`; }).join('')}</div><div class="character-details" style="--character-color:${hex(character.color)}"><div class="character-summary"><span class="eyebrow">${character.english}</span><h3>${character.name}</h3><p>${character.description}</p></div><div class="character-skill-preview"><span>初始技能与专属技能池</span><div>${character.skills.map(id => `<span class="preview-skill ${character.starting.includes(id) ? 'initial' : ''}" title="${SKILLS[id].description}">${icon(id)}<small>${SKILLS[id].name}</small>${character.starting.includes(id) ? '<i>初始</i>' : ''}</span>`).join('')}</div></div><div class="character-ultimate"><kbd>Q</kbd><h4>${character.burst.name}</h4><p>${character.burst.description}</p></div></div><div class="selection-footer"><div class="shared-stash"><span>共用行囊 · 装备与成长跨角色继承</span><small>金币 ${fixed2(session?.gold??0)}　已学天赋 ${session?Object.values(session.talents[this.selected]).reduce((a,b)=>a+b,0):0}　装备 ${Object.keys(session?.carried ?? {}).length + (session?.stash.length ?? 0)}</small></div><button class="secondary talent-open" data-command="talents">天赋树</button><button class="primary start-button" data-command="start" ${!this.ready ? 'disabled' : ''}>${this.ready ? `以${character.name}进入圣堂` : '正在唤醒圣堂…'} <span>→</span></button></div><p class="session-note">每局可重新选择角色 · 三名角色拥有独立天赋树 · 刷新或关闭页面后清空进度</p></section>`;
    this.modal.classList.add('visible', 'title-layer');localizeDom(this.root);
  }
  begin(): void { this.started = true;this.campTalentOpen=false;this.explainedHighLoot=false; this.root.classList.remove('at-title'); this.modal.classList.remove('title-layer','visible');this.modal.innerHTML=''; this.modalKey = ''; }
  private showTalents():void{const session=this.current?.session;if(!session)return;this.campTalentOpen=true;const character=CHARACTERS[this.selected],nodes=TALENT_TREES[this.selected],learned=Object.values(session.talents[this.selected]).reduce((a,b)=>a+b,0);this.modal.classList.add('visible','title-layer');this.modal.innerHTML=`<section class="talent-dialog" role="dialog" aria-modal="true" aria-labelledby="talent-title" style="--character-color:${hex(character.color)}"><header><div><span class="eyebrow">LEGACY OF ASH · 18 NODES / 54 RANKS</span><h2 id="talent-title">${character.name} · 传承天赋</h2><p>金币 ${fixed2(session.gold)} · 已投入 ${learned} / 54 级 · 全树约需 ${fixed2(talentTreeCost(this.selected))} 金币</p></div><button class="close-button" data-command="talent-close">×</button></header><div class="talent-canvas"><div class="talent-branch-label offense">毁灭</div><div class="talent-branch-label mastery">秘仪</div><div class="talent-branch-label survival">守御</div>${nodes.map(node=>{const rank=session.talents[this.selected][node.id]??0,cost=talentRankCost(node,rank),parentReady=!node.requires||(session.talents[this.selected][node.requires]??0)>=3,glyph=node.branch==='offense'?'✦':node.branch==='mastery'?'◇':'◆';return `<div class="talent-node ${node.branch} ${rank?'learned':''} ${parentReady?'':'locked'}" style="left:${node.x}%;top:${node.y}%"><button aria-label="${node.name} ${rank}/${node.maxRank}" data-talent-buy="${node.id}" ${rank>=node.maxRank||!parentReady||session.gold<cost?'disabled':''}><span>${glyph}</span><i>${Array.from({length:3},(_,i)=>`<b class="${i<rank?'on':''}"></b>`).join('')}</i></button><div class="talent-tooltip"><small>第 ${node.tier} 阶 · ${node.branch==='offense'?'毁灭':node.branch==='mastery'?'秘仪':'守御'}路线</small><strong>${node.name}</strong><span>${node.description}</span><em>${rank} / ${node.maxRank}</em><small>${rank>=node.maxRank?'已满级':parentReady?`升级费用 ${fixed2(cost)}`:'前置节点需要升满'}</small>${rank?`<button data-talent-refund="${node.id}">退回一级 · 返还 ${fixed2(Math.floor(talentRankCost(node,rank-1)/2))}</button>`:''}</div></div>`}).join('')}</div><footer><span>完整培养目标为约 8–10 次远征；退点返还该级消耗的 50.00%。</span><button class="primary" data-command="talent-close">返回营地</button></footer></section>`;localizeDom(this.root);}
  setSound(enabled: boolean): void { this.sound = enabled; const b = this.root.querySelector<HTMLButtonElement>('#sound-button')!; b.textContent = enabled ? '♪' : '♩'; b.classList.toggle('muted', !enabled); b.setAttribute('aria-label', enabled ? '关闭音效' : '开启音效'); }
  toggleMap(): void { this.mapExpanded = !this.mapExpanded; this.root.querySelector('#map-panel')!.classList.toggle('expanded', this.mapExpanded); }
  showError(message: string): void { this.modal.innerHTML = `<section class="dialog small-dialog"><span class="eyebrow">圣堂暂时无法打开</span><h2>加载未完成</h2><p>${message}</p><button class="primary" data-command="reload">重新加载</button></section>`; this.modal.classList.add('visible');localizeDom(this.root); }

  update(run: Run): void {
    this.current = run;
    if (!this.started) return;
    const now = performance.now(); if (now - this.lastUpdate < 90) return; this.lastUpdate = now;
    const text = (id: string, value: string) => { const el = this.root.querySelector(`#${id}`)!; if (el.textContent !== value) el.textContent = value; };
    const p = run.player, stats = run.stats;
    text('timer', timeText(run.time));text('kills',run.kills.toString());text('gold',fixed2(run.walletGold));
    text('character-name', run.character.name);
    text('theme-subtitle',run.showcaseMode?'BESTIARY GALLERY':run.theme.subtitle);text('stage-name',run.showcaseMode?'怪物陈列回廊 · 无掉落测试区域':`${run.theme.name} · 地图 ${run.floor} / 8 · 敌人 Lv.${run.recommendedEnemyLevel}${run.mapAffixes.length?' · '+run.mapAffixes.join(' / '):''}`);
    text('level',`LV. ${run.level}`);text('xp-label',`${fixed2(run.xp)} / ${fixed2(run.nextXp)}`);
    (this.root.querySelector('#xp-fill') as HTMLElement).style.width = `${Math.min(100, run.xp / run.nextXp * 100)}%`;
    this.root.querySelector('#life-value')!.innerHTML=`${fixed2(p.hp)} <span>/ ${fixed2(stats.maxHp)}</span>`;
    this.root.querySelector('#mana-value')!.innerHTML=`${fixed2(p.mana)} <span>/ ${fixed2(stats.maxMana)}</span>`;
    (this.root.querySelector('#life-meter') as HTMLElement).style.setProperty('--fill', `${Math.max(0,p.hp / stats.maxHp)*100}%`);
    (this.root.querySelector('#mana-meter') as HTMLElement).style.setProperty('--fill', `${p.mana}%`);
    this.root.querySelector('#life-meter')!.setAttribute('aria-valuenow', `${Math.round(p.hp / stats.maxHp * 100)}`);
    this.root.querySelector('#mana-meter')!.setAttribute('aria-valuenow', `${Math.round(p.mana)}`);
    this.root.querySelector('.life-orb')!.classList.toggle('low', p.hp / stats.maxHp < .25);
    (this.root.querySelector('#orb-shield') as HTMLElement).style.opacity = p.shield > 0 ? '.8' : '0';
    this.root.querySelector('#potion-button')!.innerHTML = `<kbd>R</kbd> 血瓶 <b>${p.potionCharges}</b>`;
    this.root.querySelector('#inventory-button')!.innerHTML = `<kbd>I</kbd> 装备 <b class="${run.inventory.length ? 'has-loot' : ''}">${run.inventory.length}</b>`;
    text('greed-value', run.greed ? `${run.greed}` : '—');
    this.root.querySelector('#greed-pips')!.innerHTML = Array.from({ length: 15 }, (_, i) => `<i class="${i < run.greed ? 'lit' : ''}"></i>`).join('');
    const statusNames={poison:'中毒',bleed:'流血',stun:'眩晕',chill:'寒冷',curse:'诅咒',burn:'燃烧'};this.root.querySelector('#status-effects')!.innerHTML=Object.entries(p.statuses).map(([id,status])=>`<span class="${id}">${statusNames[id as keyof typeof statusNames]} ${fixed2(status.duration)}s</span>`).join('');
    const resource=run.classResource,resourceBox=this.root.querySelector<HTMLElement>('#class-resource')!;resourceBox.hidden=!resource;if(resource){resourceBox.dataset.resource=run.characterId;resourceBox.classList.toggle('ready',resource.ready);resourceBox.title=resource.description;resourceBox.setAttribute('aria-label',`${resource.name}：${resource.description}`);text('class-resource-name',resource.name);text('class-resource-value',`${fixed2(resource.value)} / ${fixed2(resource.max)}`);text('class-resource-hint',resource.description);(this.root.querySelector<HTMLElement>('#class-resource-fill')!).style.width=`${resource.value}%`;}
    const slots = run.skills.map((s, i) => {const remaining=run.skillCooldownRemaining(s.id),duration=run.skillCooldownDuration(s),cooldownHeight=Math.min(100,remaining/Math.max(.01,duration)*100);return `<button class="skill-slot ${remaining<=0?'ready':''}" data-info="${s.id}" title="${SKILLS[s.id].name} [${i+1}] · ${s.level} 级 · ${fixed2(duration)} 秒冷却 · ${run.autoCast?'自动施法':'数字键手动施法'} · ${SKILLS[s.id].description}" style="--skill-color:${hex(SKILLS[s.id].color)}"><span class="slot-key">${i + 1}</span>${icon(s.id)}<span class="cooldown-overlay" style="height:${cooldownHeight}%"></span>${remaining>0?`<b class="cooldown-number">${fixed2(remaining)}</b>`:''}<span class="slot-level">${'◆'.repeat(s.level)}</span><span class="slot-name">${SKILLS[s.id].name}</span></button>`;});
    while (slots.length < 4) slots.push(`<div class="skill-slot empty"><span class="slot-key">${slots.length + 1}</span><span class="empty-sigil">＋</span><span class="slot-name">${slots.length === 2 ? '3 级解锁' : '6 级解锁'}</span></div>`);
    slots.push(`<button class="skill-slot burst-slot ${p.burstCooldown <= 0 && p.mana >= run.burstCost ? 'ready' : ''}" data-command="burst" title="${run.character.burst.name} [Q]：${run.burstCost} 法力，8 秒冷却。${run.character.burst.description}" style="--skill-color:${hex(run.character.color)}"><span class="slot-key">Q</span>${icon(run.character.burst.icon)}<span class="cooldown-overlay" style="height:${Math.round(p.burstCooldown / 8 * 100)}%"></span>${p.burstCooldown > 0 ? `<b class="cooldown-number">${fixed2(p.burstCooldown)}</b>` : ''}<span class="slot-name">${run.character.burst.name}</span></button>`);
    slots.push(`<button class="skill-slot dash-slot" data-command="dash" title="闪避 [Space]：两次充能，短暂无敌"><span class="slot-key">SPACE</span>${icon('dash')}<span class="slot-level">${'◆'.repeat(p.dashCharges)}${'◇'.repeat(2 - p.dashCharges)}</span><span class="slot-name">幽影闪避</span></button>`);
    // Avoid replacing focused buttons every tick; regenerate only when values actually change.
    const slotHtml = slots.join(''), slotBox = this.root.querySelector('#skill-slots')!;
    if (slotBox.innerHTML !== slotHtml) slotBox.innerHTML = slotHtml;
    const roomNames={siege:'封门围攻',elite:'精英阵列',survival:'守住圣印',hunt:'猎杀目标',mechanism:'机关杀阵',treasure:'宝藏伏击'};
    if(run.showcaseMode){text('objective-title','怪物陈列回廊 · 自由测试');text('objective-detail','北侧房间各陈列一种怪物 · 离开镜头即销毁 · 击杀后重生 · 死亡返回入口');}
    else if(run.activeRoomEncounter){const encounter=run.activeRoomEncounter,alive=run.enemies.filter(enemy=>enemy.encounterRoom===encounter.room&&enemy.hp>0).length;text('objective-title',`${roomNames[encounter.type]} · 房门封闭`);text('objective-detail',encounter.type==='survival'?`坚守 ${fixed2(encounter.remaining)} 秒 · 敌人 ${alive}`:`波次 ${encounter.wavesSpawned} / ${encounter.totalWaves} · 剩余敌人 ${alive}`);}
    else if (run.activeEncounter) { const e=run.activeEncounter; text('objective-title', e.kind==='cursed'?'诅咒试炼 · 坚守此地':'猎杀契约 · '+e.progress+' / 18'); text('objective-detail', `剩余 ${fixed2(Math.max(0,e.remaining))} 秒 · 离开事件区域将失败`); }
    else if (run.floorGuardian) { text('objective-title', run.floor===8?'击败黑暗统治者':'击败地图首领'); text('objective-detail', `躲开攻击预警，保留法力用于${run.character.burst.name}`); }
    else if(run.exitUnlocked){text('objective-title','通往下一地图的出口已开启');text('objective-detail',`前往主路径末端的传送门 · 下一站 ${run.floor<8?THEMES[run.campaign[run.floor]].name:''}`);}
    else if (run.inventory.length && !Object.values(run.equipped).length) { text('objective-title', '装备你的第一件战利品'); text('objective-detail', '按 I 打开装备 · 比较时战斗暂停'); }
    else { text('objective-title',run.bossUnlocked?'首领圣所已经开启':'净化关键房间，解除首领封印'); text('objective-detail', `关键房间 ${run.clearedKeyRooms} / ${run.requiredKeyRooms} · 已发现 ${run.discoveredRooms.size} / ${run.dungeon.rooms.length} 房间`); }
    const boss = run.floorGuardian;
    (this.root.querySelector('#boss-bar') as HTMLElement).hidden = !boss;
    if(boss){const phase=['','第一阶段 · 魔王降临','第二阶段 · 碎彩窗','第三阶段 · 末日丧钟'][run.bossPhase];text('boss-name',boss.name??'地图首领');(this.root.querySelector('#boss-fill') as HTMLElement).style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;text('boss-percent',`${run.floor===8?phase:'地图守卫'} · Lv.${boss.level??1} · ${fixed2(boss.hp)} / ${fixed2(boss.maxHp)}${run.bossCast?` · 施法：${run.bossCast.name} ${fixed2(run.bossCast.remaining)}s`:''}`);}
    const interaction = run.interaction, prompt = this.root.querySelector('#interact-prompt') as HTMLElement;
    prompt.hidden = !interaction || run.phase !== 'playing'; if (interaction) prompt.innerHTML = `<kbd>E</kbd> ${interaction.label}`;
    const nearest=run.nearestGroundItem,compare=this.root.querySelector<HTMLElement>('#quick-compare')!;
    if(nearest?.item&&Math.hypot(nearest.x-p.x,nearest.y-p.y)<240){const old=run.equipped[nearest.item.slot],delta=nearest.item.power-(old?.power??0),color=hex(RARITY_COLORS[nearest.item.rarity]);compare.hidden=false;compare.innerHTML=`<small>地面装备 · <kbd>F</kbd> 拾取</small><b style="color:${color}">${nearest.item.name}</b><span>Lv.${nearest.item.level??nearest.item.power} · 战力 <i class="${delta>=0?'positive':'negative'}">${delta>=0?'+':''}${fixed2(delta)}</i></span><em>${old?`对比 ${old.name}`:'该槽位尚未装备'}</em>`;}else compare.hidden=true;
    const high=run.inventory.find(item=>QUALITY_ORDER.indexOf(item.rarity)>=QUALITY_ORDER.indexOf('epic'));if(high&&!this.explainedHighLoot){this.explainedHighLoot=true;run.notify(`${RARITY_NAMES[high.rarity]}装备拥有更高词缀上限；颜色代表品质，等级决定数值基准`,'gold');}
    const notices = run.messages.map(m => `<div class="notice ${m.tone}">${m.text}</div>`).join(''), noticeBox = this.root.querySelector('#notifications')!;
    if (noticeBox.innerHTML !== notices) noticeBox.innerHTML = notices;
    this.drawMap(run); this.renderModal(run);localizeDom(this.root);
  }


  private drawMap(run: Run): void {
    const ctx = this.minimap.getContext('2d')!;
    const w = this.minimap.width, h = this.minimap.height, map = run.dungeon, local=!!map.showcase,px=run.player.x/32,py=run.player.y/32,scale=local?1.35:Math.min(1.48,(w-18)/(map.size*2),(h-28)/map.size);
    ctx.clearRect(0, 0, w, h);
    const xy = (x: number, y: number) => local?({x:w/2+(x-y-(px-py))*scale,y:h/2+(x+y-(px+py))*scale*.5}):({ x: w / 2 + (x - y) * scale, y: 23 + (x + y) * scale * .5 });
    ctx.fillStyle = '#58615d';
    const range=local?55:map.size,minX=local?Math.max(0,Math.floor(px)-range):0,maxX=local?Math.min(map.size-1,Math.floor(px)+range):map.size-1,minY=local?Math.max(0,Math.floor(py)-range):0,maxY=local?Math.min(map.size-1,Math.floor(py)+range):map.size-1;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (map.tiles[y * map.size + x] && run.explored[y * map.size + x]) { const p = xy(x, y); ctx.fillRect(p.x, p.y, 2, 1.2); }
    const dot = (x: number, y: number, color: string, r: number) => { const p = xy(x / 32, y / 32); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); };
    map.chests.forEach((c, i) => { if (!run.chestsOpened.has(i) && run.isExplored(c)) dot(c.x, c.y, '#d9b879', 2.4); });
    for(const e of run.encounters) if(run.isExplored(e)&&e.state!=='won'&&e.state!=='failed')dot(e.x,e.y,e.state==='active'?'#ff715c':'#bc92ea',3);
    for(const encounter of run.roomEncounters){const center=run.dungeon.rooms[encounter.room],position={x:(center.x+center.w/2)*32,y:(center.y+center.h/2)*32};if(run.isExplored(position))dot(position.x,position.y,encounter.state==='cleared'?'#7bc89a':encounter.state==='active'?'#f06b55':encounter.key?'#d5ae62':'#807b70',encounter.key?2.8:2);}
    if(run.isExplored(map.altar))dot(map.altar.x, map.altar.y, '#be6861', 2.5); dot(run.player.x, run.player.y, '#9ee6ee', 3);
    if (run.floorGuardian) dot(run.floorGuardian.x, run.floorGuardian.y, '#fc6453', 3);
    if(run.exitUnlocked&&run.floor<8)dot(map.exit.x,map.exit.y,'#87e5d1',4);
    if(run.showcaseMode||run.showcaseUnlocked&&run.floor===1)dot(run.showcasePortalPosition.x,run.showcasePortalPosition.y,'#d26cff',4);
  }

  private renderModal(run: Run): void {
    if(this.campTalentOpen)return;
    const key = `${run.phase}:${run.level}:${run.inventory.map(i => i.id).join(',')}:${Object.values(run.equipped).map(i => `${i.id}:${i.level}:${i.rarity}`).join(',')}:${run.greed}:${run.walletGold}:${run.amplify}:${run.autoCast}:${run.graphicsQuality}:${run.selectedEncounter}:${run.lootFilter}:${run.shopOffers.map(o=>o.sold).join('')}:${run.merchantPotionStock}:${run.clearedKeyRooms}`;
    if (key === this.modalKey) return; this.modalKey = key;
    this.hideItemTooltip();
    const open = run.phase !== 'playing';
    if (open && !this.modal.classList.contains('visible')) this.focusBeforeModal = document.activeElement as HTMLElement;
    this.modal.classList.toggle('visible', open); this.modal.classList.toggle('inventory-layer', run.phase === 'inventory');
    if (!open) { this.modal.innerHTML = ''; this.focusBeforeModal?.focus({ preventScroll: true }); return; }
    if (run.phase === 'upgrade') {
      const isNew = run.upgrades.some(c => c.kind === 'new');
      this.modal.innerHTML = `<section class="dialog upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="upgrade-title"><div class="dialog-ornament">✧</div><span class="eyebrow">LEVEL ${run.level} · 契约正在回应</span><h2 id="upgrade-title">${isNew ? '选择新的力量' : '让灰烬为你所用'}</h2><p>${isNew ? '技能由你决定。选取一项，加入自动施放序列。' : '选择一项强化。已装备技能始终有可选的成长路径。'}</p><div class="upgrade-grid ${run.upgrades.length > 4 ? 'many' : ''}">${run.upgrades.map(c => `<button class="upgrade-card" data-upgrade="${c.key}" style="--skill-color:${c.skill ? hex(SKILLS[c.skill].color) : '#d5b57b'}"><span class="upgrade-icon">${icon(c.skill ?? 'shield')}</span><small>${c.kind === 'new' ? '全新技能' : c.kind === 'wide' || c.kind === 'focused' ? '技能分支' : '契约强化'}</small><h3>${c.title}</h3><p>${c.description}</p><span class="choose-label">选择此契约 <b>↗</b></span></button>`).join('')}</div><div class="paused-caption">Ⅱ 战斗已暂停 · 选择后继续</div></section>`;
    } else if (run.phase === 'inventory') {
      const stats = run.stats;
      this.modal.innerHTML = `<section class="inventory-dialog diablo-inventory" role="dialog" aria-modal="true" aria-labelledby="inventory-title"><header><div><span class="eyebrow">INVENTORY & EQUIPMENT</span><h2 id="inventory-title">契约者的行装</h2></div><div class="inventory-stats"><span>伤害 <b>×${stats.damage.toFixed(2)}</b></span><span>生命 <b>${fixed2(stats.maxHp)}</b></span><span>暴击 <b>${fixed2(stats.crit*100)}%</b></span></div><button class="close-button" data-command="resume" aria-label="关闭装备">×</button></header><div class="inventory-character">${run.character.name} · <b>${run.currentBuild.name}</b> · ${run.currentBuild.description}</div><div class="diablo-inventory-layout"><section class="paperdoll-panel"><span class="panel-title">已装备</span><div class="paperdoll-character" style="--character-color:${hex(run.character.color)}"><span>${icon(run.character.burst.icon)}</span><b>${run.character.name}</b><small>${run.character.epithet}</small></div><div class="equipment-grid diablo-equipment">${SLOTS.map(slot=>{const item=run.equipped[slot],art=item?.weaponKind?`<span class="equipment-art weapon-${item.weaponKind}"></span>`:icon(slotIcon[slot]);return `<div class="equipment-slot slot-${slot} ${item?.rarity??'empty'}"><small>${SLOT_NAMES[slot]}</small>${item?`<button class="equipment-icon" data-item-tooltip="${item.id}" aria-label="${item.name}">${art}</button><b>${item.name}</b>`:`<span class="equipment-icon empty-icon">${art}</span><b>空置</b>`}</div>`}).join('')}</div><details class="active-effects"><summary>当前特殊效果</summary>${this.activeEffects(run)}</details></section><section class="backpack-panel"><div class="inventory-section-heading"><h3>背包 <small>${run.inventory.length} / 24</small></h3><span>将鼠标放在物品图标上查看属性</span></div><div class="item-list diablo-backpack">${run.inventory.length?run.inventory.map(item=>this.itemCard(item,run)).join(''):'<div class="empty-inventory">◇<h3>行囊仍然空着</h3><p>击败敌人或开启地图中的宝箱。</p></div>'}</div><div class="set-progress">套装与传奇效果会显示在左侧角色栏</div></section></div><footer><span>全部金币 ${fixed2(run.walletGold)} · 分解装备会转为本局金币</span><button class="primary" data-command="resume">返回战斗 <kbd>I</kbd></button></footer></section>`;
      this.modal.querySelector('.inventory-section-heading')?.insertAdjacentHTML('beforeend',`<div class="loot-filters" aria-label="快捷拾取筛选"><button data-filter="all" class="${run.lootFilter==='all'?'active':''}">全部</button><button data-filter="rare" class="${run.lootFilter==='rare'?'active':''}">稀有+</button><button data-filter="epic" class="${run.lootFilter==='epic'?'active':''}">史诗+</button></div>`);
      const activeSets=Object.keys(SET_NAMES).map(id=>`${SET_NAMES[id]} ${setPieces(Object.values(run.equipped),id)} / 3`).filter((_,index)=>setPieces(Object.values(run.equipped),Object.keys(SET_NAMES)[index])>0);
      const setProgress=this.modal.querySelector('.set-progress');if(setProgress)setProgress.textContent=activeSets.length?activeSets.join('　·　'):'套装：守夜者 / 风暴使者 / 疫病之主 / 血誓骑士 / 灰烬朝圣者';
    } else if(run.phase==='merchant'){
      this.modal.innerHTML=`<section class="dialog npc-dialog merchant-dialog" role="dialog" aria-modal="true"><span class="eyebrow">THE ASHEN MARKET</span><h2>流亡商人的珍藏</h2><p>每件商品显示完整底材、属性、词缀、武器机制和与已装备物品的差值。</p><div class="wallet-line">可用金币 <b>${fixed2(run.walletGold)}</b> · 当前地图 ${run.floor} · 贪欲 ${run.greed}</div><div class="shop-grid">${run.shopOffers.map((offer,index)=>this.shopCard(offer.item,run,run.shopPrice(offer.price),index,offer.sold)).join('')}</div><button class="potion-offer" data-buy-potion ${run.merchantPotionStock<=0||run.player.potionCharges>=3||run.walletGold<run.shopPrice(38+run.floor*8)?'disabled':''}>${icon('potion')}<span><b>浓缩生命药剂</b><small>立即补充一格腰带库存 · 当前 ${run.player.potionCharges}/3</small></span><strong>${fixed2(run.shopPrice(38+run.floor*8))} 金币 · 库存 ${run.merchantPotionStock}</strong></button><div class="merchant-secret"><label for="merchant-code">商人低声说：“有些货物，只回应正确的旧日编号。”</label><div>${run.showcaseUnlocked?'<b>◆ 怪物陈列回廊已经解锁，传送门位于营地。</b>':`<input id="merchant-code" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="输入六位旧日编号"><button data-command="unlock-showcase">确认暗号</button>`}</div></div><button class="text-button" data-command="resume">结束交易</button></section>`;
    } else if(run.phase==='blacksmith'){
      const items=[...Object.values(run.equipped),...run.inventory];this.modal.innerHTML=`<section class="dialog npc-dialog smith-dialog" role="dialog" aria-modal="true"><span class="eyebrow">IRON REMEMBERS</span><h2>铁匠的灰烬锻台</h2><p>调校只补足落后的物品等级；升品保留装备槽位与武器种类，并重新生成对应品质属性。</p><div class="wallet-line">可用金币 <b>${fixed2(run.walletGold)}</b> · 贪欲 ${run.greed}</div><div class="smith-list">${items.map(item=>{const target=Math.max(item.level??item.power,Math.round(run.level+run.floor*1.5)),gain=target-(item.level??item.power),match=run.shopPrice(45+gain*14),current=QUALITY_ORDER.indexOf(item.rarity),cap=run.greed<10?QUALITY_ORDER.indexOf('rare'):QUALITY_ORDER.length-1,quality=run.shopPrice(100+(current+1)*75+(item.level??1)*4);return `<article class="smith-item ${item.rarity}"><div><b>${item.name}</b><small>Lv.${item.level??item.power} · ${RARITY_NAMES[item.rarity]}</small></div><button data-smith-level="${item.id}" ${gain<=0||run.walletGold<match?'disabled':''}>匹配至 Lv.${target}<small>${gain<=0?'已匹配':fixed2(match)+' 金币'}</small></button><button data-smith-quality="${item.id}" ${current>=cap||run.walletGold<quality?'disabled':''}>提升品质<small>${current>=cap?'当前上限':fixed2(quality)+' 金币'}</small></button></article>`}).join('')||'<p>没有可锻造的装备。</p>'}</div><button class="text-button" data-command="resume">离开锻台</button></section>`;
    } else if(run.phase==='beggar'){
      const payment=Math.floor(run.walletGold/2);this.modal.innerHTML=`<section class="dialog small-dialog npc-dialog beggar-dialog"><span class="eyebrow">A STRANGER IN ASH</span><h2>冻饿的乞丐</h2><p>“给我一半盘缠。我若能越过下一道门，会以旅客的身份三倍偿还。”</p><div class="bargain-math"><span>支付 ${fixed2(payment)}</span><b>下一地图返还 ${fixed2(payment*3)}</b></div><button class="primary" data-pay-beggar ${payment<=0?'disabled':''}>交出一半金币</button><button class="text-button" data-command="resume">拒绝并离开</button></section>`;
    } else if(run.phase==='traveler'){
      this.modal.innerHTML=`<section class="dialog small-dialog npc-dialog traveler-dialog"><span class="eyebrow">A DEBT REPAID</span><h2>来自远方的旅客</h2><p>褴褛已经换成了远行披风。他记得你在上一道门前的选择。</p><div class="traveler-reward">${fixed2(run.beggarPayment*3)} 金币</div><button class="primary" data-claim-traveler>收下约定的三倍回报</button></section>`;
    } else if(run.phase==='route'){
      this.modal.innerHTML=`<section class="dialog route-dialog" role="dialog" aria-modal="true" aria-labelledby="route-title"><span class="eyebrow">CHOOSE THE NEXT DESCENT</span><h2 id="route-title">下一道门通往何处？</h2><p>路线会改变场景、怪物族群、首领池与机关组合。角色、技能和装备继续保留。</p><div class="upgrade-grid">${run.routeChoices.map(id=>{const theme=THEMES[id];return `<button class="upgrade-card route-card" data-route="${id}" style="--skill-color:${hex(theme.accent)}"><small>${theme.subtitle}</small><h3>${theme.name}</h3><p>地图 ${run.floor+1} / 8 · ${[5,6,8,9,11,12,14,15][run.floor]} 个房间${id==='town'?'<br>幸存者营火：进入时补满生命、法力和血瓶':''}</p><span class="choose-label">踏入此门 <b>↗</b></span></button>`}).join('')}</div><div class="paused-caption">Ⅱ 选择后立即进入下一张地图</div></section>`;
    } else if(run.phase==='roomReward'){
      const icons={relic:'◆',fortune:'◈',respite:'✦'};this.modal.innerHTML=`<section class="dialog room-reward-dialog" role="dialog" aria-modal="true" aria-labelledby="room-reward-title"><span class="eyebrow">CHAMBER PURIFIED · ${run.clearedKeyRooms} / ${run.requiredKeyRooms}</span><h2 id="room-reward-title">从净化的圣印中选择回报</h2><p>每个房间只会回应一次。选择会立即生效，然后继续探索。</p><div class="upgrade-grid">${run.roomRewardOptions.map(option=>`<button class="upgrade-card" data-room-reward="${option.key}"><span class="reward-glyph">${icons[option.key]}</span><small>房间回报</small><h3>${option.title}</h3><p>${option.description}</p><span class="choose-label">接受回报 <b>↗</b></span></button>`).join('')}</div><div class="paused-caption">Ⅱ 战斗已暂停 · 首领封印进度 ${run.clearedKeyRooms} / ${run.requiredKeyRooms}</div></section>`;
    } else if (run.phase === 'event' && run.encounter) {
      const e=run.encounter, title={cursed:'诅咒宝箱',sacrifice:'血誓祭坛',hunt:'限时猎杀'}[e.kind];
      const risk={cursed:'开启后，在紫色契约圈内存活 25 秒。离开契约圈将失败。',sacrifice:'献出最大生命的 30%，立即获得一件受当前贪欲上限约束的高品质装备。',hunt:'在紫色契约圈内，40 秒内击杀 18 名敌人；离开契约圈或超时将失败。'}[e.kind];
      this.modal.innerHTML=`<section class="dialog small-dialog event-dialog" role="dialog" aria-modal="true" aria-labelledby="event-title"><span class="eyebrow">A BARGAIN WITH THE DARK</span><div class="event-emblem">${icon(e.kind==='sacrifice'?'blood':e.kind==='hunt'?'cleave':'corpse')}</div><h2 id="event-title">${title}</h2><p>${risk}</p><p class="event-reward">奖励 · ${run.greed>=10?'高阶装备':'黄色稀有装备'}${e.kind==='sacrifice'?'':' + 60 金币'}</p><p class="danger-note">${e.kind==='sacrifice'?`需要 ${Math.ceil(run.stats.maxHp*.3)} 生命；必须保留至少 1 点生命。`:'战斗中可自由撤离，但事件不能重新开启。'}</p><button class="primary" data-command="accept-event" ${e.kind==='sacrifice'&&run.player.hp<=Math.ceil(run.stats.maxHp*.3)?'disabled':''}>接受契约</button><button class="text-button" data-command="resume">暂不接受 · 返回探索</button></section>`;
    } else if (run.phase === 'altar') {
      const normalRates=rarityRates(false,run.greed,run.floor),eliteRates=rarityRates(true,run.greed,run.floor);
      const pct=(value:number)=>value===0?'0.00%':value<.0001?'<0.01%':`${fixed2(value*100)}%`;
      const rarityTable=QUALITY_ORDER.map(rarity=>`<div class="rarity-rate" style="--rarity-color:${hex(RARITY_COLORS[rarity])}"><b>${RARITY_NAMES[rarity]}</b><span>${pct(normalRates[rarity])}</span><small>${pct(eliteRates[rarity])}</small></div>`).join('');
      const rankDrops=`普通 ${pct(run.dropChanceForRank('normal'))} · 精英 ${pct(run.dropChanceForRank('elite'))} · 超级精英 ${pct(run.dropChanceForRank('superElite'))} · 首领 ${pct(run.dropChanceForRank('boss'))}`;
      this.modal.innerHTML = `<section class="dialog greed-dialog" role="dialog" aria-modal="true" aria-labelledby="altar-title"><div class="dialog-ornament crimson">♜</div><span class="eyebrow">THE PRICE OF GREED</span><h2 id="altar-title">力量，理应有代价。</h2><p>贪欲提高怪物生命、攻击、防御和密度，并把装备品质概率推向更高等级；怪物与装备等级保持不变。</p><div class="altar-level">${run.greed}<small>当前贪欲 / 15 · 地图 ${run.floor} / 8</small></div><div class="altar-stats"><span>怪物生命 <b>+${fixed2(run.greed*7.5)}%</b></span><span>怪物攻击 <b>+${fixed2(run.greed*6.5)}%</b></span><span>怪物防御 <b>+${fixed2(run.greed*1.2)}%</b></span><span>额外怪潮 <b>+${fixed2(run.greed*7)}%</b></span></div><div class="drop-rate-heading"><div><b>当前装备品质概率</b><small>各级怪物掉装率：${rankDrops}；下列为掉出装备后的品质占比</small></div><span>普通来源　精英/首领</span></div><div class="rarity-rates">${rarityTable}</div><p class="danger-note">贪欲 0–9：紫色史诗及以上为 0%。精英与超级精英使用各自掉装率；地图首领和最终首领必定掉落，并使用右列概率；固定品质宝箱和事件不参与随机计算。</p><div class="button-row"><button class="secondary" data-greed="-1" ${run.greed === 0 ? 'disabled' : ''}>降低一阶</button><button class="primary" data-greed="1" ${run.greed === 15 ? 'disabled' : ''}>提高贪欲</button></div><button class="text-button" data-command="resume">完成祭献，返回战斗</button></section>`;
    } else if (run.phase === 'paused') {
      this.modal.innerHTML = `<section class="dialog small-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="eyebrow">A MOMENT OF SILENCE</span><h2 id="pause-title">圣堂，暂归寂静。</h2><p>你的远征已暂停。</p><div class="pause-help"><span><kbd>左键 / WASD</kbd> 点击移动</span><span><kbd>右键</kbd> 无耗蓝基础攻击</span><span><kbd>1–4</kbd> 手动释放技能</span><span><kbd>SPACE</kbd> 闪避 · 两次充能</span><span><kbd>Q</kbd> ${run.character.burst.name} · ${run.burstCost} 法力</span><span><kbd>R</kbd> 血瓶 · 恢复半管生命</span><span><kbd>E</kbd> 开箱 / 祭坛</span><span><kbd>F</kbd> 拾取最近装备</span><span><kbd>I</kbd> 装备与分解</span><span><kbd>TAB</kbd> 展开地图</span></div><button class="toggle-row" data-command="autocast" aria-pressed="${run.autoCast}"><span>技能自动施法<small>关闭后使用数字键 1–4，技能默认朝鼠标方向释放</small></span><b>${run.autoCast?'开启':'关闭'}</b></button><button class="toggle-row" data-command="quality"><span>画质档位<small>高清使用更清晰地形；性能档减少环境光效与活跃地块</small></span><b>${{high:'高清',standard:'标准',performance:'性能'}[run.graphicsQuality]}</b></button><button class="toggle-row" data-command="shake"><span>画面震动<small>重击停顿保持，震动强度可单独调整</small></span><b>${['关闭','轻微','标准'][run.shakeLevel]}</b></button><button class="toggle-row" data-command="amplify" aria-pressed="${run.amplify}"><span>自动法力增幅<small>技能仅在有余量时消耗 12 法力</small></span><b>${run.amplify ? '开启' : '关闭'}</b></button><button class="primary" data-command="resume">继续远征 <span>→</span></button></section>`;
    } else if (run.ended) {
      const won = run.phase === 'won';
      const wingReward=won&&run.session.lastWingReward?`<div class="wing-reward"><span>✦ 通关奖励 ✦</span><b>${wingName(run.session.lastWingReward)}</b><small>已解锁并自动装备 · ${run.session.unlockedWings.length} / 16</small></div>`:'';
      const sources=Object.entries(run.telemetry.bySource).sort((a,b)=>b[1]-a[1]).slice(0,4),critRate=run.telemetry.hits?run.telemetry.criticals/run.telemetry.hits*100:0;
      this.modal.innerHTML = `<section class="dialog result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="dialog-ornament ${won ? '' : 'crimson'}">${won ? '♜' : '†'}</div><span class="eyebrow">${won ? 'THE EIGHTH GATE FALLS' : 'THE ASH REMEMBERS'}</span><h2 id="result-title">${won ? '八重门扉，尽数破碎。' : '你归于灰烬。'}</h2><p>${won ? `你穿越八张地图并击败了${run.finalBossName||'最终魔王'}。` : `倒在地图 ${run.floor} / 8。最后的威胁：${run.lastHit || '远征中的危险'}。`}</p>${wingReward}<div class="result-stats"><div><b>${timeText(run.time)}</b><small>远征时间</small></div><div><b>${run.kills}</b><small>放逐敌人</small></div><div><b>${fixed2(run.telemetry.damageDealt)}</b><small>总伤害</small></div><div><b>${fixed2(critRate)}%</b><small>暴击率</small></div><div><b>${fixed2(run.telemetry.largestHit)}</b><small>最大一击</small></div><div><b>${fixed2(run.telemetry.damageTaken)}</b><small>承受伤害</small></div></div><div class="damage-breakdown"><b>伤害来源</b>${sources.map(([name,value])=>`<span>${name}<i style="width:${run.telemetry.damageDealt?value/run.telemetry.damageDealt*100:0}%"></i><em>${fixed2(value)}</em></span>`).join('')}</div><div class="result-build">${run.skills.map(s => `<span style="color:${hex(SKILLS[s.id].color)}">${icon(s.id)}${SKILLS[s.id].name} <b>${s.level}</b></span>`).join('')}</div><div class="forge-panel"><div><h3>角色传承树</h3><p>本局金币 ${fixed2(run.gold)} · 会话金币 ${fixed2(run.session.gold)}</p></div><button class="secondary" data-command="talents">打开天赋树</button></div><button class="primary" data-command="restart">返回营地 · 更换角色 <span>→</span></button><p class="session-note">所有成长仅在当前页面有效；刷新或关闭页面后清空。</p></section>`;
    }
    localizeDom(this.root);requestAnimationFrame(() => this.modal.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true }));
  }
  private activeEffects(run:Run):string{const effects:string[]=[];for(const item of Object.values(run.equipped)){if(item.weaponKind)effects.push(`${WEAPONS[item.weaponKind].name}：${WEAPONS[item.weaponKind].mechanic}`);if(item.evolution)effects.push(`${item.evolution.name}：${item.evolution.description}`);else if(item.effect)effects.push(`${item.name}：${item.description}`);}for(const id of Object.keys(SET_NAMES)){const count=setPieces(Object.values(run.equipped),id);if(count>=2)effects.push(`${SET_NAMES[id]} ${count}/3：套装效果已激活`);}return effects.length?effects.map(text=>`<span>◆ ${text}</span>`).join(''):'<span>尚未激活武器、套装、暗金或传奇机制。</span>';}
  private buildOverview(run:Run):string{
    const skillIds=new Set(run.skills.map(skill=>skill.id)),links:string[]=[];
    if(skillIds.has('frost')&&skillIds.has('fire'))links.push('霜火联动 · 寒冷目标承受的陨落余烬伤害 +25%');
    if(skillIds.has('summon')&&skillIds.has('corpse'))links.push('亡军联动 · 三名侍从在场时尸骸爆破伤害 +22%');
    if(skillIds.has('warcry')&&skillIds.has('cleave'))links.push('铁血联动 · 有护盾时裂地重斩伤害 +20%');
    const effectLinks:Partial<Record<NonNullable<Item['effect']>,SkillId[]>>={storm:['lightning'],frost:['frost'],vampire:['blood','blades'],corpse:['summon','corpse'],inferno:['fire'],guard:['shield','warcry'],execute:['cleave','blood'],chainNova:['arcane','lightning'],bloodTrail:['blood','blades'],summonerCrown:['summon'],meteorEcho:['fire'],bulwark:['shield','warcry']};
    for(const item of Object.values(run.equipped))if(item.effect&&effectLinks[item.effect]?.some(id=>skillIds.has(id)))links.push(`${item.name} · 已与技能构筑联动`);
    const branchRanks={offense:0,mastery:0,survival:0};for(const node of TALENT_TREES[run.characterId])branchRanks[node.branch]+=run.session.talents[run.characterId][node.id]??0;
    const dominant=(Object.entries(branchRanks) as Array<[keyof typeof branchRanks,number]>).sort((a,b)=>b[1]-a[1])[0];
    const resource=run.classResource;
    return `<section class="build-overview"><header><b>当前构筑联动</b><span>${links.length} 条已激活 · 天赋倾向 ${{offense:'毁灭',mastery:'秘仪',survival:'守御'}[dominant[0]]} ${dominant[1]}</span></header>${resource?`<div class="class-loop"><b>${resource.name}</b><span>${fixed2(resource.value)} / 100.00 · ${resource.description}</span></div>`:''}<div class="build-skills">${run.skills.map(skill=>{const evolution=evolutionFor(skill);return `<span style="--skill-color:${hex(SKILLS[skill.id].color)}">${icon(skill.id)}<b>${evolution?.name??SKILLS[skill.id].name}</b><small>Lv.${skill.level} · ${evolution?.tag??'等待进化'}${skill.level===6?' · 终极':''}</small></span>`}).join('')}</div><div class="build-links">${links.length?links.map(link=>`<span>◆ ${link}</span>`).join(''):'<span>装备对应的传奇机制或组合技能后，将在这里显示联动。</span>'}</div></section>`;
  }
  private itemBuildHint(item:Item,run:Run):string{
    const effectSkills:Partial<Record<NonNullable<Item['effect']>,SkillId[]>>={storm:['lightning'],frost:['frost'],vampire:['blood','blades'],corpse:['summon','corpse'],inferno:['fire'],guard:['shield','warcry'],execute:['cleave','blood'],chainNova:['arcane','lightning'],bloodTrail:['blood','blades'],summonerCrown:['summon'],meteorEcho:['fire'],bulwark:['shield','warcry']},owned=new Set(run.skills.map(skill=>skill.id)),linked=item.evolution&&owned.has(item.evolution.skill)?[item.evolution.skill]:item.effect?effectSkills[item.effect]?.filter(id=>owned.has(id))??[]:[];
    const branch=item.health>item.damage*2?'survival':item.haste>.025?'mastery':'offense',rank=TALENT_TREES[run.characterId].filter(node=>node.branch===branch).reduce((sum,node)=>sum+(run.session.talents[run.characterId][node.id]??0),0),branchName={offense:'毁灭',mastery:'秘仪',survival:'守御'}[branch];
    return `<div class="tooltip-synergy ${linked.length?'active':''}"><b>构筑联动</b><span>${linked.length?`强化 ${linked.map(id=>SKILLS[id].name).join(' / ')}`:'尚未与当前技能直接联动'}</span><span>${branchName}天赋 ${rank} 级 · ${rank?`正在放大该装备的${branch==='survival'?'生存':branch==='mastery'?'冷却':'攻击'}属性`:'投入该分支后可进一步放大属性'}</span></div>`;
  }
  private shopCard(item:Item,run:Run,price:number,index:number,sold:boolean):string{const old=run.equipped[item.slot],affixes=(item.affixes??[]).map(a=>`<span>${a.group==='prefix'?'前缀':'后缀'} T${a.tier} · ${a.name} +${fixed2(['haste','crit','moveSpeed','pickup','statusResist','eliteDamage'].includes(a.stat)?a.value*100:a.value)}${a.stat==='health'?'':'%'}</span>`).join('');return `<article class="shop-card ${item.rarity} ${sold?'sold':''}"><div class="shop-item-art" data-item-tooltip="${item.id}">${item.weaponKind?`<span class="equipment-art weapon-${item.weaponKind}"></span>`:icon(slotIcon[item.slot])}</div><div class="shop-item-copy"><small>${RARITY_NAMES[item.rarity]} · Lv.${item.level??item.power} · ${item.baseGrade?BASE_NAMES[item.baseGrade]+' · ':''}${item.weaponKind?WEAPONS[item.weaponKind].name:SLOT_NAMES[item.slot]}</small><h3>${item.name}</h3><p>${item.description}</p>${item.weaponKind?`<b class="weapon-mechanic">${WEAPONS[item.weaponKind].mechanic}</b>`:''}<div class="shop-affixes"><span>伤害 +${fixed2(item.damage)}% <i class="${item.damage-(old?.damage??0)>=0?'positive':'negative'}">(${fixed2(item.damage-(old?.damage??0))})</i></span><span>生命 +${fixed2(item.health)} <i class="${item.health-(old?.health??0)>=0?'positive':'negative'}">(${fixed2(item.health-(old?.health??0))})</i></span><span>暴击 +${fixed2(item.crit*100)}%</span><span>冷却 +${fixed2(item.haste*100)}%</span>${affixes}</div></div><button data-buy-offer="${index}" ${sold?'disabled':''}>${sold?'已售出':fixed2(price)+' 金币'}</button></article>`;}
  /** Attribute bonuses are universal; some legendary effects require a learned skill. */
  private mechanismNote(item: Item, run: Run): string {
    const required: Partial<Record<NonNullable<Item['effect']>, SkillId>> = { storm: 'lightning', inferno: 'fire', corpse: 'summon', guard: 'shield' };
    const skill = item.effect ? required[item.effect] : undefined;
    return skill && !run.skills.some(s => s.id === skill)
      ? `<small class="inactive-mechanism">机制需要 ${SKILLS[skill].name}；基础属性仍生效。</small>` : '';
  }
  private itemCard(item: Item, run: Run): string {
    const art=item.weaponKind?`<span class="equipment-art weapon-${item.weaponKind}"></span>`:icon(slotIcon[item.slot]);
    return `<article class="item-card diablo-item ${item.rarity}"><button class="item-art" data-item-tooltip="${item.id}" aria-label="查看 ${item.name}">${art}<small>Lv.${item.level??item.power}</small></button><b>${item.name}</b><span>${RARITY_NAMES[item.rarity]} · ${item.weaponKind?WEAPONS[item.weaponKind].name:SLOT_NAMES[item.slot]}</span><div class="item-actions"><button class="equip-button" data-equip="${item.id}">装备</button><button class="salvage-button" data-salvage="${item.id}">分解 ${fixed2(itemValue(item))}</button></div></article>`;
  }
  private findItem(id:number):Item|undefined{const run=this.current;if(!run)return;return run.inventory.find(item=>item.id===id)||Object.values(run.equipped).find(item=>item.id===id)||run.shopOffers.find(offer=>offer.item.id===id)?.item||run.session.stash.find(item=>item.id===id);}
  private showItemTooltip(event:PointerEvent):void{const target=(event.target as HTMLElement).closest<HTMLElement>('[data-item-tooltip]');if(!target)return;const item=this.findItem(Number(target.dataset.itemTooltip));if(!item||!this.current)return;const old=this.current.equipped[item.slot],affixes=(item.affixes??[]).map(a=>`<span>◆ ${a.name} <b>+${fixed2(['haste','crit','moveSpeed','pickup','statusResist','eliteDamage'].includes(a.stat)?a.value*100:a.value)}${a.stat==='health'?'':'%'}</b><small>T${a.tier} · ${a.group==='prefix'?'前缀':'后缀'}</small></span>`).join('');const compare=old&&old.id!==item.id?`<div class="tooltip-compare"><b>与已装备物品比较</b><span class="${item.damage-old.damage>=0?'positive':'negative'}">伤害 ${item.damage-old.damage>=0?'+':''}${fixed2(item.damage-old.damage)}%</span><span class="${item.health-old.health>=0?'positive':'negative'}">生命 ${item.health-old.health>=0?'+':''}${fixed2(item.health-old.health)}</span></div>`:'';const box=this.root.querySelector<HTMLElement>('#item-tooltip')!;box.className=`item-tooltip ${item.rarity}`;box.innerHTML=`<small class="tooltip-quality">${RARITY_NAMES[item.rarity]} · 物品等级 ${item.level??item.power}</small><h3>${item.name}</h3><div class="tooltip-type">${item.baseGrade?BASE_NAMES[item.baseGrade]+' · ':''}${item.weaponKind?WEAPONS[item.weaponKind].name:SLOT_NAMES[item.slot]}${item.originTheme?` · ${THEMES[item.originTheme].name}专属`:''}</div><div class="tooltip-core"><span>伤害 <b>+${fixed2(item.damage)}%</b></span><span>生命 <b>+${fixed2(item.health)}</b></span><span>暴击 <b>+${fixed2(item.crit*100)}%</b></span><span>冷却缩减 <b>+${fixed2(item.haste*100)}%</b></span></div><div class="tooltip-affixes">${affixes||'<span>无额外词缀</span>'}</div>${item.weaponKind?`<div class="tooltip-power">${WEAPONS[item.weaponKind].mechanic}</div>`:''}${item.effect||item.evolution?`<div class="tooltip-power">${item.description}</div>`:''}${this.itemBuildHint(item,this.current)}${compare}<footer>售价 ${fixed2(itemValue(item))} 金币</footer>`;box.hidden=false;localizeDom(box);this.positionItemTooltip(event);}
  private positionItemTooltip(event:PointerEvent):void{const box=this.root.querySelector<HTMLElement>('#item-tooltip')!;if(box.hidden)return;const anchor=(event.target as HTMLElement).closest<HTMLElement>('[data-item-tooltip]');if(!anchor)return;const margin=14,width=box.offsetWidth,height=box.offsetHeight,rect=anchor.getBoundingClientRect(),right=rect.right+14,left=rect.left-width-14;box.style.left=`${right+width<innerWidth-margin?right:Math.max(margin,left)}px`;box.style.top=`${Math.max(margin,Math.min(innerHeight-height-margin,rect.top+rect.height/2-height/2))}px`;}
  private hideItemTooltip():void{this.root.querySelector<HTMLElement>('#item-tooltip')!.hidden=true;}
  private click(event: MouseEvent): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button || button.disabled) return;
    if (button.dataset.character && CHARACTER_IDS.includes(button.dataset.character as CharacterId)) { this.selected = button.dataset.character as CharacterId; this.showStart(); this.modal.querySelector<HTMLElement>(`[data-character="${this.selected}"]`)?.focus({ preventScroll: true }); return; }
    if(button.dataset.buyOffer){this.current?.buyShopItem(Number(button.dataset.buyOffer));this.modalKey='';return;}
    if('buyPotion'in button.dataset){this.current?.buyPotion();this.modalKey='';return;}
    if(button.dataset.smithLevel){this.current?.smithMatchLevel(Number(button.dataset.smithLevel));this.modalKey='';return;}
    if(button.dataset.smithQuality){this.current?.smithImproveQuality(Number(button.dataset.smithQuality));this.modalKey='';return;}
    if('payBeggar'in button.dataset){this.current?.payBeggar();this.modalKey='';return;}
    if('claimTraveler'in button.dataset){this.current?.claimTraveler();this.modalKey='';return;}
    if(button.dataset.talentBuy){if(this.current&&buyTalent(this.current.session,this.selected,button.dataset.talentBuy))this.showTalents();return;}
    if(button.dataset.talentRefund){if(this.current&&refundTalent(this.current.session,this.selected,button.dataset.talentRefund))this.showTalents();return;}
    if (button.dataset.command === 'accept-event') { this.current?.acceptEncounter(); return; }
    if (button.dataset.upgrade) { this.current?.chooseUpgrade(button.dataset.upgrade); return; }
    if (button.dataset.equip) { this.current?.equip(Number(button.dataset.equip)); return; }
    if (button.dataset.salvage) { this.current?.salvage(Number(button.dataset.salvage)); return; }
    if (button.dataset.greed) { this.current?.changeGreed(Number(button.dataset.greed)); return; }
    if(button.dataset.filter){this.current?.setLootFilter(button.dataset.filter as 'all'|'rare'|'epic');this.modalKey='';return;}
    if(button.dataset.roomReward){this.current?.chooseRoomReward(button.dataset.roomReward as 'relic'|'fortune'|'respite');this.modalKey='';return;}
    if(button.dataset.route){this.setLoading(true);this.current?.chooseRoute(button.dataset.route as keyof typeof THEMES);return;}
    if (button.dataset.info) { const id = button.dataset.info as SkillId; this.current?.notify(`${SKILLS[id].name}：${SKILLS[id].description}`); return; }
    const command = button.dataset.command;
    if(command==='language'){setLocale(getLocale()==='zh'?'en':'zh');const language=this.root.querySelector('#language-button')!;language.textContent=getLocale()==='zh'?'EN':'中';this.callbacks.language?.();this.modalKey='';if(!this.started)this.showStart();else{this.lastUpdate=0;localizeDom(this.root);}return;}
    if(command==='unlock-showcase'){const input=this.modal.querySelector<HTMLInputElement>('#merchant-code');if(this.current&&input&&this.current.unlockShowcase(input.value)){this.modalKey='';this.renderModal(this.current);}else{input?.classList.add('invalid');input?.focus();}return;}
    if(command==='talents'){if(this.started&&this.current)this.selected=this.current.characterId;this.showTalents();return;}
    if(command==='talent-close'){this.showStart();return;}
    if (command === 'start') { if (this.ready) { this.setLoading(true);this.callbacks.start(this.selected); this.begin(); } }
    else if (command === 'restart') this.showStart();
    else if (command === 'forge') this.callbacks.forge();
    else if (command) { this.callbacks.command(command); if(command==='shake'||command==='quality'||command==='autocast')this.modalKey=''; }
  }
  private trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.modal.classList.contains('visible')) return;
    const focusable = [...this.modal.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]), [tabindex="0"]')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}


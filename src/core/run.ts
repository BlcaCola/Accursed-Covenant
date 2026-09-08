import { ENEMIES, MAX_ENEMIES, MAX_INVENTORY, SKILLS } from './catalog';
import { CHARACTERS } from './characters';
import { buildFlow, CAMPAIGN_FLOORS, generateDungeon, moveOnMap, roomsForFloor, TILE, walkable } from './dungeon';
import { campaignThemes, THEME_IDS, THEMES } from './themes';
import { FINAL_BOSSES, MONSTER_DEFINITIONS, RANK_DROP_CHANCE, THEME_BOSSES, THEME_MONSTERS, type MonsterProfile } from './bestiary';
import { enemyDamageMultiplier, enemyHealthMultiplier, enemyLevel, itemLevelFrom, MAX_GREED } from './difficulty';
import { protectedItem, QUALITY_ORDER, RARITY_COLORS, rollRarity, setPieces, watcherPieces, WEAPONS } from './equipment';
import { createItem, itemValue } from './loot';
import { clamp, distance, fixed2, Random, round2 } from './random';
import type { Rarity, CharacterId, Encounter, Corpse, Dungeon, Enemy, EnemyKind, GroundLoot, Hazard, Input, Item, Minion, Phase, Player, Projectile, RoomEncounter, RoomEncounterType, RoomRewardOption, Session, Skill, SkillId, Slot, Stats, ThemeId, Upgrade, Vec, VisualEvent, Zone } from './types';
import { WING_IDS } from './cosmetics';
import {talentBonus} from './talents';
import {roomIdentity,THEME_DESIGNS,THEME_RELICS} from './themeDesigns';
import {generateShowcaseDungeon,SHOWCASE_PROFILES} from './showcase';
import {SKILL_EVOLUTIONS} from './evolutions';
import {matchingEvolutionRelic} from './buildMechanics';

export const freshSession = (): Session => ({ gold: 0, forgeRank: 0, carried: {}, stash: [], bestKills: 0, victories: 0, unlockedWings:[], equippedWing:null, lastWingReward:null,talents:{sorceress:{},necromancer:{},bloodknight:{}} });
export const idleInput = (): Input => ({ x: 0, y: 0, dash: false, burst: false, potion: false, interact: false, basicAttack:false });
export type MapAffix='坚韧'|'狂乱'|'虫群'|'易爆'|'噩梦'|'丰饶';
export interface ShopOffer{item:Item;price:number;sold:boolean}
export type CampNpc='merchant'|'blacksmith'|'beggar'|'distant-traveler';
export type GraphicsQuality='high'|'standard'|'performance';
export interface BossCastState{enemyId:number;ability:Enemy['attack'];name:string;remaining:number;duration:number;damage:number}

/** Authoritative single-player simulation. No browser storage is read or written here. */
export class Run {
  readonly rng: Random;
  dungeon: Dungeon;
  readonly player: Player;
  readonly skills: Skill[];
  readonly equipped: Partial<Record<Slot, Item>>;
  inventory: Item[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  loot: GroundLoot[] = [];
  hazards: Hazard[] = [];
  zones: Zone[] = [];
  minions: Minion[] = [];
  corpses: Corpse[] = [];
  events: VisualEvent[] = [];
  messages: { id: number; text: string; tone: 'gold' | 'blue' | 'red'; ttl: number }[] = [];
  upgrades: Upgrade[] = [];
  phase: Phase = 'playing';
  time = 0;
  kills = 0;
  gold = 0;
  xp = 0;
  level = 1;
  greed = 0;
  amplify = true;
  autoCast = true;
  shakeLevel: 0 | 1 | 2 = 2;
  readonly telemetry={damageDealt:0,damageTaken:0,hits:0,criticals:0,kills:0,largestHit:0,bySource:{} as Record<string,number>};
  bossSpawned = false;
  bossDefeated = false;
  legendaryFound = 0;
  chestsOpened = new Set<number>();
  lastHit = '';
  explored: Uint8Array;
  readonly discoveredRooms = new Set<number>();
  encounters: Encounter[];
  roomEncounters:RoomEncounter[]=[];
  roomRewardOptions:RoomRewardOption[]=[];
  readonly campaign: ReturnType<typeof campaignThemes>;
  floor = 1;
  mapTime = 0;
  worldRevision = 0;
  exitUnlocked = false;
  guardianSpawned = false;
  floorGuardianId: number | null = null;
  finalBossName='';
  selectedEncounter: number | null = null;
  routeChoices: ReturnType<typeof campaignThemes> = [];
  mapAffixes:MapAffix[]=[];
  explorationRevision = 0;
  bossPhase: 1 | 2 | 3 = 1;
  bossCast:BossCastState|null=null;
  graphicsQuality:GraphicsQuality='high';
  lootFilter:'all'|'rare'|'epic'='all';
  shopOffers:ShopOffer[]=[];
  merchantPotionStock=0;
  beggarCurrent=false;
  beggarAppeared=false;
  beggarPaid=false;
  beggarPayment=0;
  travelerFloor=0;
  travelerClaimed=false;
  showcaseUnlocked=false;
  showcaseMode=false;
  private showcaseReturn?:{dungeon:Dungeon;explored:Uint8Array;discovered:number[];encounters:Encounter[];chestsOpened:number[]};
  private bossAttack = 0;
  private eliteSequence = 0;
  private nextId = 1;
  private cooldowns: Partial<Record<SkillId, number>> = {};
  private spawnTimer = 1.5;
  private eliteTimer = 60;
  private flow: Int16Array;
  private flowTile = -1;
  private regenBudget = 0;
  private bossTimer = 3;
  private finalized = false;
  private pendingCasts: { skill: Skill; aim?: Vec; targetId?:number; delay: number }[] = [];
  private autoTargetId:number|null=null;
  private autoTargetTime=0;
  private autoCastGap=0;
  private basicAttackCooldown=0;
  private themeTimer=12;
  private weaponHits=0;
  private weaponCombo=0;
  private weaponComboWindow=0;
  private classPower=0;
  private lastAim?:Vec;
  private damageSource='基础攻击';
  private killsSinceRare=0;
  private interruptedPhases=new Set<number>();
  private bossSealNotice=0;

  constructor(readonly seed: number, readonly characterId: CharacterId, readonly session: Session,forcedTheme?:ThemeId) {
    this.rng = new Random(seed);
    this.campaign = campaignThemes(seed);
    if(forcedTheme)this.campaign.splice(0,this.campaign.length,forcedTheme,...this.campaign.filter(theme=>theme!==forcedTheme).slice(0,7));
    this.dungeon = generateDungeon(seed,roomsForFloor(1),this.campaign[0],1);
    this.mapAffixes=this.rollMapAffixes(1);
    this.equipped = structuredClone(session.carried);
    this.inventory = structuredClone(session.stash);
    this.nextId = Math.max(0, ...this.inventory.map(i => i.id), ...Object.values(this.equipped).map(i => i.id)) + 1;
    this.skills = CHARACTERS[characterId].starting.map(id => ({ id, level: 1, branch: null }));
    this.player = { ...this.dungeon.start, hp: this.stats.maxHp, mana: this.stats.maxMana, shield: 0, invulnerable: 1,
      dashCharges: 2, dashRecharge: 0, dashTime: 0, dashDirection: { x: 0, y: 1 }, facing: { x: 0, y: 1 },
      potionCharges: 3, potionCooldown: 0, burstCooldown: 0, attackPose: 0, skillPose:0,statuses:{} };
    this.flow = buildFlow(this.dungeon, this.player);
    this.explored = new Uint8Array(this.dungeon.tiles.length);
    this.roomEncounters=this.createRoomEncounters();
    // Separate seeded stream: adding exploration does not perturb combat/drop randomness.
    const encounterRng = new Random(seed + 307);
    const rooms = encounterRng.shuffle(this.dungeon.rooms.map((_,i)=>i).filter(i=>i!==0&&i!==this.dungeon.bossRoom));
    this.encounters = (['cursed', 'sacrifice', 'hunt'] as const).map((kind, id) => {
      const room = this.dungeon.rooms[rooms[id]];
      return { id, room: rooms[id], kind, x: (room.x + room.w / 2) * TILE, y: (room.y + room.h / 2 + 2) * TILE,
        state: 'available', remaining: 0, progress: 0,spawnTimer:0,waves:0 };
    });
    this.reveal();
    this.dungeon.chests.unshift({ x: this.player.x - 125, y: this.player.y + 100,reward:'gear',gold:0 });
    this.setupFloorNpcs();
    this.notify('圣堂已经苏醒。移动，击杀，收集灰烬。', 'gold');
  }

  get stats(): Stats {
    const items=Object.values(this.equipped),pieces=watcherPieces(items),tempest=setPieces(items,'tempest'),pilgrim=setPieces(items,'pilgrim'),blood=setPieces(items,'bloodOath');
    const affix=(stat:NonNullable<Item['affixes']>[number]['stat'])=>items.flatMap(item=>item.affixes??[]).filter(a=>a.stat===stat).reduce((sum,a)=>sum+a.value,0);
    return {
      maxHp:round2(300+(pieces>=3?60:0)+items.reduce((n,i)=>n+i.health,0)+talentBonus(this.session,this.characterId,'maxHp')),maxMana:round2(100+talentBonus(this.session,this.characterId,'maxMana')),
      damage:round2(1+(pieces>=2?.12:0)+(blood>=2?.15:0)+this.session.forgeRank*.04+talentBonus(this.session,this.characterId,'damage')+items.reduce((n,i)=>n+i.damage,0)/100),
      haste:round2(Math.min(.55,items.reduce((n,i)=>n+i.haste,0)+(tempest>=2?.08:0)+talentBonus(this.session,this.characterId,'haste'))),
      crit:round2(Math.min(.6,.12+items.reduce((n,i)=>n+i.crit,0)+talentBonus(this.session,this.characterId,'crit'))),speed:round2(145*(1+(pilgrim>=2?.1:0)+affix('moveSpeed')+talentBonus(this.session,this.characterId,'speed'))),
    };
  }
  get pickupRadius():number{const items=Object.values(this.equipped),bonus=items.flatMap(i=>i.affixes??[]).filter(a=>a.stat==='pickup').reduce((n,a)=>n+a.value,0);return round2(1+bonus+(setPieces(items,'pilgrim')>=3?.8:0)+(this.has('treasureHunter')?.4:0));}
  get statusResistance():number{return Math.min(.75,Object.values(this.equipped).flatMap(i=>i.affixes??[]).filter(a=>a.stat==='statusResist').reduce((n,a)=>n+a.value,0)+talentBonus(this.session,this.characterId,'statusResist'));}
  get eliteDamage():number{return Object.values(this.equipped).flatMap(i=>i.affixes??[]).filter(a=>a.stat==='eliteDamage').reduce((n,a)=>n+a.value,0)+talentBonus(this.session,this.characterId,'eliteDamage');}
  get walletGold():number{return round2(this.gold+this.session.gold);}
  get classResource():{name:string;description:string;value:number;max:number;ready:boolean}{const labels={sorceress:['元素共鸣','施放技能与暴击积蓄；充满后下一次技能进入元素过载。'],necromancer:['魂火','击杀与消耗遗骸积蓄；充满后强化召唤或尸骸爆破。'],bloodknight:['血怒','攻击与承受伤害积蓄；充满后强化下一次武技并恢复生命。']}[this.characterId];return{name:labels[0],description:labels[1],value:round2(this.classPower),max:100,ready:this.classPower>=100};}
  get activeNpcs():CampNpc[]{const result:CampNpc[]=[];if(this.showcaseMode)return result;if(this.floor===1||this.floor===5)result.push('merchant','blacksmith');if(this.beggarCurrent)result.push('beggar');if(this.floor===this.travelerFloor&&!this.travelerClaimed)result.push('distant-traveler');return result;}
  get showcasePortalPosition():Vec{return this.showcaseMode?this.dungeon.exit:{x:this.dungeon.start.x,y:this.dungeon.start.y+145};}
  dropChanceForRank(rank:Enemy['rank']):number{return Math.min(1,RANK_DROP_CHANCE[rank]*(1+.06*this.greed)*(this.has('treasureHunter')?1.25:1));}
  get burstCost(): number { return this.has('clarity') ? 32 : 40; }
  skillCooldownDuration(skill:Skill):number{const relic=matchingEvolutionRelic(Object.values(this.equipped),skill);return round2(SKILLS[skill.id].cooldown*(1-this.stats.haste)*(skill.id==='shield'&&this.has('guard')?.7:1)*(relic?.cooldown??1));}
  skillCooldownRemaining(id:SkillId):number{return round2(Math.max(0,this.cooldowns[id]??0));}
  get character() { return CHARACTERS[this.characterId]; }
  get currentBuild(){const learned=new Set(this.skills.map(skill=>skill.id));return this.character.builds.slice().sort((a,b)=>b.skills.filter(id=>learned.has(id)).length-a.skills.filter(id=>learned.has(id)).length)[0];}
  get theme() { return THEMES[this.dungeon.theme]; }
  get wavePhase(): 'surge' | 'breather' | 'hunt' { const phase = this.mapTime % 40; return phase < 22 ? 'hunt' : phase < 33 ? 'surge' : 'breather'; }
  get nextXp(): number { return 16 + this.level * 8 + Math.floor(this.level ** 1.6); }
  get stage(): number { return Math.min(3, Math.ceil(this.floor / 3)); }
  get recommendedEnemyLevel():number{return enemyLevel(this.floor,this.level,this.mapTime,this.greed)}
  get boss(): Enemy | undefined { return this.enemies.find(e => e.kind === 'boss'); }
  get floorGuardian():Enemy|undefined{return this.enemies.find(e=>e.id===this.floorGuardianId)}
  get activeRoomEncounter():RoomEncounter|undefined{return this.roomEncounters.find(value=>value.state==='active')}
  get clearedKeyRooms():number{return this.roomEncounters.filter(value=>value.key&&value.state==='cleared').length}
  get requiredKeyRooms():number{return this.roomEncounters.filter(value=>value.key).length}
  get bossUnlocked():boolean{return this.clearedKeyRooms>=this.requiredKeyRooms}
  get ended(): boolean { return this.phase === 'won' || this.phase === 'dead'; }
  has(effect: Item['effect']): boolean { return Object.values(this.equipped).some(i => i.effect === effect); }
  notify(text: string, tone: 'gold' | 'blue' | 'red' = 'blue'): void {
    this.messages.push({ id: this.nextId++, text, tone, ttl: 4.5 });
    if (this.messages.length > 3) this.messages.shift();
  }

  /** Caller supplies a fixed step. Pauses do not advance cooldowns, spawn timers or combat. */
  update(dt: number, input: Input): void {
    if (this.phase !== 'playing') return;
    dt = clamp(dt, 0, .05);
    this.time += dt;
    this.mapTime += dt;
    const p = this.player, stats = this.stats,previous={x:this.player.x,y:this.player.y};this.bossSealNotice=Math.max(0,this.bossSealNotice-dt);
    this.updatePlayerStatuses(dt);if(this.ended)return;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.attackPose = Math.max(0, p.attackPose - dt);p.skillPose=Math.max(0,p.skillPose-dt);
    p.burstCooldown = Math.max(0, p.burstCooldown - dt);
    p.potionCooldown = Math.max(0, p.potionCooldown - dt);
    p.mana = Math.min(stats.maxMana, p.mana + dt * 5);
    p.hp = Math.min(stats.maxHp, p.hp + dt * .5);
    this.regenBudget = Math.min(12, this.regenBudget + dt * 12);
    for (const m of this.messages) m.ttl -= dt;
    this.messages = this.messages.filter(m => m.ttl > 0);
    if (p.dashCharges < 2) {
      p.dashRecharge += dt;
      if (p.dashRecharge >= 3) { p.dashCharges++; p.dashRecharge = 0; }
    }
    if(input.aim)this.lastAim={...input.aim};
    const stunned=!!p.statuses.stun,moveX=stunned?0:input.x,moveY=stunned?0:input.y,length=Math.hypot(moveX,moveY);
    if (length > 0) p.facing = { x: moveX / length, y: moveY / length };
    if (input.dash&&!stunned && p.dashCharges > 0 && p.dashTime <= 0) {
      p.dashCharges--; p.dashTime = .19; p.invulnerable = .3; p.dashDirection = { ...p.facing };
      if (this.has('bulwark')) p.shield = Math.max(p.shield, 12);
      this.events.push({ type: 'dash', ...p, color: 0xb3def4 });
      if (this.has('frost')) this.zones.push({ id: this.nextId++, ...p, radius: 95, ttl: 3, tick: 0, damage: 14, color: 0x9adaed });
      if(this.has('bloodTrail'))this.zones.push({id:this.nextId++,...p,radius:70,ttl:2.5,tick:0,damage:round2(this.stats.damage*9),color:0xb94f56});
    }
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      // Substeps keep fast dashes from tunnelling through a one-tile wall.
      for (let i = 0; i < 4; i++) moveOnMap(this.dungeon, p, p.dashDirection.x * 590 * dt / 4, p.dashDirection.y * 590 * dt / 4);
    } else if (length > 0) {const statusSpeed=p.statuses.chill?.duration?0.62:1;moveOnMap(this.dungeon,p,p.facing.x*stats.speed*statusSpeed*dt,p.facing.y*stats.speed*statusSpeed*dt);}
    let playerRoom=this.dungeon.rooms.findIndex(room=>p.x/TILE>=room.x&&p.x/TILE<room.x+room.w&&p.y/TILE>=room.y&&p.y/TILE<room.y+room.h);
    const lockedRoom=this.activeRoomEncounter;
    if(lockedRoom&&playerRoom!==lockedRoom.room){Object.assign(p,previous);playerRoom=lockedRoom.room;}
    else if(!this.showcaseMode&&playerRoom===this.dungeon.bossRoom&&!this.bossUnlocked&&!this.guardianSpawned){Object.assign(p,previous);playerRoom=this.dungeon.rooms.findIndex(room=>p.x/TILE>=room.x&&p.x/TILE<room.x+room.w&&p.y/TILE>=room.y&&p.y/TILE<room.y+room.h);if(this.bossSealNotice<=0){this.bossSealNotice=3;this.notify(`首领圣所尚未开启 · 净化关键房间 ${this.clearedKeyRooms}/${this.requiredKeyRooms}`,'red');}}
    if (input.potion) this.drinkPotion();
    if (input.burst&&!stunned) this.burst(input.aim);
    if (input.interact) { this.interact(); if (this.phase !== 'playing') return; }
    const tile = Math.floor(p.y / TILE) * this.dungeon.size + Math.floor(p.x / TILE);
    if (tile !== this.flowTile) { this.flowTile = tile; if(!this.showcaseMode)this.flow = buildFlow(this.dungeon, p); this.reveal(); }
    playerRoom=this.dungeon.rooms.findIndex(room=>p.x/TILE>=room.x&&p.x/TILE<room.x+room.w&&p.y/TILE>=room.y&&p.y/TILE<room.y+room.h);const entryGrace=playerRoom===0&&this.mapTime<18;
    if(!this.showcaseMode&&playerRoom===this.dungeon.bossRoom&&this.bossUnlocked&&!this.guardianSpawned)this.spawnFloorGuardian();
    if(this.showcaseMode)this.updateShowcaseRooms();
    else{
      this.updateEncounters(dt);
      // A map event and a sealed-room fight must never run together. If an
      // event was accepted before its room was revealed, defer that room's
      // encounter and activate it after the event resolves.
      if(!this.activeEncounter&&!this.activeRoomEncounter&&playerRoom>=0){const waiting=this.roomEncounters.find(value=>value.room===playerRoom&&value.state==='dormant');if(waiting)this.activateRoomEncounter(waiting);}
      this.updateRoomEncounters(dt);if(this.phase!=='playing')return;if(this.activeRoomEncounter)this.updateThemeMechanic(dt);
      this.updateMechanisms();this.spawnTimer-=dt;
      // Corridors retain light pressure, while rooms own their authored waves.
      if(this.spawnTimer<=0&&!entryGrace&&!this.activeRoomEncounter&&playerRoom<0){this.spawnThemePack(1+Number(this.floor>=5),'normal');this.spawnTimer=Math.max(4.5,8-this.greed*.18);}
    }
    this.autoTargetTime=Math.max(0,this.autoTargetTime-dt);this.autoCastGap=Math.max(0,this.autoCastGap-dt);this.basicAttackCooldown=Math.max(0,this.basicAttackCooldown-dt);this.weaponComboWindow=Math.max(0,this.weaponComboWindow-dt);if(this.weaponComboWindow===0)this.weaponCombo=0;
    if(input.basicAttack&&!stunned)this.basicAttack(input.aim);
    const focus=this.chooseCombatTarget(input.aim);
    for (const pending of this.pendingCasts) pending.delay -= dt;
    const released=this.pendingCasts.filter(c=>c.delay<=0);this.pendingCasts=this.pendingCasts.filter(c=>c.delay>0);
    for(const cast of released){const locked=cast.targetId===undefined?undefined:this.enemies.find(enemy=>enemy.id===cast.targetId&&enemy.hp>0);this.cast(cast.skill,locked?{x:locked.x,y:locked.y}:cast.aim);}
    for (const skill of this.skills) {
      this.cooldowns[skill.id] = (this.cooldowns[skill.id] ?? 0) - dt;
      if (this.autoCast&&this.cooldowns[skill.id]! <= 0&&this.autoCastGap<=0) {
        const target=this.chooseSkillTarget(skill,focus,input.aim);
        if(!stunned&&this.canAutoCast(skill,target)){
          this.queueSkill(skill,target?{x:target.x,y:target.y}:input.aim,target?.id);this.autoCastGap=.08;
        }
      }
    }
    if(!this.autoCast&&!stunned&&input.skillSlot!==undefined){const skill=this.skills[input.skillSlot];if(skill&&(this.cooldowns[skill.id]??0)<=0)this.queueSkill(skill,input.aim);}
    this.updateEnemies(dt);
    this.updateMinions(dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateHazards(dt);
    this.collectLoot(dt);
    for (const corpse of this.corpses) corpse.ttl -= dt;
    this.corpses = this.corpses.filter(c => c.ttl > 0).slice(-70);
    this.enemies = this.enemies.filter(e => e.hp > 0);
    if (this.ended) return;
    if (this.xp >= this.nextXp) {
      this.xp -= this.nextXp; this.level++; this.player.hp = Math.min(stats.maxHp, p.hp + 15);
      this.prepareUpgrade();
    }
  }

  private clearLine(a: Vec, b: Vec): boolean {
    const steps = Math.ceil(distance(a, b) / 20);
    for (let i = 1; i < steps; i++) if (!walkable(this.dungeon, a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps, 1)) return false;
    return true;
  }
  private targets(center: Vec, radius: number): Enemy[] { return this.enemies.filter(e => e.hp > 0 && distance(e, center) < radius && this.clearLine(center, e)); }
  private skillRange(id:SkillId):number{return{id:0,blades:145,frost:180,cleave:185,warcry:155,shield:210,summon:460,lightning:390,fire:410,poison:410,stormOrb:430,blood:450,bones:450,arcane:450,lance:450,corpse:380}[id]??390;}
  /** Keep a short-lived combat focus so every ready skill does not choose a different enemy. */
  private chooseCombatTarget(aim?:Vec):Enemy|undefined{
    const candidates=this.targets(this.player,460);if(!candidates.length){this.autoTargetId=null;this.autoTargetTime=0;return undefined;}
    const score=(enemy:Enemy)=>distance(this.player,enemy)+(aim?distance(aim,enemy)*1.25:0)-(enemy.rank==='boss'?180:enemy.rank==='superElite'?105:enemy.rank==='elite'?48:0)-(enemy.role==='support'?38:0);
    const best=candidates.slice().sort((a,b)=>score(a)-score(b))[0],locked=candidates.find(enemy=>enemy.id===this.autoTargetId);
    const chosen=locked&&this.autoTargetTime>0&&score(locked)<=score(best)+65?locked:best;this.autoTargetId=chosen.id;this.autoTargetTime=.45;return chosen;
  }
  private chooseSkillTarget(skill:Skill,focus:Enemy|undefined,aim?:Vec):Enemy|undefined{
    const range=this.skillRange(skill.id),candidates=this.targets(this.player,range);if(!candidates.length)return undefined;
    const area=['fire','poison','stormOrb'].includes(skill.id),finisher=['blood','cleave','lance'].includes(skill.id);
    const score=(enemy:Enemy)=>distance(enemy,aim??this.player)-(focus?.id===enemy.id?55:0)-(enemy.rank!=='normal'?35:0)-(area?candidates.filter(other=>distance(other,enemy)<105).length*34:0)-(finisher?(1-enemy.hp/enemy.maxHp)*75:0);
    return candidates.slice().sort((a,b)=>score(a)-score(b))[0];
  }
  private desiredMinions(skill:Skill):number{const legion=skill.branch==='wide'&&skill.level===6,cap=this.has('summonerCrown')?8:legion?7:6;return Math.min(cap,2+Math.floor(skill.level/2)+(skill.branch==='wide'?1:0)+(legion?1:0)+(this.has('summonerCrown')?2:0));}
  private canAutoCast(skill:Skill,target?:Enemy):boolean{
    if(skill.id==='summon')return this.minions.length<this.desiredMinions(skill);
    if(skill.id==='shield'){const cap=Math.min(120,25+skill.level*12)*(this.has('guard')?1.4:1);return !!target&&this.player.shield<cap*.35;}
    if(skill.id==='warcry'){const close=this.targets(this.player,this.skillRange('warcry'));return !!target&&(close.length>=2||close.some(enemy=>enemy.rank!=='normal'));}
    return !!target;
  }

  /** Mouse-directed skills stop at their authored range instead of snapping beyond it. */
  private aimedPoint(aim:Vec|undefined,range:number):Vec{
    const p=this.player,source=aim??{x:p.x+(p.attackFacing??p.facing).x*range,y:p.y+(p.attackFacing??p.facing).y*range},dx=source.x-p.x,dy=source.y-p.y,length=Math.hypot(dx,dy);
    if(length<1)return{x:p.x+p.facing.x*range,y:p.y+p.facing.y*range};const scale=Math.min(1,range/length);return{x:p.x+dx*scale,y:p.y+dy*scale};
  }

  private queueSkill(skill:Skill,aim?:Vec,targetId?:number):void{
    const point=this.aimedPoint(aim,this.skillRange(skill.id)),p=this.player,d=Math.max(1,distance(p,point));
    this.pendingCasts.push({skill,aim:point,targetId,delay:.12});
    if(['blades','blood','cleave','lance'].includes(skill.id))p.attackPose=.48;else p.skillPose=.65;
    p.attackFacing={x:(point.x-p.x)/d,y:(point.y-p.y)/d};this.cooldowns[skill.id]=this.skillCooldownDuration(skill);
  }

  private gainClassPower(amount:number):void{
    const before=this.classPower;this.classPower=round2(Math.min(100,this.classPower+amount));
    const resource=this.classResource;if(before<100&&this.classPower>=100){this.notify(`${resource.name}已充满 · 下一次核心行动获得强化`,'gold');this.events.push({type:'burst',...this.player,radius:72,color:this.character.color,label:resource.name});}
  }
  private consumeClassPower(action:SkillId|'basic'):boolean{
    if(this.classPower<100)return false;
    const valid=this.characterId==='sorceress'?action!=='basic':this.characterId==='necromancer'?action==='summon'||action==='corpse':true;
    if(!valid)return false;const resource=this.classResource;
    this.classPower=0;this.notify(`${resource.name}释放`,'gold');return true;
  }
  private classPowerHeal():void{if(this.characterId!=='bloodknight')return;const amount=round2(this.stats.maxHp*.05);this.player.hp=round2(Math.min(this.stats.maxHp,this.player.hp+amount));this.events.push({type:'heal',...this.player,amount,color:0xc95058,label:`+${fixed2(amount)}`});}

  /** Right click is a separate, mana-free weapon attack with its own cadence. */
  private basicAttack(aim?:Vec):void{
    if(this.basicAttackCooldown>0)return;
    const p=this.player,weapon=this.equipped.weapon?.weaponKind??(this.characterId==='bloodknight'?'sword':'wand'),profile=WEAPONS[weapon],point=this.aimedPoint(aim,profile.range),angle=Math.atan2(point.y-p.y,point.x-p.x),color=this.character.color;
    this.basicAttackCooldown=Math.max(.2,profile.cadence*(1-this.stats.haste*.45));p.attackPose=.48;p.attackFacing={x:Math.cos(angle),y:Math.sin(angle)};this.damageSource='基础攻击';
    const classEmpowered=this.consumeClassPower('basic'),comboHeavy=weapon==='sword'&&this.weaponCombo===2;this.weaponCombo=weapon==='sword'?(this.weaponCombo+1)%3:0;this.weaponComboWindow=1.5;
    const damage=(11+this.level*2.2)*this.stats.damage*profile.damageScale*(comboHeavy?1.45:1)*(classEmpowered?1.4:1);
    if(classEmpowered)this.classPowerHeal();
    if(profile.ranged){this.fireProjectile(p,angle,damage,color,profile.pierce);if(weapon==='wand')this.fireProjectile(p,angle+.07,damage*.58,color,0);this.events.push({type:'cast',...p,target:point,color,facing:p.attackFacing,radius:46});return;}
    const arc=comboHeavy?1.8:profile.arc;this.events.push({type:'slash',...p,target:point,radius:profile.range,color,facing:p.attackFacing,heavy:comboHeavy});
    for(const enemy of this.targets(p,profile.range+25))if(Math.cos(Math.atan2(enemy.y-p.y,enemy.x-p.x)-angle)>Math.cos(arc/2)){this.hit(enemy,damage,color,true,'基础攻击');if(weapon==='dagger'&&enemy.hp>0)this.hit(enemy,damage*.55,color,false,'副手刺击');}
  }

  spawnEnemy(kind: EnemyKind, elite = false): Enemy | undefined {
    const defaults:Record<EnemyKind,keyof typeof MONSTER_DEFINITIONS>={skeleton:'skeleton',zombie:'zombie-1',archer:'skeleton-archer',knight:'skeleton-warrior',cultist:'minotaur-fire-mage',wraith:'ghost-samurai',brute:'ogre',shaman:'minotaur-ice-mage',stalker:'wolf',spitter:'spider-archer',guardian:'skeleton-guardian',boss:'skeleton-lord'};
    return this.spawnEnemyProfile(MONSTER_DEFINITIONS[defaults[kind]],kind,elite,elite?'elite':undefined);
  }

  unlockShowcase(code:string):boolean{if(this.phase!=='merchant'||code.trim()!=='132584')return false;this.showcaseUnlocked=true;this.worldRevision++;this.notify('隐藏回廊已经回应 · 特殊传送门出现在营地','gold');return true;}
  enterShowcase():void{
    if(!this.showcaseUnlocked||this.showcaseMode)return;
    this.showcaseReturn={dungeon:this.dungeon,explored:this.explored,discovered:[...this.discoveredRooms],encounters:this.encounters,chestsOpened:[...this.chestsOpened]};
    this.showcaseMode=true;this.dungeon=generateShowcaseDungeon(this.seed+132584);this.explored=new Uint8Array(this.dungeon.tiles.length);this.discoveredRooms.clear();this.encounters=[];this.chestsOpened.clear();this.resetTransientWorld();Object.assign(this.player,this.dungeon.start,{hp:this.stats.maxHp,mana:this.stats.maxMana,statuses:{},invulnerable:2});this.flow=new Int16Array(0);this.flowTile=-1;this.phase='playing';this.worldRevision++;this.reveal();this.notify('怪物陈列回廊 · 门前铭文标记了每个试炼目标','gold');
  }
  leaveShowcase():void{
    if(!this.showcaseMode||!this.showcaseReturn)return;const saved=this.showcaseReturn;this.showcaseReturn=undefined;this.showcaseMode=false;this.dungeon=saved.dungeon;this.explored=saved.explored;this.discoveredRooms.clear();for(const room of saved.discovered)this.discoveredRooms.add(room);this.encounters=saved.encounters;this.chestsOpened=new Set(saved.chestsOpened);this.resetTransientWorld();Object.assign(this.player,this.dungeon.start,{hp:this.stats.maxHp,mana:this.stats.maxMana,statuses:{},invulnerable:2});this.flow=buildFlow(this.dungeon,this.player);this.flowTile=-1;this.phase='playing';this.worldRevision++;this.notify('你离开了怪物陈列回廊','gold');
  }
  private resetTransientWorld():void{this.enemies=[];this.projectiles=[];this.loot=[];this.hazards=[];this.zones=[];this.minions=[];this.corpses=[];this.events=[];this.pendingCasts=[];}

  npcPosition(id:CampNpc):Vec{const offset=({merchant:{x:-105,y:-45},blacksmith:{x:105,y:-45},beggar:{x:-120,y:72},'distant-traveler':{x:120,y:72}} as Record<CampNpc,Vec>)[id];return{x:this.dungeon.start.x+offset.x,y:this.dungeon.start.y+offset.y};}
  private setupFloorNpcs():void{
    this.beggarCurrent=false;
    if(this.floor<=4&&!this.beggarAppeared&&new Random(this.seed+this.floor*1709).next()<.25){this.beggarCurrent=true;this.beggarAppeared=true;}
    if(this.floor===1||this.floor===5){
      this.shopOffers=[];this.merchantPotionStock=2;
      const shopRng=new Random(this.seed+this.floor*811+this.level*37),target=Math.max(1,Math.round(this.level*.72+this.recommendedEnemyLevel*.28+this.floor*1.2));
      for(let i=0;i<4;i++){
        let rarity=rollRarity(shopRng,false,this.greed,this.floor);if(rarity==='common')rarity='magic';
        if(this.greed<10&&QUALITY_ORDER.indexOf(rarity)>QUALITY_ORDER.indexOf('rare'))rarity='rare';
        const item=createItem(shopRng,this.nextId++,Math.max(1,target+shopRng.int(-2,2)),rarity);
        this.shopOffers.push({item,price:Math.round(itemValue(item)*3.2+(item.level??1)*2.4),sold:false});
      }
    }else{this.shopOffers=[];this.merchantPotionStock=0;}
  }
  private spendGold(amount:number):boolean{
    amount=Math.max(0,Math.round(amount));if(this.walletGold<amount)return false;
    const fromRun=Math.min(this.gold,amount);this.gold=round2(this.gold-fromRun);this.session.gold=round2(this.session.gold-(amount-fromRun));return true;
  }
  shopPrice(base:number):number{return Math.max(1,Math.round(base*(1-Math.min(.3,talentBonus(this.session,this.characterId,'shopDiscount')))));}
  buyShopItem(index:number):boolean{const offer=this.shopOffers[index];if(this.phase!=='merchant'||!offer||offer.sold||!this.spendGold(this.shopPrice(offer.price)))return false;offer.sold=true;this.receiveItem(offer.item);this.notify(`商人成交 · ${offer.item.name}`,'gold');return true;}
  buyPotion():boolean{const price=this.shopPrice(38+this.floor*8);if(this.phase!=='merchant'||this.merchantPotionStock<=0||this.player.potionCharges>=3||!this.spendGold(price))return false;this.merchantPotionStock--;this.player.potionCharges++;this.notify('购买血瓶 · 已放入药剂腰带','gold');return true;}
  private locateItem(id:number):Item|undefined{return Object.values(this.equipped).find(item=>item.id===id)??this.inventory.find(item=>item.id===id);}
  smithMatchLevel(id:number):boolean{const item=this.locateItem(id);if(this.phase!=='blacksmith'||!item)return false;const target=Math.max(item.level??item.power,Math.round(this.level+this.floor*1.5)),gain=target-(item.level??item.power);if(gain<=0)return false;const cost=this.shopPrice(45+gain*14);if(!this.spendGold(cost))return false;const factor=1+gain*.035;item.level=item.power=target;item.damage=round2(item.damage*factor);item.health=round2(item.health*factor);item.baseGrade=target>=36?'elite':target>=16?'exceptional':'normal';this.notify(`铁匠调校 · ${item.name}提升至 ${target} 级`,'gold');return true;}
  smithImproveQuality(id:number):boolean{const item=this.locateItem(id);if(this.phase!=='blacksmith'||!item)return false;const current=QUALITY_ORDER.indexOf(item.rarity),cap=this.greed<10?QUALITY_ORDER.indexOf('rare'):QUALITY_ORDER.length-1;if(current<0||current>=cap)return false;const cost=this.shopPrice(100+(current+1)*75+(item.level??1)*4);if(!this.spendGold(cost))return false;const rarity=QUALITY_ORDER[current+1],improved=createItem(this.rng,item.id,item.level??item.power,rarity,item.evolution?.skill,item.slot,item.weaponKind,item.evolution?.branch);Object.assign(item,improved,{id:item.id});this.notify(`铁匠升品 · ${item.name}成为${rarity}`,'gold');return true;}
  payBeggar():boolean{if(this.phase!=='beggar'||!this.beggarCurrent)return false;const payment=Math.floor(this.walletGold/2);if(payment<=0)return false;this.spendGold(payment);this.beggarPayment=payment;this.beggarPaid=true;this.travelerFloor=this.floor+1;this.beggarCurrent=false;this.phase='playing';this.notify(`你交给乞丐 ${round2(payment)} 金币。他答应在下一道门后偿还。`,'gold');this.worldRevision++;return true;}
  claimTraveler():boolean{if(this.phase!=='traveler'||this.floor!==this.travelerFloor||this.travelerClaimed)return false;const reward=this.beggarPayment*3;this.gold=round2(this.gold+reward);this.travelerClaimed=true;this.phase='playing';this.notify(`远方旅客履约 · 归还 ${round2(reward)} 金币`,'gold');this.worldRevision++;return true;}
  private spawnThemePack(count:number,rank:'normal'|'elite'|'superElite'):Enemy[]{
    if(rank==='normal')return this.spawnThemeFormation(count);
    const roster=THEME_MONSTERS[this.dungeon.theme],matching=roster.filter(profile=>profile.rank===rank),pool=matching.length?matching:roster.filter(profile=>profile.rank==='normal');
    const leaderProfile=this.rng.pick(pool.length?pool:roster),complements=roster.filter(profile=>profile.rank==='normal'&&profile.role!==leaderProfile.role),out:Enemy[]=[];
    for(let i=0;i<count;i++){
      const profile=i===0?leaderProfile:(complements.length&&i%3===2?this.rng.pick(complements):this.rng.pick(pool.length?pool:roster));
      const enemy=this.spawnEnemyProfile(profile,undefined,true,rank);if(!enemy)continue;
      enemy.formationAngle=i*Math.PI*2/Math.max(1,count);
      if(out[0]&&i>0){const candidate={x:out[0].x+Math.cos(enemy.formationAngle)*Math.min(80,28+i*9),y:out[0].y+Math.sin(enemy.formationAngle)*Math.min(80,28+i*9)};if(walkable(this.dungeon,candidate.x,candidate.y,Math.min(enemy.radius,12)))Object.assign(enemy,candidate);}
      out.push(enemy);
    }
    return out;
  }
  private updateShowcaseRooms():void{
    const rooms=this.dungeon.showcaseRooms??[],active=new Set<number>();
    for(const specimen of rooms){const room=this.dungeon.rooms[specimen.room],center={x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2)*TILE};if(distance(center,this.player)<900)active.add(specimen.room);}
    this.enemies=this.enemies.filter(enemy=>enemy.showcaseRoom===undefined?distance(enemy,this.player)<980:active.has(enemy.showcaseRoom));
    for(const specimen of rooms.filter(value=>active.has(value.room))){
      if(this.enemies.some(enemy=>enemy.hp>0&&enemy.showcaseRoom===specimen.room))continue;
      const profile=SHOWCASE_PROFILES[specimen.profileId],enemy=this.spawnEnemyProfile(profile,undefined,profile.rank!=='normal',profile.rank);if(!enemy)continue;
      const room=this.dungeon.rooms[specimen.room];Object.assign(enemy,{x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2)*TILE,showcaseRoom:specimen.room});
      if(profile.rank==='boss'){const stationary='stationary'in profile&&!!profile.stationary;enemy.tactic=stationary?undefined:profile.attack==='charge'?'charge':profile.attack==='summon'?'summoner':profile.attack==='jail'?'jailer':undefined;}
    }
  }
  /** Every theme owns three authored formations; room purpose chooses the formation. */
  private spawnThemeFormation(count:number,roomIndex?:number):Enemy[]{
    const roster=THEME_MONSTERS[this.dungeon.theme],design=THEME_DESIGNS[this.dungeon.theme],room=roomIndex===undefined?undefined:this.dungeon.rooms[roomIndex];
    const fallback=Math.abs(roomIndex??Math.floor(this.mapTime/18))%design.formations.length,patternIndex=room?.type==='crypt'?0:room?.type==='altar'?1:room?.type==='treasury'?2:fallback,pattern=design.formations[patternIndex].units,out:Enemy[]=[];
    const total=Math.max(1,count);
    for(let i=0;i<total;i++){
      const profile=roster[pattern[i%pattern.length]%roster.length]??roster[i%roster.length],enemy=this.spawnEnemyProfile(profile);
      if(!enemy)continue;
      enemy.formationAngle=i%2?Math.PI*.72:-Math.PI*.72;
      if(room){
        const center={x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2)*TILE},row=Math.floor(i/3),column=i%3-1;
        const candidate={x:center.x+column*55,y:center.y+(row-1)*48};
        if(walkable(this.dungeon,candidate.x,candidate.y,Math.min(enemy.radius,12)))Object.assign(enemy,candidate);
      }else if(out[0]){
        const candidate={x:out[0].x+(i%3-1)*48,y:out[0].y+Math.floor(i/3)*42};
        if(walkable(this.dungeon,candidate.x,candidate.y,Math.min(enemy.radius,12)))Object.assign(enemy,candidate);
      }
      out.push(enemy);
    }
    return out;
  }
  private rollMapAffixes(floor:number):MapAffix[]{
    if(floor<3)return[];const pool:MapAffix[]=['坚韧','狂乱','虫群','易爆','噩梦','丰饶'];return new Random(this.seed+floor*7919).shuffle(pool).slice(0,floor>=6?2:1);
  }

  private createRoomEncounters():RoomEncounter[]{
    const rng=new Random(this.seed+this.floor*1009+811),rooms=rng.shuffle(this.dungeon.rooms.map((_,index)=>index).filter(index=>index!==0&&index!==this.dungeon.bossRoom&&!this.dungeon.hiddenRooms.includes(index)));
    const types:RoomEncounterType[]=['siege','elite','survival','hunt','mechanism','treasure'];
    const required=Math.min(8,Math.max(2,Math.ceil(rooms.length*.6)));
    return rooms.map((room,index)=>{const type=types[(index+this.floor+this.seed)%types.length],waves=type==='siege'?2+Number(this.floor>=5):type==='survival'?3:type==='elite'?2:1;return{room,type,state:'dormant',key:index<required,choiceReward:type==='treasure'||index===0,wavesSpawned:0,totalWaves:waves,waveDelay:0,remaining:type==='survival'?18+this.floor*1.5:0,kills:0};});
  }

  private activateRoomEncounter(encounter:RoomEncounter):void{
    if(encounter.state!=='dormant'||this.activeRoomEncounter||this.activeEncounter)return;encounter.state='active';encounter.waveDelay=.35;
    const names:Record<RoomEncounterType,string>={siege:'封门围攻',elite:'精英阵列',survival:'守住圣印',hunt:'猎杀目标',mechanism:'机关杀阵',treasure:'宝藏伏击'};
    this.notify(`${names[encounter.type]} · 房门已经封闭`,'red');this.events.push({type:'burst',...this.roomCenter(encounter.room),radius:145,color:0xb65b43,label:names[encounter.type]});
  }

  private roomCenter(index:number):Vec{const room=this.dungeon.rooms[index];return{x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2)*TILE};}

  private spawnRoomWave(encounter:RoomEncounter):void{
    encounter.wavesSpawned++;const room=encounter.room,base=3+Math.ceil(this.floor*.55)+Math.floor(this.greed/5),late=encounter.wavesSpawned>1?1:0;
    let rank:'normal'|'elite'|'superElite'='normal',count=base+late;
    if(encounter.type==='elite'){rank=encounter.wavesSpawned===encounter.totalWaves?(this.floor>=5?'superElite':'elite'):'normal';count=rank==='normal'?base:1+Number(this.floor>=6);}
    if(encounter.type==='hunt'){rank=this.floor>=5?'superElite':'elite';count=1;}
    if(encounter.type==='mechanism'){count=base;const c=this.roomCenter(room);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;this.hazards.push({id:this.nextId++,x:c.x+Math.cos(a)*100,y:c.y+Math.sin(a)*100,radius:48,delay:.85+i*.18,ttl:1.25+i*.18,damage:18+this.floor*4,fired:false,status:i%2?'burn':'chill',sourceName:'房间机关'});}}
    if(encounter.type==='treasure')count=base+2;
    const enemies=rank==='normal'?this.spawnThemeFormation(count,room):this.spawnThemePack(count,rank),center=this.roomCenter(room);
    enemies.forEach((enemy,index)=>{enemy.encounterRoom=room;if(rank!=='normal'){const a=index*Math.PI*2/Math.max(1,enemies.length);const point={x:center.x+Math.cos(a)*70,y:center.y+Math.sin(a)*70};if(walkable(this.dungeon,point.x,point.y,Math.min(12,enemy.radius)))Object.assign(enemy,point);}});
    if(encounter.type==='hunt'&&enemies[0])encounter.targetId=enemies[0].id;
  }

  private updateRoomEncounters(dt:number):void{
    const encounter=this.activeRoomEncounter;if(!encounter)return;
    if(encounter.type==='survival')encounter.remaining=round2(Math.max(0,encounter.remaining-dt));
    const alive=this.enemies.filter(enemy=>enemy.hp>0&&enemy.encounterRoom===encounter.room);
    const complete=encounter.type==='survival'?encounter.remaining<=0:encounter.type==='hunt'?!!encounter.targetId&&!this.enemies.some(enemy=>enemy.id===encounter.targetId&&enemy.hp>0):encounter.wavesSpawned>=encounter.totalWaves&&!alive.length;
    if(complete){for(const enemy of alive)enemy.hp=0;this.completeRoomEncounter(encounter);return;}
    if(!alive.length&&encounter.wavesSpawned<encounter.totalWaves){encounter.waveDelay-=dt;if(encounter.waveDelay<=0){this.spawnRoomWave(encounter);encounter.waveDelay=1.4;}}
    else if(encounter.type==='survival'&&encounter.wavesSpawned<encounter.totalWaves&&encounter.remaining<(encounter.totalWaves-encounter.wavesSpawned)*6){this.spawnRoomWave(encounter);}
  }

  private completeRoomEncounter(encounter:RoomEncounter):void{
    if(encounter.state==='cleared')return;encounter.state='cleared';const reward=25+this.floor*12+Number(encounter.key)*20;this.gold=round2(this.gold+reward);this.xp=round2(this.xp+10+this.floor*4);this.player.hp=round2(Math.min(this.stats.maxHp,this.player.hp+this.stats.maxHp*.08));this.player.mana=round2(Math.min(this.stats.maxMana,this.player.mana+15));this.events.push({type:'burst',...this.roomCenter(encounter.room),radius:180,color:0xd6b86e,label:'房间净化'});
    this.notify(`房间已净化 · ${reward.toFixed(2)} 金币${encounter.key?` · 首领封印 ${this.clearedKeyRooms}/${this.requiredKeyRooms}`:''}`,'gold');
    if(encounter.choiceReward){this.roomRewardOptions=[{key:'relic',title:'守护者遗物',description:'获得一件至少稀有品质、匹配当前等级的装备。'},{key:'fortune',title:'灰烬贡金',description:`立即获得 ${80+this.floor*25} 金币。`},{key:'respite',title:'圣所休整',description:'恢复 45% 生命、40 法力并补充一瓶血瓶。'}];this.phase='roomReward';}
    else if(this.bossUnlocked)this.notify('关键房间已经净化 · 首领圣所解除封锁','gold');
  }

  chooseRoomReward(key:RoomRewardOption['key']):boolean{
    if(this.phase!=='roomReward'||!this.roomRewardOptions.some(option=>option.key===key))return false;
    if(key==='relic')this.dropItem(this.player,this.greed>=10?'epic':'rare',true);
    else if(key==='fortune')this.gold=round2(this.gold+80+this.floor*25);
    else{this.player.hp=round2(Math.min(this.stats.maxHp,this.player.hp+this.stats.maxHp*.45));this.player.mana=round2(Math.min(this.stats.maxMana,this.player.mana+40));this.player.potionCharges=Math.min(3,this.player.potionCharges+1);this.events.push({type:'heal',...this.player,color:0x9ed6a8});}
    this.roomRewardOptions=[];this.phase='playing';if(this.bossUnlocked)this.notify('关键房间已经净化 · 首领圣所解除封锁','gold');return true;
  }

  private updateMechanisms():void{
    for(const m of this.dungeon.mechanisms){
      if(m.used||distance(m,this.player)>58||!['spikes','flameVent','frostVent'].includes(m.kind))continue;
      m.used=true;
      const frost=m.kind==='frostVent';
      this.hazards.push({id:this.nextId++,...m,radius:m.kind==='spikes'?65:82,delay:.65,damage:(18+this.floor*5)*(1+this.greed*.04),ttl:1.2,fired:false,shape:'circle'});
      if(frost)this.zones.push({id:this.nextId++,...m,radius:75,ttl:3,tick:0,damage:3+this.floor,color:0x8fd5e6});
      this.notify(m.kind==='spikes'?'地刺机关启动':frost?'霜息机关启动':'焰口机关启动','red');
    }
  }
  private applyPlayerStatus(status:NonNullable<Enemy['onHit']>,potency:number,duration:number,source:string):void{
    const resisted=1-this.statusResistance,existing=this.player.statuses[status];
    this.player.statuses[status]={duration:round2(Math.max(existing?.duration??0,duration*resisted)),potency:round2(Math.max(existing?.potency??0,potency*resisted)),tick:.5};
    this.lastHit=`${source}造成的${{poison:'中毒',bleed:'流血',stun:'眩晕',chill:'寒冷',curse:'诅咒',burn:'燃烧'}[status]}`;
    this.events.push({type:'status',...this.player,label:{poison:'中毒',bleed:'流血',stun:'眩晕',chill:'寒冷',curse:'诅咒',burn:'燃烧'}[status],color:{poison:0x87b85c,bleed:0xd74f54,stun:0xe8ce77,chill:0x87d4ef,curse:0xb272d8,burn:0xef713f}[status]});
  }
  private updatePlayerStatuses(dt:number):void{
    const damaging=new Set(['poison','bleed','burn']);
    for(const [key,value] of Object.entries(this.player.statuses)){
      const status=key as NonNullable<Enemy['onHit']>;value.duration-=dt;value.tick-=dt;
      if(damaging.has(status)&&value.tick<=0){value.tick=.5;const amount=round2(value.potency*.5),absorbed=Math.min(this.player.shield,amount);this.player.shield=round2(this.player.shield-absorbed);this.player.hp=round2(this.player.hp-(amount-absorbed));this.events.push({type:'hit',...this.player,amount,color:status==='poison'?0x87b85c:status==='burn'?0xef713f:0xd74f54});}
      if(value.duration<=0)delete this.player.statuses[status];
    }
    if(this.player.hp<=0){if(this.showcaseMode){Object.assign(this.player,this.dungeon.start,{hp:this.stats.maxHp,mana:this.stats.maxMana,shield:0,invulnerable:3,statuses:{}});this.enemies=[];this.projectiles=[];this.hazards=[];this.zones=[];this.notify('陈列回廊重塑了你的躯体','gold');}else{this.player.hp=0;this.finish('dead');}}
  }
  private updateThemeMechanic(dt:number):void{
    this.themeTimer-=dt;if(this.themeTimer>0)return;this.themeTimer=Math.max(10,22-this.floor-this.greed*.25);
    const theme=this.dungeon.theme,design=THEME_DESIGNS[theme],p={...this.player},damage=round2(10+this.floor*3+this.greed*.7),hazard=(x:number,y:number,radius:number,status?:Enemy['onHit'],scale=1,delay=.9)=>this.hazards.push({id:this.nextId++,x,y,radius,delay,ttl:2.2,damage:round2(damage*scale),fired:false,status,sourceName:design.hazardName});
    switch(design.hazard){
      case'rockfall':hazard(p.x,p.y,62,'stun',1,1.15);break;
      case'prisoners':this.spawnThemeFormation(3);break;
      case'bells':this.spawnThemeFormation(Math.min(4,2+Math.floor(this.floor/3)));this.events.push({type:'ring',...p,radius:150,color:0xc8a66a});break;
      case'ambush':this.spawnThemeFormation(4);hazard(p.x,p.y,48,'bleed',.55,1);break;
      case'eruption':for(let i=0;i<3;i++){const a=i*Math.PI*2/3;hazard(p.x+Math.cos(a)*85,p.y+Math.sin(a)*85,68,'burn',1,.8);}break;
      case'avalanche':hazard(p.x,p.y,82,'stun',1.1,1.3);this.applyPlayerStatus('chill',0,1.8,design.hazardName);break;
      case'plague':for(let i=0;i<2;i++)hazard(p.x+(i?75:-75),p.y,76,'poison',.55,.7);break;
      case'royalGuard':this.spawnThemeFormation(4);for(const enemy of this.enemies.slice(-4)){enemy.maxShield=round2(enemy.maxHp*.12);enemy.shield=enemy.maxShield;}break;
      case'resurrection':{const dead=this.corpses.slice(-3);for(const corpse of dead){const enemy=this.spawnThemeFormation(1)[0];if(enemy)Object.assign(enemy,{x:corpse.x,y:corpse.y,hp:round2(enemy.maxHp*.55)});}this.corpses=this.corpses.filter(corpse=>!dead.includes(corpse));break;}
      case'toxicFlush':this.hazards.push({id:this.nextId++,x:p.x-180,y:p.y,target:{x:p.x+180,y:p.y},shape:'line',width:38,radius:0,delay:1.1,ttl:2.1,damage,status:'poison',fired:false,sourceName:design.hazardName});break;
      case'blizzard':this.applyPlayerStatus('chill',0,2.8,design.hazardName);hazard(p.x,p.y,95,'chill',.45,1.2);break;
      case'bogGas':for(let i=0;i<3;i++){const a=i*Math.PI*2/3;hazard(p.x+Math.cos(a)*72,p.y+Math.sin(a)*72,64,'poison',.48,.65);}break;
      case'caveIn':hazard(p.x-55,p.y,58,'stun',.9,1.05);hazard(p.x+55,p.y,58,'stun',.9,1.25);break;
      case'sandstorm':this.applyPlayerStatus('chill',0,2.4,design.hazardName);this.spawnThemeFormation(3);break;
      case'abyssRift':this.applyPlayerStatus('curse',.18,3,design.hazardName);this.spawnThemeFormation(2);this.events.push({type:'teleport',...p,radius:120,color:0xbe5ce1});break;
    }
    this.notify(`${this.theme.name} · ${design.hazardName}`,'red');
  }
  private updateSupport(e:Enemy,dt:number):void{
    if(!e.support)return;e.supportCooldown-=dt;if(e.supportCooldown>0)return;e.supportCooldown=e.rank==='superElite'?5:7;
    const allies=this.enemies.filter(other=>other.hp>0&&other.id!==e.id&&distance(other,e)<230);
    if(e.support==='heal'){for(const ally of allies.slice(0,5))ally.hp=round2(Math.min(ally.maxHp,ally.hp+ally.maxHp*.12));this.events.push({type:'heal',...e,radius:180,color:0x80c978});}
    if(e.support==='shield'){for(const ally of allies.slice(0,5)){ally.maxShield=round2(ally.maxHp*.16);ally.shield=Math.max(ally.shield,ally.maxShield);}this.events.push({type:'shield',...e,radius:190,color:0x8ac4e8});}
    if(e.support==='revive'&&e.revives<3&&this.corpses.length){const corpse=this.corpses.pop()!,profile=this.rng.pick(THEME_MONSTERS[this.dungeon.theme].filter(p=>p.rank==='normal'));const revived=this.spawnEnemyProfile(profile);if(revived){Object.assign(revived,{x:corpse.x,y:corpse.y,hp:round2(revived.maxHp*.45)});e.revives++;this.events.push({type:'revive',...corpse,color:0x9cc17d});}}
    if(e.support==='teleport'){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x)+Math.PI,candidate={x:this.player.x+Math.cos(a)*110,y:this.player.y+Math.sin(a)*110};if(walkable(this.dungeon,candidate.x,candidate.y,12)){Object.assign(e,candidate);this.events.push({type:'teleport',...e,color:0xb276dd});}}
    if(e.support==='surround')for(let i=0;i<allies.length;i++)allies[i].formationAngle=i*Math.PI*2/Math.max(1,allies.length);
  }
  private spawnEnemyProfile(profile?:MonsterProfile,forcedKind?:EnemyKind,elite=false,rankOverride?:'normal'|'elite'|'superElite'|'boss'):Enemy|undefined{
    const kind=forcedKind??profile!.kind;
    if (this.enemies.length >= MAX_ENEMIES && kind !== 'boss') return;
    const base = ENEMIES[kind];
    let pos: Vec | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      const a = this.rng.next() * Math.PI * 2, r = this.rng.int(260, 390);
      const v = { x: this.player.x + Math.cos(a) * r, y: this.player.y + Math.sin(a) * r };
      if (walkable(this.dungeon, v.x, v.y, Math.min(base.radius, 14))) { pos = v; break; }
    }
    // Boss must always appear even if the player stands in a narrow corridor.
    if (!pos && kind === 'boss') pos = { ...this.dungeon.start };
    if (!pos) return;
    const rank=rankOverride??profile?.rank??(elite?'elite':'normal'),ranked=rank!=='normal',level=this.recommendedEnemyLevel+(this.mapAffixes.includes('噩梦')?3:0),baseHp=profile?.hp??base.hp,baseDamage=profile?.damage??base.damage;
    const hp=round2(baseHp*enemyHealthMultiplier(level,this.greed,ranked)*(rank==='superElite'?1.35:1)*(this.mapAffixes.includes('坚韧')?1.22:1)),damage=round2(baseDamage*enemyDamageMultiplier(level,this.greed,ranked)*(rank==='superElite'?1.18:1)*(this.mapAffixes.includes('狂乱')?1.18:1));
    const e: Enemy = { id: this.nextId++, ...pos, kind, hp, maxHp: hp, speed: base.speed, radius: base.radius, damage: base.damage, attackCooldown: this.rng.next() * 1.5,
      slow:0,hitFlash:0,elite:ranked,rank,role:profile?.role??'frontline',onHit:profile?.onHit,support:profile?.support,supportCooldown:2+this.rng.next()*3,shield:0,maxShield:0,moving:false,formationAngle:0,dropChance:rankOverride?RANK_DROP_CHANCE[rank]:profile?.dropChance??RANK_DROP_CHANCE[rank],xpMultiplier:rankOverride?(rank==='superElite'?4:rank==='elite'?2:1):profile?.xpMultiplier??(ranked?2:1),revives:0,windup:0,abilityCooldown:2,chargeTime:0,stagger:0,knockback:{x:0,y:0},armor:Math.min(.38,this.greed*.012+(rank==='boss'?.12:rank==='superElite'?.08:rank==='elite'?.04:0)),level,name:profile?.name,attack:profile?.attack??(kind==='archer'?'shot':kind==='cultist'?'meteor':'melee'),tint:profile?.tint,artId:profile?.artId,legacyFrame:profile?.legacyFrame,facing:{x:0,y:1},stationary:'stationary'in(profile??{})?(profile as any).stationary:false,bossId:rank==='boss'?profile?.id:undefined,abilities:'abilities'in(profile??{})?(profile as any).abilities:undefined };
    e.damage=damage;e.speed=(profile?.speed??base.speed)*(this.mapAffixes.includes('狂乱')?1.1:1);
    if(rank==='boss')e.radius=profile?.artId?.startsWith('final/')?105:49;
    this.enemies.push(e); return e;
  }

  private cast(skill: Skill, aim?: Vec): void {
    const p = this.player, color = SKILLS[skill.id].color;
    const castAim=this.aimedPoint(aim,this.skillRange(skill.id));
    const nearby = this.targets(p,this.skillRange(skill.id)).sort((a, b) => distance(a,castAim) - distance(b,castAim));
    const enhanced = this.amplify && p.mana >= 52;
    if (enhanced) p.mana -= 12; // Always reserve 40 mana for the player's manual burst.
    const relic=matchingEvolutionRelic(Object.values(this.equipped),skill),classEmpowered=this.consumeClassPower(skill.id);
    const apex=skill.level===6,damage = (18 + skill.level * 9) * this.stats.damage * (enhanced ? 1.3 : 1) * (skill.branch === 'focused' ? 1.35 : 1) * (apex ? 1.4 : 1)*(relic?.damage??1)*(classEmpowered?1.4:1);
    this.damageSource=SKILLS[skill.id].name;
    const width = (skill.branch === 'wide' ? 1.3 : 1)*(relic?.area??1)*(classEmpowered&&this.characterId==='sorceress'?1.15:1);
    this.events.push({type:'cast',...p,color,facing:p.attackFacing??p.facing,label:skill.id,radius:75});
    switch (skill.id) {
      case 'lightning': {
        if(!nearby.length)break;
        let from: Vec = p;
        const hit = new Set<number>();
        const jumps=3+Math.floor(skill.level/2)+(this.has('storm')?2:0)+(skill.branch==='wide'?2+(apex?3:0):0)+(setPieces(Object.values(this.equipped),'tempest')>=3?2:0)+(relic?.branch==='wide'?1:0);
        let refunds = 0;
        for (let j = 0; j < jumps; j++) {
          const next = (j===0?nearby:this.targets(from,270)).filter(e => !hit.has(e.id)).sort((a, b) => distance(a,j===0?castAim:from)-distance(b,j===0?castAim:from))[0];
          if (!next) {
            // Focused branch converts remaining jumps into diminishing boss damage.
            if (skill.branch === 'focused' && nearby[0]?.hp > 0) this.hit(nearby[0], damage * .35 * (jumps - j), color);
            break;
          }
          this.events.push({ type: 'lightning', x: from.x, y: from.y, target: { x: next.x, y: next.y }, color });
          const critical = this.hit(next, damage * (skill.branch === 'wide' ? .85 : 1), color);
          if (critical && this.has('storm') && refunds < 3) { p.mana = Math.min(100, p.mana + 4); refunds++; }
          hit.add(next.id); from = { x: next.x, y: next.y };
        }
        if(apex&&skill.branch==='focused'&&nearby[0]?.hp>0){this.events.push({type:'lightning',x:from.x,y:from.y,target:{x:nearby[0].x,y:nearby[0].y},color});this.hit(nearby[0],damage*.8,color);}
        break;
      }
      case 'blades':
        if (skill.branch === 'wide') {
          const count = skill.level === 6 ? 5 : 3;
          for (let i = 0; i < count; i++) this.fireProjectile(p, this.time * 1.5 + i * Math.PI * 2 / count, damage * .7, color, 4, true);
          break;
        }
        this.events.push({ type: 'slash', ...p, radius: (92 + skill.level * 5) * width, color });
        for (const e of this.targets(p, (92 + skill.level * 5) * width)) this.hit(e, damage, color);
        if(apex&&skill.branch==='focused'){this.events.push({type:'slash',...p,radius:105,color,facing:{x:-(p.attackFacing??p.facing).x,y:-(p.attackFacing??p.facing).y}});for(const e of this.targets(p,105))this.hit(e,damage*.65,color);}
        break;
      case 'frost':
        this.events.push({ type: 'ring', ...p, radius: 155 * width, color });
        for (const e of this.targets(p, 155 * width)) { e.slow = skill.branch==='focused'?4.2:2.8; this.hit(e, damage * 1.1, color);if(apex&&skill.branch==='focused')e.stagger=Math.max(e.stagger,.55); }
        if (skill.level === 6) this.zones.push({ id: this.nextId++, ...p, radius: 155 * width, ttl: 2.5, tick: 0, damage: damage * .2, color: 0x9adaed,sourceName:SKILLS[skill.id].name });
        break;
      case 'fire': case 'poison': case 'stormOrb': {
        const center = castAim;
        const radius = (skill.id === 'fire' ? 85 : 100) * width * (skill.id === 'fire' && this.has('inferno') ? 1.4 : 1);
        this.zones.push({ id: this.nextId++, x: center.x, y: center.y, radius, ttl: 3 + (skill.id === 'fire' && this.has('inferno') ? 2 : 0)+(relic?.branch==='wide'?1:0), tick: 0, damage: damage * .48, color,sourceName:SKILLS[skill.id].name });
        if(skill.id==='fire'&&this.has('meteorEcho')&&this.rng.next()<.25)this.zones.push({id:this.nextId++,x:center.x+this.rng.int(-80,80),y:center.y+this.rng.int(-80,80),radius:radius*.72,ttl:2.5,tick:0,damage:round2(damage*.4),color});
        this.events.push({ type: 'ring', x: center.x, y: center.y, radius, color });
        if(apex&&skill.branch==='focused')for(const e of this.targets(center,radius))this.hit(e,damage*.8,color);
        if (skill.level === 6) for (const extra of nearby.slice(1, 3)) this.zones.push({ id: this.nextId++, x: extra.x, y: extra.y, radius: radius * .65, ttl: 2, tick: 0, damage: damage * .28, color });
        break;
      }
      case 'blood': case 'bones': {
        const a = Math.atan2(castAim.y - p.y,castAim.x - p.x);
        const focusedApex=apex&&skill.branch==='focused'?1.25:1;
        this.projectiles.push({ id: this.nextId++, ...p, vx: Math.cos(a) * 450, vy: Math.sin(a) * 450, ttl: 1.2, damage: damage * focusedApex*(skill.id === 'blood' && this.has('vampire') ? 1.25 : 1), radius: 10, enemy: false, color, pierce: 3 + skill.level + (skill.branch === 'wide' ? 3 : 0), hit: new Set(), bleed: skill.id === 'blood' });
        if (skill.level === 6) { this.fireProjectile(p, a - .18, damage * .6, color, 3); this.fireProjectile(p, a + .18, damage * .6, color, 3); }
        break;
      }
      case 'summon':
        this.raiseMinions(this.desiredMinions(skill)+(relic?.branch==='wide'?1:0),damage*.6,(skill.level===6?20:14)*(this.has('summonerCrown')?1.25:1));
        break;
      case 'shield': case 'warcry':
        p.shield = Math.min(150, 25 + skill.level * 12) * (skill.id === 'shield' && this.has('guard') ? 1.4 : 1)*(skill.branch==='focused'?(apex?1.35:1.18):1);
        this.events.push({ type: 'ring', ...p, radius: 75 * width, color });
        for (const e of this.targets(p, (skill.id === 'warcry' ? 115 : 75) * width)) { this.hit(e, damage * .75, color); if (skill.id === 'warcry') { e.slow = 2; this.pushEnemy(e, p, 200); } }
        if(apex&&skill.branch==='wide'){this.zones.push({id:this.nextId++,...p,radius:(skill.id==='warcry'?125:90)*width,ttl:1.8,tick:.35,damage:damage*.22,color,sourceName:SKILLS[skill.id].name});}
        break;
      case 'arcane': {
        const a = Math.atan2(castAim.y-p.y,castAim.x-p.x), count = 3 + (skill.branch === 'wide' ? 2 : 0) + (skill.level === 6 ? 2 : 0)+(relic?.branch==='wide'?1:0);
        for (let i = 0; i < count; i++) this.fireProjectile(p, a + (i - (count - 1) / 2) * .12, damage * .65, color, skill.branch === 'focused' ? 4 : 1);
        if(apex&&skill.branch==='focused')this.fireProjectile(p,a,damage*.7,color,5);
        break;
      }
      case 'lance': {
        const a = Math.atan2(castAim.y-p.y,castAim.x-p.x);
        this.fireProjectile(p, a, damage*(apex&&skill.branch==='focused'?1.2:1), color, 5, true);
        if (skill.branch === 'wide' || skill.level === 6) { this.fireProjectile(p, a + .24, damage * .65, color, 4, true); this.fireProjectile(p, a - .24, damage * .65, color, 4, true); }
        break;
      }
      case 'cleave': {
        const center = castAim, a = Math.atan2(center.y - p.y, center.x - p.x), radius = 140 * width;
        this.events.push({ type: 'slash', ...p, radius, color, target: center });
        for (const e of this.targets(p, radius)) if (Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - a) > -.2) { this.hit(e, damage * 1.7, color); this.pushEnemy(e, p, 230); }
        if(apex&&skill.branch==='focused')for(const e of this.targets(p,radius))if(e.hp>0&&e.hp/e.maxHp<.35&&Math.cos(Math.atan2(e.y-p.y,e.x-p.x)-a)>-.2)this.hit(e,damage*.65,color);
        if (skill.level === 6) this.zones.push({ id: this.nextId++, ...p, radius, ttl: 1.2, tick: .35, damage: damage * .45, color });
        break;
      }
      case 'corpse': {
        let remains = this.corpses.filter(c => distance(c,castAim)<130*width).sort((a,b)=>distance(a,castAim)-distance(b,castAim)).slice(0, (skill.branch === 'wide' ? 5 : 3)+(relic?.branch==='wide'?1:0)+(classEmpowered?2:0));
        if(this.characterId==='necromancer'&&remains.length)this.gainClassPower(remains.length*5);
        if (!remains.length) remains = [{ id: -1, x: castAim.x, y: castAim.y, ttl: 0 }];
        for (const corpse of remains) { this.explodeCorpse(corpse, damage * 1.3, 95 * width); this.corpses = this.corpses.filter(c => c.id !== corpse.id); }
        if(apex&&skill.branch==='focused')this.explodeCorpse(castAim,damage*.7,70);
        break;
      }
    }
    if(this.characterId==='sorceress')this.gainClassPower(12);
    if(this.characterId==='bloodknight')this.gainClassPower(9);
    if(classEmpowered)this.classPowerHeal();
    this.damageSource='基础攻击';
  }

  private fireProjectile(origin: Vec, angle: number, damage: number, color: number, pierce: number, returning = false): void {
    const speed = returning ? 300 : 410;
    this.projectiles.push({ id: this.nextId++, x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      damage, color, radius: returning ? 13 : 7, pierce, enemy: false, hit: new Set(), ttl: returning ? 1.65 : 1.2, returning, age: 0,sourceName:this.damageSource });
  }

  private pushEnemy(enemy: Enemy, from: Vec, force: number): void {
    if(enemy.stationary)return;
    const d = distance(enemy, from) || 1, resistance = enemy.kind === 'boss' ? .03 : enemy.elite ? .25 : 1;
    enemy.knockback = { x: (enemy.x - from.x) / d * force * resistance, y: (enemy.y - from.y) / d * force * resistance };
  }

  private raiseMinions(count: number, damage: number, duration: number, origin:Vec=this.player): void {
    count = Math.min(10, count);
    for (const minion of this.minions.slice(0, count)) { minion.ttl = Math.max(minion.ttl, duration); minion.damage = damage; }
    while (this.minions.length < count) {
      const angle = this.minions.length * Math.PI * 2 / count;
      const position = { x: origin.x + Math.cos(angle) * 27, y: origin.y + Math.sin(angle) * 27 };
      if (!walkable(this.dungeon, position.x, position.y)) Object.assign(position, { x: this.player.x, y: this.player.y });
      this.minions.push({ id: this.nextId++, ...position, ttl: duration, attackCooldown: .2, targetId: null, damage, hitPose: 0 });
      this.events.push({ type: 'summon', ...position, color: 0xa9bd88, radius: 36 });
    }
  }

  private explodeCorpse(position: Vec, damage: number, radius: number): void {
    this.events.push({ type: 'corpse', x: position.x, y: position.y, radius, color: 0xafbf91 });
    for (const e of this.targets(position, radius)) this.hit(e, damage, 0xafbf91, false);
  }

  /** Independent allies choose reachable targets, follow the player, and attack on their own clocks. */
  private updateMinions(dt: number): void {
    for (const minion of this.minions) {
      minion.ttl -= dt; minion.attackCooldown -= dt; minion.hitPose = Math.max(0, minion.hitPose - dt);
      let target = this.enemies.find(e => e.id === minion.targetId && e.hp > 0 && distance(e, this.player) < 430 && this.clearLine(minion, e));
      if (!target) target = this.targets(minion, 320).sort((a, b) => distance(a, minion) - distance(b, minion))[0];
      minion.targetId = target?.id ?? null;
      const destination = target ?? this.player, d = distance(minion, destination);
      if (d > (target ? target.radius + 18 : 50)) {
        if (distance(minion, this.player) > 500) { minion.x = this.player.x; minion.y = this.player.y; }
        else moveOnMap(this.dungeon, minion, (destination.x - minion.x) / d * 180 * dt, (destination.y - minion.y) / d * 180 * dt, 8);
      }
      if (target && d < target.radius + 27 && minion.attackCooldown <= 0) {
        minion.attackCooldown = .85; minion.hitPose = .22;
        this.events.push({ type: 'slash', x: minion.x, y: minion.y, target: { x: target.x, y: target.y }, radius: 29, color: 0xa9bd88 });
        this.hit(target, minion.damage, 0xa9bd88,true,'召唤物');
        const summon=this.skills.find(skill=>skill.id==='summon');if(summon?.branch==='focused'&&summon.level===6)target.stagger=Math.max(target.stagger,.28);
        if (target.hp <= 0 && this.has('corpse')) this.explodeCorpse(target, minion.damage * .65, 95);
      }
    }
    this.minions = this.minions.filter(m => m.ttl > 0);
  }

  /** Trigger-generated damage passes allowProc=false: no recursive on-hit resource loops. */
  hit(enemy: Enemy, damage: number, color = 0xffffff, allowProc = true,source=this.damageSource): boolean {
    if (enemy.hp <= 0 || this.ended) return false;
    const weapon=this.equipped.weapon?.weaponKind,critical=allowProc&&this.rng.next()<this.stats.crit,distant=distance(this.player,enemy)>220;
    let multiplier=(critical?1.8:1)*(allowProc&&this.has('execute')&&enemy.hp/enemy.maxHp<.3?1.25:1)*(enemy.rank!=='normal'?1+this.eliteDamage:1)*(1-enemy.armor);
    const learned=new Set(this.skills.map(skill=>skill.id));
    if(this.characterId==='sorceress'&&source==='陨落余烬'&&enemy.slow>0&&learned.has('frost'))multiplier*=1.25;
    if(this.characterId==='necromancer'&&source==='尸骸爆破'&&this.minions.length>=3&&learned.has('summon'))multiplier*=1.22;
    if(this.characterId==='bloodknight'&&source==='裂地重斩'&&this.player.shield>0&&learned.has('warcry'))multiplier*=1.2;
    if(allowProc&&weapon==='axe'&&enemy.rank==='normal'&&enemy.hp/enemy.maxHp<.3)multiplier*=1.25;if(allowProc&&weapon==='bow'&&distant)multiplier*=1.2;
    const amount=round2(damage*multiplier),absorbed=Math.min(enemy.shield,amount);enemy.shield=round2(enemy.shield-absorbed);enemy.hp=round2(enemy.hp-(amount-absorbed));enemy.hitFlash=critical ? .19 : .12;
    if (allowProc) { enemy.stagger = Math.max(enemy.stagger, enemy.elite ? .025 : .09); this.pushEnemy(enemy, this.player, enemy.elite ? 12 : critical ? 100 : 45); }
    const lethal=enemy.hp<=0,executed=lethal&&enemy.elite&&enemy.hp+amount<=enemy.maxHp*.3,heavy=critical||amount>=enemy.maxHp*.12,impact=Math.min(1,.12+amount/150+(critical ? .24 : 0)+(lethal ? .28 : 0));
    this.telemetry.damageDealt=round2(this.telemetry.damageDealt+amount);this.telemetry.hits++;this.telemetry.criticals+=Number(critical);this.telemetry.largestHit=Math.max(this.telemetry.largestHit,amount);
    this.telemetry.bySource[source]=round2((this.telemetry.bySource[source]??0)+amount);
    if(allowProc&&this.characterId==='sorceress'&&critical)this.gainClassPower(4);
    if(allowProc&&this.characterId==='bloodknight')this.gainClassPower(3);
    this.events.push({ type: executed?'execute':'hit', x: enemy.x, y: enemy.y, color, amount, critical,lethal,heavy,blocked:absorbed>=amount,impact,label:absorbed>=amount?'格挡':executed?'处决':undefined });
    if(this.bossCast?.enemyId===enemy.id&&!this.interruptedPhases.has(this.bossPhase)&&(critical||amount>=enemy.maxHp*.025)){
      this.interruptedPhases.add(this.bossPhase);this.bossCast=null;this.bossTimer=2.4;enemy.skillPose=0;
      this.events.push({type:'interrupt',x:enemy.x,y:enemy.y,color:0x9cecff,radius:150,label:'打断'});this.notify(`打断成功 · ${enemy.name??'首领'}的施法被粉碎`,'blue');
    }
    const hpBefore=this.player.hp;
    if (allowProc && this.has('vampire') && this.regenBudget >= 1) { this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 1); this.regenBudget--; }
    if(allowProc&&critical&&setPieces(Object.values(this.equipped),'bloodOath')>=3)this.player.hp=round2(Math.min(this.stats.maxHp,this.player.hp+1.5));
    const healed=round2(this.player.hp-hpBefore);if(healed>0)this.events.push({type:'heal',...this.player,amount:healed,label:`+${fixed2(healed)}`,color:0x75d99a});
    if(allowProc&&weapon){
      this.weaponHits++;
      if(weapon==='mace'&&this.rng.next()<.24)enemy.stagger=Math.max(enemy.stagger,.65);
      if(weapon==='dagger'&&critical)for(const skill of Object.keys(this.cooldowns) as SkillId[])this.cooldowns[skill]=round2(Math.max(0,(this.cooldowns[skill]??0)*.88));
      const others=this.targets(enemy,145).filter(other=>other.id!==enemy.id);
      if(weapon==='sword'&&others[0])this.hit(others[0],amount*.35,color,false);
      if(weapon==='wand'&&others[0]&&this.rng.next()<.18)this.hit(others[0],amount*.5,color,false);
      if(weapon==='spear'){const fx=enemy.x-this.player.x,fy=enemy.y-this.player.y,len=Math.hypot(fx,fy)||1,target=others.find(other=>((other.x-enemy.x)*fx+(other.y-enemy.y)*fy)/len>25);if(target)this.hit(target,amount*.45,color,false);}
      if((weapon==='staff'&&this.weaponHits%5===0)||(this.has('chainNova')&&this.weaponHits%5===0)){for(const other of others.slice(0,6))this.hit(other,amount*.65,0xb69bea,false);this.events.push({type:'ring',...enemy,radius:145,color:0xb69bea});}
    }
    if (enemy.hp <= 0) this.kill(enemy,source);
    return critical;
  }

  private kill(e: Enemy,source='基础攻击'): void {
    this.kills++;this.telemetry.kills++;
    if(this.characterId==='necromancer')this.gainClassPower(source==='尸骸爆破'||source==='召唤物'?14:9);
    const roomEncounter=e.encounterRoom===undefined?undefined:this.roomEncounters.find(value=>value.room===e.encounterRoom);if(roomEncounter)roomEncounter.kills++;
    if(e.rank==='normal')this.killsSinceRare++;
    for (const encounter of this.encounters) if (encounter.state === 'active' && encounter.kind === 'hunt' && distance(e, encounter) < 320) encounter.progress++;
    this.corpses.push({ id: this.nextId++, x: e.x, y: e.y, ttl: 18,rank:e.rank,blood:e.onHit==='poison'?0x4d6237:e.onHit==='burn'?0x442019:0x61231f });
    if(this.corpses.length>70)this.corpses.shift();
    this.player.mana = Math.min(100, this.player.mana + 1);
    this.events.push({ type: 'death', x: e.x, y: e.y, color: e.elite ? 0xd4aa65 : 0x73584e,artId:e.artId,facing:e.facing });
    if(this.showcaseMode)return;
    const rankGold={normal:1,elite:12,superElite:35,boss:80}[e.rank],rawGold=rankGold*(1+.1*this.greed)*(1+talentBonus(this.session,this.characterId,'goldFind'));
    const fractional = rawGold - Math.floor(rawGold);
    // Stochastic rounding preserves +10% expected rewards even for one-coin enemies.
    const gold = Math.floor(rawGold) + (fractional > 0 && this.rng.next() < fractional ? 1 : 0);
    this.loot.push({id:this.nextId++,x:e.x,y:e.y,spawnX:e.x,spawnY:e.y,xp:round2(ENEMIES[e.kind].xp*e.xpMultiplier),gold,age:0});
    const dropChance=Math.min(1,e.dropChance*(1+.06*this.greed)*(this.has('treasureHunter')?1.25:1));
    if(this.rng.next()<dropChance||this.killsSinceRare>=35){
      let rarity = rollRarity(this.rng, e.rank!=='normal'||this.killsSinceRare>=35, this.greed,this.floor);
      if(this.killsSinceRare>=35&&QUALITY_ORDER.indexOf(rarity)<QUALITY_ORDER.indexOf('rare'))rarity='rare';
      this.dropItem(e, rarity, rarity === 'legendary' && this.legendaryFound === 0);
      if(QUALITY_ORDER.indexOf(rarity)>=QUALITY_ORDER.indexOf('rare'))this.killsSinceRare=0;
    }
    if(e.id===this.floorGuardianId){
      this.exitUnlocked=true;this.dropItem(e,rollRarity(this.rng,true,this.greed,this.floor),true,false,true);
      this.notify(this.floor===CAMPAIGN_FLOORS?'最终守卫已经陨落':'地图首领已被击败 · 出口已经开启','gold');
    }
    if(setPieces(Object.values(this.equipped),'plague')>=3&&e.onHit==='poison')this.zones.push({id:this.nextId++,x:e.x,y:e.y,radius:72,ttl:2.5,tick:0,damage:round2(this.stats.damage*7),color:0x8eaa55});
    if (e.kind === 'boss') { this.bossDefeated = true; this.finish('won'); }
    if ((this.greed >= 3 || this.mapAffixes.includes('易爆')) && e.elite && e.kind !== 'boss') this.hazards.push({ id: this.nextId++, x: e.x, y: e.y, radius: 75, delay: 1.2, damage: 25 + this.floor * 4, ttl: 1.5, fired: false });
  }
  private dropItem(pos: Vec, rarity: Rarity, match = false, weapon = false,themeRelic=false,emitEffect=true): void {
    if(this.greed<10&&QUALITY_ORDER.indexOf(rarity)>QUALITY_ORDER.indexOf('rare'))rarity='rare';
    const sourceLevel='level'in pos&&typeof pos.level==='number'?pos.level:this.recommendedEnemyLevel;
    const itemLevel=itemLevelFrom(sourceLevel,this.floor,this.greed,this.rng.next())+(this.mapAffixes.includes('丰饶')?3:0);
    const evolvedSkills=this.skills.filter(skill=>skill.branch!==null),evolved=evolvedSkills.length?this.rng.pick(evolvedSkills):undefined;
    const preferred=match?(evolved??this.rng.pick(this.skills)):undefined;
    const item = createItem(this.rng, this.nextId++, itemLevel, rarity, preferred?.id, weapon ? 'weapon' : undefined,undefined,preferred?.branch??undefined);
    if(themeRelic){item.name=THEME_RELICS[this.dungeon.theme][(this.seed+this.floor)%2];item.originTheme=this.dungeon.theme;item.description=`${this.theme.name}专属遗物 · ${item.description}`;}
    this.loot.push({ id: this.nextId++, x: pos.x, y: pos.y,spawnX:pos.x,spawnY:pos.y, item, xp: 0, gold: 0, age: 0 });
    if (rarity === 'legendary') { this.legendaryFound++; this.notify(`传奇现世 · ${item.name}`, 'gold'); }
    else if (rarity === 'unique') this.notify(`暗金遗物 · ${item.name}`, 'gold');
    else if (rarity === 'set') this.notify(`套装部件 · ${item.name}`, 'gold');
    if(emitEffect)this.events.push({ type: 'loot', x: pos.x, y: pos.y, color: RARITY_COLORS[rarity] });
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    // Spatial buckets bound local separation work in dense crowds.
    const buckets = new Map<string, Enemy[]>();
    for (const e of this.enemies) { const key = `${Math.floor(e.x / 50)},${Math.floor(e.y / 50)}`; const list = buckets.get(key) ?? []; list.push(e); buckets.set(key, list); }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.moving=false;e.hitFlash=Math.max(0,e.hitFlash-dt);e.skillPose=Math.max(0,(e.skillPose??0)-dt);e.slow=Math.max(0,e.slow-dt);e.attackCooldown-=dt;this.updateSupport(e,dt);
      const d = distance(e, p);
      if (e.tactic && this.updateElite(e, dt)){this.constrainShowcaseEnemy(e);continue;}
      if ((e.basicWindup ?? 0) > 0) {
        e.basicWindup! -= dt;
        if(e.basicWindup!<=0&&e.basicTarget){
          const attack=e.basicAttack,target=e.basicTarget,source=e.name??(e.kind==='boss'?'最终首领':'怪物');
          if(attack==='melee'&&distance(e,p)<e.radius+30){const vulnerable=p.invulnerable<=0;this.hurt(e.damage,`${source}的近身攻击`,e);if(vulnerable&&e.onHit){const potency=e.onHit==='bleed'?e.damage*.12:e.onHit==='poison'||e.onHit==='burn'?e.damage*.18:0;this.applyPlayerStatus(e.onHit,potency,e.onHit==='stun'?.8:3,source);}}
          if(e.basicAttack==='shot'){
            const a=Math.atan2(target.y-e.y,target.x-e.x);
            this.projectiles.push({id:this.nextId++,x:e.x,y:e.y,vx:Math.cos(a)*165,vy:Math.sin(a)*165,ttl:2.5,damage:e.damage,enemy:true,radius:5,color:0xf4a66f,pierce:1,hit:new Set(),status:e.onHit,sourceName:source});
          }
          if(attack==='poison'||attack==='meteor')this.hazards.push({id:this.nextId++,...target,radius:attack==='poison'?46:62,delay:attack==='poison'?.05:.55,ttl:attack==='poison'?2.8:1,damage:e.damage,fired:false,status:e.onHit??(attack==='poison'?'poison':'burn'),sourceName:`${source}:${attack}`});
          if(attack==='beam')this.hazards.push({id:this.nextId++,x:e.x,y:e.y,target:{...target},shape:'line',width:18,radius:0,delay:.18,ttl:.45,damage:e.damage,fired:false,status:e.onHit,sourceName:source});
          if(attack==='nova')this.hazards.push({id:this.nextId++,x:e.x,y:e.y,radius:88,delay:.08,ttl:.35,damage:e.damage,fired:false,status:e.onHit,sourceName:source});
          if(attack==='charge'||attack==='leap')this.hazards.push({id:this.nextId++,...target,radius:attack==='leap'?58:42,delay:.12,ttl:.38,damage:round2(e.damage*1.2),fired:false,status:e.onHit,sourceName:source});
          if(attack==='summon')for(let i=0;i<2;i++){const minion=this.spawnEnemy('skeleton');if(minion)Object.assign(minion,{x:e.x+i*18-9,y:e.y+18});}
          if(attack==='jail')for(let i=0;i<3;i++){const a=i*Math.PI*2/3,to={x:target.x+Math.cos(a)*85,y:target.y+Math.sin(a)*85};this.hazards.push({id:this.nextId++,x:target.x,y:target.y,target:to,shape:'line',width:14,radius:0,delay:.35,ttl:2.2,damage:e.damage,fired:false});}
          e.basicTarget=undefined;e.basicAttack=undefined;
        }
        continue;
      }
      let dx = p.x - e.x, dy = p.y - e.y;
      if(e.role==='ambusher'||e.support==='surround'){const target={x:p.x+Math.cos(e.formationAngle)*82,y:p.y+Math.sin(e.formationAngle)*82};dx=target.x-e.x;dy=target.y-e.y;}
      if (d > 60 && !this.clearLine(e, p)) {
        const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE), index = ty * this.dungeon.size + tx;
        let best = index;
        for (const next of [index - 1, index + 1, index - this.dungeon.size, index + this.dungeon.size]) {
          if (this.flow[next] >= 0 && (this.flow[best] < 0 || this.flow[next] < this.flow[best])) best = next;
        }
        dx = (best % this.dungeon.size + .5) * TILE - e.x; dy = (Math.floor(best / this.dungeon.size) + .5) * TILE - e.y;
      }
      const len = Math.hypot(dx, dy) || 1;
      let vx = dx / len, vy = dy / len;
      if (['shot','poison','beam','meteor','summon','jail'].includes(e.attack??'') && d < 190 && this.clearLine(e, p)) { vx *= d < 125 ? -.4 : 0; vy *= d < 125 ? -.4 : 0; }
      const bx = Math.floor(e.x / 50), by = Math.floor(e.y / 50);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (const other of buckets.get(`${bx + ox},${by + oy}`) ?? []) {
        if (other.id === e.id) continue;
        const sep = distance(e, other), min = e.radius + other.radius;
        if (sep > .1 && sep < min) { vx += (e.x - other.x) / sep * .6; vy += (e.y - other.y) / sep * .6; }
      }
      e.stagger = Math.max(0, e.stagger - dt);
      const speed = (e.stationary?0:e.speed) * (e.slow > 0 ? .42 : 1) * (e.stagger > 0 ? .15 : 1);
      if(Math.abs(vx)+Math.abs(vy)>.05)e.facing={x:vx,y:vy};
      const before={x:e.x,y:e.y};moveOnMap(this.dungeon,e,(vx*speed+e.knockback.x)*dt,(vy*speed+e.knockback.y)*dt,Math.min(e.radius,12));e.moving=distance(before,e)>.05;
      this.constrainShowcaseEnemy(e);
      e.knockback.x *= Math.max(0, 1 - dt * 12); e.knockback.y *= Math.max(0, 1 - dt * 12);
      if(e.attackCooldown<=0){
        const attack=e.attack??'melee',range=attack==='melee'?e.radius+17:['nova'].includes(attack)?105:['charge','leap'].includes(attack)?225:300;
        if(d<range&&(attack==='melee'||this.clearLine(e,p))){
          const windups:Record<string,number>={melee:.28,shot:.42,charge:.62,nova:.55,summon:.75,jail:.7,leap:.5,poison:.48,beam:.7,meteor:.75};
          e.basicWindup=windups[attack];e.basicTarget={...p};e.basicAttack=attack;e.attackCooldown=attack==='melee'?1.3:attack==='shot'?2.3:3.2;
        }
      }
      if (e.rank === 'boss'||e.kind==='boss') this.updateBoss(e, dt);

    }
  }

  private constrainShowcaseEnemy(enemy:Enemy):void{if(enemy.showcaseRoom===undefined)return;const room=this.dungeon.rooms[enemy.showcaseRoom],margin=Math.max(22,enemy.radius);enemy.x=clamp(enemy.x,(room.x+1)*TILE+margin,(room.x+room.w-1)*TILE-margin);enemy.y=clamp(enemy.y,(room.y+1)*TILE+margin,(room.y+room.h-1)*TILE-margin);}

  private updateProjectiles(dt: number): void {
    for (const b of this.projectiles) {
      const previousAge = b.age ?? 0;
      b.age = previousAge + dt;
      if (b.returning && b.age >= .55) {
        if (previousAge < .55) { b.hit.clear(); b.pierce += 5; }
        const d = distance(b, this.player) || 1;
        if (d < 20) { b.ttl = 0; continue; }
        b.vx = (this.player.x - b.x) / d * 440; b.vy = (this.player.y - b.y) / d * 440;
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt;
      if (!walkable(this.dungeon, b.x, b.y, 1)) { b.ttl = 0; continue; }
      if(b.enemy&&distance(b,this.player)<15+b.radius){const vulnerable=this.player.invulnerable<=0;this.hurt(b.damage,b.sourceName??'远程攻击');if(vulnerable&&b.status)this.applyPlayerStatus(b.status,b.damage*.16,b.status==='stun'?.7:3,b.sourceName??'远程攻击');b.ttl=0;}
      else for (const e of this.enemies) if (e.hp > 0 && !b.hit.has(e.id) && distance(b, e) < e.radius + b.radius) {
        this.hit(e, b.damage, b.color,true,b.sourceName??'投射物'); b.hit.add(e.id); b.pierce--;
        if (b.bleed) this.player.hp = Math.min(this.stats.maxHp, this.player.hp + .6);
        if (b.pierce <= 0) { b.ttl = 0; break; }
      }
    }
    this.projectiles = this.projectiles.filter(b => b.ttl > 0);
  }
  private updateZones(dt: number): void {
    for (const z of this.zones) {
      z.ttl -= dt; z.tick -= dt;
      if (z.tick <= 0) { z.tick = .6; let contacts=0;for (const e of this.targets(z, z.radius)) { this.hit(e, z.damage, z.color, false,z.sourceName??'持续区域');contacts++; if (z.color === 0x9adaed) e.slow = 1; }if(z.color===0xb94f56&&contacts)this.player.hp=round2(Math.min(this.stats.maxHp,this.player.hp+Math.min(2,contacts*.35))); }
    }
    this.zones = this.zones.filter(z => z.ttl > 0);
  }
  private updateHazards(dt: number): void {
    for (const h of this.hazards) {
      h.delay -= dt; h.ttl -= dt;
      if (h.delay > 0) continue;
      const first = !h.fired; h.fired = true;
      let contact = false;
      if (h.shape === 'ring') {
        h.innerRadius = Math.max(0, h.radius - 22); h.radius += dt * 150;
        const d = distance(h, this.player); contact = d < h.radius + 10 && d > h.innerRadius - 10;
      } else if (h.shape === 'line' && h.target) {
        const dx = h.target.x - h.x, dy = h.target.y - h.y;
        const t = clamp(((this.player.x - h.x) * dx + (this.player.y - h.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        contact = distance(this.player, { x: h.x + dx * t, y: h.y + dy * t }) < (h.width ?? 18);
      } else contact = first && distance(h, this.player) < h.radius;
      if(contact&&h.damage>0&&!h.hitPlayer&&this.player.invulnerable<=0){this.hurt(h.damage,h.sourceName??(h.shape==='ring'?'敲钟人的钟波':'诅咒领域'));if(h.status)this.applyPlayerStatus(h.status,h.damage*.14,h.status==='stun'?.65:3,h.sourceName??'环境');h.hitPlayer=true;}
    }
    this.hazards = this.hazards.filter(h => h.ttl > 0);
  }

  /** Telegraphs lock positions before damage; dodging never follows the player retroactively. */
  private updateElite(e: Enemy, dt: number): boolean {
    e.abilityCooldown = (e.abilityCooldown ?? 2) - dt;
    if ((e.chargeTime ?? 0) > 0 && e.lockedTarget) {
      e.chargeTime! -= dt;
      const d = distance(e, e.lockedTarget) || 1;
      moveOnMap(this.dungeon, e, (e.lockedTarget.x - e.x) / d * 380 * dt, (e.lockedTarget.y - e.y) / d * 380 * dt, 12);
      if (distance(e, this.player) < 40) this.hurt(30, '精英骑士的冲锋');
      if (d < 15) e.chargeTime = 0;
      return true;
    }
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0 && e.tactic === 'charge') e.chargeTime = .75;
      if(e.windup<=0&&e.tactic==='summoner')for(let i=0;i<3;i++){
        const minion=this.spawnEnemy('skeleton'), a=i*Math.PI*2/3;
        const pos={x:e.x+Math.cos(a)*45,y:e.y+Math.sin(a)*45};
        if(minion)Object.assign(minion,walkable(this.dungeon,pos.x,pos.y,12)?pos:{x:e.x,y:e.y});
      }
      return true;
    }
    if (e.abilityCooldown! > 0 || distance(e, this.player) > 330) return false;
    e.abilityCooldown = e.tactic === 'summoner' ? 7 : 6;
    e.lockedTarget = { x: this.player.x, y: this.player.y };
    if (e.tactic === 'charge') {
      e.windup = 1.05;
      this.hazards.push({ id: this.nextId++, x: e.x, y: e.y, target: { ...e.lockedTarget }, shape: 'line', width: 22, radius: 0, delay: 1.05, ttl: 1.07, damage: 0, fired: false });
    } else if (e.tactic === 'summoner') {
      e.windup = .8;
      this.events.push({ type: 'summon', x: e.x, y: e.y, radius: 80, color: 0xa9bd88 });
    } else {
      e.windup = .8;
      // Three damaging walls leave an open side: movement choice, never an unavoidable trap.
      const p = e.lockedTarget, corners = [{x:p.x-90,y:p.y-90},{x:p.x+90,y:p.y-90},{x:p.x+90,y:p.y+90},{x:p.x-90,y:p.y+90}];
      for (let i = 0; i < 3; i++) this.hazards.push({ id: this.nextId++, ...corners[i], target: corners[i+1], shape: 'line', width: 15, radius: 0, delay: 1.25, ttl: 4.5, damage: 22, fired: false });
    }
    return true;
  }

  private updateBoss(e: Enemy, dt: number): void {
    if(e.hp<=e.maxHp*.33&&this.bossPhase<3){this.bossPhase=3;this.bossCast=null;this.bossTimer=1.2;this.notify(`${e.name??'首领'}进入第三阶段 · 末日丧钟`,'red');this.events.push({type:'burst',x:e.x,y:e.y,radius:260,color:0xe54436,label:'第三阶段'});for(const radius of [95,185])this.hazards.push({id:this.nextId++,x:e.x,y:e.y,radius,innerRadius:Math.max(0,radius-44),shape:'ring',delay:1.35,ttl:2,damage:round2(e.damage*.72),fired:false,status:'curse',sourceName:'末日丧钟'});}
    else if (e.hp <= e.maxHp * .66 && this.bossPhase === 1) {
      this.bossPhase = 2; this.bossCast=null;this.bossTimer = 1.5;
      this.notify(`${e.name??'首领'}进入第二阶段 · 碎彩窗`, 'red');
      for(let i=0;i<2;i++)this.spawnEnemy('knight');
      this.events.push({ type: 'burst', x: e.x, y: e.y, radius: 180, color: 0xec9a54,label:'第二阶段' });
      const c={...this.player};this.hazards.push({id:this.nextId++,x:c.x-230,y:c.y,target:{x:c.x+230,y:c.y},shape:'line',width:24,radius:0,delay:1.25,ttl:1.55,damage:round2(e.damage*.65),fired:false,status:'burn',sourceName:'碎彩窗'});this.hazards.push({id:this.nextId++,x:c.x,y:c.y-230,target:{x:c.x,y:c.y+230},shape:'line',width:24,radius:0,delay:1.25,ttl:1.55,damage:round2(e.damage*.65),fired:false,status:'burn',sourceName:'碎彩窗'});
    }
    if(this.bossCast?.enemyId===e.id){this.bossCast.remaining=round2(this.bossCast.remaining-dt);if(this.bossCast.remaining<=0){const cast=this.bossCast;this.bossCast=null;this.releaseBossAbility(e,cast.ability!,cast.damage);this.bossTimer=this.bossPhase===3?2.15:this.bossPhase===2?3:4.5;}return;}
    this.bossTimer -= dt;
    if (this.bossTimer > 0) return;
    const abilities=e.abilities?.length?e.abilities:[e.attack??'nova'],ability=abilities[this.bossAttack++%abilities.length],damage=round2(e.damage*(this.bossPhase===3?1.26:this.bossPhase===2?1.12:1));
    const names:Record<string,string>={nova:'圣骸震波',meteor:'碎彩陨火',summon:'亡者弥撒',jail:'荆棘囚笼',beam:'审判圣光',poison:'腐化圣油',leap:'钟楼坠击',charge:'殉道冲锋',shot:'裂魂箭雨',melee:'断罪'};
    const duration=this.bossPhase===3?.72:this.bossPhase===2?.95:1.18;this.bossCast={enemyId:e.id,ability,name:names[ability]??'灾厄仪式',remaining:duration,duration,damage};e.skillPose=duration;
    // A harmless anticipation marker makes the cast readable and gives tests,
    // accessibility cues and the renderer one shared representation.
    this.hazards.push({id:this.nextId++,x:e.x,y:e.y,radius:72,delay:duration,ttl:duration+.03,damage:0,fired:false,sourceName:this.bossCast.name});
    this.notify(`${e.name??'首领'}正在施放 ${this.bossCast.name} · 重击或暴击可打断`,'red');
  }

  private releaseBossAbility(e:Enemy,ability:Enemy['attack'],damage:number):void{
    if(ability==='nova'){this.hazards.push({id:this.nextId++,x:e.x,y:e.y,radius:35,innerRadius:0,shape:'ring',delay:1.1,ttl:4.6,damage,fired:false,status:e.onHit,sourceName:e.name});this.notify(`${e.name}释放扩散冲击 · 穿越波纹`,'red');}
    else if(ability==='meteor'){for(let i=0;i<(this.bossPhase===3?7:this.bossPhase===2?5:3);i++){const a=i*Math.PI*.66;this.hazards.push({id:this.nextId++,x:this.player.x+(i?Math.cos(a)*105:0),y:this.player.y+(i?Math.sin(a)*105:0),radius:i?58:76,delay:1.3,ttl:1.75,damage,fired:false,status:'burn',sourceName:`${e.name}:meteor`});}this.notify(`${e.name}锁定陨火 · 离开灼烧区域`,'red');}
    else if(ability==='summon'){this.spawnThemePack(this.bossPhase===3?6:this.bossPhase===2?4:3,'normal');this.events.push({type:'summon',...e,radius:110,color:e.tint??0xb89568});this.notify(`${e.name}召集仆从`,'red');}
    else if(ability==='jail'){const p=this.player,corners=[{x:p.x-95,y:p.y-95},{x:p.x+95,y:p.y-95},{x:p.x+95,y:p.y+95},{x:p.x-95,y:p.y+95}];for(let i=0;i<3;i++)this.hazards.push({id:this.nextId++,...corners[i],target:corners[i+1],shape:'line',width:18,radius:0,delay:1.15,ttl:4,damage,fired:false,status:e.onHit,sourceName:e.name});this.notify(`${e.name}编织三面囚笼 · 从缺口突围`,'red');}
    else if(ability==='beam'){this.hazards.push({id:this.nextId++,x:e.x,y:e.y,target:{...this.player},shape:'line',width:25,radius:0,delay:.9,ttl:1.4,damage,fired:false,status:e.onHit??'curse',sourceName:e.name});this.notify(`${e.name}蓄积毁灭射线`,'red');}
    else if(ability==='poison'){for(let i=0;i<3;i++){const a=i*Math.PI*2/3;this.hazards.push({id:this.nextId++,x:this.player.x+Math.cos(a)*75,y:this.player.y+Math.sin(a)*75,radius:65,delay:.7,ttl:3,damage:round2(damage*.7),fired:false,status:'poison',sourceName:e.name});}this.notify(`${e.name}喷吐腐化毒池`,'red');}
    else {this.hazards.push({id:this.nextId++,...this.player,radius:ability==='leap'?80:55,delay:.85,ttl:1.2,damage:round2(damage*1.2),fired:false,status:e.onHit,sourceName:e.name});if(!e.stationary){e.lockedTarget={...this.player};e.chargeTime=.65;}this.notify(`${e.name}${ability==='leap'?'跃向目标':'发动冲锋'}`,'red');}
  }

  private sealedHiddenTile(x:number,y:number):boolean{
    return this.dungeon.hiddenRooms.some(index=>{const room=this.dungeon.rooms[index],wall=this.dungeon.breakableWalls.find(value=>value.revealedRoom===index);return !!wall&&!wall.destroyed&&x>=room.x&&x<room.x+room.w&&y>=room.y&&y<room.y+room.h;});
  }
  isExplored(pos: Vec): boolean {const x=Math.floor(pos.x/TILE),y=Math.floor(pos.y/TILE);return !this.sealedHiddenTile(x,y)&&!!this.explored[y*this.dungeon.size+x]; }
  private reveal(): void {
    const map = this.dungeon, tx = Math.floor(this.player.x / TILE), ty = Math.floor(this.player.y / TILE);
    for (let y = Math.max(0, ty - 6); y <= Math.min(map.size - 1, ty + 6); y++) for (let x = Math.max(0, tx - 6); x <= Math.min(map.size - 1, tx + 6); x++)
      if ((x - tx) ** 2 + (y - ty) ** 2 <= 36&&!this.sealedHiddenTile(x,y)) this.explored[y * map.size + x] = 1;
    const room = map.rooms.findIndex(r => tx >= r.x && tx < r.x+r.w && ty >= r.y && ty < r.y+r.h);
    // Crossing a doorway reveals the entire room at once, including its edge
    // tiles. Sealed hidden rooms still remain completely absent from the map.
    if(room>=0){const current=map.rooms[room];for(let y=current.y;y<current.y+current.h;y++)for(let x=current.x;x<current.x+current.w;x++)if(!this.sealedHiddenTile(x,y))this.explored[y*map.size+x]=1;}
    if (room >= 0 && !this.discoveredRooms.has(room)) {
      this.discoveredRooms.add(room);
      const specimen=map.showcaseRooms?.find(value=>value.room===room),identity=specimen?{name:`${specimen.label}陈列室`}:map.hiddenRooms.includes(room)?{name:THEME_DESIGNS[map.theme].secretName}:roomIdentity(map.theme,map.rooms[room].type,room);
      this.notify(`发现 · ${identity.name}`, 'gold');
      const roomEncounter=this.roomEncounters.find(value=>value.room===room);
      if(!this.showcaseMode&&room!==0&&room!==map.bossRoom&&!roomEncounter){
        this.spawnThemeFormation(Math.min(5,2+Math.ceil(this.floor/2)),room);
        if(map.hiddenRooms.includes(room)){const elite=this.spawnThemePack(1,this.floor>=4?'superElite':'elite')[0];if(elite){Object.assign(elite,{x:(map.rooms[room].x+map.rooms[room].w/2)*TILE,y:(map.rooms[room].y+map.rooms[room].h/2)*TILE});this.notify(`隐藏精英 · ${elite.name}守卫${THEME_DESIGNS[map.theme].secretName}`,'red');}}
      }
      if(roomEncounter)this.activateRoomEncounter(roomEncounter);
      if(room===map.bossRoom&&!this.guardianSpawned&&this.bossUnlocked)this.spawnFloorGuardian();
    }
    this.explorationRevision++;
  }

  private spawnFloorGuardian():void{
    this.guardianSpawned=true;this.bossSpawned=this.floor===CAMPAIGN_FLOORS;
    const final=this.floor===CAMPAIGN_FLOORS,profile=final?FINAL_BOSSES[this.seed%FINAL_BOSSES.length]:THEME_BOSSES[this.dungeon.theme][(this.seed+this.floor)%5];
    if(!final&&this.enemies.length>=MAX_ENEMIES){const i=this.enemies.findIndex(v=>!v.elite);if(i>=0)this.enemies.splice(i,1);}
    const e=this.spawnEnemyProfile(profile,undefined,true);if(!e){this.guardianSpawned=false;return;}
    if(final)this.finalBossName=profile.name;
    Object.assign(e,this.dungeon.exit);
    e.tactic=profile.stationary?undefined:profile.attack==='charge'?'charge':profile.attack==='summon'?'summoner':profile.attack==='jail'?'jailer':undefined;
    this.floorGuardianId=e.id;
    this.notify(final?`最终首领 · ${profile.name}苏醒`:`地图首领 · ${profile.name}现身`,'red');
  }

  /** Keep build and resources, discard all entities tied to the previous map. */
  advanceFloor():boolean{
    if(!this.exitUnlocked||this.floor>=CAMPAIGN_FLOORS)return false;
    this.floor++;this.mapTime=0;this.dungeon=generateDungeon(this.seed+this.floor*1009,roomsForFloor(this.floor),this.campaign[this.floor-1],this.floor);this.mapAffixes=this.rollMapAffixes(this.floor);
    Object.assign(this.player,this.dungeon.start,{invulnerable:1.5,dashTime:0,attackPose:0,skillPose:0,statuses:{}});
    this.player.hp=Math.min(this.stats.maxHp,this.player.hp+this.stats.maxHp*.25);this.player.mana=Math.min(this.stats.maxMana,this.player.mana+30);this.player.potionCharges=Math.min(3,this.player.potionCharges+1);
    if(this.dungeon.theme==='town'){this.player.hp=this.stats.maxHp;this.player.mana=this.stats.maxMana;this.player.potionCharges=3;this.notify('疫病城镇 · 在幸存者营火旁完成休整','gold');}
    this.enemies=[];this.projectiles=[];this.loot=[];this.hazards=[];this.zones=[];this.minions=[];this.corpses=[];this.events=[];this.pendingCasts=[];
    this.explored=new Uint8Array(this.dungeon.tiles.length);this.discoveredRooms.clear();this.chestsOpened.clear();this.roomEncounters=this.createRoomEncounters();this.roomRewardOptions=[];
    const encounterRng=new Random(this.seed+this.floor*1009+307),rooms=encounterRng.shuffle(this.dungeon.rooms.map((_,i)=>i).filter(i=>i!==0&&i!==this.dungeon.bossRoom)).slice(0,3);
    this.encounters=(['cursed','sacrifice','hunt'] as const).map((kind,id)=>{const room=this.dungeon.rooms[rooms[id]];return{id,room:rooms[id],kind,x:(room.x+room.w/2)*TILE,y:(room.y+room.h/2+2)*TILE,state:'available',remaining:0,progress:0,spawnTimer:0,waves:0}});
    this.selectedEncounter=null;this.exitUnlocked=false;this.guardianSpawned=false;this.floorGuardianId=null;this.bossSpawned=false;this.bossDefeated=false;this.bossPhase=1;this.bossCast=null;this.interruptedPhases.clear();this.bossAttack=0;this.bossTimer=3;this.killsSinceRare=0;
    this.flowTile=-1;this.flow=buildFlow(this.dungeon,this.player);this.spawnTimer=1.5;this.eliteTimer=55;this.themeTimer=12;this.setupFloorNpcs();this.explorationRevision++;this.worldRevision++;this.reveal();
    this.notify(`进入第 ${this.floor} 层 · ${this.theme.name} · ${this.dungeon.rooms.length} 个房间`,'gold');return true;
  }

  private openRouteChoice():void{
    const used=new Set(this.campaign.slice(0,this.floor));
    const candidates=this.rng.shuffle(THEME_IDS.filter(id=>!used.has(id)&&id!==this.campaign[this.floor]));
    this.routeChoices=[this.campaign[this.floor],...candidates].slice(0,2);
    this.phase='route';
  }
  chooseRoute(theme:typeof THEME_IDS[number]):void{
    if(this.phase!=='route'||!this.routeChoices.includes(theme))return;
    this.campaign[this.floor]=theme;this.phase='playing';this.routeChoices=[];this.advanceFloor();
  }

  get encounter(): Encounter | undefined { return this.encounters.find(e => e.id === this.selectedEncounter); }
  get activeEncounter(): Encounter | undefined { return this.encounters.find(e => e.state === 'active'); }
  acceptEncounter(): void {
    const e = this.encounter;
    if (this.phase !== 'event' || !e || e.state !== 'available' || this.activeEncounter) return;
    if (e.kind === 'sacrifice') {
      const cost = Math.ceil(this.stats.maxHp * .3);
      if (this.player.hp <= cost) { this.notify('生命不足，无法完成献祭', 'red'); return; }
      this.player.hp -= cost; e.state = 'won'; this.dropItem(e, this.greed>=10?'legendary':'rare', true);
    } else {
      e.state = 'active'; e.remaining = e.kind === 'cursed' ? 25 : 40;e.spawnTimer=.25;e.waves=0;
      this.spawnContractWave(e,true);
      this.notify(e.kind === 'cursed' ? '诅咒开启 · 在此地存活 25 秒，离开将失败' : '猎杀开始 · 40 秒内击败附近 18 个敌人', 'red');
    }
    this.phase = 'playing'; this.selectedEncounter = null;
  }
  private updateEncounters(dt: number): void {
    const e = this.activeEncounter; if (!e) return;
    e.remaining -= dt;
    if (distance(e, this.player) > 320) { e.state = 'failed'; this.notify('契约失败 · 你离开了事件区域', 'red'); return; }
    e.spawnTimer-=dt;if(e.spawnTimer<=0){this.spawnContractWave(e);e.spawnTimer=(e.kind==='hunt'?2.35:3.1)-Math.min(.65,this.greed*.035);}
    if (e.kind === 'hunt' && e.progress >= 18 || e.kind === 'cursed' && e.remaining <= 0) {
      e.state = 'won'; this.gold += 60; this.dropItem(e, this.greed>=10?'legendary':'rare', true); this.notify(`契约完成 · ${this.greed>=10?'高阶装备':'稀有装备'}与 60 金币`, 'gold');
    } else if (e.remaining <= 0) { e.state = 'failed'; this.notify('猎杀契约超时', 'red'); }
  }
  private spawnContractWave(encounter:Encounter,initial=false):void{
    const live=this.enemies.filter(enemy=>enemy.hp>0&&enemy.encounterEvent===encounter.id).length,cap=18+Math.floor(this.greed*.8)+this.floor;
    if(live>=cap)return;
    const count=Math.min(cap-live,initial?6:(encounter.kind==='hunt'?4:3)+Math.floor(this.floor/3)),spawned=this.spawnThemeFormation(count,encounter.room),wave=encounter.waves++;
    spawned.forEach((enemy,index)=>{enemy.encounterEvent=encounter.id;const angle=(index/Math.max(1,spawned.length))*Math.PI*2+wave*1.37,radius=145+(index%3)*42,candidate={x:encounter.x+Math.cos(angle)*radius,y:encounter.y+Math.sin(angle)*radius};if(walkable(this.dungeon,candidate.x,candidate.y,enemy.radius))Object.assign(enemy,candidate);});
    if(!initial&&encounter.kind==='hunt'&&wave%3===2&&live<cap-1){const elite=this.spawnThemePack(1,this.floor>=6?'superElite':'elite')[0];if(elite){elite.encounterEvent=encounter.id;const angle=wave*.91,candidate={x:encounter.x+Math.cos(angle)*220,y:encounter.y+Math.sin(angle)*220};if(walkable(this.dungeon,candidate.x,candidate.y,elite.radius))Object.assign(elite,candidate);}}
    this.events.push({type:'summon',x:encounter.x,y:encounter.y,color:encounter.kind==='hunt'?0xb85d69:0x9a67c8,radius:180,label:'contract-wave'});
  }
  private collectLoot(dt: number): void {
    for (const l of this.loot) {
      l.age += dt;
      const d = distance(l, this.player);
      const accepted=!l.item||this.lootFilter==='all'||QUALITY_ORDER.indexOf(l.item.rarity)>=QUALITY_ORDER.indexOf(this.lootFilter==='rare'?'rare':'epic');
      if(!accepted)continue;
      const magnet = (l.item ? 65 : 135)*this.pickupRadius;
      if (d < magnet && this.clearLine(l, this.player)) {
        if (d < 22) {
          this.xp += l.xp; this.gold += l.gold;
          if (l.item) this.receiveItem(l.item);
          l.age = -1000;
        } else { l.x += (this.player.x - l.x) / d * 320 * dt; l.y += (this.player.y - l.y) / d * 320 * dt; }
      }
    }
    this.loot = this.loot.filter(l => l.age >= 0);
    // Merge old distant XP into newer orbs to prevent unlimited entity growth.
    if (this.loot.length > 240) {
      const old = this.loot.find(l => !l.item), next = this.loot.find(l => !l.item && l !== old);
      if (old && next) { next.xp += old.xp; next.gold += old.gold; this.loot.splice(this.loot.indexOf(old), 1); }
    }
  }
  setLootFilter(filter:'all'|'rare'|'epic'):void{this.lootFilter=filter;this.notify(`快捷拾取 · ${{all:'全部装备',rare:'稀有及以上',epic:'史诗及以上'}[filter]}`,'gold');}
  get nearestGroundItem():GroundLoot|undefined{return this.loot.filter(value=>value.item&&this.isLootAccepted(value.item)).sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];}
  private isLootAccepted(item:Item):boolean{return this.lootFilter==='all'||QUALITY_ORDER.indexOf(item.rarity)>=QUALITY_ORDER.indexOf(this.lootFilter==='rare'?'rare':'epic');}
  pickupNearestItem():boolean{
    if(this.phase!=='playing')return false;const loot=this.nearestGroundItem;if(!loot||distance(loot,this.player)>190||!this.clearLine(loot,this.player))return false;
    this.receiveItem(loot.item!);loot.age=-1000;this.loot=this.loot.filter(value=>value.age>=0);return true;
  }
  receiveItem(item: Item): void {
    if (this.inventory.length >= MAX_INVENTORY) {
      const weakest = this.inventory.filter(i => !protectedItem(i)).sort((a,b) => QUALITY_ORDER.indexOf(a.rarity) - QUALITY_ORDER.indexOf(b.rarity) || a.power - b.power)[0];
      const disposable = weakest ? this.inventory.indexOf(weakest) : -1;
      if (disposable >= 0) this.salvage(this.inventory[disposable].id);
      else { this.gold += itemValue(item); this.notify('背包已满，新增装备自动分解为灰烬金币', 'gold'); return; }
    }
    this.inventory.push(item);
    this.notify(`拾取 ${item.name} · 按 I 装备`, ['set','unique','legendary'].includes(item.rarity) ? 'gold' : 'blue');
  }
  equip(id: number): void {
    const index = this.inventory.findIndex(i => i.id === id); if (index < 0) return;
    const item = this.inventory.splice(index, 1)[0], previous = this.equipped[item.slot];
    this.equipped[item.slot] = item;
    if (previous) this.inventory.push(previous);
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
    this.notify(`已装备 · ${item.name}`, 'gold');
  }
  salvage(id: number): void {
    const i = this.inventory.findIndex(item => item.id === id); if (i < 0) return;
    this.gold += itemValue(this.inventory[i]); this.inventory.splice(i, 1);
  }

  hurt(amount: number, source: string,attacker?:Enemy): void {
    const p = this.player;
    if (p.invulnerable > 0 || this.ended) return;
    const cursed=p.statuses.curse?.duration?1+(p.statuses.curse.potency||.18):1,defense=1-Math.min(.45,talentBonus(this.session,this.characterId,'armor')),final=round2(amount*cursed*defense),absorbed=Math.min(p.shield,final);p.shield=round2(p.shield-absorbed);p.hp=round2(p.hp-(final-absorbed));
    p.invulnerable = .45; this.lastHit = source;
    this.telemetry.damageTaken=round2(this.telemetry.damageTaken+Math.max(0,final-absorbed));
    if(this.characterId==='bloodknight'&&final>absorbed)this.gainClassPower(Math.min(12,4+(final-absorbed)*.08));
    this.events.push({type:'playerHit',...p,amount:round2(final-absorbed),label:absorbed>=final?'格挡':undefined,color:0xee7072,blocked:absorbed>=final,impact:Math.min(1,.25+final/100)});if(attacker&&this.has('thorns'))this.hit(attacker,round2(final*.18),0xd3b17d,false);
    if(p.hp<=0&&this.showcaseMode){Object.assign(p,this.dungeon.start,{hp:this.stats.maxHp,mana:this.stats.maxMana,shield:0,invulnerable:3,statuses:{}});this.enemies=[];this.projectiles=[];this.hazards=[];this.zones=[];this.notify('陈列回廊重塑了你的躯体','gold');return;}
    if (p.hp <= 0) { p.hp = 0; this.finish('dead'); }
  }
  drinkPotion(): void {
    const p = this.player;
    if (p.potionCharges <= 0 || p.potionCooldown > 0 || p.hp >= this.stats.maxHp) return;
    const before=p.hp;p.potionCharges--; p.potionCooldown = 3; p.hp = Math.min(this.stats.maxHp, p.hp + this.stats.maxHp * (.5+talentBonus(this.session,this.characterId,'potionPower')));
    const restored=round2(p.hp-before);this.events.push({ type: 'heal', ...p,amount:restored,label:`+${fixed2(restored)}`, color: 0xc45f63 }); this.notify('饮下血瓶 · 恢复 50% 生命');
  }
  burst(aim?:Vec): void {
    const p = this.player;
    if (p.burstCooldown > 0) return;
    if (p.mana < this.burstCost) { this.notify(`法力不足 · ${this.character.burst.name}需要 ${this.burstCost} 法力`, 'blue'); return; }
    p.mana -= this.burstCost; p.burstCooldown = 8;
    p.attackPose = .48;p.skillPose=.65;
    const range=this.characterId==='bloodknight'?230:330,fallback=this.targets(p,range)[0],center=this.aimedPoint(aim??this.lastAim??fallback,range),d=Math.max(1,distance(p,center));p.attackFacing={x:(center.x-p.x)/d,y:(center.y-p.y)/d};
    const damage = (110 + this.level * 12) * this.stats.damage;
    this.events.push({ type: 'burst', ...center, radius: this.characterId === 'bloodknight' ? 200 : 290, color: this.character.color });
    if (this.characterId === 'sorceress') {
      for (const e of this.targets(center, 290)) { this.hit(e, damage, this.character.color); e.slow = 1.5; this.events.push({ type: 'lightning', x: e.x - 20, y: e.y - 160, target: { x: e.x, y: e.y }, color: 0xb4def7 }); }
      this.projectiles = this.projectiles.filter(b => !b.enemy || distance(b, center) > 290);
    } else if (this.characterId === 'necromancer') {
      this.raiseMinions(6, damage * .2, 10,center);
      for (const e of this.targets(center, 180)) this.hit(e, damage * .65, this.character.color);
      const remains = this.corpses.filter(c => distance(c, center) < 300).slice(0, 6);
      for (const corpse of remains) this.explodeCorpse(corpse, damage * .6, 100);
      this.corpses = this.corpses.filter(c => !remains.includes(c));
    } else {
      const targets = this.targets(center, 200);
      for (const e of targets) { this.hit(e, damage * (e.hp / e.maxHp < .5 ? 2 : 1), this.character.color); this.pushEnemy(e, center, 220); }
      p.hp = Math.min(this.stats.maxHp, p.hp + Math.min(60, targets.length * 5));
    }
  }

  get interaction(): { label: string; kind: 'altar' | 'chest' | 'event' | 'exit' | 'wall' | 'mechanism'|'merchant'|'blacksmith'|'beggar'|'traveler'|'showcasePortal'|'showcaseExit'; index: number } | null {
    if(this.showcaseMode&&distance(this.player,this.showcasePortalPosition)<100)return{label:'离开怪物陈列回廊',kind:'showcaseExit',index:-1};
    if(!this.showcaseMode&&this.showcaseUnlocked&&this.floor===1&&distance(this.player,this.showcasePortalPosition)<100)return{label:'进入怪物陈列回廊',kind:'showcasePortal',index:-1};
    if(this.exitUnlocked&&this.floor<CAMPAIGN_FLOORS&&distance(this.player,this.dungeon.exit)<90)return{label:`进入下一地图 · ${THEMES[this.campaign[this.floor]].name}`,kind:'exit',index:-1};
    const encounter = this.encounters.find(e => e.state === 'available' && distance(e, this.player) < 80);
    if (encounter && !this.activeEncounter&&!this.activeRoomEncounter) return { label: { cursed: '诅咒宝箱', sacrifice: '血誓祭坛', hunt: '限时猎杀' }[encounter.kind], kind: 'event', index: encounter.id };
    if (distance(this.player, this.dungeon.altar) < 40) return { label: '贪欲祭坛', kind: 'altar', index: -1 };
    for(const npc of this.activeNpcs){if(distance(this.player,this.npcPosition(npc))<78)return{label:{merchant:'与商人交易',blacksmith:'委托铁匠锻造',beggar:'听听乞丐的请求','distant-traveler':'与远方旅客交谈'}[npc],kind:npc==='distant-traveler'?'traveler':npc,index:-1};}
    if (distance(this.player, this.dungeon.altar) < 85) return { label: '贪欲祭坛', kind: 'altar', index: -1 };
    const wall=this.dungeon.breakableWalls.findIndex(w=>!w.destroyed&&distance(w,this.player)<95);
    if(wall>=0)return{label:'击碎裂纹墙壁 · 发现隐藏房间',kind:'wall',index:wall};
    const mechanism=this.dungeon.mechanisms.findIndex(m=>!m.used&&['healingShrine','urn','ancientLever'].includes(m.kind)&&distance(m,this.player)<75);
    if(mechanism>=0){const kind=this.dungeon.mechanisms[mechanism].kind;return{label:kind==='healingShrine'?'触碰复苏神龛':kind==='urn'?'打碎封印陶罐':'拉动远古机关',kind:'mechanism',index:mechanism};}
    if(this.activeRoomEncounter)return null;
    const i = this.dungeon.chests.findIndex((c, index) => !this.chestsOpened.has(index) && distance(c, this.player) < 75);
    return i < 0 ? null : { label: this.dungeon.chests[i].reward==='gold'?'开启金币宝箱':'开启遗物宝箱', kind: 'chest', index: i };
  }
  interact(): void {
    const action = this.interaction; if (!action) return;
    if(action.kind==='showcasePortal'){this.enterShowcase();return;}
    if(action.kind==='showcaseExit'){this.leaveShowcase();return;}
    if(action.kind==='exit'){if([2,4,6].includes(this.floor))this.openRouteChoice();else this.advanceFloor();return;}
    if(['merchant','blacksmith','beggar','traveler'].includes(action.kind)){this.phase=action.kind as Phase;return;}
    if(action.kind==='wall'){
      const wall=this.dungeon.breakableWalls[action.index];wall.destroyed=true;for(const tile of wall.tiles)this.dungeon.tiles[tile]=1;
      this.flowTile=-1;this.flow=buildFlow(this.dungeon,this.player);this.explorationRevision++;this.worldRevision++;
      this.notify('暗墙崩裂 · 隐藏房间已经开启','gold');return;
    }
    if(action.kind==='mechanism'){
      const m=this.dungeon.mechanisms[action.index];m.used=true;
      if(m.kind==='healingShrine'){this.player.hp=Math.min(this.stats.maxHp,this.player.hp+this.stats.maxHp*.4);this.player.potionCharges=Math.min(3,this.player.potionCharges+1);this.events.push({type:'heal',...m,color:0x9ed6a8});}
      else if(m.kind==='urn'){this.gold+=20+this.floor*8;this.dropItem(m,rollRarity(this.rng,false,this.greed,this.floor));}
      else {for(const enemy of this.targets(m,260)){enemy.slow=4;this.hit(enemy,30+this.floor*8,0xd8bc75,false)}this.gold+=10;}
      this.notify(m.kind==='healingShrine'?'神龛恢复了生命':m.kind==='urn'?'陶罐中藏有战利品':'远古机关压制了附近敌人','gold');return;
    }
    if (action.kind === 'event') { this.selectedEncounter = action.index; this.phase = 'event'; }
    else if (action.kind === 'altar') this.phase = 'altar';
    else {
      this.chestsOpened.add(action.index);
      const chest=this.dungeon.chests[action.index];
      if(chest.reward==='gold'){
        this.gold+=chest.gold;this.notify(`金币宝箱已开启 · 获得 ${fixed2(chest.gold)} 金币`,'gold');
      }else{
        const rarity=action.index===0?'epic':rollRarity(this.rng,true,this.greed,this.floor);
        this.dropItem(chest,rarity,true,action.index===0,false,false);this.player.potionCharges=Math.min(3,this.player.potionCharges+1);
        this.notify('遗物宝箱已开启 · 获得装备并补充一瓶药剂','gold');
      }
    }
  }
  changeGreed(amount: number): void {
    if (this.phase !== 'altar') return;
    this.greed = clamp(this.greed + amount, 0, MAX_GREED);
    this.notify(`贪欲 ${this.greed} 阶 · 怪潮与奖励已改变`, 'gold');
  }
  openInventory(): void { if (this.phase === 'playing' || this.phase === 'paused') this.phase = 'inventory'; else if (this.phase === 'inventory') this.phase = 'playing'; }
  pause(): void { if (this.phase === 'playing') this.phase = 'paused'; else if (['paused','inventory','altar','event','merchant','blacksmith','beggar','traveler'].includes(this.phase)) { this.phase = 'playing'; this.selectedEncounter = null; } }

  prepareUpgrade(): void {
    const newSkill = this.skills.length < (this.level >= 6 ? 4 : this.level >= 3 ? 3 : 2);
    const options: Upgrade[] = [];
    if (newSkill) {
      for (const id of this.character.skills.filter(id => !this.skills.some(s => s.id === id))) options.push({ key: `new-${id}`, title: SKILLS[id].name, description: SKILLS[id].description, skill: id, kind: 'new' });
      this.upgrades = options; // All available skills are shown: genuine player choice.
    } else {
      for (const skill of this.skills.filter(s => s.level < 6)) {
        if (skill.level === 2 && !skill.branch) {
          const wide=SKILL_EVOLUTIONS[skill.id].wide,focused=SKILL_EVOLUTIONS[skill.id].focused;
          options.push({ key: `wide-${skill.id}`, title: wide.name, description: wide.description, skill: skill.id, kind: 'wide' });
          options.push({ key: `focused-${skill.id}`, title: focused.name, description: focused.description, skill: skill.id, kind: 'focused' });
        } else {const evolution=skill.branch?SKILL_EVOLUTIONS[skill.id][skill.branch]:undefined;options.push({ key: `level-${skill.id}`, title: `${evolution?.name??SKILLS[skill.id].name} · ${skill.level === 5 ? '终极蜕变' : '强化'}`, description: skill.level === 5 ? `${evolution?.apex??'升至 6 级并强化技能规模。'} 基础伤害额外提高 40%。` : `升至 ${skill.level + 1} 级，提高基础伤害与技能效果。`, skill: skill.id, kind: 'level' });}
      }
      this.upgrades = this.rng.shuffle(options).slice(0, 3);
      // Stable fallback includes every omitted equipped skill, so RNG cannot block a build.
      for (const skill of this.skills.filter(s => s.level < 6)) if (!this.upgrades.some(o => o.skill === skill.id)) {
        this.upgrades.push(options.find(o => o.skill === skill.id)!);
      }
      if (!this.upgrades.length) this.upgrades.push({ key: 'heal', title: '灰烬的恩赐', description: '恢复 40% 生命并补充一瓶药剂。', kind: 'heal' });
    }
    this.phase = 'upgrade';
  }
  chooseUpgrade(key: string): void {
    if (this.phase !== 'upgrade') return;
    const choice = this.upgrades.find(o => o.key === key); if (!choice) return;
    if (choice.kind === 'new' && choice.skill && this.skills.length < 4) this.skills.push({ id: choice.skill, level: 1, branch: null });
    else if (choice.skill) {
      const skill = this.skills.find(s => s.id === choice.skill);
      if (skill) { skill.level = Math.min(6, skill.level + 1); if (choice.kind === 'wide' || choice.kind === 'focused') skill.branch = choice.kind; }
    } else { this.player.hp = Math.min(this.stats.maxHp, this.player.hp + this.stats.maxHp * .4); this.player.potionCharges = Math.min(3, this.player.potionCharges + 1); }
    this.phase = 'playing'; this.upgrades = []; this.notify(`契约强化 · ${choice.title}`, 'gold');
  }

  private finish(result: 'won' | 'dead'): void {
    if (this.finalized) return;
    this.finalized = true; this.phase = result;
    if (result === 'won') {
      this.gold += 150;
      for (const l of this.loot) if (l.item) this.receiveItem(l.item);
    }
    this.session.gold += this.gold;
    this.session.carried = structuredClone(this.equipped);
    this.session.stash = structuredClone(this.inventory);
    this.session.bestKills = Math.max(this.session.bestKills, this.kills);
    if (result === 'won') {
      this.session.victories++;
      const available=WING_IDS.filter(id=>!this.session.unlockedWings.includes(id));
      this.session.lastWingReward=available.length?this.rng.pick(available):null;
      if(this.session.lastWingReward){this.session.unlockedWings.push(this.session.lastWingReward);this.session.equippedWing=this.session.lastWingReward;}
    } else this.session.lastWingReward=null;
  }
}

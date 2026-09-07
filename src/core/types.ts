/** Plain serializable domain types. The combat simulation has no Phaser or DOM dependency. */
export interface Vec { x: number; y: number }
export type CharacterId = 'sorceress' | 'necromancer' | 'bloodknight';
export type SkillId = 'lightning' | 'blades' | 'frost' | 'fire' | 'blood' | 'poison' | 'summon' | 'shield' | 'arcane' | 'stormOrb' | 'corpse' | 'bones' | 'cleave' | 'warcry' | 'lance';
export type Slot = 'weapon' | 'offhand' | 'head' | 'chest' | 'feet' | 'amulet' | 'ring1' | 'ring2';
export type Rarity = 'common' | 'magic' | 'rare' | 'epic' | 'set' | 'unique' | 'legendary';
export type WeaponKind = 'sword' | 'axe' | 'mace' | 'dagger' | 'spear' | 'staff' | 'wand' | 'bow';
export type MonsterRank='normal'|'elite'|'superElite'|'boss';
export type MonsterRole='frontline'|'ranged'|'skirmisher'|'tank'|'support'|'ambusher';
export type StatusEffect='poison'|'bleed'|'stun'|'chill'|'curse'|'burn';
export type SupportAbility='heal'|'shield'|'revive'|'teleport'|'surround';
export type ThemeId = 'cave'|'dungeon'|'cathedral'|'abandonedVillage'|'inferno'|'mountain'|'town'|'palace'|'catacomb'|'sewer'|'frozenRuins'|'swamp'|'mine'|'desertTemple'|'abyssFortress';
export type Phase = 'playing' | 'paused' | 'upgrade' | 'inventory' | 'altar' | 'event' | 'roomReward' | 'route' | 'merchant' | 'blacksmith' | 'beggar' | 'traveler' | 'won' | 'dead';
export type EnemyKind = 'skeleton'|'zombie'|'archer'|'knight'|'cultist'|'wraith'|'brute'|'shaman'|'stalker'|'spitter'|'guardian'|'boss';
export type EnemyAttack = 'melee'|'shot'|'charge'|'nova'|'summon'|'jail'|'leap'|'poison'|'beam'|'meteor';
export interface Skill { id: SkillId; level: number; branch: 'wide' | 'focused' | null }
export interface Item {
  id: number; name: string; slot: Slot; rarity: Rarity; power: number;
  damage: number; health: number; haste: number; crit: number;
  level?: number; weaponKind?: WeaponKind; baseGrade?: 'normal' | 'exceptional' | 'elite'; setId?: string;
  originTheme?:ThemeId;
  effect?: 'storm' | 'frost' | 'vampire' | 'corpse' | 'inferno' | 'guard' | 'execute' | 'clarity' | 'bulwark'|'chainNova'|'bloodTrail'|'summonerCrown'|'meteorEcho'|'thorns'|'treasureHunter';
  affixes?:ItemAffix[];
  description: string;
}
export interface ItemAffix { id:string; name:string; tier:number; value:number; group:'prefix'|'suffix'; stat:'damage'|'health'|'haste'|'crit'|'moveSpeed'|'pickup'|'statusResist'|'eliteDamage' }
export interface Player extends Vec {
  hp: number; mana: number; shield: number; invulnerable: number;
  dashCharges: number; dashRecharge: number; dashTime: number; dashDirection: Vec;
  facing: Vec; potionCharges: number; potionCooldown: number; burstCooldown: number;
  attackPose: number; skillPose: number; attackFacing?: Vec; statuses:Partial<Record<StatusEffect,{duration:number;potency:number;tick:number}>>;
}
export interface Enemy extends Vec {
  id: number; kind: EnemyKind; hp: number; maxHp: number; speed: number;
  radius: number; damage: number; attackCooldown: number; slow: number; level?:number; name?:string; attack?:EnemyAttack; tint?:number;
  tactic?: 'charge' | 'summoner' | 'jailer'; abilityCooldown?: number; chargeTime?: number; lockedTarget?: Vec;
  basicWindup?: number; basicTarget?: Vec; basicAttack?: EnemyAttack; artId?:string; legacyFrame?:number; facing:Vec;
  hitFlash: number; elite: boolean; rank:MonsterRank; role:MonsterRole; onHit?:StatusEffect; support?:SupportAbility; supportCooldown:number; shield:number; maxShield:number;
  moving:boolean; formationAngle:number; dropChance:number; xpMultiplier:number; revives:number; windup: number; stagger: number; knockback: Vec;
  armor:number; stationary?:boolean; bossId?:string; abilities?:EnemyAttack[];
  skillPose?:number;
  showcaseRoom?:number;
  encounterRoom?:number;
  encounterEvent?:number;
}
export interface Projectile extends Vec {
  id: number; vx: number; vy: number; ttl: number; damage: number;
  radius: number; enemy: boolean; color: number; pierce: number; hit: Set<number>;
  returning?: boolean; origin?: Vec; age?: number; bleed?: boolean; status?:StatusEffect; sourceName?:string;
}
export interface Minion extends Vec { id: number; ttl: number; attackCooldown: number; targetId: number | null; damage: number; hitPose: number }
export interface Corpse extends Vec { id: number; ttl: number; rank?: MonsterRank; blood?: number }
export interface GroundLoot extends Vec { id: number; item?: Item; xp: number; gold: number; age: number; spawnX?:number; spawnY?:number }
export interface Hazard extends Vec { id: number; radius: number; delay: number; damage: number; ttl: number; fired: boolean; shape?: 'circle' | 'ring' | 'line'; target?: Vec; width?: number; innerRadius?: number; hitPlayer?: boolean; status?:StatusEffect; sourceName?:string }
export interface Zone extends Vec { id: number; radius: number; ttl: number; tick: number; damage: number; color: number; sourceName?:string }
export type RoomArchetype=string;
export interface Room { x: number; y: number; w: number; h: number; type: 'entry' | 'crypt' | 'altar' | 'treasury' | 'sanctum'; archetype?:RoomArchetype }
export type MechanismKind = 'spikes'|'flameVent'|'frostVent'|'healingShrine'|'urn'|'ancientLever';
export interface BreakableWall extends Vec { tiles:number[]; revealedRoom:number; destroyed:boolean; orientation:'L'|'R' }
export interface Mechanism extends Vec { kind:MechanismKind; used:boolean }
export interface ShowcaseRoom {room:number;profileId:string;label:string;boss:boolean}
export interface EnvironmentProp extends Vec {
  id:number; room:number; kind:'pillar'|'brazier'|'theme'|'user'|'tomb'; frame:number;
  height:number; radius:number; solid:boolean; atlas?:'user-props-1'|'user-props-2';
}
export interface Dungeon { size: number; tiles: Uint8Array; rooms: Room[]; start: Vec; exit: Vec; altar: Vec; chests: Vec[]; seed: number; theme: ThemeId; floor: number; bossRoom: number; hiddenRooms:number[]; breakableWalls:BreakableWall[]; mechanisms:Mechanism[]; props:EnvironmentProp[];showcase?:boolean;showcaseRooms?:ShowcaseRoom[] }
export interface Input { x: number; y: number; aim?: Vec; dash: boolean; burst: boolean; potion: boolean; interact: boolean; basicAttack?:boolean; skillSlot?:number }
export interface VisualEvent extends Vec {
  type: 'hit' | 'playerHit' | 'death' | 'lightning' | 'ring' | 'slash' | 'loot' | 'dash' | 'burst' | 'heal' | 'corpse' | 'summon'|'shield'|'teleport'|'revive'|'status'|'execute'|'interrupt'|'cast';
  color: number; amount?: number; critical?: boolean; lethal?:boolean; heavy?:boolean; blocked?:boolean; target?: Vec; radius?: number; impact?: number; artId?:string; facing?:Vec; label?:string;
}
export interface Stats { maxHp: number; maxMana: number; damage: number; crit: number; haste: number; speed: number }
export interface Upgrade { key: string; title: string; description: string; skill?: SkillId; kind: 'new' | 'level' | 'wide' | 'focused' | 'heal' }
export interface Session {
  gold: number; forgeRank: number; carried: Partial<Record<Slot, Item>>; stash: Item[]; bestKills: number; victories: number;
  unlockedWings:string[]; equippedWing:string|null; lastWingReward:string|null;
  talents:Record<CharacterId,Record<string,number>>;
}

export interface Encounter extends Vec {
  id: number; room: number; kind: 'cursed' | 'sacrifice' | 'hunt';
  state: 'available' | 'active' | 'won' | 'failed'; remaining: number; progress: number;spawnTimer:number;waves:number;
}

export type RoomEncounterType='siege'|'elite'|'survival'|'hunt'|'mechanism'|'treasure';
export interface RoomEncounter {
  room:number;type:RoomEncounterType;state:'dormant'|'active'|'cleared';key:boolean;choiceReward:boolean;
  wavesSpawned:number;totalWaves:number;waveDelay:number;remaining:number;kills:number;targetId?:number;
}
export interface RoomRewardOption {key:'relic'|'fortune'|'respite';title:string;description:string}

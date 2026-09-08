import { idleInput, Run } from '../core/run';
import { createItem } from '../core/loot';
import { Random, fixed2 } from '../core/random';
import type { Rarity } from '../core/types';
import {THEMES,THEME_IDS} from '../core/themes';
import type {ThemeId} from '../core/types';

interface DebugPanelBridge { getRun:()=>Run; replaceRun:(run:Run)=>void }

/** Developer instrumentation. This module is dynamically imported only for DEV ?qa=1. */
export class DebugPanel {
  private root=document.createElement('aside');
  private open=false;
  private invulnerable=false;
  private raf=0;
  private lastFrame=performance.now();
  private fps=60;
  constructor(private bridge:DebugPanelBridge){
    this.root.className='qa-tools';
    const themes=THEME_IDS.map(id=>`<option value="${id}" ${id==='cathedral'?'selected':''}>${THEMES[id].name}</option>`).join('');
    this.root.innerHTML=`<button class="qa-toggle" aria-label="开发者调试面板">QA</button><section hidden><header><b>DEMO 0.15 调试台</b><small>F2 / \`</small></header><div class="qa-readout"></div><div class="qa-grid"><select class="qa-theme" aria-label="地图主题">${themes}</select><button data-qa="load-theme">载入地图主题</button><button data-qa="next">进入下层</button><button data-qa="level">等级 +5</button><button data-qa="gold">金币 +500</button><button data-qa="greed-down">贪欲 -1</button><button data-qa="greed-up">贪欲 +1</button><button data-qa="pack">生成怪群</button><button data-qa="elite">生成精英</button><button data-qa="boss">唤醒 Boss</button><button data-qa="clear">清除怪物</button><button data-qa="item">生成装备</button><select class="qa-rarity" aria-label="生成装备品质"><option value="rare">稀有</option><option value="epic">史诗</option><option value="set">套装</option><option value="unique">暗金</option><option value="legendary">传奇</option></select><button data-qa="god">无敌：关</button></div><p>仅开发环境与 ?qa=1 可见，不写入浏览器存档。</p></section>`;
    document.body.append(this.root);this.root.addEventListener('click',event=>this.click(event));
    addEventListener('keydown',event=>{if(event.code==='F2'||event.code==='Backquote'){event.preventDefault();this.toggle();}});
    this.update();
  }
  private toggle():void{this.open=!this.open;(this.root.querySelector('section') as HTMLElement).hidden=!this.open;this.root.classList.toggle('open',this.open);}
  private click(event:MouseEvent):void{
    const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(!target)return;
    if(target.classList.contains('qa-toggle')){this.toggle();return;}
    const run=this.bridge.getRun(),action=target.dataset.qa;
    if(action==='load-theme'){const theme=(this.root.querySelector('.qa-theme') as HTMLSelectElement).value as ThemeId;this.bridge.replaceRun(new Run(41010+THEME_IDS.indexOf(theme),run.characterId,run.session,theme));return;}
    if(action==='level'){run.level+=5;run.player.hp=run.stats.maxHp;run.player.mana=run.stats.maxMana;}
    if(action==='gold')run.gold+=500;
    if(action==='greed-down')run.greed=Math.max(0,run.greed-1);
    if(action==='greed-up')run.greed=Math.min(15,run.greed+1);
    if(action==='pack')for(const kind of ['skeleton','knight','archer','cultist','zombie','guardian'] as const)run.spawnEnemy(kind);
    if(action==='elite')run.spawnEnemy('knight',true);
    if(action==='boss'){run.phase='playing';Object.assign(run.player,run.dungeon.exit);run.update(1/60,idleInput());}
    if(action==='clear'){run.enemies=[];run.projectiles=[];run.hazards=[];}
    if(action==='item'){
      const rarity=(this.root.querySelector('.qa-rarity') as HTMLSelectElement).value as Rarity,maxId=Math.max(10000,...run.inventory.map(item=>item.id),...Object.values(run.equipped).map(item=>item.id));
      run.receiveItem(createItem(new Random(run.seed+maxId),maxId+1,Math.max(1,run.recommendedEnemyLevel),rarity));
    }
    if(action==='god'){this.invulnerable=!this.invulnerable;run.player.invulnerable=this.invulnerable?9999:0;target.textContent=`无敌：${this.invulnerable?'开':'关'}`;}
    if(action==='next'&&run.floor<8){run.exitUnlocked=true;run.advanceFloor();}
  }
  private update=():void=>{
    const now=performance.now(),frameMs=Math.max(1,now-this.lastFrame);this.lastFrame=now;this.fps=this.fps*.92+1000/frameMs*.08;
    const run=this.bridge.getRun(),dps=run.time?run.telemetry.damageDealt/run.time:0;
    const readout=this.root.querySelector('.qa-readout');if(readout)readout.innerHTML=`<span>地图 <b>${run.floor}/8</b></span><span>等级 <b>${run.level}</b></span><span>贪欲 <b>${run.greed}</b></span><span>敌人 <b>${run.enemies.length}</b></span><span>DPS <b>${fixed2(dps)}</b></span><span>承伤 <b>${fixed2(run.telemetry.damageTaken)}</b></span><span>暴击 <b>${run.telemetry.criticals}/${run.telemetry.hits}</b></span><span>最大一击 <b>${fixed2(run.telemetry.largestHit)}</b></span><span>FPS <b>${Math.round(this.fps)}</b></span>`;
    this.raf=requestAnimationFrame(this.update);
  };
  destroy():void{cancelAnimationFrame(this.raf);this.root.remove();}
}

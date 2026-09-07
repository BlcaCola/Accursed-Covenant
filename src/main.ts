import Phaser from 'phaser';
import { freshSession, idleInput, Run } from './core/run';
import { GameScene, type SceneBridge } from './render/scene';
import { AudioBus } from './render/audio';
import { Interface } from './ui/interface';
import './style.css';
import './gothic.css';
import './image-ui.css';

/** Memory-only session. Never use localStorage, IndexedDB, cookies, or a service worker. */
const session = freshSession();
const audio = new AudioBus();
let run = new Run(48271, 'sorceress', session);
let game: Phaser.Game | undefined;
const ui = new Interface({
  start: character => {
    audio.unlock();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    run = new Run(seed, character, session);ui.bind(run); bridge.run = run; bridge.started = true;
  },
  command,
  forge: () => { if (run.ended && session.gold >= 100 && session.forgeRank < 5) { session.gold -= 100; session.forgeRank++; } },
  language:()=>game?.scene.getScene<GameScene>('dungeon')?.refreshLanguage(),
});
const bridge: SceneBridge = {
  run, started: false, audio, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  onFrame: () => ui.update(run), onCommand: command, onReady: () => ui.setReady(), onLoading: (visible,progress,label) => ui.setLoading(visible,progress,label),
};
ui.bind(run);

function command(action: string): void {
  if (action === 'sound') { ui.setSound(audio.toggle()); return; }
  if (action === 'fullscreen') {
    const promise = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    void promise.catch(() => run.notify('当前浏览器未能进入全屏，可使用浏览器全屏快捷键。'));
    return;
  }
  if (action === 'reload') { location.reload(); return; }
  if (action === 'load-error') { ui.showError('游戏素材未能加载，请检查网络后重试。'); return; }
  if (!bridge.started) return;
  if (action === 'map') { ui.toggleMap(); return; }
  if (action === 'shake') { run.shakeLevel = ((run.shakeLevel + 1) % 3) as 0|1|2; run.notify(`画面震动 · ${['关闭','轻微','标准'][run.shakeLevel]}`); return; }
  if(action==='quality'){const order=['high','standard','performance'] as const;run.graphicsQuality=order[(order.indexOf(run.graphicsQuality)+1)%order.length];run.worldRevision++;run.notify(`画质 · ${{high:'高清',standard:'标准',performance:'性能'}[run.graphicsQuality]}`,'gold');return;}
  if (action === 'inventory') run.openInventory();
  if (action === 'pause' || action === 'resume') run.pause();
  if (action === 'amplify') run.amplify = !run.amplify;
  if (run.phase !== 'playing') return;
  if(action==='pickup'){if(!run.pickupNearestItem())run.notify('附近没有可拾取且符合筛选的装备','blue');return;}
  if (action === 'burst') run.burst();
  if (action === 'potion') run.drinkPotion();
  if (action === 'dash') { const input = idleInput(); input.dash = true; run.update(1 / 60, input); }
}

// A tab losing focus is a true pause. Do not simulate a catch-up monster burst on return.
const pauseForFocus = () => { if (bridge.started && run.phase === 'playing') run.phase = 'paused'; };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForFocus(); });
window.addEventListener('blur', pauseForFocus);
// Browsers may restore a page from BFCache; treat that as a fresh visit, not a save.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

try {
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#090d10',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { pixelArt: true, antialias: false, roundPixels: true, powerPreference: 'high-performance' },
    fps: { target: 60, smoothStep: true },
    audio: { noAudio: true }, // Synthesized sound is managed by AudioBus.
    scene: [new GameScene(bridge)],
    banner: false,
  });
} catch {
  ui.showError('需要支持 WebGL 的浏览器。请开启浏览器硬件加速，或尝试较新的 Chrome、Edge、Firefox。');
}

/** Dev-only observability for deterministic browser tests; removed from production builds. */
if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
  Object.assign(window, { __ASHBOUND_TEST__: {
    get scene() { return game!.scene.getScene('dungeon'); },
    get run() { return run; }, get session() { return session; },
    start: () => { run = new Run(12345, 'sorceress', session); bridge.run = run; bridge.started = true; ui.begin(); },
    step: (seconds: number) => { for (let i = 0; i < seconds * 60 && run.phase === 'playing'; i++) run.update(1 / 60, idleInput()); },
  } });
  // Keep development controls out of the production graph and normal player UI.
  void import('./ui/debugPanel').then(({DebugPanel})=>new DebugPanel({getRun:()=>run,replaceRun:next=>{run=next;bridge.run=next;bridge.started=true;ui.begin();}}));
}

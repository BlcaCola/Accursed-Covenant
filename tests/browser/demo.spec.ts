import { expect, test } from '@playwright/test';

test('complete demo journey: start, move, pause, upgrade, equip, greed, win and forget', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?qa=1');
  const start = page.locator('[data-command="start"]');
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await page.screenshot({ path: 'test-results/title.png' });
  await start.click();
  await expect(page.locator('.start-screen')).toHaveCount(0);
  const before = await page.evaluate(() => ({ x: (window as any).__ASHBOUND_TEST__.run.player.x, y: (window as any).__ASHBOUND_TEST__.run.player.y }));
  await page.keyboard.down('d');
  await expect.poll(async () => page.evaluate((p) => Math.hypot((window as any).__ASHBOUND_TEST__.run.player.x - p.x, (window as any).__ASHBOUND_TEST__.run.player.y - p.y), before), { timeout: 10_000 }).toBeGreaterThan(10);
  await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.scene.hero.texture.key)).toContain(':run:');
  const movingDirection=(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.scene.hero.texture.key)).match(/:([0-7]):run:/)?.[1];expect(movingDirection).toBeTruthy();
  await page.evaluate(()=>{const p=(window as any).__ASHBOUND_TEST__.run.player;p.attackPose=2;p.attackFacing={x:-p.facing.x,y:-p.facing.y};});
  await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.scene.hero.texture.key)).toContain(`:${movingDirection}:attack:`);
  await page.keyboard.up('d');
  const after = await page.evaluate(() => ({ x: (window as any).__ASHBOUND_TEST__.run.player.x, y: (window as any).__ASHBOUND_TEST__.run.player.y }));
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(10);
  await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: '圣堂，暂归寂静。' })).toBeVisible();
  const pausedTime = await page.evaluate(() => (window as any).__ASHBOUND_TEST__.run.time);
  await page.waitForTimeout(300); expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.run.time)).toBe(pausedTime);
  await page.getByRole('button', { name: /继续远征/ }).click();
  await page.evaluate(() => { const r = (window as any).__ASHBOUND_TEST__.run; r.level = 3; r.prepareUpgrade(); });
  await expect(page.getByRole('heading', { name: '选择新的力量' })).toBeVisible();
  await page.locator('[data-upgrade="new-fire"]').click();
  await expect(page.locator('.upgrade-dialog')).toHaveCount(0);
  await page.evaluate(() => {
    const r = (window as any).__ASHBOUND_TEST__.run;
    r.receiveItem({ id: 9999, name: '风暴之心', slot: 'weapon', rarity: 'legendary', power: 1, damage: 15, health: 20, haste: 0, crit: .04, effect: 'storm', description: '链雷额外跳跃 2 次。' });
  });
  await page.keyboard.press('i'); await expect(page.getByRole('heading', { name: '契约者的行装' })).toBeVisible();
  await page.locator('[data-equip="9999"]').click();
  await expect(page.locator('.equipment-slot.legendary')).toContainText('风暴之心');
  await page.locator('.equipment-slot.legendary').click();await expect(page.locator('.equipped-inspector')).toContainText('风暴之心');await expect(page.locator('.active-effects')).toContainText('链雷额外跳跃');
  await page.screenshot({ path: 'test-results/equipment.png' });
  await page.getByRole('button', { name: /返回战斗/ }).click();
  await page.evaluate(() => { const r = (window as any).__ASHBOUND_TEST__.run; r.player.x = r.dungeon.altar.x; r.player.y = r.dungeon.altar.y; });
  await page.keyboard.press('e'); await expect(page.getByRole('heading', { name: '力量，理应有代价。' })).toBeVisible();
  await expect(page.locator('.rarity-rate')).toHaveCount(7);
  await expect(page.locator('.drop-rate-heading')).toContainText('各级怪物掉装率');
  await page.screenshot({path:'test-results/greed-rates.png'});
  await page.getByRole('button', { name: '提高贪欲' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ASHBOUND_TEST__.run.greed)).toBe(1);
  await page.getByRole('button', { name: /完成祭献/ }).click();
  await page.evaluate(() => {
    const r = (window as any).__ASHBOUND_TEST__.run; r.player.x = r.dungeon.start.x; r.player.y = r.dungeon.start.y;
    r.player.invulnerable = 99; r.level = 8;
    for (let i = 0; i < 25; i++) { const e = r.spawnEnemy(i % 3 === 0 ? 'zombie' : 'skeleton'); if (e) { const a = i * .9; e.x = r.player.x + Math.cos(a) * (110 + i * 3); e.y = r.player.y + Math.sin(a) * (110 + i * 3); } }
  });
  await page.waitForTimeout(500); await page.screenshot({ path: 'test-results/combat.png' });
  await page.evaluate(() => { const r=(window as any).__ASHBOUND_TEST__.run;r.phase='playing';r.roomEncounters.filter((v:any)=>v.key).forEach((v:any)=>v.state='cleared');Object.assign(r.player,r.dungeon.exit);r.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:false});r.hit(r.floorGuardian,999999);r.advanceFloor(); });
  await expect(page.locator('#stage-name')).toContainText('地图 2 / 8');
  await page.evaluate(() => { const r = (window as any).__ASHBOUND_TEST__.run; for(let floor=2;floor<=8;floor++){r.roomEncounters.filter((v:any)=>v.key).forEach((v:any)=>v.state='cleared');Object.assign(r.player,r.dungeon.exit);r.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:false});r.hit(r.floorGuardian,999999);if(floor<8)r.advanceFloor();} });
  await expect(page.getByRole('heading', { name: '八重门扉，尽数破碎。' })).toBeVisible();
  await expect(page.locator('.wing-reward')).toContainText('已解锁并自动装备');
  expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.session.unlockedWings.length)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.scene.wing?.texture.key??'')).toContain('auth:wing:wing-');
  await page.screenshot({ path: 'test-results/victory.png' });
  await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.session.gold+=500);await page.getByRole('button',{name:'打开天赋树'}).click();await expect(page.getByRole('heading',{name:/传承天赋/})).toBeVisible();await page.locator('[data-talent-buy="s-ember"]').click();expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.session.talents.sorceress['s-ember'])).toBe(1);await page.screenshot({path:'test-results/talent-tree-v12.png'});await page.locator('[data-command="talent-close"]').last().click();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await page.locator('[data-character="bloodknight"]').click();
  await expect(page.locator('[data-command="start"]')).toContainText('血刃骑士');
  await page.locator('[data-command="start"]').click();
  expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.run.characterId)).toBe('bloodknight');
  expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.run.equipped.weapon.id)).toBe(9999);
  expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.session.talents.sorceress['s-ember'])).toBe(1);
  await page.reload(); await expect(page.locator('[data-command="start"]')).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.session.forgeRank)).toBe(0);
  expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.session.gold)).toBe(0);
  expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.session.talents.sorceress)).toEqual({});
});

test('compact desktop layout keeps the start and HUD within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto('/?qa=1');
  await expect(page.locator('[data-command="start"]')).toBeEnabled();
  await page.screenshot({ path: 'test-results/selection-compact.png' });
  const startBox = await page.locator('[data-command="start"]').boundingBox();
  expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(720);
  await page.locator('[data-command="talents"]').click();await expect(page.getByRole('heading',{name:/传承天赋/})).toBeVisible();await page.locator('[data-command="talent-close"]').last().click();
  await page.locator('[data-command="start"]').click();
  await expect(page.locator('#map-loading')).toBeHidden({timeout:20_000});
  await expect(page.locator('.hud-art img')).toHaveAttribute('src',/hud-frame-v1\.png/);
  for (const id of ['#life-meter', '#mana-meter', '#skill-slots']) {
    const box = await page.locator(id).boundingBox(); expect(box).toBeTruthy(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(1024); expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  }
  await page.screenshot({path:'test-results/hud-compact-v16.png'});
});

test('Chinese and English UI, fogged walls and authored combat effects are active',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?qa=1');
  await page.locator('.selection-language').click();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('#game-title')).toHaveText('ACCURSED COVENANT');await expect(page.locator('.character-choice').first()).toContainText('Storm Sorceress');
  await page.locator('.selection-language').click();await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');await expect(page.locator('#game-title')).toContainText('诅 咒 契 约');await page.locator('[data-command="start"]').click();await expect(page.locator('#map-loading')).toBeHidden({timeout:20000});
  const initial=await page.evaluate(()=>{const scene=(window as any).__ASHBOUND_TEST__.scene,run=(window as any).__ASHBOUND_TEST__.run,keys=Object.keys(scene.textures.list).filter(key=>key.startsWith('effect:'));run.loot.push({id:990001,x:run.player.x+150,y:run.player.y+10,spawnX:run.player.x+150,spawnY:run.player.y+10,xp:45,gold:0,age:0});return{firstFrames:keys.length,experience:scene.textures.exists('effect:experience-orb:0:0'),portal:scene.textures.exists('effect:portal/gold-body:0:0'),directional:scene.textures.exists('effect:character-lightning-cast:7:0'),wallVisible:scene.barrierImages[0]?.visible??true};});expect(initial.firstFrames).toBeGreaterThanOrEqual(80);expect(initial).toMatchObject({experience:true,portal:true,directional:true,wallVisible:false});await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.scene.xpDrops.size)).toBe(1);await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run,p=run.player;run.events.push({type:'lightning',x:p.x-80,y:p.y,target:{x:p.x+80,y:p.y-40},color:0x65cfff},{type:'corpse',x:p.x+30,y:p.y+55,radius:90,color:0x86d45e});run.hazards.push({id:990002,x:p.x-70,y:p.y+70,radius:58,delay:.1,ttl:1.5,damage:0,fired:false,status:'poison',sourceName:'visual-test'});});await page.waitForTimeout(500);expect(await page.evaluate(()=>{const scene=(window as any).__ASHBOUND_TEST__.scene;return{xp:[...scene.xpDrops.values()][0]?.texture.key??'',effects:scene.authoredTextureFx.filter((image:any)=>image.visible).map((image:any)=>image.texture.key)}})).toMatchObject({xp:expect.stringContaining('effect:experience-orb'),effects:expect.arrayContaining([expect.stringMatching(/^effect:/)])});await page.screenshot({path:'test-results/authored-effects-v15.png'});
  await page.evaluate(()=>{const scene=(window as any).__ASHBOUND_TEST__.scene,run=(window as any).__ASHBOUND_TEST__.run,wall=run.dungeon.breakableWalls[0];Object.assign(run.player,wall);run.reveal();});await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.scene.barrierImages[0]?.visible)).toBe(true);await page.screenshot({path:'test-results/fog-wall-v15.png'});
  await page.locator('#language-button').click();await expect(page.locator('#objective-title')).toContainText(/BOSS|Purify|Siege|Formation|Seal|Hunt|Trap|Treasure/);await expect(page.locator('#map-loading')).toBeHidden({timeout:20000});const translated=await page.locator('#stage-name,#objective,#interact-prompt').allTextContents();expect(translated.join(' ')).not.toMatch(/[\u3400-\u9fff]/);await expect(page.locator('#tutorial-tip')).toHaveCount(0);await page.screenshot({path:'test-results/english-ui-v15.png'});expect(errors).toEqual([]);
});

test('all three characters select distinct actors and restricted skill pools', async ({ page }) => {
  await page.goto('/?qa=1');
  for (const id of ['sorceress', 'necromancer', 'bloodknight']) {
    await page.locator(`button[data-character="${id}"]`).click();
    await expect(page.locator(`button[data-character="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-command="start"]').click();
    await expect(page.locator('#map-loading')).toBeHidden({timeout:20000});
    expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.run.characterId)).toBe(id);
    for(let direction=0;direction<8;direction++){
      await page.evaluate(i=>{const r=(window as any).__ASHBOUND_TEST__.run,a=i*Math.PI/4,sx=Math.sin(a),sy=Math.cos(a);r.phase='paused';r.player.attackPose=0;r.player.skillPose=0;r.player.attackFacing=undefined;r.player.facing={x:sx/2+sy,y:sy-sx/2};},direction);
      const authoredDirection=[4,3,2,1,0,7,6,5][direction];
      await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.scene.hero.texture.key)).toContain(`:${authoredDirection}:stand:`);
    }
    await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.scene.hero.texture.key)).toContain(`auth:character:${id}:`);
    await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.phase='playing');
    await page.screenshot({path:`test-results/${id}-v3.png`});
    await page.evaluate(() => { const r = (window as any).__ASHBOUND_TEST__.run; r.level = 3; r.prepareUpgrade(); });
    await expect(page.locator('.upgrade-card')).toHaveCount(3);
    await page.locator('.upgrade-card').first().click();
    if (id === 'necromancer') {
      await page.evaluate(() => { (window as any).__ASHBOUND_TEST__.step(.5); });
      expect(await page.evaluate(() => (window as any).__ASHBOUND_TEST__.run.minions.length)).toBeGreaterThan(0);
    }
    await page.evaluate(() => { const r = (window as any).__ASHBOUND_TEST__.run; r.player.invulnerable = 0; r.hurt(99999, '角色切换验证'); });
    await expect(page.getByRole('heading', { name: '你归于灰烬。' })).toBeVisible();
    await page.getByRole('button', { name: /返回营地/ }).click();
  }
});


test('exploration contracts, PNG interface, resource clipping and boss phase',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?qa=1');await page.locator('[data-command="start"]').click();
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run,e=r.encounters[0];Object.assign(r.player,{x:e.x,y:e.y});r.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:true});});
  await expect(page.getByRole('heading',{name:'诅咒宝箱'})).toBeVisible();
  expect(await page.locator('.event-dialog').evaluate(e=>getComputedStyle(e).borderImageSource)).toContain('panel-v3.png');
  await page.screenshot({path:'test-results/event-v3.png'});
  await page.getByRole('button',{name:'接受契约'}).click();
  await expect(page.locator('#objective-title')).toContainText('诅咒试炼');
  const reinforcement=await page.evaluate(()=>{const api=(window as any).__ASHBOUND_TEST__,r=api.run,e=r.activeEncounter;r.player.invulnerable=999;for(const enemy of r.enemies.filter((value:any)=>value.encounterEvent===e.id))enemy.hp=0;api.step(3.3);return{waves:e.waves,alive:r.enemies.filter((value:any)=>value.encounterEvent===e.id&&value.hp>0).length};});expect(reinforcement.waves).toBeGreaterThanOrEqual(2);expect(reinforcement.alive).toBeGreaterThan(0);
  await page.keyboard.press('Escape');const clock=await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.activeEncounter.remaining);
  await page.waitForTimeout(200);expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.activeEncounter.remaining)).toBe(clock);
  await page.getByRole('button',{name:/继续远征/}).click();
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.activeEncounter.remaining=.001;r.player.invulnerable=999;(window as any).__ASHBOUND_TEST__.step(.05);});
  expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.encounters[0].state)).toBe('won');
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.player.hp=r.stats.maxHp*.25;r.player.mana=25;const e=r.spawnEnemy('boss',true);r.floorGuardianId=e.id;Object.assign(e,{x:r.player.x+120,y:r.player.y,hp:e.maxHp*.49});r.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:false});});
  await expect(page.locator('#boss-percent')).toContainText('地图守卫');
  await expect.poll(()=>page.locator('#life-meter').evaluate(e=>parseFloat((e as HTMLElement).style.getPropertyValue('--fill')))).toBeLessThan(27);
  expect(await page.locator('#life-meter').evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('ui/frame-atlas-v3.png');
  expect(await page.locator('#life-liquid').evaluate(e=>({display:getComputedStyle(e).display,animation:getComputedStyle(e).animationName,height:parseFloat(getComputedStyle(e).height),texture:getComputedStyle(e).backgroundImage,filter:getComputedStyle(e).filter}))).toMatchObject({display:'block',animation:expect.stringContaining('orb-liquid-flow'),texture:expect.stringContaining('frame-atlas-v3.png'),filter:'none'});
  expect(await page.locator('.life-orb .glass').evaluate(e=>getComputedStyle(e).backdropFilter)).toContain('grayscale(1)');
  await expect.poll(()=>page.locator('.life-orb .glass').evaluate(e=>getComputedStyle(e).clipPath)).toContain('polygon');
  const liquidMotion=await page.locator('#life-liquid').evaluate(async e=>{const sample=()=>{const liquid=getComputedStyle(e),current=getComputedStyle(e.querySelector('i')!,'');return[liquid.backgroundPosition,current.backgroundPosition,current.transform].join('|')};const before=sample();await new Promise(resolve=>setTimeout(resolve,450));return{before,after:sample()};});
  expect(liquidMotion.after).not.toBe(liquidMotion.before);
  await page.screenshot({path:'test-results/boss-v3.png'});expect(errors).toEqual([]);
});

test('breakable wall, route choice and animated portal are playable',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?qa=1');await page.locator('[data-command="start"]').click();
  const sealed=await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run,w=r.dungeon.breakableWalls[0],room=r.dungeon.rooms[w.revealedRoom],center={x:(room.x+room.w/2)*32,y:(room.y+room.h/2)*32};Object.assign(r.player,w);return{hidden:r.isExplored(center),orientation:w.orientation,tiles:w.tiles.length};});
  expect(sealed.hidden).toBe(false);expect(['L','R']).toContain(sealed.orientation);expect(sealed.tiles).toBeLessThanOrEqual(5);
  await page.waitForTimeout(250);expect(await page.evaluate(()=>{const scene=(window as any).__ASHBOUND_TEST__.scene,cam=scene.cameras.main;return{dx:Math.abs(cam.midPoint.x-scene.hero.x),dy:Math.abs(cam.midPoint.y-scene.hero.y)};})).toMatchObject({dx:0,dy:0});await page.screenshot({path:'test-results/hidden-wall-sealed-v13.png'});
  expect(await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run,w=r.dungeon.breakableWalls[0];r.interact();return w.destroyed;})).toBe(true);await page.waitForTimeout(250);await page.screenshot({path:'test-results/hidden-wall-open-v13.png'});
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;for(let floor=1;floor<=2;floor++){r.roomEncounters.filter((v:any)=>v.key).forEach((v:any)=>v.state='cleared');Object.assign(r.player,r.dungeon.exit);r.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:false});r.hit(r.floorGuardian,999999);if(floor===1)r.advanceFloor();}Object.assign(r.player,r.dungeon.exit);r.interact();});
  await expect(page.getByRole('heading',{name:'下一道门通往何处？'})).toBeVisible();await expect(page.locator('[data-route]')).toHaveCount(2);await page.screenshot({path:'test-results/route-v6.png'});
  await page.locator('[data-route]').nth(1).click();await expect(page.locator('#map-loading')).toBeVisible();await page.screenshot({path:'test-results/loading-v13.png'});await expect(page.locator('#stage-name')).toContainText('地图 3 / 8',{timeout:20000});await expect(page.locator('#map-loading')).toBeHidden();
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.roomEncounters.filter((v:any)=>v.key).forEach((v:any)=>v.state='cleared');Object.assign(r.player,r.dungeon.exit);r.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:false});r.hit(r.floorGuardian,999999);r.loot=[];r.phase='playing';r.xp=0;});
  await expect(page.locator('#objective-title')).toContainText('出口已开启');await page.waitForTimeout(1000);expect(await page.evaluate(()=>{const images=(window as any).__ASHBOUND_TEST__.scene.authoredTextureFx,body=images.find((image:any)=>image.visible&&image.texture.key.startsWith('effect:portal/gold-body:'));return body?{width:body.displayWidth,height:body.displayHeight}:null;})).toEqual({width:269,height:207});await page.screenshot({path:'test-results/portal-v15.png'});expect(errors).toEqual([]);
});

test('monster walk frames, status HUD, affixes and pickup filter are wired',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?qa=1');await page.locator('[data-command="start"]').click();
  const enemyId=await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.enemies=[];const e=r.spawnEnemy('skeleton');Object.assign(e,{x:r.player.x+80,y:r.player.y,attackCooldown:99,hp:1e9,maxHp:1e9});return e.id;});
  await expect.poll(()=>page.evaluate(id=>(window as any).__ASHBOUND_TEST__.scene.entities.get(id)?.texture.key??'',enemyId)).toContain('auth:monster:skeleton:');
  const frames:string[]=[];for(let i=0;i<6;i++){frames.push(await page.evaluate(id=>(window as any).__ASHBOUND_TEST__.scene.entities.get(id)?.texture.key??'',enemyId));await page.waitForTimeout(120);}
  expect(new Set(frames).size).toBeGreaterThan(1);expect(frames.some(key=>key.includes(':stand:'))).toBe(true);
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.applyPlayerStatus('poison',8,3,'验收毒素');r.receiveItem({id:88001,name:'残酷的灰烬长剑·猎魔',slot:'weapon',rarity:'epic',power:21,level:21,damage:14.25,health:18.5,haste:.02,crit:.03,weaponKind:'sword',description:'验收装备',affixes:[{id:'cruel',name:'残酷',tier:3,value:5.25,stat:'damage',group:'prefix'},{id:'hunter',name:'猎魔',tier:3,value:.06,stat:'eliteDamage',group:'suffix'}]});});
  await expect(page.locator('#status-effects')).toContainText('中毒');await page.keyboard.press('i');await expect(page.locator('.loot-filters button')).toHaveCount(3);await expect(page.locator('.rolled-affixes')).toContainText('T3 · 残酷');
  await page.locator('[data-filter="epic"]').click();expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.lootFilter)).toBe('epic');expect(errors).toEqual([]);
});

test('sealed room combat opens a three-way reward and unlocks the boss seal',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?qa=1');await page.locator('[data-command="start"]').click();await expect(page.locator('#map-loading')).toBeHidden({timeout:20000});
  await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run,encounter=run.roomEncounters[0],room=run.dungeon.rooms[encounter.room];encounter.totalWaves=1;encounter.choiceReward=true;Object.assign(run.player,{x:(room.x+room.w/2)*32,y:(room.y+room.h/2)*32,invulnerable:999});run.reveal();});
  await expect(page.locator('#objective-title')).toContainText('房门封闭');await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.enemies.filter((enemy:any)=>enemy.encounterRoom!==undefined).length)).toBeGreaterThan(0);await page.screenshot({path:'test-results/sealed-room-combat.png'});
  await page.evaluate(()=>{const api=(window as any).__ASHBOUND_TEST__,run=api.run;for(const enemy of run.enemies.filter((value:any)=>value.encounterRoom!==undefined))run.hit(enemy,999999);if(run.activeRoomEncounter?.type==='survival')run.activeRoomEncounter.remaining=0;api.step(.1);});
  await expect(page.getByRole('heading',{name:'从净化的圣印中选择回报'})).toBeVisible();await expect(page.locator('[data-room-reward]')).toHaveCount(3);const before=await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.gold);await page.locator('[data-room-reward="fortune"]').click();expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.gold)).toBeGreaterThan(before);
  await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;run.roomEncounters.filter((value:any)=>value.key).forEach((value:any)=>value.state='cleared');run.worldRevision++;});await expect(page.locator('#objective-title')).toContainText('首领圣所已经开启');expect(errors).toEqual([]);
});

test('camp NPC economy and authored boss sprites are playable',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?qa=1');await page.locator('[data-command="start"]').click();
  expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.activeNpcs)).toEqual(expect.arrayContaining(['merchant','blacksmith']));
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.session.gold=1000;Object.assign(r.player,r.npcPosition('merchant'));});await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'流亡商人的珍藏'})).toBeVisible();await expect(page.locator('.shop-card')).toHaveCount(4);await page.screenshot({path:'test-results/merchant-v12.png'});await page.locator('[data-buy-offer="0"]').click();expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.inventory.length)).toBeGreaterThan(0);await page.getByRole('button',{name:'结束交易'}).click();
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;Object.assign(r.player,r.npcPosition('blacksmith'));});await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'铁匠的灰烬锻台'})).toBeVisible();await expect(page.locator('.smith-item')).not.toHaveCount(0);await page.getByRole('button',{name:'离开锻台'}).click();
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.gold=200;r.session.gold=0;r.beggarCurrent=true;r.beggarAppeared=true;r.worldRevision++;Object.assign(r.player,r.npcPosition('beggar'));});await expect(page.locator('#map-loading')).toBeVisible();await expect(page.locator('#map-loading')).toBeHidden({timeout:20000});await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'冻饿的乞丐'})).toBeVisible();await page.locator('[data-pay-beggar]').click();expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.beggarPayment)).toBe(100);
  await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.exitUnlocked=true;r.advanceFloor();Object.assign(r.player,r.npcPosition('distant-traveler'));});await expect(page.locator('#map-loading')).toBeVisible();await expect(page.locator('#map-loading')).toBeHidden({timeout:20000});await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'来自远方的旅客'})).toBeVisible();await page.locator('[data-claim-traveler]').click();expect(await page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.gold)).toBe(400);
  const bossId=await page.evaluate(()=>{const r=(window as any).__ASHBOUND_TEST__.run;r.roomEncounters.filter((v:any)=>v.key).forEach((v:any)=>v.state='cleared');Object.assign(r.player,r.dungeon.exit);r.reveal();return r.floorGuardian.id;});await expect.poll(()=>page.evaluate(id=>(window as any).__ASHBOUND_TEST__.scene.entities.get(id)?.texture.key??'',bossId),{timeout:15000}).toContain('auth:boss:common/');await page.screenshot({path:'test-results/authored-boss-v9.png'});
  expect(errors).toEqual([]);
});

test('developer panel controls combat telemetry without entering production UI',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?qa=1');await page.locator('[data-command="start"]').click();
  await expect(page.locator('.qa-toggle')).toBeVisible();await page.locator('.qa-toggle').click();await expect(page.getByText('DEMO 0.12 调试台')).toBeVisible();
  await page.locator('.qa-theme').selectOption('cathedral');await page.locator('[data-qa="load-theme"]').click();await expect(page.locator('#map-loading')).toBeVisible();await expect(page.locator('#map-loading')).toBeHidden({timeout:20000});expect(await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;return[run.dungeon.theme,run.dungeon.rooms[0].archetype];})).toEqual(['cathedral','narthex']);
  expect(await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run,encounter=run.roomEncounters[0],room=run.dungeon.rooms[encounter.room];if(!room)throw new Error('教堂战斗房生成失败');Object.assign(run.player,{x:(room.x+room.w/2)*32,y:(room.y+room.h/2)*32,invulnerable:9999});run.reveal();return{archetype:room.archetype,state:encounter.state};})).toMatchObject({state:'active'});await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.enemies.length)).toBeGreaterThanOrEqual(1);
  await page.locator('.qa-toggle').click();await page.waitForTimeout(500);await page.screenshot({path:'test-results/cathedral-chapel-v11.png'});await page.locator('.qa-toggle').click();
  await page.locator('[data-qa="clear"]').click();const before=await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;run.phase='paused';return{gold:run.gold,level:run.level};});
  await page.locator('[data-qa="gold"]').click();await page.locator('[data-qa="level"]').click();await page.locator('[data-qa="pack"]').click();
  expect(await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;return{gold:run.gold,level:run.level,enemies:run.enemies.length};})).toMatchObject({gold:before.gold+500,level:before.level+5,enemies:6});
  await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;let enemy=run.enemies[0];if(!enemy)enemy=run.spawnEnemy('knight',true);if(!enemy)throw new Error('调试怪物生成失败');enemy.hp=1;run.hit(enemy,999);});
  await expect(page.locator('.qa-readout')).toContainText('最大一击');await page.screenshot({path:'test-results/debug-panel-v11.png'});expect(errors).toEqual([]);
});

test('all fifteen map themes load their own geometry and room identity',async({page})=>{
  test.setTimeout(150_000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?qa=1');await page.locator('[data-command="start"]').click();await page.locator('.qa-toggle').click();
  const themes=['cave','dungeon','cathedral','abandonedVillage','inferno','mountain','town','palace','catacomb','sewer','frozenRuins','swamp','mine','desertTemple','abyssFortress'];
  for(const theme of themes){
    await page.locator('.qa-theme').selectOption(theme);await page.locator('[data-qa="load-theme"]').click();await expect(page.locator('#map-loading')).toBeVisible();await expect(page.locator('#map-loading')).toBeHidden({timeout:20000});
    const state=await page.evaluate(expected=>{const run=(window as any).__ASHBOUND_TEST__.run,index=run.dungeon.rooms.findIndex((_room:any,i:number)=>i>0&&i!==run.dungeon.bossRoom&&!run.dungeon.hiddenRooms.includes(i)),room=run.dungeon.rooms[index];Object.assign(run.player,{x:(room.x+room.w/2)*32,y:(room.y+room.h/2)*32,invulnerable:9999});run.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:false});return{theme:run.dungeon.theme,archetype:room.archetype,discovered:run.discoveredRooms.has(index),expected};},theme);
    expect(state).toMatchObject({theme,discovered:true});expect(state.archetype.length).toBeGreaterThan(3);
    await page.locator('.qa-toggle').click();await page.waitForTimeout(120);await page.screenshot({path:`test-results/theme-${theme}-v11.png`});await page.locator('.qa-toggle').click();
  }
  expect(errors).toEqual([]);
});

test('expanded talent tree, detailed merchant, gallery code and giant final boss are playable',async({page})=>{
  test.setTimeout(120_000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?qa=1');
  await page.locator('[data-command="talents"]').click();await expect(page.locator('.talent-node')).toHaveCount(18);await expect(page.locator('.talent-branch-label')).toHaveCount(3);await page.screenshot({path:'test-results/talent-tree-v12.png'});await page.locator('[data-command="talent-close"]').last().click();
  await page.locator('[data-command="start"]').click();await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;run.skills.length=0;run.phase='merchant';});await expect(page.getByRole('heading',{name:'流亡商人的珍藏'})).toBeVisible();await expect(page.locator('.shop-item-art')).toHaveCount(4);await expect(page.locator('.shop-affixes').first()).toContainText('伤害');await page.locator('#merchant-code').fill('132584');await page.locator('[data-command="unlock-showcase"]').click();await expect(page.locator('.merchant-secret')).toContainText('已经解锁');await page.screenshot({path:'test-results/merchant-detail-v12.png'});await page.locator('[data-command="resume"]').click();
  await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;Object.assign(run.player,run.showcasePortalPosition);run.interact();});await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.showcaseMode)).toBe(true);await expect(page.locator('#stage-name')).toContainText('怪物陈列回廊',{timeout:15000});
  const specimen=await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run,spec=run.dungeon.showcaseRooms[0],room=run.dungeon.rooms[spec.room];Object.assign(run.player,{x:(room.x+room.w/2)*32,y:(room.y+room.h+1)*32,invulnerable:999});run.update(1/60,{x:0,y:0,dash:false,burst:false,potion:false,interact:false});const enemy=run.enemies.find((value:any)=>value.showcaseRoom===spec.room);return{rooms:run.dungeon.showcaseRooms.length,label:spec.label,enemyId:enemy?.id};});expect(specimen.rooms).toBeGreaterThan(60);expect(specimen.enemyId).toBeTruthy();await expect(page.locator('#objective-title')).toContainText('自由测试');await page.screenshot({path:'test-results/monster-gallery-v12.png'});
  await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;Object.assign(run.player,run.showcasePortalPosition);run.interact();});await expect.poll(()=>page.evaluate(()=>(window as any).__ASHBOUND_TEST__.run.showcaseMode),{timeout:15000}).toBe(false);await expect(page.locator('#stage-name')).toContainText('地图 1 / 8',{timeout:15000});
  const finalId=await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run;while(run.floor<8){run.exitUnlocked=true;run.advanceFloor();}run.roomEncounters.filter((v:any)=>v.key).forEach((v:any)=>v.state='cleared');Object.assign(run.player,run.dungeon.exit,{invulnerable:999});run.reveal();return run.floorGuardian.id;});expect(await page.evaluate(()=>{const run=(window as any).__ASHBOUND_TEST__.run,room=run.dungeon.rooms[run.dungeon.bossRoom];return[room.w,room.h];})).toEqual([30,30]);await expect.poll(()=>page.evaluate(id=>(window as any).__ASHBOUND_TEST__.scene.entities.get(id)?.displayHeight??0,finalId),{timeout:20000}).toBeGreaterThanOrEqual(950);await page.screenshot({path:'test-results/final-boss-scale-v12.png'});expect(errors).toEqual([]);
});



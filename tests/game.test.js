import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, addPlayer, action, step, removePlayer, EXIT, generateChests, publicState, CHEST_OPEN_SECONDS, WORLD_WIDTH, WORLD_HEIGHT } from '../shared/game.js';
function room(count = 2) { const s = createState(); for (let i = 0; i < count; i++) addPlayer(s, `${i}`, `P${i}`); return s; }
test('four-player capacity and host-only start', () => {
  const s = room(4); assert.throws(() => addPlayer(s, 'extra', 'extra'));
  action(s, '1', { type: 'start' }); assert.equal(s.phase, 'LOBBY');
  action(s, '0', { type: 'start' }); assert.equal(s.phase, 'BATTLE'); assert.throws(() => addPlayer(s, 'late', 'late'));
});
test('complete two-node journey requires everyone to escape and get ready', () => {
  const s = room(); action(s, '0', { type: 'start' });
  s.players[0].x = EXIT.x + 10; s.players[0].y = EXIT.y + 10; step(s, new Map()); assert.equal(s.phase, 'BATTLE');
  s.players[1].x = EXIT.x + 10; s.players[1].y = EXIT.y + 10; for (let i = 0; i < 40; i++) step(s, new Map()); assert.equal(s.phase, 'MAP');
  action(s, '1', { type: 'select_destination', node: '新大阪' }); assert.equal(s.phase, 'MAP');
  action(s, '0', { type: 'select_destination', node: '横浜' }); assert.equal(s.phase, 'MAP');
  action(s, '0', { type: 'select_destination', node: '新大阪' }); assert.equal(s.phase, 'DESIGN');
  action(s, '0', { type: 'ready', ready: true }); assert.equal(s.phase, 'DESIGN');
  action(s, '0', { type: 'ready', ready: false }); assert.equal(s.players[0].ready, false);
  action(s, '1', { type: 'ready', ready: true }); assert.equal(s.phase, 'DESIGN');
  action(s, '0', { type: 'ready', ready: true }); assert.equal(s.phase, 'BATTLE'); assert.equal(s.node, '新大阪'); assert.equal(s.players[0].x, 90);
  s.players.forEach(p => { p.x = EXIT.x + 10; p.y = EXIT.y + 10; }); for (let i = 0; i < 40; i++) step(s, new Map()); assert.equal(s.phase, 'CLEAR');
});
test('normalized movement, bounds and untrusted coordinates', () => {
  const s = room(1); action(s, '0', { type: 'start' }); const p = s.players[0];
  step(s, new Map([['0', { right: true, down: true, x: 999999 }]])); assert.ok(Math.abs(Math.hypot(p.x - 90, p.y - 150) - 11) < .001);
  for (let i = 0; i < 1000; i++) step(s, new Map([['0', { left: true, up: true }]])); assert.equal(p.x, 16); assert.equal(p.y, 16);
});
test('disconnect transfers host and releases readiness requirement', () => {
  const s = room(); s.phase = 'DESIGN'; s.players[1].ready = true; removePlayer(s, '0'); assert.equal(s.host, '1'); assert.equal(s.phase, 'BATTLE');
});

test('escape takes two continuous seconds and resets when a player leaves', () => {
  const s = room(); action(s, '0', {type: 'start'});
  s.players.forEach(p => Object.assign(p, {x: EXIT.x + 20, y: EXIT.y + 20}));
  for (let i = 0; i < 20; i++) step(s, new Map());
  assert.equal(s.phase, 'BATTLE'); assert.ok(Math.abs(s.escapeElapsed - 1) < 1e-9);
  s.players[1].x = 600; step(s, new Map()); assert.equal(s.escapeElapsed, 0);
  s.players[1].x = EXIT.x + 20;
  for (let i = 0; i < 39; i++) step(s, new Map());
  assert.equal(s.phase, 'BATTLE'); step(s, new Map()); assert.equal(s.phase, 'MAP');
});
test('solo movement and escape timing remain equal at 30, 60 and 144 fps', () => {
  for (const fps of [30, 60, 144]) {
    const s = room(1); action(s, '0', {type:'start'});
    for (let i=0; i<fps; i++) step(s, new Map([['0',{right:true}]]), 1/fps);
    assert.ok(Math.abs(s.players[0].x - 310) < 1e-8);
    Object.assign(s.players[0], {x:EXIT.x+20,y:EXIT.y+20});
    for (let i=0; i<fps*2-1; i++) step(s, new Map(), 1/fps);
    assert.equal(s.phase,'BATTLE'); step(s,new Map(),1/fps); assert.equal(s.phase,'MAP');
  }
});
test('sprint is 1.4x, lasts four seconds, and refills over six seconds', () => {
  const s = room(1); action(s, '0', {type:'start'}); const p = s.players[0];
  step(s, new Map([['0', {right:true, sprint:true}]]), .5);
  assert.ok(Math.abs(p.x - (90 + 220 * 1.4 * .5)) < 1e-8);
  assert.equal(p.stamina, 87.5);
  for (let i=0;i<70;i++) step(s,new Map([['0',{right:true,sprint:true}]]),.05);
  assert.equal(p.stamina,0); assert.equal(p.exhausted,true);
  step(s,new Map(),3); assert.ok(Math.abs(p.stamina-50)<1e-8);
  step(s,new Map(),3); assert.equal(p.stamina,100);
});
test('walking recovers stamina, idle Shift does not drain, exhausted holding does not restart', () => {
  const s=room(1); action(s,'0',{type:'start'}); const p=s.players[0]; p.stamina=50;
  step(s,new Map([['0',{sprint:true}]]),1); assert.ok(p.stamina>50); assert.equal(p.running,false);
  p.stamina=0; p.exhausted=true;
  step(s,new Map([['0',{right:true,sprint:true}]]),1); assert.equal(p.running,false); assert.ok(p.stamina>0);
  step(s,new Map([['0',{right:true}]]),.1); assert.equal(p.exhausted,false);
  step(s,new Map([['0',{right:true,sprint:true}]]),.1); assert.equal(p.running,true);
});

test('2–4 chests, valid random items, resource quantities, unique positions within the map', () => {
  for (const n of [0, .4, .99]) {
    const chests = generateChests(() => n);
    assert.equal(chests.length, 2 + Math.floor(n * 3));
    assert.equal(new Set(chests.map(c => `${c.x},${c.y}`)).size, chests.length);
    for (const c of chests) { assert.ok(c.x > 100 && c.x < WORLD_WIDTH - 100); assert.ok(c.y > 0 && c.y < WORLD_HEIGHT); }
  }
  for (let kind = 0; kind < 5; kind++) {
    const values = [0, 0, (kind + .1) / 5, .99]; let i = 0;
    const c = generateChests(() => values[i++] ?? 0)[0];
    assert.equal(c.loot.item, ['food','fuel','rifle','knife','hat'][kind]);
    assert.equal(c.loot.quantity, kind < 2 ? 4 : 1);
  }
});
test('half-second hold, release/range resets, hidden contents, simultaneous opening credits once', () => {
  const s=room(); action(s,'0',{type:'start'});
  s.chests=[{id:'chest',x:250,y:200,opened:false,openingBy:null,progress:0,loot:{item:'food',quantity:3}}];
  const c=s.chests[0]; const inputs=new Map([['0',{interact:true}],['1',{interact:true}]]);
  assert.equal('loot' in publicState(s).chests[0],false);
  step(s,inputs,.5); assert.equal(c.opened,false);
  s.players.forEach(p=>Object.assign(p,{x:250,y:200}));
  step(s,inputs,.25); assert.equal(c.progress,.25); assert.equal(s.inventory.food,0);
  step(s,new Map(),.05); assert.equal(c.progress,0);
  step(s,inputs,.25); s.players.forEach(p=>p.x=500);step(s,inputs,.05);assert.equal(c.progress,0);
  s.players.forEach(p=>p.x=250);
  for(let i=0;i<9;i++) step(s,inputs,.05);
  assert.equal(c.opened,false);step(s,inputs,.05);assert.equal(c.opened,true);assert.equal(c.progress,CHEST_OPEN_SECONDS);
  assert.equal(s.inventory.food,3);step(s,inputs,1);assert.equal(s.inventory.food,3);
  assert.deepEqual(publicState(s).chests[0].loot,{item:'food',quantity:3});
});
test('new stage regenerates chests but retains recovered shared inventory', () => {
  const s=room(1);action(s,'0',{type:'start'});s.inventory.hat=1;s.chests[0].opened=true;
  s.phase='DESIGN'; action(s,'0',{type:'ready',ready:true});
  assert.equal(s.inventory.hat,1);assert.ok(s.chests.every(c=>!c.opened));
});

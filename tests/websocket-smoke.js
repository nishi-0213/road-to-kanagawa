import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { EXIT } from '../shared/game.js';
const base = process.env.TEST_URL || 'http://127.0.0.1:8787';
const response = await fetch(`${base}/api/rooms`, { method: 'POST' });
assert.equal(response.status, 200); const { code } = await response.json();
const connections = [];
async function join() {
  const entry = { ws: new WebSocket(`${base.replace('http', 'ws')}/api/rooms/${code}/ws?name=Tester`), state: null, id: null };
  entry.ws.on('message', raw => { const m = JSON.parse(raw); if (m.type === 'welcome') entry.id = m.id; if (m.type === 'state') entry.state = m.state; });
  await new Promise((resolve, reject) => { entry.ws.once('open', resolve); entry.ws.once('error', reject); }); connections.push(entry); await until(() => entry.id && entry.state); return entry;
}
async function until(predicate) { const end = Date.now() + 10000; while (!predicate()) { if (Date.now() > end) throw Error('Timed out'); await new Promise(r => setTimeout(r, 30)); } }
const send = (entry, message) => entry.ws.send(JSON.stringify(message));
async function moveToExit(entries) {
  // All four spawn at different y values. Align vertically, then travel east.
  const timers = entries.map(e => setInterval(() => {
    const p = e.state.players.find(p => p.id === e.id);
    send(e, { type: 'input', right: p.x < EXIT.x + EXIT.width / 2, down: p.y < EXIT.y + 45, up: p.y > EXIT.y + 75 });
  }, 50));
  try { await until(() => entries[0].state.phase !== 'BATTLE'); } finally { timers.forEach(clearInterval); entries.forEach(e => send(e, { type: 'input' })); }
}
try {
  const players = []; for (let i = 0; i < 4; i++) players.push(await join());
  await until(() => players.every(p => p.state.players.length === 4));
  const denied = new WebSocket(`${base.replace('http', 'ws')}/api/rooms/${code}/ws`);
  await new Promise((resolve, reject) => { denied.on('unexpected-response', (_, res) => { try { assert.equal(res.statusCode, 409); res.resume(); resolve(); } catch(e) { reject(e); } }); denied.on('open', () => reject(Error('Fifth player accepted'))); denied.on('error', () => {}); });
  send(players[1], { type: 'start' }); await new Promise(r => setTimeout(r, 100)); assert.equal(players[0].state.phase, 'LOBBY');
  send(players[0], { type: 'start' }); await until(() => players.every(p => p.state.phase === 'BATTLE'));
  send(players[0], { type: 'input', right: true, sprint: true, stamina: 9999 });
  await until(() => players[0].state.players.find(p => p.id === players[0].id)?.running === true);
  assert.ok(players[0].state.players.find(p => p.id === players[0].id).stamina < 100);
  send(players[0], { type: 'input' });
  const chest = players[0].state.chests[0];
  assert.equal('loot' in chest, false);
  players.forEach(e => send(e, { type: 'input', interact: true }));
  await new Promise(r => setTimeout(r, 150)); assert.ok(players[0].state.chests.every(c => !c.opened));
  const approach = players.map(e => setInterval(() => {
    const p = e.state.players.find(p => p.id === e.id);
    send(e, { type: 'input', right: p.x < chest.x - 8, left: p.x > chest.x + 8, down: p.y < chest.y - 8, up: p.y > chest.y + 8 });
  }, 50));
  try { await until(() => players.every(e => { const p=e.state.players.find(p=>p.id===e.id);return Math.hypot(p.x-chest.x,p.y-chest.y)<20; })); }
  finally { approach.forEach(clearInterval);players.forEach(e=>send(e,{type:'input'})); }
  const opening = players.map(e => setInterval(() => send(e,{type:'input',interact:true}),50));
  try {
    await until(() => players[0].state.chests.find(c=>c.id===chest.id).opened);
    const opened=players[0].state.chests.find(c=>c.id===chest.id);
    assert.equal(players[0].state.inventory[opened.loot.item],opened.loot.quantity);
    await new Promise(r=>setTimeout(r,600));
    assert.equal(players[0].state.inventory[opened.loot.item],opened.loot.quantity);
  } finally { opening.forEach(clearInterval);players.forEach(e=>send(e,{type:'input'})); }
  await moveToExit(players); assert.equal(players[0].state.phase, 'MAP');
  send(players[0], { type: 'select_destination', node: '新大阪' }); await until(() => players.every(p => p.state.phase === 'DESIGN'));
  players.slice(0, 3).forEach(e => send(e, { type: 'ready', ready: true })); await new Promise(r => setTimeout(r, 100)); assert.equal(players[0].state.phase, 'DESIGN');
  send(players[3], { type: 'ready', ready: true }); await until(() => players.every(p => p.state.phase === 'BATTLE'));
  await moveToExit(players); await until(() => players.every(p => p.state.phase === 'CLEAR')); assert.equal(players[0].state.node, '新大阪');
  players[0].ws.close(); await until(() => players[1].state.players.length === 3); assert.equal(players[1].state.host, players[1].id);
  console.log('PASS: four real WebSockets, fifth-player rejection, host checks, movement, shared chest opening without duplicate loot, both escapes, readiness, clear, host transfer');
} finally { connections.forEach(e => e.ws.close()); }

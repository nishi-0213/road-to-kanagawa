export const WORLD_WIDTH = 1024;
export const WORLD_HEIGHT = 640;
export const RUN_MULTIPLIER = 1.4;
export const RUN_SECONDS = 4;
export const RECOVERY_SECONDS = 6;
export const ESCAPE_SECONDS = 2;
export const CHEST_OPEN_SECONDS = .5;
export const CHEST_RANGE = 52;
export const ITEM_NAMES = { food: '食料', fuel: '燃料', rifle: '小銃', knife: 'ナイフ', hat: '帽子' };
export const EXIT = { x: 928, y: 256, width: 64, height: 128 };
export function createState() { return { phase: 'LOBBY', node: '尼崎', players: [], host: null, tick: 0, escapeElapsed: 0, chests: [], inventory: { food: 0, fuel: 0, rifle: 0, knife: 0, hat: 0 } }; }
export function generateChests(random = Math.random) {
  const cells = [];
  for (let row = 1; row <= 8; row++) for (let col = 2; col <= 13; col++) cells.push({ x: col * 64 + 32, y: row * 64 + 32 });
  const count = 2 + Math.floor(random() * 3);
  return Array.from({ length: count }, (_, i) => {
    const index = Math.floor(random() * cells.length);
    const position = cells.splice(index, 1)[0];
    const item = Object.keys(ITEM_NAMES)[Math.floor(random() * 5)];
    return { id: `chest-${i}`, ...position, opened: false, openingBy: null, progress: 0, loot: { item, quantity: item === 'food' || item === 'fuel' ? 2 + Math.floor(random() * 3) : 1 } };
  });
}
export function publicState(s) {
  return { ...s, chests: s.chests.map(chest => { const { loot, ...visible } = chest; return chest.opened ? chest : visible; }) };
}
export function nearestChest(s, p) {
  return s.chests.filter(c => !c.opened && Math.hypot(p.x - c.x, p.y - c.y) <= CHEST_RANGE)
    .sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0];
}
function updateChests(s, inputs, dt) {
  for (const c of s.chests) {
    if (c.opened) continue;
    const eligible = p => inputs.get(p.id)?.interact === true && nearestChest(s, p)?.id === c.id;
    let owner = s.players.find(p => p.id === c.openingBy && eligible(p));
    if (!owner) { c.progress = 0; owner = s.players.find(eligible); c.openingBy = owner?.id ?? null; }
    if (!owner) continue;
    c.progress = Math.min(CHEST_OPEN_SECONDS, c.progress + dt);
    if (c.progress >= CHEST_OPEN_SECONDS - 1e-9) {
      c.progress = CHEST_OPEN_SECONDS; c.opened = true; c.openingBy = null;
      s.inventory[c.loot.item] += c.loot.quantity;
    }
  }
}
export function addPlayer(state, id, name) {
  if (state.phase !== 'LOBBY') throw Error('ゲームは開始済みです');
  if (state.players.length >= 4) throw Error('ルームは満員です');
  state.players.push({ id, name: String(name || '旅人').slice(0, 20), x: 90, y: 150 + state.players.length * 70, ready: false, stamina: 100, exhausted: false, running: false });
  state.host ||= id;
}
export function removePlayer(s, id) {
  s.players = s.players.filter(p => p.id !== id);
  if (s.host === id) s.host = s.players[0]?.id ?? null;
  advance(s);
}
function enterBattle(s) {
  s.phase = 'BATTLE';
  s.escapeElapsed = 0;
  s.chests = generateChests();
  s.players.forEach((p, i) => Object.assign(p, { x: 90, y: 150 + i * 70, ready: false, stamina: 100, exhausted: false, running: false }));
}
export function action(s, id, message) {
  const p = s.players.find(p => p.id === id);
  if (!p) return;
  if (message.type === 'start' && s.phase === 'LOBBY' && s.host === id) enterBattle(s);
  if (message.type === 'select_destination' && s.phase === 'MAP' && s.host === id && message.node === '新大阪') {
    s.node = '新大阪'; s.phase = 'DESIGN'; s.players.forEach(p => p.ready = false);
  }
  if (message.type === 'ready' && s.phase === 'DESIGN' && typeof message.ready === 'boolean') {
    p.ready = message.ready; advance(s);
  }
}
export function inExit(p) { return p.x >= EXIT.x && p.x <= EXIT.x + EXIT.width && p.y >= EXIT.y && p.y <= EXIT.y + EXIT.height; }
function advance(s) {
  if (!s.players.length) return;
  if (s.phase === 'DESIGN' && s.players.every(p => p.ready)) enterBattle(s);

}
export function step(s, inputs, dt = 0.05) {
  if (s.phase !== 'BATTLE') return;
  for (const p of s.players) {
    const input = inputs.get(p.id) || {};
    let x = Number(input.right === true) - Number(input.left === true);
    let y = Number(input.down === true) - Number(input.up === true);
    const moving = x !== 0 || y !== 0;
    if (input.sprint !== true) p.exhausted = false;
    const stamina = p.stamina ?? 100;
    const running = moving && input.sprint === true && !p.exhausted && stamina > 1e-9;
    // Integrate the exact fraction of a frame remaining before exhaustion.
    const runTime = running ? Math.min(dt, stamina / (100 / RUN_SECONDS)) : 0;
    const distance = 220 * (dt + runTime * (RUN_MULTIPLIER - 1));
    if (running) {
      p.stamina = Math.max(0, stamina - dt * 100 / RUN_SECONDS);
      if (p.stamina < 1e-8) { p.stamina = 0; p.exhausted = true; }
    } else p.stamina = Math.min(100, stamina + dt * 100 / RECOVERY_SECONDS);
    p.running = runTime > 0;
    const length = Math.hypot(x, y) || 1;
    p.x = Math.max(16, Math.min(WORLD_WIDTH - 16, p.x + x / length * distance));
    p.y = Math.max(16, Math.min(WORLD_HEIGHT - 16, p.y + y / length * distance));
  }
  updateChests(s, inputs, dt);
  if (s.players.length && s.players.every(inExit)) {
    s.escapeElapsed = Math.min(ESCAPE_SECONDS, (s.escapeElapsed || 0) + dt);
    if (s.escapeElapsed >= ESCAPE_SECONDS - 1e-9) {
      s.escapeElapsed = ESCAPE_SECONDS;
      s.phase = s.node === '新大阪' ? 'CLEAR' : 'MAP';
    }
  } else s.escapeElapsed = 0;
  s.tick++; advance(s);
}

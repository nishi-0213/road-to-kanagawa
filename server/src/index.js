import { createState, addPlayer, removePlayer, action, step, publicState } from '../../shared/game.js';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
      const room = env.ROOMS.get(env.ROOMS.idFromName(code));
      await room.fetch('https://room/init', { method: 'POST' });
      return Response.json({ code });
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-F0-9]{12})\/ws$/);
    if (match) return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
export class GameRoom {
  constructor(ctx) {
    this.ctx = ctx; this.state = createState(); this.clients = new Map(); this.inputs = new Map(); this.timer = null; this.initialized = false;
    ctx.blockConcurrencyWhile(async () => { this.initialized = await ctx.storage.get('initialized') === true; });
  }
  async fetch(request) {
    if (new URL(request.url).pathname === '/init' && request.method === 'POST') {
      this.initialized = true; await this.ctx.storage.put('initialized', true); return new Response('ok');
    }
    if (!this.initialized) return new Response('ルームが存在しません', { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 });
    if (this.state.phase !== 'LOBBY' || this.clients.size >= 4) return new Response('参加できません（満員または開始済み）', { status: 409 });
    const pair = new WebSocketPair(); const [client, socket] = Object.values(pair);
    socket.accept();
    const id = crypto.randomUUID();
    addPlayer(this.state, id, new URL(request.url).searchParams.get('name'));
    this.clients.set(id, { socket, lastMessage: 0, count: 0 });
    socket.send(JSON.stringify({ type: 'welcome', id }));
    socket.addEventListener('message', event => {
      try {
        const entry = this.clients.get(id); if (!entry) return;
        const now = Date.now(); if (now - entry.lastMessage > 1000) { entry.lastMessage = now; entry.count = 0; }
        if (++entry.count > 100 || typeof event.data !== 'string' || event.data.length > 2048) { socket.close(1008, 'Invalid input'); return; }
        const message = JSON.parse(event.data);
        if (!message || typeof message !== 'object') return;
        if (message.type === 'input') this.inputs.set(id, { left: message.left === true, right: message.right === true, up: message.up === true, down: message.down === true, sprint: message.sprint === true, interact: message.interact === true, at: now });
        else { action(this.state, id, message); this.broadcast(); }
      } catch { socket.close(1008, 'Invalid message'); }
    });
    const leave = () => { if (!this.clients.delete(id)) return; this.inputs.delete(id); removePlayer(this.state, id); this.broadcast(); if (!this.clients.size) { clearInterval(this.timer); this.timer = null; this.state = createState(); } };
    socket.addEventListener('close', leave); socket.addEventListener('error', leave);
    if (!this.timer) this.timer = setInterval(() => {
      if (this.state.phase !== 'BATTLE') return;
      for (const [key, input] of this.inputs) if (Date.now() - input.at > 300) this.inputs.delete(key);
      step(this.state, this.inputs); this.broadcast();
    }, 50);
    this.broadcast(); return new Response(null, { status: 101, webSocket: client });
  }
  broadcast() {
    const data = JSON.stringify({ type: 'state', state: publicState(this.state) });
    for (const { socket } of this.clients.values()) { try { socket.send(data); } catch {} }
  }
}

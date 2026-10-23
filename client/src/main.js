import Phaser from 'phaser';
import './style.css';
import { createState, addPlayer, action, step, EXIT, inExit, ESCAPE_SECONDS, CHEST_OPEN_SECONDS, ITEM_NAMES, nearestChest, WORLD_WIDTH, WORLD_HEIGHT } from '../../shared/game.js';

const palette = [0xf4c66b, 0x6ed5d1, 0xee8a92, 0xb9a1ff];
const form = { name: '旅人', code: new URL(location.href).searchParams.get('room') || '' };
let state = null, myId, socket, solo = false, roomCode = '', disconnected = false, connecting = false, message = '', ui;
// Native text composition/paste only; every visible field and label is drawn in Phaser.
const inputBridge = document.createElement('input');
inputBridge.className = 'input-bridge'; inputBridge.autocomplete = 'off'; inputBridge.tabIndex = -1;
document.body.append(inputBridge);
let editing = null;
inputBridge.addEventListener('input', () => { if (editing) form[editing] = inputBridge.value; ui?.refreshFields(); });
inputBridge.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { inputBridge.blur(); editing = null; ui?.refreshFields(); } });
inputBridge.addEventListener('blur', () => { editing = null; ui?.refreshFields(); });
function stopEditing() { inputBridge.blur(); editing = null; }
function notify(text) { message = text; ui?.refreshMessage(); }
function send(data) {
  if (solo) { action(state, myId, data); ui?.sync(); }
  else if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
}
function leave() {
  stopEditing();
  if (socket) { socket.onclose = null; socket.close(); socket = null; }
  state = null; disconnected = false; connecting = false; message = ''; ui?.sync(true);
}
function beginSolo() {
  stopEditing(); solo = true; roomCode = ''; myId = 'solo'; disconnected = false; message = '';
  state = createState(); addPlayer(state, myId, form.name); ui.sync();
}
async function createRoom() {
  if (connecting) return;
  stopEditing(); connecting = true; notify('ルームを作成しています…'); ui.refreshButtons();
  try {
    const response = await fetch('/api/rooms', { method: 'POST' });
    if (!response.ok) throw Error('ルームを作成できませんでした');
    connect((await response.json()).code);
  } catch(e) { connecting = false; notify(e.message); ui.refreshButtons(); }
}
function joinRoom() {
  if (connecting) return;
  stopEditing(); let code = form.code.trim();
  try { if (code.includes('://')) code = new URL(code).searchParams.get('room') || ''; } catch {}
  code = code.toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(code)) return notify('12文字のルームコード、または招待URLを入力してください');
  connecting = true; ui.refreshButtons(); connect(code);
}
function connect(code) {
  solo = false; roomCode = code; disconnected = false; notify('ルームに接続しています…');
  const url = new URL(`/api/rooms/${code}/ws`, location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('name', form.name);
  socket = new WebSocket(url);
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.type === 'welcome') myId = data.id;
    if (data.type === 'state') { state = data.state; connecting = false; message = ''; ui.sync(); }
  };
  socket.onerror = () => notify('接続できません。コード・満員・開始済みの状態を確認してください');
  socket.onclose = () => {
    connecting = false;
    if (state) { disconnected = true; ui.sync(); }
    else { notify('参加できません。コード・満員・開始済みの状態を確認してください'); ui.refreshButtons(); }
  };
}
async function copyInvite() {
  const url = new URL(location.href); url.search = ''; url.searchParams.set('room', roomCode);
  try { await navigator.clipboard.writeText(url.href); notify('招待URLをコピーしました'); }
  catch { notify(`招待URL：${url.href}`); }
}

class GameUI extends Phaser.Scene {
  create() {
    ui = this; this.phase = null; this.buttons = []; this.fieldLabels = {}; this.dots = new Map();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E');
    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.setAttribute('role', 'application');
    this.input.keyboard.on('keydown-ENTER', () => { if (this.phase === 'MAP' && !editing) this.chooseDestination(); });
    this.game.events.on('blur', () => { this.input.keyboard.resetKeys(); if (!solo) send({ type: 'input' }); });
    this.events.once('shutdown', () => { ui = null; });
    this.time.addEvent({ delay: 50, loop: true, callback: () => {
      if (!solo && !disconnected && state?.phase === 'BATTLE') send({ type: 'input', ...this.readInput() });
    } });
    this.sync(true);
  }
  text(x, y, text, size = 20, color = '#eee9d7', extra = {}) {
    return this.add.text(x, y, text, { fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, color, ...extra });
  }
  button(x, y, width, label, callback, enabled = () => true) {
    const container = this.add.container(x, y);
    const box = this.add.rectangle(0, 0, width, 46, 0xd8b15e).setStrokeStyle(1, 0xf0ce8a);
    const text = this.text(0, 0, label, 17, '#182329').setOrigin(.5);
    container.add([box, text]); box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => { if (enabled()) { stopEditing(); this.game.canvas.focus(); callback(); } });
    box.on('pointerover', () => { if (enabled()) box.setFillStyle(0xf0ce8a); });
    box.on('pointerout', () => box.setFillStyle(0xd8b15e));
    this.buttons.push({ container, box, enabled, text }); this.refreshButtons();
    return { container, box, text };
  }
  refreshButtons() { for (const b of this.buttons) { const enabled = b.enabled(); b.container.setAlpha(enabled ? 1 : .4); b.box.input.cursor = enabled ? 'pointer' : 'default'; } }
  field(x, y, width, key, label) {
    this.text(x, y - 33, label, 17, '#a7b9b9');
    const box = this.add.rectangle(x + width / 2, y + 20, width, 46, 0x22343b).setStrokeStyle(1, 0x657b7f).setInteractive({ useHandCursor: true });
    const value = this.text(x + 12, y + 20, '', 17).setOrigin(0, .5);
    this.fieldLabels[key] = { value, box, width };
    box.on('pointerdown', () => {
      if (connecting) return;
      editing = key; inputBridge.value = form[key]; inputBridge.maxLength = key === 'name' ? 20 : 250;
      inputBridge.setAttribute('aria-label', label); inputBridge.focus({ preventScroll: true }); this.refreshFields();
    }); this.refreshFields();
  }
  refreshFields() {
    for (const [key, field] of Object.entries(this.fieldLabels)) {
      let value = form[key] || (key === 'code' ? 'ルームコード または 招待URL' : '旅人');
      const max = Math.floor(field.width / 17); if (value.length > max) value = '…' + value.slice(-max);
      field.value.setText(value + (editing === key ? ' ▏' : ''));
      field.box.setStrokeStyle(editing === key ? 2 : 1, editing === key ? 0xf0c66b : 0x657b7f);
    }
  }
  refreshMessage() { if (this.messageLabel?.active) this.messageLabel.setText(message); }
  readInput() {
    if (editing || this.phase !== 'BATTLE') return {};
    const k = this.keys;
    return { left: k.A.isDown || k.LEFT.isDown, right: k.D.isDown || k.RIGHT.isDown, up: k.W.isDown || k.UP.isDown, down: k.S.isDown || k.DOWN.isDown, sprint: k.SHIFT.isDown, interact: k.E.isDown };
  }
  sync(force = false) {
    const phase = disconnected ? 'DISCONNECTED' : state?.phase || 'TITLE';
    if (this.phase !== phase || force) {
      stopEditing(); this.input.keyboard.resetKeys(); this.children.removeAll(true);
      this.buttons = []; this.fieldLabels = {}; this.dots = new Map(); this.phase = phase;
      this.input.keyboard.removeCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);
      if (phase === 'BATTLE') this.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);
      this.add.rectangle(512, 424, 1024, 848, 0x101f26);
      this.text(35, 20, 'ROAD TO KANAGAWA', 29, '#f0c66b');
      this.statusLabel = this.text(35, 62, '', 15, '#a7b9b9');
      this.messageLabel = this.text(35, 815, message, 12, '#f6b295', { wordWrap: { width: 930 } });
      if (phase !== 'TITLE' && !solo) this.button(905, 44, 140, '退出', leave);
      if (phase === 'TITLE') this.titleScreen();
      else if (phase === 'LOBBY') this.lobbyScreen();
      else if (phase === 'BATTLE') this.battleScreen();
      else if (phase === 'MAP') this.mapScreen();
      else if (phase === 'DESIGN') this.designScreen();
      else if (phase === 'CLEAR') { this.text(500, 290, 'クリア！', 58, '#a5ffc5').setOrigin(.5); this.text(500, 385, '全員で新大阪から脱出しました。', 25).setOrigin(.5); }
      else { this.text(500, 270, '接続が切れました', 34, '#ffad9e').setOrigin(.5); this.text(500, 355, 'タイトルへ戻って再参加してください。\n開始済みのゲームへの再接続は未対応です。', 21, '#eee9d7', { align: 'center' }).setOrigin(.5); }
      this.game.canvas.setAttribute('aria-label', `Road to Kanagawa：${phase}`);
    }
    this.statusLabel.setText(state ? `${solo ? 'オフライン' : `ONLINE · ${roomCode}`} ｜ ${state.node} ｜ ${state.players.length}/4人` : 'PCブラウザ専用 · 1〜4人協力サバイバル');
    if (this.phase === 'LOBBY' || this.phase === 'DESIGN') this.refreshPlayers();
    this.refreshButtons(); this.refreshMessage();
  }
  titleScreen() {
    this.text(500, 145, '関西から横浜へ。仲間と生き抜く旅。', 24).setOrigin(.5);
    this.field(180, 245, 640, 'name', 'プレイヤー名（クリックして入力）');
    this.button(330, 360, 290, '1人で遊ぶ（オフライン）', beginSolo, () => !connecting);
    this.button(670, 360, 290, '協力ルームを作成', createRoom, () => !connecting);
    this.text(500, 420, '1人プレイは通信不要。協力プレイはルームコードで参加。', 17, '#a7b9b9').setOrigin(.5);
    this.field(180, 510, 640, 'code', 'ルームコード または 招待URL');
    this.button(365, 620, 260, 'ルームに参加', joinRoom, () => !connecting);
    this.button(665, 620, 260, 'コード・URLを貼り付け', async () => {
      try { form.code = (await navigator.clipboard.readText()).slice(0, 250); this.refreshFields(); }
      catch { notify('コード欄をクリックし、Ctrl+Vで貼り付けてください'); }
    }, () => !connecting);
    this.text(500, 700, 'WASD / 矢印：移動　　Shift：走る', 19, '#a7b9b9').setOrigin(.5);
  }
  lobbyScreen() {
    this.text(500, 145, '待機ロビー', 34, '#f0c66b').setOrigin(.5);
    this.text(500, 215, solo ? '1人プレイ · WebSocket未使用' : `ルームコード： ${roomCode}`, 24).setOrigin(.5);
    if (!solo) this.button(500, 285, 260, '招待URLをコピー', copyInvite);
    this.playerLabels = Array.from({ length: 4 }, (_, i) => this.text(250, 355 + i * 52, '', 21));
    this.lobbyHelp = this.text(500, 605, '', 19, '#a7b9b9').setOrigin(.5);
    this.button(500, 675, 280, 'ゲーム開始', () => send({ type: 'start' }), () => state.host === myId);
  }
  designScreen() {
    this.text(500, 150, '設計・移動準備', 34, '#f0c66b').setOrigin(.5);
    this.text(500, 225, '次の目的地：新大阪', 25).setOrigin(.5);
    this.text(500, 280, '設計機能は今後追加します。全員の準備完了で出発。', 18, '#a7b9b9').setOrigin(.5);
    this.playerLabels = Array.from({ length: 4 }, (_, i) => this.text(230, 355 + i * 52, '', 21));
    this.readyButton = this.button(500, 650, 320, '準備完了', () => send({ type: 'ready', ready: !state.players.find(p => p.id === myId)?.ready }));
  }
  refreshPlayers() {
    this.playerLabels.forEach((label, i) => {
      const p = state.players[i]; label.setText(p ? `${p.name}${p.id === myId ? '（あなた）' : ''}${p.id === state.host ? ' [ホスト]' : ''}${this.phase === 'DESIGN' ? p.ready ? '  ✓ 準備完了' : '  準備中' : ''}` : '— 空き —');
      label.setColor(p ? '#eee9d7' : '#617b80');
    });
    if (this.phase === 'LOBBY') this.lobbyHelp.setText(state.host === myId ? '全員が揃ったら開始。1人でも開始できます。' : 'ホストの開始を待っています。');
    if (this.readyButton && this.phase === 'DESIGN') this.readyButton.text.setText(state.players.find(p => p.id === myId)?.ready ? '準備完了を取り消す' : '準備完了');
  }
  chooseDestination() { if (!disconnected && this.phase === 'MAP' && state.host === myId) send({ type: 'select_destination', node: '新大阪' }); }
  mapScreen() {
    this.text(500, 140, '移動先の指定', 32, '#f0c66b').setOrigin(.5);
    this.text(500, 195, 'ノードにマウスを重ねて、ルート情報を確認', 19, '#a7b9b9').setOrigin(.5);
    this.add.rectangle(500, 385, 340, 4, 0xb7c6ba);
    const current = this.add.circle(330, 385, 26, 0x203e35).setStrokeStyle(4, 0x7ed8aa).setInteractive();
    this.add.circle(330, 385, 8, 0x7ed8aa);
    this.text(330, 325, '尼崎', 27).setOrigin(.5);
    this.text(330, 440, '現在地 · 脱出済み', 16, '#7ed8aa').setOrigin(.5);
    this.destinationHalo = this.add.circle(670, 385, 38, 0xf0c66b, .12);
    this.destination = this.add.circle(670, 385, 26, 0x28393a).setStrokeStyle(4, 0xf0c66b).setInteractive({ useHandCursor: true });
    this.text(670, 325, '新大阪', 27, '#f0c66b').setOrigin(.5);
    this.destinationNote = this.text(670, 440, '', 16, '#f0c66b').setOrigin(.5);
    this.mapHelp = this.text(500, 680, '', 20).setOrigin(.5);
    const panel = this.add.rectangle(500, 557, 700, 142, 0x22393d).setStrokeStyle(1, 0x718c85);
    const details = this.text(180, 502, '', 18, '#eee9d7', { lineSpacing: 8 });
    const tooltip = this.add.container(0, 0, [panel, details]).setDepth(30).setVisible(false);
    const show = (node) => {
      details.setText(node === '尼崎' ? '尼崎｜現在地\n必要物資：なし（現在地のため移動なし）\n特徴：旅の出発地点。平原と道路のステージ。脱出済み。' : '新大阪｜次の目的地\n必要物資：食料・燃料ともに未設定（現在は消費なし）\n特徴：平原と道路。今回の最終ノード。脱出するとクリア。');
      tooltip.setVisible(true);
    };
    for (const [node, name] of [[current, '尼崎'], [this.destination, '新大阪']]) {
      node.on('pointerover', () => { show(name); node.setFillStyle(0x50634a); });
      node.on('pointerout', () => { tooltip.setVisible(false); node.setFillStyle(name === '尼崎' ? 0x203e35 : 0x28393a); });
    }
    this.destination.on('pointerdown', () => this.chooseDestination());
  }
  battleScreen() {
    this.text(35, 100, 'WASD / 矢印：移動　Shift：走る　E長押し：チェスト', 15, '#a7b9b9');
    this.staminaText = this.text(720, 95, '', 15, '#a5ffc5');
    this.add.rectangle(645, 103, 120, 10, 0x20363b).setStrokeStyle(1, 0x54746a);
    this.staminaFill = this.add.rectangle(587, 103, 116, 6, 0x7ed8aa).setOrigin(0, .5);
    this.world = this.add.container(0, 128);
    const firstWorldChild = this.children.list.length;
      // A real 64px tile grid: 0 = plain, 1 = road. No background image.
      const tileSize = 64;
      const tiles = this.make.graphics({ x: 0, y: 0 }, false);
      tiles.fillStyle(0x304e37).fillRect(0, 0, tileSize, tileSize);
      tiles.lineStyle(1, 0x486548, .65).strokeRect(.5, .5, 63, 63);
      tiles.lineStyle(2, 0x6a8550, .65);
      for (const [x, y] of [[12, 16], [42, 10], [28, 43], [52, 50]]) {
        tiles.beginPath().moveTo(x - 3, y + 3).lineTo(x, y - 3).lineTo(x + 3, y + 2).strokePath();
      }
      tiles.fillStyle(0x485052).fillRect(64, 0, 64, 64);
      tiles.lineStyle(1, 0x657073, .6).strokeRect(64.5, .5, 63, 63);
      tiles.generateTexture('terrain', 128, 64); tiles.destroy();
      const data = Array.from({ length: WORLD_HEIGHT / tileSize }, (_, row) => Array.from({ length: WORLD_WIDTH / tileSize }, () => row >= 3 && row <= 5 ? 1 : 0));
      const map = this.make.tilemap({ data, tileWidth: tileSize, tileHeight: tileSize });
      const terrain = map.addTilesetImage('terrain', 'terrain', tileSize, tileSize, 0, 0);
      map.createLayer(0, terrain, 0, 0);
      for (let col = 0; col < WORLD_WIDTH / tileSize; col++) this.add.rectangle(col * tileSize + 32, 288, 30, 4, 0xd6c99c);
      const cx = EXIT.x + EXIT.width / 2, cy = EXIT.y + EXIT.height / 2;
      this.exitAura = [24, 16, 8].map(padding => this.add.rectangle(cx, cy, EXIT.width + padding * 2, EXIT.height + padding * 2, 0x50ff96, .08).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
      this.exitZone = this.add.rectangle(cx, cy, EXIT.width, EXIT.height, 0xb39b43, .6).setStrokeStyle(3, 0xffda77);
      this.exitLabel = this.add.text(EXIT.x + EXIT.width, EXIT.y - 60, '脱出地点', { fontSize: '17px', color: '#ffe4a0' }).setOrigin(1, 0);
      this.escapeBarBackground = this.add.rectangle(cx, EXIT.y - 30, 82, 10, 0x142b25).setStrokeStyle(1, 0xa5ffc5).setDepth(10).setVisible(false);
      this.escapeBarFill = this.add.rectangle(cx - 38, EXIT.y - 30, 76, 6, 0x50ff96).setOrigin(0, .5).setDepth(11).setVisible(false);
    this.world.add(this.children.list.slice(firstWorldChild));
    this.chestSprites = new Map();
    for (const c of state.chests) {
      const box = this.add.container(c.x, c.y);
      const body = this.add.rectangle(0, 4, 34, 25, 0x96683e).setStrokeStyle(2, 0xe7bf75);
      const lid = this.add.rectangle(0, -9, 36, 10, 0xc3914c).setStrokeStyle(2, 0xe7bf75);
      const lock = this.add.rectangle(0, 0, 6, 9, 0xf3d18a);
      const barBg = this.add.rectangle(0, -28, 44, 7, 0x142b25).setStrokeStyle(1, 0xa5ffc5).setVisible(false);
      const bar = this.add.rectangle(-20, -28, 40, 3, 0x7ed8aa).setOrigin(0, .5).setVisible(false);
      const label = this.text(0, -49, '', 13, '#ffe4a0').setOrigin(.5);
      box.add([body, lid, lock, barBg, bar, label]); this.world.add(box);
      this.chestSprites.set(c.id, { lid, lock, body, barBg, bar, label });
    }
    this.inventoryLabel = this.text(35, 784, '', 16, '#eee9d7');
    this.chestHint = this.text(512, 118, '', 12, '#ffe4a0').setOrigin(.5);
  }
  update(time, delta) {
    if (!state || disconnected) return;
    if (this.phase === 'MAP') {
      const canChoose = state.host === myId;
      this.destinationHalo.setAlpha(canChoose ? .1 + .08 * (Math.sin(time / 300) + 1) : .06);
      this.destination.input.cursor = canChoose ? 'pointer' : 'default';
      this.destinationNote.setText(canChoose ? 'クリックして移動' : '次の目的地');
      this.mapHelp.setText(canChoose ? '新大阪の○をクリック、またはEnterで指定' : 'ホストが移動先を指定しています');
      return;
    }
    if (this.phase !== 'BATTLE') return;
    if (solo) step(state, new Map([[myId, this.readInput()]]), Math.min(delta / 1000, .05));
    const arrived = state.players.filter(inExit).length;
    const pulse = (Math.sin(time / 180) + 1) / 2;
    this.exitZone.setFillStyle(arrived ? 0x36df7c : 0xb39b43, arrived ? .55 + pulse * .2 : .6).setStrokeStyle(3, arrived ? 0x9affbd : 0xffda77);
    this.exitAura.forEach((aura, index) => aura.setVisible(arrived > 0).setAlpha(.06 + index * .04 + pulse * .07).setScale(1 + pulse * .05));
    this.exitLabel.setColor(arrived ? '#a5ffc5' : '#ffe4a0');
    this.escapeBarBackground.setVisible(arrived > 0);
    this.escapeBarFill.setVisible(arrived > 0).setScale(Phaser.Math.Clamp((state.escapeElapsed || 0) / ESCAPE_SECONDS, 0, 1), 1);
    const ids = new Set(state.players.map(p => p.id));
    for (const [id, object] of this.dots) if (!ids.has(id)) { object.destroy(); this.dots.delete(id); }
    state.players.forEach((p, i) => {
      let object = this.dots.get(p.id);
      if (!object) {
        object = this.add.container(p.x, p.y);
        object.add(this.add.circle(0, 0, 15, palette[i]).setStrokeStyle(p.id === myId ? 3 : 1, 0xffffff));
        object.add(this.text(0, -35, p.name, 14).setOrigin(.5)); this.world.add(object); this.dots.set(p.id, object);
      }
      const blend = solo ? 1 : Math.min(1, delta / 65);
      object.x += (p.x - object.x) * blend; object.y += (p.y - object.y) * blend;
      object.setAlpha(inExit(p) ? .6 : 1);
    });
    const me = state.players.find(p => p.id === myId);
    const nearby = me ? nearestChest(state, me) : null;
    this.chestHint.setText(nearby ? 'Eを0.5秒長押しして開封（離す・範囲外でリセット）' : '全員が脱出地点に2秒集合すると次へ');
    for (const chest of state.chests) {
      const view = this.chestSprites.get(chest.id);
      if (!view) continue;
      view.lid.setY(chest.opened ? -20 : -9).setRotation(chest.opened ? -.3 : 0);
      view.lock.setVisible(!chest.opened); view.body.setFillStyle(chest.opened ? 0x504535 : 0x96683e);
      view.barBg.setVisible(!chest.opened && chest.progress > 0);
      view.bar.setVisible(!chest.opened && chest.progress > 0).setScale(chest.progress / CHEST_OPEN_SECONDS, 1);
      view.label.setText(chest.opened ? `${ITEM_NAMES[chest.loot.item]} +${chest.loot.quantity}` : nearby?.id === chest.id ? 'E：開ける' : '');
    }
    this.inventoryLabel.setText('共有物資： ' + Object.entries(ITEM_NAMES).map(([key, name]) => `${name} ${state.inventory[key]}`).join('   ｜   '));
    this.staminaFill.setScale((me?.stamina ?? 100) / 100, 1).setFillStyle(me?.exhausted ? 0xe4a06d : 0x7ed8aa);
    this.staminaText.setText(`スタミナ ${Math.round(me?.stamina ?? 100)}%${me?.exhausted ? ' · Shiftを離す' : me?.running ? ' · 走行中' : ''}`);
    if (state.phase !== this.phase) this.sync();
  }
}
new Phaser.Game({ type: Phaser.AUTO, width: WORLD_WIDTH, height: 848, parent: 'app', backgroundColor: '#101f26', scene: GameUI, audio: { noAudio: true } });

import Phaser from 'phaser';
import './style.css';
import {createBattle,stepBattle,TILE} from '../../shared/battle.js';
const form=document.querySelector('#login'),codeInput=document.querySelector('#code'),message=document.querySelector('#message');
let socket=null,connecting=false,gameScene=null,mode=null,room='',count=0,connectionTimer,phase='PREPARATION',players=[],selfId=null,battle=null;
function busy(value){connecting=value;form.querySelectorAll('button,input').forEach(el=>el.disabled=value);}
function report(text){message.textContent=text;}
function showLogin(text=''){mode=null;form.hidden=false;busy(false);report(text);gameScene?.refresh();}
function enter(nextMode){mode=nextMode;form.hidden=true;busy(false);report('');gameScene?.refresh();}
function leave(){clearTimeout(connectionTimer);const ws=socket;socket=null;ws?.close();showLogin();}
async function join(code){
 if(connecting)return;code=code.trim().toUpperCase();
 if(!/^[A-F0-9]{12}$/.test(code)){report('12文字のルームコードを入力してください。');return;}
 busy(true);report('接続中…');room=code;
 const url=new URL(`/api/rooms/${code}/ws`,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
 const ws=socket=new WebSocket(url);
 connectionTimer=setTimeout(()=>{if(socket===ws){socket=null;ws.close();showLogin('接続がタイムアウトしました。');}},10000);
 ws.onmessage=event=>{
  if(socket!==ws)return;
  try{const data=JSON.parse(event.data);if(data.type==='room'){
   const previous=phase,oldMap=battle?.id;clearTimeout(connectionTimer);count=data.count;phase=data.phase;players=data.players;selfId=data.selfId;battle=data.battle;
   if(mode!=='online'||previous!==phase||oldMap!==battle?.id)enter('online');
   else if(phase==='PREPARATION')gameScene?.refresh();
  }}catch{}
 };
 ws.onerror=()=>report('接続できません。ルームコード・満員・通信状態をご確認ください。');
 ws.onclose=()=>{if(socket!==ws)return;clearTimeout(connectionTimer);socket=null;showLogin('接続が終了しました。再度入室してください。');};
}
document.querySelector('#solo').onclick=()=>{if(!connecting){phase='PREPARATION';battle=null;selfId='solo';players=[{id:'solo',slot:1,ready:false}];enter('solo');}};
document.querySelector('#create').onclick=async()=>{
 if(connecting)return;busy(true);report('ルーム作成中…');
 try{const response=await fetch('/api/rooms',{method:'POST',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const data=await response.json();busy(false);await join(data.code);}catch{busy(false);report('ルームを作成できませんでした。');}
};
form.onsubmit=e=>{e.preventDefault();join(codeInput.value);};
const invited=new URL(location.href).searchParams.get('room');if(invited)codeInput.value=invited.toUpperCase();
const playerImages=import.meta.glob('../assets/player.png',{eager:true,query:'?url',import:'default'});
const STYLE={fontFamily:'sans-serif',fontSize:'16px',color:'#b8cbd7'};
class GameScene extends Phaser.Scene{
 preload(){const url=Object.values(playerImages)[0];if(url)this.load.image('player',url);}
 create(){
  gameScene=this;this.actors=new Map();this.lastSend=0;
  this.keys=this.input.keyboard.addKeys('W,A,S,D,SHIFT');
  this.game.events.on('blur',()=>{this.input.keyboard.resetKeys();if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'input'}));});
  // A neutral temporary 32px figure is used only until the original PNG is available.
  if(!this.textures.exists('player')){const g=this.make.graphics({x:0,y:0,add:false});g.fillStyle(0xeef5f7);g.fillCircle(16,9,6);g.fillRoundedRect(10,16,12,11,2);g.fillRect(9,26,5,5);g.fillRect(18,26,5,5);g.generateTexture('player',32,32);g.destroy();}
  const ground=this.make.graphics({x:0,y:0,add:false});ground.fillStyle(0x344a38);ground.fillRect(0,0,32,32);ground.lineStyle(1,0x3c5540);ground.strokeRect(.5,.5,31,31);ground.fillStyle(0x4a6348);ground.fillRect(5,7,2,2);ground.fillRect(22,24,3,1);ground.generateTexture('ground',32,32);ground.destroy();
  const zone=this.make.graphics({x:0,y:0,add:false});zone.fillStyle(0xffffff,.4);zone.fillRect(0,0,64,96);zone.lineStyle(2,0xffffff,1);zone.strokeRect(1,1,62,94);zone.generateTexture('exit-zone',64,96);zone.destroy();
  this.scale.on('resize',()=>this.refresh());this.refresh();
 }
 text(x,y,text,style={}){return this.add.text(x,y,text,{...STYLE,...style});}
 refresh(){
  this.lastSimulation=undefined;this.children.removeAll(true);this.actors.clear();this.exitGlow=null;this.progress=null;this.staminaBar=null;this.exitTint=null;
  const camera=this.cameras.main;camera.stopFollow();camera.setScroll(0,0);camera.removeBounds();camera.setZoom(1);
  if(!mode)return;
  if(phase==='BATTLE'&&battle)this.buildBattle();
  this.hud=this.add.container(0,0).setScrollFactor(0).setDepth(100);
  this.hud.add(this.add.rectangle(0,0,this.scale.width,118,0x101820,.88).setOrigin(0));
  this.hud.add(this.text(20,16,phase==='BATTLE'?'戦闘フェーズ':'準備フェーズ',{fontSize:'26px',color:'#eff7fa'}));
  this.hud.add(this.text(20,54,mode==='solo'?'1人プレイ':`ルームコード：${room}　${count}/4人`));
  const exit=this.text(this.scale.width-20,20,'退出').setOrigin(1,0).setInteractive({useHandCursor:true});exit.on('pointerdown',leave);this.hud.add(exit);
  if(mode==='online'){
   const copy=this.text(20,82,'招待URLをコピー',{fontSize:'14px'}).setInteractive({useHandCursor:true});
   copy.on('pointerdown',async()=>{const url=new URL(location.href);url.search='';url.searchParams.set('room',room);try{await navigator.clipboard.writeText(url.href);copy.setText('コピーしました');}catch{copy.setText('ルームコード：'+room);}});this.hud.add(copy);
  }
  if(phase==='BATTLE'){
   this.hud.add(this.text(260,25,'WASD：移動 / Shift：ダッシュ',{fontSize:'14px'}));
   this.hud.add(this.text(260,54,'スタミナ',{fontSize:'14px'}));
   this.hud.add(this.add.rectangle(340,54,164,14,0x15202a).setOrigin(0).setStrokeStyle(1,0x66807b));
   this.staminaBar=this.add.rectangle(342,56,160,10,0x88ddbb).setOrigin(0);this.hud.add(this.staminaBar);
   this.hud.add(this.text(260,84,'右上の脱出ゾーンへ全員で集合（3秒）',{fontSize:'14px'}));
  }else this.preparation();
 }
 preparation(){
  const width=Math.min(230,this.scale.width-40),x=this.scale.width-20-width/2;
  const gap=Math.min(70,Math.max(52,(this.scale.height-145)/Math.max(1,players.length)));
  players.forEach((player,index)=>{
   const mine=player.id===selfId,y=145+index*gap;
   const background=this.add.rectangle(x,y,width,50,player.ready?0x245d50:mine?0x28465c:0x1b2c39).setStrokeStyle(1,mine?0x80d5ee:0x405461);
   this.hud.add(background);this.hud.add(this.text(x,y,`プレイヤー${player.slot}${mine?'（あなた）':''}\n${player.ready?'準備完了 ✓':'準備完了'}`,{align:'center',color:mine?'#eff7fa':'#8da2b1'}).setOrigin(.5));
   if(mine){background.setInteractive({useHandCursor:true});background.on('pointerdown',()=>{
    if(mode==='solo'){battle=createBattle(players);phase='BATTLE';this.refresh();}
    else if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ready',ready:!player.ready}));
   });}
  });
 }
 buildBattle(){
  const w=battle.cols*TILE,h=battle.rows*TILE;
  this.add.tileSprite(0,0,w,h,'ground').setOrigin(0);
  const e=battle.exit;
  this.exitTint=this.add.image(e.x+e.width/2,e.y+e.height/2,'exit-zone').setTint(0xffd84a);
  // Phaser's built-in Glow FX (WebGL); the filled zone remains visible on Canvas.
  if(this.exitTint.preFX){this.exitTint.preFX.setPadding(20);this.exitGlow=this.exitTint.preFX.addGlow(0xffd84a,4,1,false,.1,12);}
  this.exitLabel=this.text(e.x+e.width/2,12,'脱出',{fontSize:'13px',color:'#ffffff'}).setOrigin(.5,0).setDepth(2);
  this.progressBack=this.add.rectangle(e.x+e.width/2,-12,e.width-8,5,0x101820).setOrigin(.5,0).setDepth(5).setVisible(false);
  this.progress=this.add.rectangle(e.x+4,-11,e.width-10,3,0x8bd7ff).setOrigin(0).setDepth(6).setVisible(false);
  for(const p of players){
   const sprite=this.add.image(p.x,p.y,'player').setDisplaySize(32,32).setDepth(3);
   const label=this.text(p.x,p.y-25,`P${p.slot}${p.id===selfId?' ●':''}`,{fontSize:'12px',color:p.id===selfId?'#fff4ad':'#ffffff'}).setOrigin(.5).setDepth(4);
   this.actors.set(p.id,{sprite,label});
  }
  const me=this.actors.get(selfId)?.sprite;
  if(me){this.cameras.main.removeBounds();this.cameras.main.centerOn(me.x,me.y);this.cameras.main.startFollow(me,false,1,1,0,0);}
 }
 update(time,delta){
  if(!mode||phase!=='BATTLE'||!battle)return;
  const k=this.keys,input={left:k.A.isDown,right:k.D.isDown,up:k.W.isDown,down:k.S.isDown,sprint:k.SHIFT.isDown};
  if(mode==='solo'){
   const now=performance.now();let remaining=Math.min(1,(now-(this.lastSimulation??now))/1000);this.lastSimulation=now;
   while(remaining>0){const dt=Math.min(.05,remaining);remaining-=dt;if(stepBattle(battle,players,new Map([[selfId,input]]),dt)){phase='PREPARATION';battle=null;players.forEach(p=>p.ready=false);this.refresh();return;}}
  }else if(time-this.lastSend>=50){this.lastSend=time;if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'input',...input}));}
  const ids=new Set(players.map(p=>p.id));for(const [id,a] of this.actors)if(!ids.has(id)){a.sprite.destroy();a.label.destroy();this.actors.delete(id);}
  for(const p of players){const a=this.actors.get(p.id);if(!a)continue;const blend=mode==='solo'?1:1-Math.exp(-delta/45);a.sprite.x+=(p.x-a.sprite.x)*blend;a.sprite.y+=(p.y-a.sprite.y)*blend;a.label.setPosition(a.sprite.x,a.sprite.y-25);}
  const me=players.find(p=>p.id===selfId);if(me&&this.staminaBar){this.staminaBar.scaleX=me.stamina;this.staminaBar.setFillStyle(me.exhausted?0xe6a46c:0x88ddbb);}
  const all=battle.inside===players.length&&players.length>0,color=all?0x51baff:battle.inside>0?0xbaff45:0xffd84a;
  this.exitTint?.setTint(color);
  if(this.exitGlow){this.exitGlow.color=color;this.exitGlow.outerStrength=4+Math.sin(time/240)*.7;}
  this.progressBack?.setVisible(all);this.progress?.setVisible(all).setScale(battle.escape/3,1);
 }
}
export const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',backgroundColor:'#101820',pixelArt:true,scene:GameScene,scale:{mode:Phaser.Scale.RESIZE,width:window.innerWidth,height:window.innerHeight},audio:{noAudio:true}});

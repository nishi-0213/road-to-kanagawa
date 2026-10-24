import {getPlayerStats} from '../../shared/personality.js';
import {drawPlayerEditor,updatePlayerEditor,clearPlayerEditor} from './player-editor-ui.js';
import {editPlayer} from '../../shared/player-editor.js';
import {createSkinMask,createAppearanceLayers,updateAppearanceLayers} from './player-appearance.js';
import {HAIRSTYLES} from '../../shared/appearance.js';
import {createOutfit,updateOutfit,createHeldItem,updateHeldItem} from './player-outfit.js';
import {cycleItem,renderCombatEffects,updateCombatHud,updateCombatAim} from './combat-ui.js';
import {availableItems} from '../../shared/combat.js';
import {drawPreparationInventory,installPreparationDrag} from './preparation-ui.js';
import {ensureInventory,createPreparation,finishBattleInventory,discardUnclaimed,movePreparationItem} from '../../shared/preparation.js';
import {createRoute,nextNodes,selectNode,finishBattle,nodeInfo,CITIES,ringCount,canStartBattle,startBattle} from '../../shared/route.js';
import {ITEMS,nearestBox} from '../../shared/items.js';
import Phaser from 'phaser';
import './style.css';
import {createBattle,stepBattle,TILE} from '../../shared/battle.js';
import {BIOME_NAMES} from '../../shared/terrain.js';
const form=document.querySelector('#login'),codeInput=document.querySelector('#code'),message=document.querySelector('#message');
let resumeToken=null,reconnectAttempts=0,reconnectTimer=null,heartbeat=null,lastReceived=0,connectionStatus='';
function setConnectionStatus(text){connectionStatus=text;if(gameScene?.connectionNotice?.active)gameScene.connectionNotice.setText(text).setVisible(Boolean(text));}
let socket=null,connecting=false,gameScene=null,mode=null,room='',count=0,connectionTimer,phase='PREPARATION',players=[],selfId=null,battle=null,route=null,preparation=createPreparation();
function busy(value){connecting=value;form.querySelectorAll('button,input').forEach(el=>el.disabled=value);}
function report(text){message.textContent=text;}
function showLogin(text=''){mode=null;form.hidden=false;busy(false);report(text);gameScene?.refresh();}
function enter(nextMode){mode=nextMode;form.hidden=true;busy(false);report('');gameScene?.refresh();}
async function join(code,resuming=false){
 if(connecting&&!resuming)return;
 if(!resuming){resumeToken=null;reconnectAttempts=0;clearTimeout(reconnectTimer);setConnectionStatus('');}code=code.trim().toUpperCase();
 if(!/^[A-F0-9]{12}$/.test(code)){report('12文字のルームコードを入力してください。');return;}
 busy(true);report('接続中…');room=code;
 const url=new URL(`/api/rooms/${code}/ws`,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';if(resuming&&resumeToken)url.searchParams.set('resume',resumeToken);
 const ws=socket=new WebSocket(url);
 connectionTimer=setTimeout(()=>{if(socket===ws)ws.close(4000,'Connection timeout');},10000);
 ws.onopen=()=>{lastReceived=Date.now();clearInterval(heartbeat);heartbeat=setInterval(()=>{if(socket!==ws||ws.readyState!==WebSocket.OPEN)return;if(Date.now()-lastReceived>25000)ws.close(4000,'Heartbeat timeout');else ws.send('ping');},10000);};
 ws.onmessage=event=>{
  if(socket!==ws)return;lastReceived=Date.now();if(event.data==='pong')return;
  try{const data=JSON.parse(event.data);if(data.type==='room'){
   const previous=phase,oldMap=battle?.id;clearTimeout(connectionTimer);resumeToken=data.selfResumeToken||resumeToken;if(connecting)busy(false);reconnectAttempts=0;setConnectionStatus('');count=data.count;phase=data.phase;players=data.players;selfId=data.selfId;battle=data.battle;route=data.route;preparation=data.preparation||createPreparation();
   if(mode!=='online'||previous!==phase||oldMap!==battle?.id)enter('online');
   else if(phase==='EDITOR'){if(gameScene?.editorView?.ids===players.map(p=>p.id).join(','))updatePlayerEditor(gameScene,players,selfId);else gameScene?.refresh();}
   else if(phase==='PREPARATION'){if(gameScene?.dragging)gameScene.refreshAfterDrag=true;else gameScene?.refresh();}
  }}catch{}
 };
 ws.onerror=()=>{if(!resumeToken)report('接続できません。ルームコード・満員・通信状態をご確認ください。');};
 ws.onclose=event=>{
  if(socket!==ws)return;clearTimeout(connectionTimer);clearInterval(heartbeat);socket=null;
  if(resumeToken&&event.code!==1008&&reconnectAttempts<6){reconnectAttempts++;busy(true);setConnectionStatus(`通信が途切れました。再接続中… ${reconnectAttempts}/6`);reconnectTimer=setTimeout(()=>join(room,true),Math.min(6000,1000*2**(reconnectAttempts-1)));return;}
  setConnectionStatus('');resumeToken=null;showLogin(`接続が終了しました（コード ${event.code}${event.reason?'：'+event.reason:''}）。再度入室してください。`);
 };
}
document.querySelector('#solo').onclick=()=>{if(!connecting){phase='EDITOR';battle=null;route=createRoute();selfId='solo';preparation=createPreparation();players=[ensureInventory({id:'solo',slot:1,ready:false})];enter('solo');}};
document.querySelector('#create').onclick=async()=>{
 if(connecting)return;busy(true);report('ルーム作成中…');
 try{const response=await fetch('/api/rooms',{method:'POST',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const data=await response.json();busy(false);await join(data.code);}catch{busy(false);report('ルームを作成できませんでした。');}
};
form.onsubmit=e=>{e.preventDefault();join(codeInput.value);};
const invited=new URL(location.href).searchParams.get('room');if(invited)codeInput.value=invited.toUpperCase();
const treeImages=import.meta.glob('../assets/**/*.{png,PNG}',{eager:true,query:'?url',import:'default'});
const treeImage=Object.entries(treeImages).find(([name])=>/\/tree\.png$/i.test(name))?.[1];
const playerImages=import.meta.glob('../assets/player.png',{eager:true,query:'?url',import:'default'});
const STYLE={fontFamily:'sans-serif',fontSize:'16px',color:'#b8cbd7'};
class GameScene extends Phaser.Scene{
 preload(){const url=Object.values(playerImages)[0];if(url)this.load.image('player',url);if(treeImage)this.load.image('tree',treeImage);for(const key of ['box','stone',...ITEMS.map(i=>i.id),...HAIRSTYLES.filter(Boolean)]){const file=Object.entries(treeImages).find(([name])=>name.split('/').pop().toLowerCase()===key+'.png')?.[1];if(file)this.load.image(key,file);}}
 create(){
  gameScene=this;this.actors=new Map();this.lastSend=0;this.lootMapId=null;this.shownLoot=new Set();
  this.installInventoryDrag();
  this.keys=this.input.keyboard.addKeys('W,A,S,D,SHIFT,E');
  this.input.on('wheel',(_pointer,_objects,_dx,dy)=>{if(phase==='BATTLE'&&dy)this.selectedItem=cycleItem(this.selectedItem,players.find(p=>p.id===selfId),Math.sign(dy));});
  this.game.canvas.addEventListener('wheel',event=>event.preventDefault(),{passive:false});
  this.game.canvas.addEventListener('contextmenu',event=>event.preventDefault());
  for(const eventName of ['mousedown','mouseup'])this.game.canvas.addEventListener(eventName,event=>{if(phase!=='BATTLE'&&event.button===2){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  this.game.events.on('blur',()=>{this.input.keyboard.resetKeys();this.input.activePointer.reset();if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'input'}));});
  // A neutral temporary 32px figure is used only until the original PNG is available.
  if(!this.textures.exists('player')){const g=this.make.graphics({x:0,y:0,add:false});g.fillStyle(0xeef5f7);g.fillCircle(16,9,6);g.fillRoundedRect(10,16,12,11,2);g.fillRect(9,26,5,5);g.fillRect(18,26,5,5);g.generateTexture('player',32,32);g.destroy();}
  createSkinMask(this);
  const ground=this.make.graphics({x:0,y:0,add:false});ground.fillStyle(0x344a38);ground.fillRect(0,0,32,32);ground.lineStyle(1,0x3c5540);ground.strokeRect(.5,.5,31,31);ground.fillStyle(0x4a6348);ground.fillRect(5,7,2,2);ground.fillRect(22,24,3,1);ground.generateTexture('ground',32,32);ground.destroy();
  if(!this.textures.exists('tree')){const tree=this.make.graphics({x:0,y:0,add:false});tree.fillStyle(0x74563a);tree.fillRect(13,24,6,8);tree.fillStyle(0x1f432f);tree.fillCircle(16,14,13);tree.fillStyle(0x366444);tree.fillCircle(12,10,9);tree.generateTexture('tree',32,32);tree.destroy();}
  const zone=this.make.graphics({x:0,y:0,add:false});zone.fillStyle(0xffffff,.4);zone.fillRect(0,0,64,96);zone.lineStyle(2,0xffffff,1);zone.strokeRect(1,1,62,94);zone.generateTexture('exit-zone',64,96);zone.destroy();
  this.scale.on('resize',()=>this.refresh());this.refresh();
 }
 installInventoryDrag(){
  installPreparationDrag(this,{isPreparation:()=>phase==='PREPARATION',onMove:action=>{
   if(mode==='solo'){movePreparationItem(preparation,players,selfId,action);this.refresh();}
   else if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(action));
  },onRefresh:()=>this.refresh()});
 }
 text(x,y,text,style={}){return this.add.text(x,y,text,{...STYLE,...style});}
 refresh(){
  clearPlayerEditor(this);if(phase==='BATTLE')this.input.keyboard.enableGlobalCapture();else this.input.keyboard.disableGlobalCapture();
  this.dragging=false;this.pendingDrop=null;
  for(const object of this.children.list)if(object.name==='loot-popup'||object.name==='combat-effect')this.tweens.killTweensOf(object);
  this.scopeMark=null;this.input.setDefaultCursor('default');this.lastSimulation=undefined;this.children.removeAll(true);this.actors.clear();this.boxSprites=new Map();this.boxProgress=new Map();this.inventoryCounts=new Map();this.inventorySelections=new Map();this.exitGlow=null;this.progress=null;this.staminaBar=null;this.exitTint=null;
  const camera=this.cameras.main;camera.stopFollow();camera.setScroll(0,0);camera.removeBounds();camera.setZoom(1);
  if(!mode)return;
  if(phase==='BATTLE'&&battle)this.buildBattle();
  this.hud=this.add.container(0,0).setScrollFactor(0).setDepth(100000);
  this.hud.add(this.add.rectangle(0,0,this.scale.width,118,0x101820,.88).setOrigin(0));
  this.hud.add(this.text(20,16,phase==='EDITOR'?'プレイヤーエディター':phase==='BATTLE'?'戦闘フェーズ':'準備フェーズ',{fontSize:'26px',color:'#eff7fa'}));
  this.hud.add(this.text(20,54,mode==='solo'?'1人プレイ':`ルームコード：${room}　${count}/4人`));
  if(mode==='online'){
   const copy=this.text(20,82,'招待URLをコピー',{fontSize:'14px'}).setInteractive({useHandCursor:true});
   copy.on('pointerdown',async pointer=>{if(pointer.button!==0)return;const url=new URL(location.href);url.search='';url.searchParams.set('room',room);try{await navigator.clipboard.writeText(url.href);copy.setText('コピーしました');}catch{copy.setText('ルームコード：'+room);}});this.hud.add(copy);
  }
  if(phase==='EDITOR'){
   drawPlayerEditor(this,players,selfId,patch=>{if(mode==='solo'){const player=players.find(p=>p.id===selfId);if(editPlayer(player,patch))updatePlayerEditor(this,players,selfId);}else if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'edit_player',patch}));},()=>{if(phase!=='EDITOR')return;if(mode==='solo'){phase='PREPARATION';players.forEach(p=>{p.ready=false;p.personalityEffectsActive=true;});this.refresh();}else if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ready',ready:!players.find(p=>p.id===selfId).ready}));});
  }else if(phase==='BATTLE'){
   this.hud.add(this.text(260,25,`${battle.city||''}　${BIOME_NAMES[battle.biome]||'森林地帯'}　WASD：移動 / Shift：ダッシュ`,{fontSize:'14px'}));
   this.hud.add(this.text(260,54,'スタミナ',{fontSize:'14px'}));
   this.hud.add(this.add.rectangle(340,54,164,14,0x15202a).setOrigin(0).setStrokeStyle(1,0x66807b));
   this.hud.add(this.text(530,51,'HP',{fontSize:'14px'}));
   this.hud.add(this.add.rectangle(570,54,164,14,0x15202a).setOrigin(0).setStrokeStyle(1,0x88676c));
   this.hpBar=this.add.rectangle(572,56,160,10,0xe17e88).setOrigin(0);this.hud.add(this.hpBar);
   this.hpText=this.text(744,51,'HP 100/100',{fontSize:'14px'});this.hud.add(this.hpText);
   this.defenseText=this.text(530,84,'防御力 0',{fontSize:'14px',color:'#bed5f3'});this.hud.add(this.defenseText);
   this.equippedText=this.text(260,104,'',{fontSize:'13px',color:'#ffe7a5'});this.hud.add(this.equippedText);
   const hx=this.scale.width/2,hy=this.scale.height-70;
   this.healBack=this.add.rectangle(hx,hy,164,8,0x15202a).setVisible(false);this.hud.add(this.healBack);
   this.healBar=this.add.rectangle(hx-80,hy-2,160,4,0x89e6ac).setOrigin(0).setVisible(false);this.hud.add(this.healBar);
   this.healText=this.text(hx,hy-24,'',{fontSize:'14px',color:'#b3f3ce'}).setOrigin(.5).setVisible(false);this.hud.add(this.healText);
   this.staminaBar=this.add.rectangle(342,56,160,10,0x88ddbb).setOrigin(0);this.hud.add(this.staminaBar);
   this.hud.add(this.text(260,84,'右上の脱出ゾーンへ',{fontSize:'14px'}));
   this.buildInventory();
   this.boxHint=this.text(this.scale.width/2,this.scale.height-32,'',{fontSize:'16px',color:'#ffdf8b',backgroundColor:'#101820'}).setOrigin(.5);this.hud.add(this.boxHint);
  }else this.preparation();
  this.connectionNotice=this.text(this.scale.width/2,130,connectionStatus,{fontSize:'16px',color:'#ffdf8b',backgroundColor:'#101820'}).setOrigin(.5,0).setVisible(Boolean(connectionStatus));this.hud.add(this.connectionNotice);
 }
 buildInventory(){
  this.hud.add(this.add.rectangle(12,126,218,ITEMS.length*34+50,0x101820,.85).setOrigin(0));
  this.hud.add(this.text(24,134,'所持・今回取得アイテム',{fontSize:'16px',color:'#eff7fa'}));
  ITEMS.forEach((item,index)=>{const y=174+index*34;const selected=this.add.rectangle(20,y-15,202,30,0x48614a,.8).setOrigin(0).setStrokeStyle(1,0xd5e997).setVisible(false);this.hud.add(selected);this.inventorySelections.set(item.id,selected);this.hud.add(this.add.image(36,y,item.id).setDisplaySize(24,24));this.hud.add(this.text(58,y,item.name).setOrigin(0,.5));const count=this.text(206,y,'0',{color:'#eff7fa'}).setOrigin(1,.5);this.hud.add(count);this.inventoryCounts.set(item.id,count);});
 }
 preparation(){
  this.drawRoute();
  drawPreparationInventory(this,players,selfId,preparation);
  const startY=Math.max(145,this.scale.height/3+85),locked=!canStartBattle(route);
  const width=Math.min(230,this.scale.width-40),x=this.scale.width-20-width/2;
  const gap=Math.min(70,Math.max(52,(this.scale.height-startY)/Math.max(1,players.length)));
  players.forEach((player,index)=>{
   const mine=player.id===selfId,y=startY+index*gap;
   const background=this.add.rectangle(x,y,width,50,player.ready?0x245d50:mine?0x28465c:0x1b2c39).setStrokeStyle(1,mine?0x80d5ee:0x405461);
   this.hud.add(background);this.hud.add(this.text(x,y,`${player.name||`プレイヤー${player.slot}`}${mine?'（あなた）':''}\n${player.connected===false?'再接続を待っています':player.ready?'準備完了 ✓':'準備完了'}`,{align:'center',color:mine?'#eff7fa':'#8da2b1'}).setOrigin(.5));
   if(locked)background.setAlpha(.4);
   if(mine&&!locked){background.setScrollFactor(0).setInteractive({useHandCursor:true});background.on('pointerdown',pointer=>{if(pointer.button!==0||phase!=='PREPARATION'||!background.active||!canStartBattle(route)||!background.getBounds().contains(pointer.x,pointer.y))return;
    if(mode==='solo'){if(!startBattle(route))return;discardUnclaimed(preparation,players);battle=createBattle(players);battle.city=route.nodes[route.current].name;phase='BATTLE';this.refresh();}
    else if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ready',ready:!player.ready}));
   });}
  });
  if(this.routeTooltip)this.hud.bringToTop(this.routeTooltip);
 }
 drawRoute(){
  if(!route)return;
  const height=this.scale.height/3,top=Math.min(112,height*.45),width=this.scale.width;
  this.hud.add(this.add.rectangle(0,105,width,Math.max(0,height-105),0x182732,.85).setOrigin(0));
  const yCenter=(top+height-36)/2,amplitude=Math.max(12,(height-top-62)/2);
  const positions=route.nodes.map(n=>({x:32+n.stage*(width-64)/(CITIES.length-1),y:yCenter+n.lane*amplitude}));
  const allowed=nextNodes(route),lines=this.add.graphics();this.hud.add(lines);
  for(const edge of route.edges){const a=positions[edge.from],b=positions[edge.to],active=edge.from===route.current&&allowed.includes(edge.to);lines.lineStyle(active?2:1,active?0xdde990:0x65737d,active?1:.65);lines.lineBetween(a.x,a.y,b.x,b.y);}
  this.routeCircles=new Map();this.routeRings=new Map();
  const tooltip=this.add.container(0,0).setDepth(1).setVisible(false);this.routeTooltip=tooltip;
  tooltip.add(this.add.rectangle(0,0,236,110,0x101b25,.98).setOrigin(0).setStrokeStyle(1,0xb7a760));
  const tooltipText=this.text(12,10,'',{fontSize:'14px',lineSpacing:6,color:'#f2e9c5'});tooltip.add(tooltipText);
  for(const node of route.nodes){
   const p=positions[node.id],visited=route.visited.includes(node.id),base=visited?0xb9e56c:0xffe5a0;
   const count=ringCount(node.trait),rings=[];
   for(let ring=1;ring<count;ring++){const outline=this.add.circle(p.x,p.y,10+ring*4).setFillStyle(0,0).setStrokeStyle(1.5,base);rings.push(outline);this.hud.add(outline);}
   this.routeRings.set(node.id,rings);
   const circle=this.add.circle(p.x,p.y,10,base).setStrokeStyle(node.id===route.current?3:1,node.id===route.current?0xeafbc8:0x8e845f).setInteractive({hitArea:new Phaser.Geom.Circle(10,10,10+(count-1)*4),hitAreaCallback:Phaser.Geom.Circle.Contains,useHandCursor:allowed.includes(node.id)});
   this.hud.add(circle);this.routeCircles.set(node.id,circle);
   circle.on('pointerover',()=>{
    if(!visited){circle.setFillStyle(0xd7a923);rings.forEach(r=>r.setStrokeStyle(1.5,0xd7a923));}const info=nodeInfo(node,players.length);
    tooltipText.setText(`${info.name}\n特性：${info.trait}\n消費燃料：${info.fuel}　食料：${info.food}\n食料は1人あたり1つ`);
    tooltip.setPosition(Math.max(8,Math.min(width-244,p.x-118)),p.y+38).setVisible(true);
   });circle.on('pointerout',()=>{circle.setFillStyle(base);rings.forEach(r=>r.setStrokeStyle(1.5,base));tooltip.setVisible(false);});
   circle.on('pointerdown',pointer=>{if(pointer.button!==0)return;
    if(!allowed.includes(node.id))return;
    if(mode==='solo'){if(selectNode(route,node.id)){players.forEach(p=>p.ready=false);this.refresh();}}
    else if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'select_node',target:node.id}));
   });

  }
  for(let stage=0;stage<CITIES.length;stage++){
   const group=route.nodes.filter(n=>n.stage===stage),x=positions[group[0].id].x,y=Math.max(...group.map(n=>positions[n.id].y+10+(ringCount(n.trait)-1)*4))+7;
   const visited=group.some(n=>route.visited.includes(n.id)),name=CITIES[stage]==='神奈川ゴール'?'神奈川\nゴール':CITIES[stage];
   this.hud.add(this.text(x,y,name,{fontSize:`${Math.min(13,Math.max(10,(width-64)/CITIES.length/4))}px`,align:'center',color:visited?'#c9ee95':'#d9e0d8'}).setOrigin(.5,0));
  }
  this.hud.add(tooltip);
  const status=route.finished?'神奈川ゴールに到達しました！':route.canAdvance?'接続された右側のノードをクリックして進んでください。':'準備ができたら準備完了を押してください。脱出後に次のノードへ進めます。';
  this.hud.add(this.text(20,height+20,`現在地：${route.nodes[route.current].name}`,{fontSize:'20px',color:'#d6ec9f'}));
  this.hud.add(this.text(20,height+52,status,{fontSize:'14px'}));this.hud.bringToTop(tooltip);
 }
 showPickup(box){
  const player=players.find(p=>p.id===box.openedBy),actor=this.actors.get(box.openedBy)?.sprite,item=ITEMS.find(item=>item.id===box.loot?.item);
  if(!player||!item||!box.loot.quantity)return;
  const popup=this.text(actor?.x??player.x,(actor?.y??player.y)-26,`${item.name} +${box.loot.quantity}`,{fontSize:'12px',color:'#fff2b3',stroke:'#101820',strokeThickness:3}).setOrigin(.5,1).setDepth(20000).setName('loot-popup');
  this.tweens.add({targets:popup,y:popup.y-36,alpha:0,duration:1800,ease:'Sine.Out',onComplete:()=>popup.destroy()});
 }
 drawMapFade(w,h,tint){
  const name='map-fade';if(this.textures.exists(name))this.textures.remove(name);
  const extent=128,texture=this.textures.createCanvas(name,w+extent*2,h+extent*2),ctx=texture.context;
  const image=ctx.createImageData(texture.width,texture.height),data=image.data;
  const base=[0x34,0x4a,0x38],mult=[(tint>>>16&255)/255,(tint>>>8&255)/255,(tint&255)/255];
  for(let y=0;y<texture.height;y++)for(let x=0;x<texture.width;x++){
   const dx=Math.max(extent-x,0,x-(extent+w-1)),dy=Math.max(extent-y,0,y-(extent+h-1));
   const distance=Math.hypot(dx,dy);if(!distance||distance>=extent)continue;
   const t=1-distance/extent,alpha=t*t*(3-2*t),i=(y*texture.width+x)*4;
   data[i]=base[0]*mult[0];data[i+1]=base[1]*mult[1];data[i+2]=base[2]*mult[2];data[i+3]=Math.round(alpha*255);
  }
  ctx.putImageData(image,0,0);texture.refresh();this.add.image(-extent,-extent,name).setOrigin(0).setDepth(-1);
 }
 buildBattle(){
  if(this.lootMapId!==battle.id){this.lootMapId=battle.id;this.shownLoot=new Set((battle.boxes||[]).filter(box=>box.opened).map(box=>box.id));}
  const w=battle.cols*TILE,h=battle.rows*TILE;
  const tint=battle.biome==='urban'?0xa2a7a8:battle.biome==='highway'?0xb9bd97:0xffffff;
  this.drawMapFade(w,h,tint);
  this.add.tileSprite(0,0,w,h,'ground').setOrigin(0).setTint(tint);
  if(battle.biome==='highway'){
   const cx=Math.floor(battle.cols/2)*32;
   this.add.rectangle(cx,0,160,h,0x42484b).setOrigin(.5,0);
   for(let y=16;y<h;y+=64)this.add.rectangle(cx,y,4,28,0xe4d79b);
   this.add.rectangle(0,h-80,w,96,0x42484b).setOrigin(0,.5);
  }else if(battle.biome==='urban'){
   const streets=this.add.graphics().fillStyle(0x51585b);
   for(let x=96;x<w;x+=192)streets.fillRect(x,0,48,h);
   for(let y=96;y<h;y+=192)streets.fillRect(0,y,w,48);
  }
  for(const t of battle.trees||[]){const tree=this.add.image((t.col+.5)*32,(t.row+1)*32,'tree').setOrigin(.5,1);const ratio=tree.height/tree.width;tree.setDisplaySize(32,32*ratio).setDepth((t.row+1)*32);}

  for(const r of battle.rocks||[])this.add.image((r.col+.5)*32,(r.row+.5)*32,'stone').setDisplaySize(32,32).setDepth((r.row+1)*32);
  for(const box of battle.boxes||[]){const image=this.add.image(box.x,box.y,'box').setDisplaySize(32,32).setDepth(box.y+16);this.boxSprites.set(box.id,image);const back=this.add.rectangle(box.x,box.y-25,28,5,0x101820).setDepth(10000).setVisible(false),fill=this.add.rectangle(box.x-12,box.y-26,24,3,0xffd879).setOrigin(0).setDepth(10001).setVisible(false);this.boxProgress.set(box.id,{back,fill});}
  const e=battle.exit;
  this.exitTint=this.add.image(e.x+e.width/2,e.y+e.height/2,'exit-zone').setTint(0xffd84a);
  // Phaser's built-in Glow FX (WebGL); the filled zone remains visible on Canvas.
  if(this.exitTint.preFX){this.exitTint.preFX.setPadding(20);this.exitGlow=this.exitTint.preFX.addGlow(0xffd84a,4,1,false,.1,12);}
  this.exitLabel=this.text(e.x+e.width/2,12,'脱出',{fontSize:'13px',color:'#ffffff'}).setOrigin(.5,0).setDepth(2);
  this.progressBack=this.add.rectangle(e.x+e.width/2,-12,e.width-8,5,0x101820).setOrigin(.5,0).setDepth(5).setVisible(false);
  this.progress=this.add.rectangle(e.x+4,-11,e.width-10,3,0x8bd7ff).setOrigin(0).setDepth(6).setVisible(false);
  for(const p of players){
   const sprite=this.add.image(p.x,p.y,'player').setDisplaySize(32,32).setDepth(3);
   const label=this.text(p.x,p.y-25,`${p.name||`P${p.slot}`}${p.id===selfId?' ●':''}`,{fontSize:'12px',color:p.id===selfId?'#fff4ad':'#ffffff'}).setOrigin(.5).setDepth(4);
   const healBack=this.add.rectangle(p.x,p.y-30,28,5,0x101820).setDepth(10002).setVisible(false),healBar=this.add.rectangle(p.x-12,p.y-31,24,3,0x89e6ac).setOrigin(0).setDepth(10003).setVisible(false);
   const appearance=createAppearanceLayers(this,sprite);updateAppearanceLayers(sprite,appearance,p);
   const outfit=createOutfit(this,sprite);updateOutfit(sprite,outfit,p);
   const heldItem=createHeldItem(this,sprite);
   this.actors.set(p.id,{sprite,label,healBack,healBar,appearance,outfit,heldItem});
  }
  const me=this.actors.get(selfId)?.sprite;
  if(me){this.cameras.main.removeBounds();this.cameras.main.centerOn(me.x,me.y);this.cameras.main.startFollow(me,false,1,1,0,0);}
 }
 update(time,delta){
  if(!mode||phase!=='BATTLE'||!battle)return;
  const localPlayer=players.find(p=>p.id===selfId),usable=availableItems(localPlayer);if(!usable.includes(this.selectedItem))this.selectedItem=usable[0]||null;
  const pointer=this.input.activePointer,aim=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
  const k=this.keys,input={left:k.A.isDown,right:k.D.isDown,up:k.W.isDown,down:k.S.isDown,sprint:k.SHIFT.isDown,interact:k.E.isDown,use:pointer.leftButtonDown()&&document.hasFocus()&&!document.hidden,secondary:pointer.rightButtonDown()&&document.hasFocus()&&!document.hidden,selected:this.selectedItem,aimX:aim.x,aimY:aim.y};
  const meBefore=players.find(p=>p.id===selfId),nearby=meBefore?nearestBox(battle,meBefore):null;
  if(mode==='solo'){
   const now=performance.now();let remaining=Math.min(1,(now-(this.lastSimulation??now))/1000);this.lastSimulation=now;
   while(remaining>0){const dt=Math.min(.05,remaining);remaining-=dt;if(stepBattle(battle,players,new Map([[selfId,input]]),dt)){preparation=finishBattleInventory(battle,players);phase='PREPARATION';battle=null;finishBattle(route);players.forEach(p=>p.ready=false);this.refresh();return;}}
  }else if(time-this.lastSend>=50){this.lastSend=time;if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'input',...input}));}
  const ids=new Set(players.map(p=>p.id));for(const [id,a] of this.actors)if(!ids.has(id)){a.sprite.destroy();a.label.destroy();a.healBack.destroy();a.healBar.destroy();a.outfit.forEach(layer=>layer.destroy());a.heldItem.destroy();a.appearance.skin.destroy();a.appearance.hair.destroy();this.actors.delete(id);}
  for(const p of players){const a=this.actors.get(p.id);if(!a)continue;const blend=mode==='solo'?1:1-Math.exp(-delta/45);a.sprite.x+=(p.x-a.sprite.x)*blend;a.sprite.y+=(p.y-a.sprite.y)*blend;a.sprite.setDepth(a.sprite.y+16);updateAppearanceLayers(a.sprite,a.appearance,p);updateOutfit(a.sprite,a.outfit,p);if(p.id===selfId)updateHeldItem(a,p,this.selectedItem,Math.atan2(aim.y-p.y,aim.x-p.x));else updateHeldItem(a,p);a.label.setPosition(a.sprite.x,a.sprite.y-25).setDepth(a.sprite.y+17).setVisible(!p.lootBoxId&&!(p.healProgress>0));a.healBack.setPosition(a.sprite.x,a.sprite.y-30).setVisible(p.healProgress>0);a.healBar.setPosition(a.sprite.x-12,a.sprite.y-31).setScale((p.healProgress||0)/(p.healDuration||3),1).setVisible(p.healProgress>0);}
  renderCombatEffects(this,battle);
  const me=players.find(p=>p.id===selfId);updateCombatHud(this,me);updateCombatAim(this,me,input.secondary);if(me&&this.staminaBar){this.staminaBar.scaleX=me.stamina;this.staminaBar.setFillStyle(me.exhausted?0xe6a46c:0x88ddbb);}
  for(const box of battle.boxes||[]){
   if(box.opened&&!this.shownLoot.has(box.id)){this.shownLoot.add(box.id);this.showPickup(box);}
   const image=this.boxSprites.get(box.id);if(image)image.setAlpha(box.opened?.28:1).setTint(box.opened?0x7f8b8e:0xffffff);
   const progress=box.opened?0:Math.max(0,...players.filter(p=>p.lootBoxId===box.id).map(p=>p.lootProgress||0)),bar=this.boxProgress.get(box.id);
   if(bar){bar.back.setVisible(progress>0);bar.fill.setVisible(progress>0).setScale(progress,1);}
  }
  for(const item of ITEMS)this.inventoryCounts.get(item.id)?.setText(String((me?.inventory?.[item.id]||0)+(me?.battleLoot?.[item.id]||0)));
  const lootSeconds=getPlayerStats(me,battle,players).lootTime;
  const waiting=players.some(player=>player.connected===false);
  this.boxHint?.setText(waiting?'プレイヤーの再接続を待っています（最大30秒）':nearby?`E長押し（${Number(lootSeconds.toFixed(2))}秒）：アイテムボックスを開ける`:'');
  const all=battle.inside===players.length&&players.length>0&&!waiting,color=all?0x51baff:battle.inside>0?0xbaff45:0xffd84a;
  this.exitTint?.setTint(color);
  if(this.exitGlow){this.exitGlow.color=color;this.exitGlow.outerStrength=4+Math.sin(time/240)*.7;}
  this.progressBack?.setVisible(all);this.progress?.setVisible(all).setScale(battle.escape/3,1);
 }
}
export const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',backgroundColor:'#101820',pixelArt:true,scene:GameScene,scale:{mode:Phaser.Scale.RESIZE,width:window.innerWidth,height:window.innerHeight},audio:{noAudio:true}});

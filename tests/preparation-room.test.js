import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameRoom} from '../server/src/index.js';
import {createPreparation,ensureInventory} from '../shared/preparation.js';
import {createRoute} from '../shared/route.js';
const clone=value=>value===undefined?undefined:structuredClone(value);
class Socket{
 constructor(id,slot){this.readyState=1;this.player=ensureInventory({id,slot,ready:false});this.messages=[];}
 deserializeAttachment(){return clone(this.player);}
 serializeAttachment(value){this.player=clone(value);}
 send(raw){this.messages.push(JSON.parse(raw));}
}
test('room handler enforces concurrent single claim, own-slot permissions, preparation-only moves and leftovers deletion',async()=>{
 const a=new Socket('a',1),b=new Socket('b',2),prep=createPreparation();prep.loot[0]={id:'shared-knife',item:'knife',quantity:1};prep.loot[1]={id:'leftover-rifle',item:'rifle',quantity:1};
 prep.loot[2]={id:'shared-pants',item:'pants',quantity:1};prep.loot[3]={id:'shared-hat',item:'hat',quantity:1};
 const values=new Map([['initialized',true],['phase','PREPARATION'],['route',createRoute(()=>.4)],['preparation',prep]]),ctx={getWebSockets:()=>[a,b],storage:{get:async key=>clone(values.get(key)),put:async(key,value)=>{if(typeof key==='string')values.set(key,clone(value));else for(const [k,v] of Object.entries(key))values.set(k,clone(v));}},blockConcurrencyWhile(fn){this.ready=fn();},waitUntil(promise){this.pending=promise;}};
 const room=new GameRoom(ctx);await ctx.ready;
 const action={type:'move_item',from:{area:'loot',index:0},to:{area:'inventory',index:0},itemId:'shared-knife',targetItemId:null};
 try{
  await Promise.all([room.webSocketMessage(a,JSON.stringify(action)),room.webSocketMessage(b,JSON.stringify(action))]);assert.equal(a.player.inventory.knife+b.player.inventory.knife,1);assert.equal(room.preparation.loot[0],null);assert.equal(values.get('preparation').loot[0],null);
  const winner=a.player.inventory.knife?a:b,loser=winner===a?b:a;
  await room.webSocketMessage(loser,JSON.stringify({...action,from:{area:'inventory',index:0,playerId:winner.player.id},to:{area:'trash'},itemId:'shared-knife'}));assert.equal(winner.player.inventory.knife,1);
  assert.ok(winner.messages.at(-1).preparation.loot[1]);
  await room.webSocketMessage(a,JSON.stringify({type:'move_item',from:{area:'loot',index:2},to:{area:'inventory',index:1},itemId:'shared-pants',targetItemId:null,defense:999}));
  await room.webSocketMessage(b,JSON.stringify({type:'move_item',from:{area:'loot',index:3},to:{area:'inventory',index:1},itemId:'shared-hat',targetItemId:null}));
  await room.webSocketMessage(a,JSON.stringify({type:'move_item',from:{area:'inventory',index:1},to:{area:'equipment',index:2},itemId:'shared-pants',targetItemId:null}));
  await room.webSocketMessage(b,JSON.stringify({type:'move_item',from:{area:'inventory',index:1},to:{area:'equipment',index:0},itemId:'shared-hat',targetItemId:null}));
  assert.equal(a.player.equipmentSlots[2].item,'pants');assert.equal(b.messages.at(-1).players.find(p=>p.id==='a').equipmentSlots[2].item,'pants');
  await room.webSocketMessage(a,JSON.stringify({type:'move_item',from:{area:'equipment',index:2},to:{area:'equipment',index:0},itemId:'shared-pants',targetItemId:null}));assert.equal(a.player.equipmentSlots[2].item,'pants');assert.equal(a.player.equipmentSlots[0],null);
  assert.equal(a.player.defense,2);assert.equal(b.player.defense,1);assert.equal(b.messages.at(-1).players.find(p=>p.id==='a').defense,2);
  await room.webSocketMessage(a,JSON.stringify({type:'ready',ready:true}));await room.webSocketMessage(b,JSON.stringify({type:'ready',ready:true}));assert.equal(room.phase,'BATTLE');assert.deepEqual(room.route.battleStarted,[room.route.current]);assert.ok(room.preparation.loot.every(x=>!x));assert.equal(winner.player.inventory.knife,1);assert.equal(winner.player.inventorySlots[0].id,'shared-knife');
  await room.webSocketMessage(winner,JSON.stringify({type:'move_item',from:{area:'inventory',index:0},to:{area:'trash'},itemId:'shared-knife'}));assert.equal(winner.player.inventory.knife,1,'moves during battle are ignored');
  await room.webSocketMessage(a,JSON.stringify({type:'move_item',from:{area:'equipment',index:2},to:{area:'trash'},itemId:'shared-pants'}));assert.equal(a.player.equipmentSlots[2].item,'pants','cannot remove equipment during battle');
  room.stopTimer();room.phase='PREPARATION';a.player.ready=false;b.player.ready=false;
  await room.webSocketMessage(a,JSON.stringify({type:'ready',ready:true}));await room.webSocketMessage(b,JSON.stringify({type:'ready',ready:true}));
  assert.equal(room.phase,'PREPARATION','a used node cannot restart even if canAdvance is false');assert.equal(a.player.ready,false);
 }finally{room.stopTimer();}
});

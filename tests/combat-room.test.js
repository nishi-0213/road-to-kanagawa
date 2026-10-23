import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameRoom} from '../server/src/index.js';
import {createBattle} from '../shared/battle.js';
import {createRoute,startBattle} from '../shared/route.js';
import {ensureInventory} from '../shared/preparation.js';
test('room validates combat inputs and broadcasts authoritative effects, HP and medicine consumption to all players',async()=>{
 const clone=x=>structuredClone(x),socket=(id,inventory)=>({readyState:1,player:ensureInventory({id,slot:id==='a'?1:2,hp:20,inventory}),messages:[],deserializeAttachment(){return clone(this.player);},serializeAttachment(p){this.player=clone(p);},send(raw){this.messages.push(JSON.parse(raw));}});
 const a=socket('a',{rifle:1,knife:1,medicine:1}),b=socket('b',{}),map=createBattle([a.player,b.player],()=>.4),route=createRoute(()=>.4);startBattle(route);
 const values=new Map([['initialized',true],['phase','BATTLE'],['battle',map],['route',route]]),pending=[],ctx={getWebSockets:()=>[a,b],storage:{get:async k=>clone(values.get(k)),put:async(k,v)=>{if(typeof k==='string')values.set(k,clone(v));else for(const [key,value] of Object.entries(k))values.set(key,clone(value));}},blockConcurrencyWhile(fn){this.ready=fn();},waitUntil(p){pending.push(p);}};
 const room=new GameRoom(ctx);await ctx.ready;room.stopTimer();const tick=()=>{room.lastTick=Date.now()-100;room.tick();};
 try{
  await room.webSocketMessage(a,JSON.stringify({type:'input',use:true,selected:'rifle',aimX:a.player.x+200,aimY:a.player.y,hp:999,inventory:{medicine:999}}));tick();assert.equal(room.battle.effects.length,1);assert.equal(room.battle.effects[0].type,'rifle');assert.equal(b.messages.at(-1).battle.effects[0].id,a.messages.at(-1).battle.effects[0].id);assert.equal(a.player.hp,20);
  await room.webSocketMessage(b,JSON.stringify({type:'input',use:true,selected:'rifle',aimX:0,aimY:0}));await room.webSocketMessage(a,JSON.stringify({type:'input'}));tick();assert.equal(room.battle.effects.length,1,'unowned weapon cannot be fired');
  await room.webSocketMessage(a,JSON.stringify({type:'input',use:true,selected:'medicine'}));for(let i=0;i<29;i++)tick();assert.equal(a.player.hp,20);assert.equal(a.player.inventory.medicine,1);tick();assert.equal(a.player.hp,70);assert.equal(a.player.inventory.medicine,0);assert.equal(b.messages.at(-1).players.find(p=>p.id==='a').hp,70);
  assert.equal(values.get('battle').itemRevision,1);assert.equal(b.player.hp,20);
  await room.webSocketMessage(a,JSON.stringify({type:'input',secondary:true,selected:'knife',aimX:a.player.x+100,aimY:a.player.y,damage:999,stamina:999}));
  for(let i=0;i<4;i++)tick();assert.equal(room.battle.effects.length,0);assert.equal(a.player.stamina,1);tick();
  assert.equal(a.player.stamina,.7);assert.equal(room.battle.effects[0].damage,30);assert.equal(b.messages.at(-1).battle.effects[0].strong,true);
  room.inputs.get('a').at=Date.now()-1000;tick();assert.equal(room.inputs.has('a'),false);assert.equal(a.player.healProgress,0);await Promise.all(pending);
 }finally{room.stopTimer();}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensureInventory,createPreparation,finishBattleInventory,discardUnclaimed,movePreparationItem} from '../shared/preparation.js';
import {createBattle} from '../shared/battle.js';
import {openBox,ITEMS} from '../shared/items.js';
const player=(id='a')=>ensureInventory({id,slot:id==='a'?1:2,inventory:{food:3,fuel:2,knife:0,rifle:0},ready:false});
const item=(id,type='knife')=>({id,item:type,quantity:1});
const move=(state,players,id,from,to,targetItemId=null)=>movePreparationItem(state,players,id,{from,to,itemId:(from.area==='loot'?state.loot:players.find(p=>p.id===id).inventorySlots)[from.index]?.id,targetItemId});
test('weapon pickups are unowned pending loot, resources are immediately counted outside grids',()=>{
 const p=player(),map={id:'round',inventoryVersion:2,trees:[],rocks:[],boxes:[{id:'b',x:64,y:64,opened:false},{id:'f',x:64,y:64,opened:false}]};p.x=64;p.y=64;
 openBox(map,p,'b',()=>(ITEMS.findIndex(item=>item.id==='rifle')+.5)/ITEMS.length);openBox(map,p,'f',()=>.1);assert.equal(p.inventory.rifle,0);assert.equal(p.battleLoot.rifle,1);assert.equal(p.inventory.food,4);
 const state=finishBattleInventory(map,[p]);assert.equal(state.loot.filter(Boolean).length,1);assert.equal(state.loot[0].item,'rifle');assert.equal(p.battleLoot.rifle,0);assert.ok(p.inventorySlots.every(x=>!x));
});
test('claim, rearrange, swap, return and trash keep item identities and own inventory counts consistent',()=>{
 const p=player(),players=[p],state=createPreparation();state.loot[0]=item('knife');state.loot[1]=item('rifle','rifle');
 assert.ok(move(state,players,p.id,{area:'loot',index:0},{area:'inventory',index:0}));assert.equal(p.inventory.knife,1);
 assert.ok(move(state,players,p.id,{area:'inventory',index:0},{area:'inventory',index:4}));assert.equal(p.inventorySlots[0],null);assert.equal(p.inventorySlots[4].id,'knife');
 assert.ok(move(state,players,p.id,{area:'loot',index:1},{area:'inventory',index:4},'knife'));assert.equal(p.inventorySlots[4].id,'rifle');assert.equal(state.loot[1].id,'knife');assert.equal(p.inventory.knife,0);assert.equal(p.inventory.rifle,1);
 assert.ok(move(state,players,p.id,{area:'inventory',index:4},{area:'loot',index:5}));assert.equal(p.inventory.rifle,0);assert.ok(move(state,players,p.id,{area:'loot',index:5},{area:'trash'}));assert.equal(state.loot[5],null);assert.ok(move(state,players,p.id,{area:'loot',index:1},{area:'inventory',index:1}));assert.ok(move(state,players,p.id,{area:'inventory',index:1},{area:'trash'}));assert.equal(p.inventory.knife,0);assert.equal(p.inventory.food,3);assert.equal(p.inventory.fuel,2);
});
test('concurrent claims, stale targets, foreign inventory and forged item data cannot duplicate or replace items',()=>{
 const a=player(),b=player('b'),players=[a,b],state=createPreparation();state.loot[0]=item('one');b.inventorySlots[0]=item('foreign','rifle');
 const action={from:{area:'loot',index:0},to:{area:'inventory',index:0},itemId:'one',targetItemId:null};assert.ok(movePreparationItem(state,players,a.id,action));assert.equal(movePreparationItem(state,players,b.id,action),false);
 assert.equal(movePreparationItem(state,players,a.id,{from:{area:'inventory',playerId:b.id,index:0},to:{area:'trash'},itemId:'foreign'}),false);assert.equal(b.inventorySlots[0].id,'foreign');
 assert.equal(movePreparationItem(state,players,a.id,{from:{area:'inventory',index:0},to:{area:'loot',index:0},itemId:'fake'}),false);
 state.loot[0]=item('new');assert.equal(move(state,players,a.id,{area:'inventory',index:0},{area:'loot',index:0},null),false);assert.equal(a.inventorySlots[0].id,'one');
 assert.equal(movePreparationItem(state,players,a.id,{from:{area:'loot',index:-1},to:{area:'trash'},itemId:'new'}),false);
});
test('ready-to-battle deletes all leftovers and preserves only claimed items, resources and personal slot positions',()=>{
 const p=player(),state=createPreparation();state.loot[0]=item('keep','rifle');state.loot[1]=item('delete');p.ready=true;
 assert.ok(move(state,[p],p.id,{area:'loot',index:0},{area:'inventory',index:7}));assert.equal(p.ready,false);discardUnclaimed(state,[p]);assert.ok(state.loot.every(x=>!x));createBattle([p],()=>.4);assert.equal(p.inventorySlots[7].id,'keep');assert.equal(p.inventory.rifle,1);assert.equal(p.inventory.knife,0);assert.equal(p.inventory.food,3);
});
test('the next pending list contains only gear from the immediately preceding battle',()=>{
 const p=player(),first=finishBattleInventory({id:'first',inventoryVersion:2,boxes:[{id:'a',opened:true,loot:{item:'knife',quantity:1}}]},[p]);assert.equal(first.loot[0].id,'first:a');discardUnclaimed(first,[p]);const next=finishBattleInventory({id:'second',inventoryVersion:2,boxes:[{id:'b',opened:true,loot:{item:'rifle',quantity:1}},{id:'c',opened:true,loot:{item:'food',quantity:4}}]},[p]);assert.equal(next.loot.filter(Boolean).length,1);assert.equal(next.loot[0].id,'second:b');
});
test('legacy owned gear migrates once into slots without loss and old battle loot is not duplicated',()=>{
 const p={id:'legacy',inventory:{food:2,fuel:3,knife:2,rifle:1}};ensureInventory(p);assert.equal(p.inventorySlots.filter(Boolean).length,3);const ids=p.inventorySlots.filter(Boolean).map(i=>i.id);ensureInventory(p);assert.deepEqual(p.inventorySlots.filter(Boolean).map(i=>i.id),ids);assert.ok(finishBattleInventory({id:'old',boxes:[{id:'x',opened:true,loot:{item:'rifle',quantity:1}}]},[p]).loot.every(x=>!x));assert.equal(p.inventory.rifle,1);
});

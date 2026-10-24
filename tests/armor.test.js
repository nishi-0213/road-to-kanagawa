import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensureInventory,getDefense,finishBattleInventory,movePreparationItem,discardUnclaimed} from '../shared/preparation.js';
import {openBox,ITEMS} from '../shared/items.js';
import {availableItems} from '../shared/combat.js';
import {createBattle} from '../shared/battle.js';
const rollFor=id=>(ITEMS.findIndex(item=>item.id===id)+.5)/ITEMS.length;
const move=(state,players,player,from,to)=>movePreparationItem(state,players,player.id,{from,to,itemId:(from.area==='loot'?state.loot:player.inventorySlots)[from.index].id,targetItemId:(to.area==='loot'?state.loot:player.inventorySlots)[to.index]?.id??null});
test('each armor drops once, stays pending, and stored copies add no defense; trash and return remove its bonus',()=>{
 const p=ensureInventory({id:'a',slot:1,x:64,y:64}),map={id:'armor-round',inventoryVersion:2,boxes:['pants','hat','tshirt'].map(id=>({id,x:64,y:64,opened:false}))};
 for(const id of ['pants','hat','tshirt'])assert.deepEqual(openBox(map,p,id,()=>rollFor(id)),{item:id,quantity:1});
 assert.equal(getDefense(p),0);assert.equal(p.defense,0);const state=finishBattleInventory(map,[p]);assert.equal(state.loot.filter(Boolean).length,3);
 for(let index=0;index<3;index++)assert.ok(move(state,[p],p,{area:'loot',index},{area:'inventory',index}));assert.equal(getDefense(p),0);assert.equal(p.defense,0);assert.deepEqual(availableItems(p),[],'passive armor is excluded from wheel selection');
 assert.ok(move(state,[p],p,{area:'inventory',index:0},{area:'loot',index:0}));assert.equal(p.defense,0);assert.ok(move(state,[p],p,{area:'loot',index:0},{area:'inventory',index:6}));assert.equal(p.defense,0);
 assert.ok(movePreparationItem(state,[p],p.id,{from:{area:'inventory',index:6},to:{area:'trash'},itemId:p.inventorySlots[6].id}));assert.equal(p.defense,0);discardUnclaimed(state,[p]);createBattle([p],()=>.4);assert.equal(p.defense,0);assert.equal(p.inventory.pants,0);assert.equal(p.inventory.hat,1);assert.equal(p.inventory.tshirt,1);
});
test('stored copies add no defense, non-armor adds nothing, and stale submitted totals are recomputed from slots',()=>{
 const p=ensureInventory({id:'a',inventory:{pants:2,hat:3,tshirt:2,knife:1,food:99},defense:999});assert.equal(p.defense,0);assert.equal(getDefense(p),0);p.defense=999;p.inventory.pants=999;ensureInventory(p);assert.equal(p.defense,0);assert.equal(p.inventory.pants,2);
 const hats=p.inventorySlots.findIndex(slot=>slot?.item==='hat');p.inventorySlots[hats].quantity=2;ensureInventory(p);assert.equal(p.defense,0);assert.equal(getDefense(null),0);
});

test('defense includes only one matching garment per equipment slot, never bag contents or stale totals',()=>{
 const p=ensureInventory({id:'a',inventory:{pants:4,hat:5,tshirt:3},equipmentSlots:[{id:'h',item:'hat',quantity:1},{id:'t',item:'tshirt',quantity:1},{id:'p',item:'pants',quantity:1}],defense:999});assert.equal(p.defense,4);
 p.equipmentSlots[2]=null;ensureInventory(p);assert.equal(p.defense,2);p.equipmentSlots[0]={id:'wrong',item:'pants',quantity:1};assert.equal(getDefense(p),1);p.equipmentSlots[1].quantity=2;assert.equal(getDefense(p),0);
});

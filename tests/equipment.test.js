import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensureInventory,createPreparation,movePreparationItem,getDefense,discardUnclaimed} from '../shared/preparation.js';
import {createBattle} from '../shared/battle.js';
const item=(id,type,quantity=1)=>({id,item:type,quantity});
const player=(id='a')=>ensureInventory({id,slot:1});
const locate=(state,p,location)=>location.area==='loot'?state.loot:location.area==='inventory'?p.inventorySlots:p.equipmentSlots;
const move=(state,players,p,from,to)=>movePreparationItem(state,players,p.id,{from,to,itemId:locate(state,p,from)[from.index]?.id,targetItemId:to.area==='trash'?null:locate(state,p,to)[to.index]?.id??null});
test('clothes equip only into matching head/body/legs, and weapons cannot be equipped',()=>{
 const p=player(),state=createPreparation();state.loot[0]=item('hat','hat');state.loot[1]=item('shirt','tshirt');state.loot[2]=item('pants','pants');state.loot[3]=item('rifle','rifle');
 for(let source=0;source<4;source++)for(let target=0;target<3;target++)if(source!==target){const before=JSON.stringify(state);assert.equal(move(state,[p],p,{area:'loot',index:source},{area:'equipment',index:target}),false);assert.equal(JSON.stringify(state),before);}
 for(let index=0;index<3;index++)assert.equal(move(state,[p],p,{area:'loot',index},{area:'equipment',index}),true);
 assert.deepEqual(p.equipmentSlots.map(slot=>slot.item),['hat','tshirt','pants']);assert.equal(p.inventory.hat,1);assert.equal(p.inventory.tshirt,1);assert.equal(p.inventory.pants,1);assert.equal(getDefense(p),4);assert.equal(p.defense,4);assert.ok(p.inventorySlots.every(slot=>!slot));
 discardUnclaimed(state,[p]);createBattle([p],()=>.4);assert.deepEqual(p.equipmentSlots.map(slot=>slot.item),['hat','tshirt','pants']);assert.equal(p.defense,4);
});
test('equip/unequip and compatible swaps preserve IDs and ownership, incompatible reverse swaps cannot corrupt slots',()=>{
 const p=player(),state=createPreparation();state.loot[0]=item('hat-1','hat');p.inventorySlots[0]=item('rifle','rifle');p.inventorySlots[1]=item('hat-2','hat');ensureInventory(p);
 assert.ok(move(state,[p],p,{area:'loot',index:0},{area:'equipment',index:0}));assert.equal(p.defense,1);
 assert.equal(move(state,[p],p,{area:'equipment',index:0},{area:'inventory',index:0}),false,'rifle may not swap into head slot');
 assert.ok(move(state,[p],p,{area:'inventory',index:1},{area:'equipment',index:0}));assert.equal(p.equipmentSlots[0].id,'hat-2');assert.equal(p.inventorySlots[1].id,'hat-1');assert.equal(p.defense,1);
 assert.ok(move(state,[p],p,{area:'equipment',index:0},{area:'inventory',index:2}));assert.equal(p.equipmentSlots[0],null);assert.equal(p.defense,0,'stored clothing does not add defense');
 assert.ok(move(state,[p],p,{area:'inventory',index:2},{area:'equipment',index:0}));assert.ok(move(state,[p],p,{area:'equipment',index:0},{area:'loot',index:0}));assert.equal(p.defense,0);
 assert.ok(move(state,[p],p,{area:'loot',index:0},{area:'equipment',index:0}));assert.ok(move(state,[p],p,{area:'equipment',index:0},{area:'trash'}));assert.equal(p.equipmentSlots[0],null);assert.equal(p.defense,0);assert.equal(p.inventory.hat,1);
});
test('equipment rejects foreign owners, stale items, invalid indices, stacked clothing and concurrent double claims',()=>{
 const a=player(),b=player('b'),state=createPreparation(),players=[a,b];state.loot[0]=item('one','hat');state.loot[1]=item('stack','hat',2);
 assert.equal(move(state,players,a,{area:'loot',index:1},{area:'equipment',index:0}),false);
 const action={from:{area:'loot',index:0},to:{area:'equipment',index:0},itemId:'one',targetItemId:null};assert.ok(movePreparationItem(state,players,a.id,action));assert.equal(movePreparationItem(state,players,b.id,action),false);
 assert.equal(movePreparationItem(state,players,b.id,{from:{area:'equipment',index:0,playerId:a.id},to:{area:'trash'},itemId:'one'}),false);
 assert.equal(movePreparationItem(state,players,a.id,{from:{area:'equipment',index:0},to:{area:'inventory',index:0,playerId:b.id},itemId:'one',targetItemId:null}),false);
 for(const index of [-1,3,99])assert.equal(move(state,players,a,{area:'equipment',index:0},{area:'equipment',index}),false);
 assert.equal(a.equipmentSlots[0].id,'one');assert.equal(b.equipmentSlots[0],null);
});
test('old inventories gain empty equipment slots without auto-equipping or losing clothing',()=>{
 const p={id:'old',inventory:{pants:2,hat:1}};ensureInventory(p);const ids=p.inventorySlots.filter(Boolean).map(item=>item.id);assert.deepEqual(p.equipmentSlots,[null,null,null]);assert.equal(p.defense,0);ensureInventory(p);assert.deepEqual(p.inventorySlots.filter(Boolean).map(item=>item.id),ids);
});

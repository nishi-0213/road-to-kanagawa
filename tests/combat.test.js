import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableItems,stepCombat,MAX_HP} from '../shared/combat.js';
import {ensureInventory,finishBattleInventory,movePreparationItem} from '../shared/preparation.js';
import {openBox,ITEMS} from '../shared/items.js';
import {createBattle} from '../shared/battle.js';
import {cycleItem} from '../client/src/combat-ui.js';
const make=()=>ensureInventory({id:'a',slot:1,hp:20,x:64,y:64,inventory:{food:3,fuel:2,rifle:1,knife:1,medicine:2}});
const tick=(map,p,input,seconds)=>{for(let left=seconds;left>1e-8;left-=.05)stepCombat(map,[p],new Map([[p.id,input]]),Math.min(left,.05));};
test('wheel cycles only available rifle, knife, medicine and wraps in both directions',()=>{
 const p=make();assert.deepEqual(availableItems(p),['rifle','knife','medicine']);assert.equal(cycleItem('rifle',p,1),'knife');assert.equal(cycleItem('knife',p,1),'medicine');assert.equal(cycleItem('medicine',p,1),'rifle');assert.equal(cycleItem('rifle',p,-1),'medicine');assert.equal(cycleItem(null,{inventory:{}},1),null);assert.equal(cycleItem('knife',{inventory:{knife:1}},-1),'knife');
});
test('rifle and knife produce bounded, directed effects only when possessed, with attack cooldown',()=>{
 const p=make(),map={};tick(map,p,{use:true,selected:'rifle',aimX:164,aimY:64},.05);assert.equal(map.effects.length,1);assert.equal(map.effects[0].type,'rifle');assert.equal(map.effects[0].angle,0);assert.equal(map.effects[0].distance,100);
 tick(map,p,{use:true,selected:'rifle',aimX:164,aimY:64},.1);assert.equal(map.effects.length,1);
 tick(map,p,{},.4);tick(map,p,{use:true,selected:'knife',aimX:64,aimY:-100},.05);assert.equal(map.effects.at(-1).type,'knife');assert.equal(map.effects.at(-1).angle,-Math.PI/2);
 tick(map,p,{},2);assert.equal(map.effects.length,0);
 tick(map,p,{use:true,selected:'food',aimX:0,aimY:0},.5);tick(map,p,{use:true,selected:'rifle',aimX:NaN,aimY:0},.5);assert.equal(map.effects.length,0);
 const empty=ensureInventory({id:'empty',hp:100});tick(map,empty,{use:true,selected:'rifle',aimX:0,aimY:0},1);assert.equal(map.effects.length,0);
});
test('medicine needs uninterrupted 3-second hold, heals 50% max HP and consumes exactly one own inventory slot',()=>{
 const p=make(),map={},input={use:true,selected:'medicine'};tick(map,p,input,2.95);assert.equal(p.hp,20);assert.equal(p.inventory.medicine,2);tick(map,p,{},.05);assert.equal(p.healProgress,0);
 tick(map,p,input,2);tick(map,p,{use:true,selected:'knife'},.05);assert.equal(p.healProgress,0);
 tick(map,p,input,3);assert.equal(p.hp,70);assert.equal(p.inventory.medicine,1);assert.equal(p.inventorySlots.filter(s=>s?.item==='medicine').length,1);
 tick(map,p,input,4);assert.equal(p.hp,70);assert.equal(p.inventory.medicine,1,'one use until mouse release');
 tick(map,p,{},.05);tick(map,p,input,3);assert.equal(p.hp,MAX_HP);assert.equal(p.inventory.medicine,0);
});
test('medicine at full HP is not consumed and battle HP carries across nodes',()=>{
 const p=make();p.hp=MAX_HP;tick({},p,{use:true,selected:'medicine'},4);assert.equal(p.inventory.medicine,2);p.hp=43;createBattle([p],()=>.4);assert.equal(p.hp,43);assert.equal(p.healProgress,0);
});
test('new loot stays unusable until claimed into personal inventory during preparation',()=>{
 const p=ensureInventory({id:'a',slot:1,x:64,y:64,hp:40}),map={id:'round',inventoryVersion:2,boxes:[{id:'med',x:64,y:64,opened:false}]};assert.deepEqual(openBox(map,p,'med',()=>(ITEMS.findIndex(item=>item.id==='medicine')+.5)/ITEMS.length),{item:'medicine',quantity:1});assert.equal(p.battleLoot.medicine,1);
 assert.deepEqual(availableItems(p),[]);tick(map,p,{use:true,selected:'medicine'},3);assert.equal(p.hp,40);assert.equal(p.battleLoot.medicine,1);
 const preparation=finishBattleInventory(map,[p]),item=preparation.loot[0];assert.equal(item.item,'medicine');
 assert.ok(movePreparationItem(preparation,[p],p.id,{from:{area:'loot',index:0},to:{area:'inventory',index:0},itemId:item.id,targetItemId:null}));
 assert.deepEqual(availableItems(p),['medicine']);tick(map,p,{use:true,selected:'medicine'},3);assert.equal(p.hp,90);assert.equal(p.inventory.medicine,0);
});
test('strong knife requires a continuous half second and costs 30 percent once for 1.5x damage',()=>{
 const p=make(),map={},input={selected:'knife',secondary:true,aimX:164,aimY:64};p.stamina=1;
 tick(map,p,input,.45);assert.equal(map.effects.length,0);assert.equal(p.stamina,1);assert.ok(p.strongCharge>.44);
 tick(map,p,input,.05);assert.equal(map.effects.length,1);assert.equal(map.effects[0].strong,true);assert.equal(map.effects[0].damageMultiplier,1.5);assert.equal(map.effects[0].damage,30);assert.equal(map.effects[0].angle,0);assert.equal(p.stamina,.7);assert.equal(p.strongCharge,0);
 tick(map,p,input,1);assert.equal(map.effects.length,1);assert.equal(p.stamina,.7,'holding does not repeat strong attack');
 tick(map,p,{},.05);tick(map,p,{selected:'knife',use:true,aimX:164,aimY:64},.05);assert.equal(map.effects.at(-1).damage,20);assert.equal(map.effects.at(-1).damageMultiplier,1);
});
test('release, switching, invalid aim and insufficient stamina prevent an incomplete strong attack',()=>{
 const p=make(),map={},input={selected:'knife',secondary:true,aimX:164,aimY:64};p.stamina=1;
 tick(map,p,input,.3);tick(map,p,{},.05);assert.equal(p.strongCharge,0);assert.equal(p.stamina,1);assert.equal(map.effects.length,0);
 tick(map,p,input,.3);tick(map,p,{selected:'rifle',secondary:true},.05);assert.equal(p.strongCharge,0);
 p.stamina=.29;tick(map,p,input,1);assert.equal(map.effects.length,0);assert.equal(p.stamina,.29);
 p.stamina=.3;tick(map,p,{...input,aimX:NaN},.5);assert.equal(p.strongCharge,0);assert.equal(map.effects.length,0);
 tick(map,p,{...input,use:true},.5);assert.equal(map.effects.length,1,'right click takes precedence over normal attack');assert.equal(p.stamina,0);assert.equal(p.exhausted,true);
 const empty=ensureInventory({id:'empty',hp:100,stamina:1});tick(map,empty,input,.5);assert.equal(map.effects.length,1,'unowned knives cannot strong attack');
});

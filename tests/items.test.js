import {finishBattleInventory,movePreparationItem,createPreparation,ensureInventory} from '../shared/preparation.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,SIZES} from '../shared/battle.js';
import {ITEMS,createInventory,openBox,nearestBox,stepLoot} from '../shared/items.js';
import {canStand} from '../shared/terrain.js';
const make=()=>ensureInventory({id:'a',slot:1,inventory:createInventory()});
test('boxes are distinct, spaced, on reachable tiles and away from spawn and exit in all biome sizes',()=>{
 for(let size=0;size<4;size++)for(let biome=0;biome<3;biome++){
  let count=0;const random=()=>count++===0?(size+.1)/4:count===2?(biome+.1)/3:.41;
  const players=[make()],map=createBattle(players,random);assert.deepEqual([map.cols,map.rows],SIZES[size]);assert.ok(map.boxes.length>=3&&map.boxes.length<=5);
  const seen=new Set(),queue=[[1,map.rows-2]];
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i],key=y*map.cols+x;if(x<0||y<0||x>=map.cols||y>=map.rows||seen.has(key))continue;seen.add(key);if(!canStand(map,x*32+16,y*32+16)){seen.delete(key);continue;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<map.cols&&ny<map.rows&&!seen.has(ny*map.cols+nx)&&canStand(map,nx*32+16,ny*32+16))queue.push([nx,ny]);}}
  for(const box of map.boxes){assert.ok(canStand(map,box.x,box.y));assert.ok(seen.has(Math.floor(box.y/32)*map.cols+Math.floor(box.x/32)));assert.equal(box.loot,undefined);assert.equal(box.opened,false);}
  assert.equal(new Set(map.boxes.map(b=>b.id)).size,map.boxes.length);
 }
});
test('food/fuel yield 1–4 and weapons yield exactly one; unopened loot stays private',()=>{
 for(let index=0;index<ITEMS.length;index++)for(let quantity=1;quantity<=4;quantity++){
  const map={trees:[],rocks:[],boxes:[{id:'box',x:64,y:64,opened:false}]},player={...make(),x:64,y:64},values=[(index+.1)/ITEMS.length,(quantity-.5)/4];
  const result=openBox(map,player,'box',()=>values.shift());assert.deepEqual(result,{item:ITEMS[index].id,quantity:index<2?quantity:1});assert.equal(result.item==='food'||result.item==='fuel'?player.inventory[result.item]:player.battleLoot[result.item],result.quantity);assert.equal(map.boxes[0].openedBy,'a');
  assert.equal(openBox(map,player,'box'),null);
 }
});
test('distance and obstruction validation, concurrent claim has a single owner, inventory survives next round',()=>{
 const map={trees:[],rocks:[],boxes:[{id:'box',x:144,y:144,opened:false}]},a={...make(),x:16,y:16},b={...make(),id:'b',x:144,y:144};
 assert.equal(openBox(map,a,'box'),null);assert.equal(nearestBox(map,a),undefined);
 a.x=100;a.y=144;map.rocks=[{col:3,row:4}];assert.equal(openBox(map,a,'box'),null);
 map.rocks=[];a.x=144;assert.ok(openBox(map,a,'box',()=>(ITEMS.findIndex(item=>item.id==='rifle')+.5)/ITEMS.length));assert.equal(openBox(map,b,'box'),null);assert.equal(a.battleLoot.rifle,1);assert.equal(b.battleLoot.rifle,0);
 map.id='round';map.inventoryVersion=2;const prep=finishBattleInventory(map,[a,b]);assert.equal(a.inventory.rifle,0);const item=prep.loot[0];assert.ok(movePreparationItem(prep,[a,b],a.id,{from:{area:'loot',index:0},to:{area:'inventory',index:0},itemId:item.id,targetItemId:null}));
 createBattle([a],()=>.4);assert.equal(a.inventory.rifle,1);
});

test('each battle creates exactly 3, 4 or 5 boxes according to the count draw',()=>{
 for(let desired=3;desired<=5;desired++){let call=0;const random=()=>{call++;return call===4?(desired-3+.1)/3:.4;};const map=createBattle([make()],random);assert.equal(map.boxes.length,desired);}
});

test('looting requires a full uninterrupted second, displays progress and resets on release or range loss',()=>{
 const map={trees:[],rocks:[],boxes:[{id:'box',x:64,y:64,opened:false}]},p={...make(),x:64,y:64},input=new Map([[p.id,{interact:true}]]);
 for(let i=0;i<10;i++)stepLoot(map,[p],input,.05,()=>.1);assert.ok(p.lootProgress>.49&&p.lootProgress<.51);assert.equal(map.boxes[0].opened,false);
 stepLoot(map,[p],new Map(),.05);assert.equal(p.lootProgress,0);assert.equal(p.lootBoxId,null);
 for(let i=0;i<19;i++)stepLoot(map,[p],input,.05,()=>.1);assert.equal(map.boxes[0].opened,false);p.x=200;stepLoot(map,[p],input,.05);assert.equal(p.lootProgress,0);
 p.x=64;for(let i=0;i<19;i++)stepLoot(map,[p],input,.05,()=>.1);assert.equal(map.boxes[0].opened,false);assert.equal(stepLoot(map,[p],input,.05,()=>.1),true);assert.equal(map.boxes[0].opened,true);assert.equal(p.inventory.food,1);assert.equal(p.lootProgress,0);
});
test('simultaneous timed loot still awards one player exactly once',()=>{
 const map={trees:[],rocks:[],boxes:[{id:'box',x:64,y:64,opened:false}]},a={...make(),x:64,y:64},b={...make(),id:'b',x:64,y:64},inputs=new Map([[a.id,{interact:true}],[b.id,{interact:true}]]);
 for(let i=0;i<20;i++)stepLoot(map,[a,b],inputs,.05,()=>(ITEMS.findIndex(item=>item.id==='rifle')+.5)/ITEMS.length);assert.equal(a.battleLoot.rifle+b.battleLoot.rifle,1);assert.equal(b.lootProgress,0);for(let i=0;i<40;i++)stepLoot(map,[a,b],inputs,.05,()=>(ITEMS.findIndex(item=>item.id==='rifle')+.5)/ITEMS.length);assert.equal(a.battleLoot.rifle+b.battleLoot.rifle,1);
});

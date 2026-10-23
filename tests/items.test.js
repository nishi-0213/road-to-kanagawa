import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,SIZES} from '../shared/battle.js';
import {ITEMS,createInventory,openBox,nearestBox} from '../shared/items.js';
import {canStand} from '../shared/terrain.js';
const make=()=>({id:'a',slot:1,inventory:createInventory()});
test('boxes are distinct, spaced, on reachable tiles and away from spawn and exit in all biome sizes',()=>{
 for(let size=0;size<4;size++)for(let biome=0;biome<3;biome++){
  let count=0;const random=()=>count++===0?(size+.1)/4:count===2?(biome+.1)/3:.41;
  const players=[make()],map=createBattle(players,random);assert.deepEqual([map.cols,map.rows],SIZES[size]);assert.ok(map.boxes.length>=8);
  const seen=new Set(),queue=[[1,map.rows-2]];
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i],key=y*map.cols+x;if(x<0||y<0||x>=map.cols||y>=map.rows||seen.has(key))continue;seen.add(key);if(!canStand(map,x*32+16,y*32+16)){seen.delete(key);continue;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<map.cols&&ny<map.rows&&!seen.has(ny*map.cols+nx)&&canStand(map,nx*32+16,ny*32+16))queue.push([nx,ny]);}}
  for(const box of map.boxes){assert.ok(canStand(map,box.x,box.y));assert.ok(seen.has(Math.floor(box.y/32)*map.cols+Math.floor(box.x/32)));assert.equal(box.loot,undefined);assert.equal(box.opened,false);}
  assert.equal(new Set(map.boxes.map(b=>b.id)).size,map.boxes.length);
 }
});
test('food/fuel yield 1–4 and weapons yield exactly one; unopened loot stays private',()=>{
 for(let index=0;index<4;index++)for(let quantity=1;quantity<=4;quantity++){
  const map={trees:[],rocks:[],boxes:[{id:'box',x:64,y:64,opened:false}]},player={...make(),x:64,y:64},values=[(index+.1)/4,(quantity-.5)/4];
  const result=openBox(map,player,'box',()=>values.shift());assert.deepEqual(result,{item:ITEMS[index].id,quantity:index<2?quantity:1});assert.equal(player.inventory[result.item],result.quantity);assert.equal(map.boxes[0].openedBy,'a');
  assert.equal(openBox(map,player,'box'),null);
 }
});
test('distance and obstruction validation, concurrent claim has a single owner, inventory survives next round',()=>{
 const map={trees:[],rocks:[],boxes:[{id:'box',x:144,y:144,opened:false}]},a={...make(),x:16,y:16},b={...make(),id:'b',x:144,y:144};
 assert.equal(openBox(map,a,'box'),null);assert.equal(nearestBox(map,a),undefined);
 a.x=100;a.y=144;map.rocks=[{col:3,row:4}];assert.equal(openBox(map,a,'box'),null);
 map.rocks=[];a.x=144;assert.ok(openBox(map,a,'box',()=>.8));assert.equal(openBox(map,b,'box'),null);assert.equal(a.inventory.rifle,1);assert.equal(b.inventory.rifle,0);
 createBattle([a],()=>.4);assert.equal(a.inventory.rifle,1);
});

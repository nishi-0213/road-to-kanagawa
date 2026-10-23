import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrees,createRocks,canStand,noise} from '../shared/terrain.js';
import {createBattle,stepBattle,SIZES,SPEED,inExit} from '../shared/battle.js';
const make=(n=1,r=()=>0)=>{const players=Array.from({length:n},(_,i)=>({id:String(i),slot:i+1,ready:true}));return {players,map:createBattle(players,r)};};
const advance=(map,players,inputs,seconds)=>{for(let i=0;i<Math.round(seconds*20);i++)stepBattle(map,players,inputs,.05);};
test('four map sizes, 32px tiles, bottom-left spawns and top-right 2x3 exit',()=>{
 for(let i=0;i<4;i++){const {map,players}=make(4,()=>i/4);assert.deepEqual([map.cols,map.rows],SIZES[i]);assert.deepEqual(map.exit,{x:(map.cols-2)*32,y:0,width:64,height:96});for(const p of players){assert.ok(p.x<=64);assert.ok(p.y>=map.rows*32-64);assert.equal(p.stamina,1);}}
});
test('sprint is 1.5x, drains in 4 seconds and recovers in 6 seconds',()=>{
 const {map,players}=make(1,()=>.25),p=players[0],start=p.x;map.trees=[];map.rocks=[];
 advance(map,players,new Map([[p.id,{right:true,sprint:true}]]),4);
 assert.ok(Math.abs(p.x-start-SPEED*1.5*4)<1e-6);assert.equal(p.stamina,0);assert.equal(p.exhausted,true);
 advance(map,players,new Map(),5.95);assert.ok(p.stamina<1);assert.equal(p.exhausted,true);
 stepBattle(map,players,new Map(),.05);assert.equal(p.stamina,1);assert.equal(p.exhausted,false);
});
test('diagonal speed is normalized, movement bounded, sprint without movement costs nothing',()=>{
 const {map,players}=make(),p=players[0];map.trees=[];map.rocks=[];p.x=200;p.y=200;stepBattle(map,players,new Map([[p.id,{right:true,down:true}]]),.1);assert.ok(Math.abs(Math.hypot(p.x-200,p.y-200)-16)<1e-6);
 for(let i=0;i<100;i++)stepBattle(map,players,new Map([[p.id,{left:true,down:true}]]),.1);assert.equal(p.x,16);assert.equal(p.y,map.rows*32-16);
 stepBattle(map,players,new Map([[p.id,{sprint:true}]]),.1);assert.equal(p.stamina,1);
});
test('anyone / all inside, continuous 3 seconds and reset on leaving for 1–4 players',()=>{
 for(let n=1;n<=4;n++){
  const {map,players}=make(n);const put=p=>{p.x=map.exit.x+24;p.y=48;};put(players[0]);stepBattle(map,players,new Map(),.05);assert.equal(map.inside,1);if(n>1)assert.equal(map.escape,0);
  players.forEach(put);map.escape=0;advance(map,players,new Map(),2.95);assert.ok(map.escape<3);
  players[0].x=map.exit.x-1;stepBattle(map,players,new Map(),.05);assert.equal(map.escape,0);assert.equal(inExit(players[0],map),false);
  put(players[0]);advance(map,players,new Map(),2.95);assert.equal(stepBattle(map,players,new Map(),.05),true);
 }
});

test('biomes are selected independently from map dimensions',()=>{
 for(let i=0;i<3;i++){const values=[.5,(i+.1)/3,.5];const {map}=make(1,()=>values.length?values.shift():.5);assert.equal(map.biome,['forest','highway','urban'][i]);assert.deepEqual([map.cols,map.rows],[40,30]);assert.equal(map.trees.length>0,i===0);}
});
test('seeded forest layouts repeat, vary by seed, and reserve a reachable spawn-to-exit path',()=>{
 for(const [cols,rows] of SIZES)for(let seed=0;seed<30;seed++){
  const trees=createTrees(cols,rows,seed),rocks=createRocks(cols,rows,seed,trees),map={cols,rows,trees,rocks};assert.ok(trees.length>10);assert.deepEqual(trees,createTrees(cols,rows,seed));assert.notDeepEqual(trees,createTrees(cols,rows,seed+100));
  const blocked=new Set([...trees,...rocks].map(t=>t.row*cols+t.col)),seen=new Set(),queue=[[1,rows-2]];
  while(queue.length){const [x,y]=queue.shift(),key=y*cols+x;if(x<0||y<0||x>=cols||y>=rows||seen.has(key)||blocked.has(key))continue;seen.add(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);}
  assert.ok(seen.has(cols-2),'exit remains connected to spawn');
  for(const p of [{x:32,y:rows*32-32},{x:64,y:rows*32-64},{x:(cols-1)*32,y:48}])assert.equal(canStand(map,p.x,p.y),true);
 }
 assert.ok(Math.abs(noise(2,2,21)-noise(2.01,2.01,21))<.01,'nearby noise samples vary smoothly');
});
test('walking and sprinting cannot pass through trees, while diagonal movement slides along obstacles',()=>{
 const {map,players}=make(),p=players[0];map.trees=[{col:4,row:4}];p.x=100;p.y=144;
 for(let i=0;i<10;i++)stepBattle(map,players,new Map([[p.id,{right:true,sprint:true}]]),.1);
 assert.ok(p.x<=118);assert.equal(canStand(map,p.x,p.y),true);
 stepBattle(map,players,new Map([[p.id,{right:true,down:true}]]),.1);assert.ok(p.y>144);assert.equal(canStand(map,p.x,p.y),true);
 p.x=200;p.y=144;for(let i=0;i<10;i++)stepBattle(map,players,new Map([[p.id,{left:true}]]),.1);assert.ok(p.x>=170);
});

test('rocks occur in every biome at one third of the equivalent forest tree count without overlap',()=>{
 for(const [cols,rows] of SIZES)for(let seed=0;seed<10;seed++){
  const trees=createTrees(cols,rows,seed),occupied=new Set(trees.map(t=>t.row*cols+t.col));
  const rocks=createRocks(cols,rows,seed,trees);assert.equal(rocks.length,Math.round(trees.length/3));assert.ok(rocks.every(r=>!occupied.has(r.row*cols+r.col)));assert.equal(createRocks(cols,rows,seed).length,Math.round(trees.length/3));
 }
 const {map,players}=make();map.trees=[];map.rocks=[{col:4,row:4}];players[0].x=100;players[0].y=144;
 for(let i=0;i<10;i++)stepBattle(map,players,new Map([[players[0].id,{right:true,sprint:true}]]),.1);assert.ok(players[0].x<=118);
});

test('three separate corridor routes stay clear of both trees and rocks for every map size',()=>{
 for(const [cols,rows] of SIZES)for(let seed=0;seed<40;seed++){
  const trees=createTrees(cols,rows,seed),rocks=createRocks(cols,rows,seed,trees),blocked=new Set([...trees,...rocks].map(t=>t.row*cols+t.col));
  // Left + top route, and bottom + right route, each have a three-tile width.
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const center=(cols-3)*(1-row/(rows-1))+1+Math.sin(row*.22+seed%7)*.8;
   if(Math.abs(col-2)<=1||Math.abs(row-2)<=1||Math.abs(col-(cols-3))<=1||Math.abs(row-(rows-3))<=1||Math.abs(col-center)<1.8)assert.equal(blocked.has(row*cols+col),false);
  }
 }
});

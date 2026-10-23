import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,stepBattle,SIZES,SPEED,inExit} from '../shared/battle.js';
const make=(n=1,r=()=>0)=>{const players=Array.from({length:n},(_,i)=>({id:String(i),slot:i+1,ready:true}));return {players,map:createBattle(players,r)};};
const advance=(map,players,inputs,seconds)=>{for(let i=0;i<Math.round(seconds*20);i++)stepBattle(map,players,inputs,.05);};
test('four map sizes, 32px tiles, bottom-left spawns and top-right 2x3 exit',()=>{
 for(let i=0;i<4;i++){const {map,players}=make(4,()=>i/4);assert.deepEqual([map.cols,map.rows],SIZES[i]);assert.deepEqual(map.exit,{x:(map.cols-2)*32,y:0,width:64,height:96});for(const p of players){assert.ok(p.x<=64);assert.ok(p.y>=map.rows*32-64);assert.equal(p.stamina,1);}}
});
test('sprint is 1.5x, drains in 4 seconds and recovers in 6 seconds',()=>{
 const {map,players}=make(1,()=>.25),p=players[0],start=p.x;
 advance(map,players,new Map([[p.id,{right:true,sprint:true}]]),4);
 assert.ok(Math.abs(p.x-start-SPEED*1.5*4)<1e-6);assert.equal(p.stamina,0);assert.equal(p.exhausted,true);
 advance(map,players,new Map(),5.95);assert.ok(p.stamina<1);assert.equal(p.exhausted,true);
 stepBattle(map,players,new Map(),.05);assert.equal(p.stamina,1);assert.equal(p.exhausted,false);
});
test('diagonal speed is normalized, movement bounded, sprint without movement costs nothing',()=>{
 const {map,players}=make(),p=players[0];p.x=200;p.y=200;stepBattle(map,players,new Map([[p.id,{right:true,down:true}]]),.1);assert.ok(Math.abs(Math.hypot(p.x-200,p.y-200)-16)<1e-6);
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

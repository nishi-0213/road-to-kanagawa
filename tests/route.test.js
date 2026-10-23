import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITIES,createRoute,nextNodes,selectNode,finishBattle,TRAITS,nodeInfo} from '../shared/route.js';
test('all thirteen named cities stay ordered and the connected graph splits and merges with degree 1–2',()=>{
 for(let seed=1;seed<=80;seed++){
  let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};const route=createRoute(random);
  assert.deepEqual(route.nodes.map(n=>n.name),CITIES);assert.equal(route.current,0);assert.deepEqual(route.visited,[0]);assert.ok(route.edges.some(e=>e.to-e.from===2));
  for(const node of route.nodes){const out=route.edges.filter(e=>e.from===node.id),incoming=route.edges.filter(e=>e.to===node.id);assert.equal(out.length>=1&&out.length<=2,node.id<12);assert.equal(incoming.length>=1&&incoming.length<=2,node.id>0);}
  for(const edge of route.edges)assert.ok(edge.to>edge.from&&edge.to-edge.from<=2);
 }
});
test('moving requires escape, accepts only one connected rightward choice and ends at Kanagawa',()=>{
 const route=createRoute(()=>.8);assert.deepEqual(nextNodes(route),[]);assert.equal(selectNode(route,1),false);
 for(let target=1;target<CITIES.length;target++){
  finishBattle(route);assert.ok(nextNodes(route).includes(target));assert.equal(selectNode(route,target-1),false);assert.equal(selectNode(route,target+3),false);assert.equal(selectNode(route,'1'),false);assert.equal(selectNode(route,target),true);assert.equal(selectNode(route,target+1),false);
 }
 assert.equal(route.finished,true);assert.equal(route.current,12);assert.deepEqual(route.visited,Array.from({length:13},(_,i)=>i));finishBattle(route);assert.deepEqual(nextNodes(route),[]);
});
test('a randomly generated branch can skip one city but cannot move farther or reverse',()=>{
 const route=createRoute(()=>0);finishBattle(route);assert.deepEqual(nextNodes(route),[1,2]);assert.equal(selectNode(route,2),true);finishBattle(route);assert.equal(selectNode(route,1),false);assert.equal(selectNode(route,5),false);assert.equal(selectNode(route,4),true);
});

test('node tooltip metadata has 70% normal and three 10% traits, fixed Fuji event and per-player food',()=>{
 const cases=[[.1,'normal'],[.699,'normal'],[.7,'enemies'],[.8,'resources'],[.9,'trader']];
 for(const [value,trait] of cases){const route=createRoute(()=>value);for(const node of route.nodes){assert.equal(node.trait,node.name==='富士'?'event':trait);assert.ok(node.fuelCost>=1&&node.fuelCost<=3);for(let players=1;players<=4;players++)assert.deepEqual(nodeInfo(node,players),{name:node.name,trait:TRAITS[node.trait],fuel:node.fuelCost,food:players});}}
 let seed=5;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const counts={normal:0,enemies:0,resources:0,trader:0};for(let i=0;i<1000;i++)for(const node of createRoute(rng).nodes)if(node.name!=='富士')counts[node.trait]++;assert.ok(counts.normal/12000>.67&&counts.normal/12000<.73);for(const key of ['enemies','resources','trader'])assert.ok(counts[key]/12000>.08&&counts[key]/12000<.12);
});

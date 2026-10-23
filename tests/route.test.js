import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITIES,createRoute,upgradeRoute,nextNodes,selectNode,finishBattle,TRAITS,nodeInfo,ringCount} from '../shared/route.js';
test('every path visits all thirteen cities in order, with adjacent-stage branches and merges only',()=>{
 for(let seed=1;seed<=100;seed++){
  let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};const route=createRoute(random);
  assert.equal(route.current,0);assert.deepEqual(route.visited,[0]);assert.ok(route.nodes.length>13);
  for(let stage=0;stage<CITIES.length;stage++){const layer=route.nodes.filter(n=>n.stage===stage);assert.ok(layer.length>=1&&layer.length<=2);assert.ok(layer.every(n=>n.name===CITIES[stage]));}
  for(const node of route.nodes){const out=route.edges.filter(e=>e.from===node.id),incoming=route.edges.filter(e=>e.to===node.id);assert.equal(out.length>=1&&out.length<=2,node.stage<12);assert.equal(incoming.length>=1&&incoming.length<=2,node.stage>0);}
  for(const edge of route.edges)assert.equal(route.nodes[edge.to].stage,route.nodes[edge.from].stage+1);
  const names=[CITIES[0]];for(let stage=1;stage<13;stage++){finishBattle(route);const choices=nextNodes(route);assert.ok(selectNode(route,choices[Math.floor(random()*choices.length)]));names.push(route.nodes[route.current].name);}
  assert.deepEqual(names,CITIES);assert.equal(route.finished,true);
 }
});
test('escape allows only one adjacent-city selection and rejects shortcuts, siblings and reverse travel',()=>{
 const route=createRoute(()=>0);assert.deepEqual(nextNodes(route),[]);assert.equal(selectNode(route,1),false);
 for(let stage=1;stage<CITIES.length;stage++){
  finishBattle(route);const target=route.nodes.find(n=>n.stage===stage).id,shortcut=route.nodes.find(n=>n.stage===stage+1)?.id;
  assert.equal(selectNode(route,route.current),false);if(shortcut!==undefined)assert.equal(selectNode(route,shortcut),false);assert.equal(selectNode(route,'1'),false);assert.equal(selectNode(route,target),true);assert.equal(selectNode(route,target+1),false);
 }
 assert.equal(route.finished,true);assert.equal(route.visited.length,13);finishBattle(route);assert.deepEqual(nextNodes(route),[]);
});
test('ring counts distinguish normal, three special traits and event nodes',()=>{assert.equal(ringCount('normal'),1);for(const trait of ['enemies','resources','trader'])assert.equal(ringCount(trait),2);assert.equal(ringCount('event'),3);});
test('legacy shortcut maps migrate while preserving location, progress and existing costs',()=>{
 const old={nodes:CITIES.map((name,id)=>({id,name,trait:name==='富士'?'event':'normal',fuelCost:2})),edges:[{from:0,to:2}],current:4,visited:[0,2,4],canAdvance:true,finished:false};
 const migrated=upgradeRoute(old,()=>.4);assert.equal(migrated.version,2);assert.equal(migrated.nodes[migrated.current].name,'草津');assert.equal(migrated.canAdvance,true);assert.ok(migrated.nodes.every(n=>n.fuelCost===2));assert.ok(migrated.edges.every(e=>migrated.nodes[e.to].stage===migrated.nodes[e.from].stage+1));assert.equal(upgradeRoute(migrated),migrated);
});
test('trait probabilities, fixed Fuji event, fuel range and per-player food remain correct',()=>{
 for(const [value,trait] of [[.1,'normal'],[.699,'normal'],[.7,'enemies'],[.8,'resources'],[.9,'trader']]){const route=createRoute(()=>value);for(const node of route.nodes){assert.equal(node.trait,node.name==='富士'?'event':trait);assert.ok(node.fuelCost>=1&&node.fuelCost<=3);for(let players=1;players<=4;players++)assert.deepEqual(nodeInfo(node,players),{name:node.name,trait:TRAITS[node.trait],fuel:node.fuelCost,food:players});}}
 let seed=5;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},counts={normal:0,enemies:0,resources:0,trader:0};let total=0;
 for(let i=0;i<1000;i++)for(const node of createRoute(rng).nodes)if(node.name!=='富士'){counts[node.trait]++;total++;}
 assert.ok(counts.normal/total>.67&&counts.normal/total<.73);for(const key of ['enemies','resources','trader'])assert.ok(counts[key]/total>.08&&counts[key]/total<.12);
});

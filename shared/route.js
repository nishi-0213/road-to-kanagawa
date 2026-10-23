export const CITIES=['尼崎','新大阪','枚方','京都','草津','四日市','名古屋','豊橋','浜松','富士','熱海','横浜','神奈川ゴール'];
export const TRAITS={normal:'通常',enemies:'敵増加',resources:'資源増加',trader:'トレーダー',event:'イベント'};
export function ringCount(trait){return trait==='event'?3:['enemies','resources','trader'].includes(trait)?2:1;}
export function createRoute(random=Math.random){
 const widths=CITIES.map((_,stage)=>stage>0&&stage<CITIES.length-1&&random()<.35?2:1);
 if(!widths.includes(2))widths[1+Math.min(CITIES.length-3,Math.floor(random()*(CITIES.length-2)))]=2;
 const nodes=[],layers=[],edges=[];
 for(let stage=0;stage<CITIES.length;stage++){
  const layer=[];
  for(let branch=0;branch<widths[stage];branch++){
   const roll=random(),name=CITIES[stage],id=nodes.length;
   nodes.push({id,stage,name,lane:widths[stage]===2?(branch===0?-.72:.72):0,trait:name==='富士'?'event':roll<.7?'normal':roll<.8?'enemies':roll<.9?'resources':'trader',fuelCost:1+Math.min(2,Math.floor(random()*3))});layer.push(id);
  }
  if(stage>0)for(const from of layers[stage-1])for(const to of layer)edges.push({from,to});
  layers.push(layer);
 }
 return {version:2,nodes,edges,current:0,visited:[0],battleStarted:[],canAdvance:false,finished:false};
}
export function upgradeRoute(route,random=Math.random){
 if(route?.version===2){route.battleStarted??=route.visited.filter(id=>id!==route.current||route.canAdvance);return route;}
 const fresh=createRoute(random);if(!route?.nodes?.length)return fresh;
 const currentName=route.nodes[route.current]?.name||CITIES[0];
 fresh.current=fresh.nodes.find(n=>n.name===currentName)?.id||0;
 fresh.visited=[...new Set((route.visited||[0]).map(id=>fresh.nodes.find(n=>n.name===route.nodes[id]?.name)?.id).filter(id=>id!==undefined))];
 fresh.battleStarted=fresh.visited.filter(id=>id!==fresh.current||route.canAdvance);
 fresh.canAdvance=Boolean(route.canAdvance);fresh.finished=Boolean(route.finished);
 for(const n of fresh.nodes){const previous=route.nodes.find(old=>old.name===n.name);if(previous?.trait)n.trait=previous.trait;if(previous?.fuelCost)n.fuelCost=previous.fuelCost;}
 return fresh;
}
export function nextNodes(route){return route?.canAdvance&&!route.finished?route.edges.filter(e=>e.from===route.current).map(e=>e.to):[];}
export function selectNode(route,target){
 if(!Number.isInteger(target)||!nextNodes(route).includes(target))return false;
 const next=route.nodes[target],current=route.nodes[route.current];
 if(next.stage!==current.stage+1)return false;
 route.current=target;route.visited.push(target);route.canAdvance=false;route.finished=next.stage===CITIES.length-1;return true;
}
export function finishBattle(route){if(route&&!route.finished)route.canAdvance=true;}
export function nodeInfo(node,playerCount){return {name:node.name,trait:TRAITS[node.trait]||'通常',fuel:node.fuelCost||1,food:Math.max(1,playerCount)};}

export function canStartBattle(route){return Boolean(route&&!route.canAdvance&&!route.finished&&!(route.battleStarted||[]).includes(route.current));}
export function startBattle(route){if(!canStartBattle(route))return false;(route.battleStarted??=[]).push(route.current);return true;}

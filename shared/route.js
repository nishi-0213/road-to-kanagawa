export const CITIES=['尼崎','新大阪','枚方','京都','草津','四日市','名古屋','豊橋','浜松','富士','熱海','横浜','神奈川ゴール'];
export const TRAITS={normal:'通常',enemies:'敵増加',resources:'資源増加',trader:'トレーダー',event:'イベント'};
export function createRoute(random=Math.random){
 const nodes=CITIES.map((name,id)=>{const roll=random();return {id,name,lane:id===0||id===CITIES.length-1?0:(random()-.5)*2,trait:name==='富士'?'event':roll<.7?'normal':roll<.8?'enemies':roll<.9?'resources':'trader',fuelCost:1+Math.min(2,Math.floor(random()*3))};});
 const edges=nodes.slice(0,-1).map(node=>({from:node.id,to:node.id+1}));
 let branches=0;
 for(let from=0;from<CITIES.length-2;from++)if(random()<.35){edges.push({from,to:from+2});branches++;}
 if(!branches){const from=Math.min(CITIES.length-3,Math.floor(random()*(CITIES.length-2)));edges.push({from,to:from+2});}
 return {nodes,edges,current:0,visited:[0],canAdvance:false,finished:false};
}
export function nextNodes(route){return route?.canAdvance&&!route.finished?route.edges.filter(e=>e.from===route.current).map(e=>e.to):[];}
export function selectNode(route,target){
 if(!Number.isInteger(target)||!nextNodes(route).includes(target))return false;
 route.current=target;route.visited.push(target);route.canAdvance=false;route.finished=target===route.nodes.length-1;return true;
}
export function finishBattle(route){if(route&&!route.finished)route.canAdvance=true;}

export function nodeInfo(node,playerCount){return {name:node.name,trait:TRAITS[node.trait]||'通常',fuel:node.fuelCost||1,food:Math.max(1,playerCount)};}

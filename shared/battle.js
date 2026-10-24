import {getPlayerStats} from './personality.js';
import {stepCombat} from './combat.js';
import {ensureInventory,createBattleLoot} from './preparation.js';
import {createBoxes,createInventory,stepLoot} from './items.js';
import {BIOMES,createTrees,createRocks,movePlayer} from './terrain.js';
export const TILE=32, SPEED=160, SIZES=[[30,40],[50,25],[40,30],[20,60]];
export function createBattle(players,random=Math.random){
 const [cols,rows]=SIZES[Math.min(3,Math.floor(random()*4))];
 const biome=BIOMES[Math.min(2,Math.floor(random()*3))],seed=Math.floor(random()*0xffffffff);
 const trees=biome==='forest'?createTrees(cols,rows,seed):[];
 const rocks=createRocks(cols,rows,seed,trees);
 for(const p of players){ensureInventory(p);p.battleLoot=createBattleLoot();}
 for(const [index,p] of players.entries())Object.assign(p,{x:32+(index%2)*32,y:rows*TILE-32-Math.floor(index/2)*32,maxHp:getPlayerStats(p).maxHp,hp:Number.isFinite(p.hp)?Math.min(p.hp,getPlayerStats(p).maxHp):getPlayerStats(p).maxHp,selectedItem:null,aimAngle:0,strongCharge:0,strongLatched:false,healProgress:0,healLatched:false,attackCooldown:0,stamina:1,exhausted:false,ready:false,inventory:p.inventory||createInventory(),lootBoxId:null,lootProgress:0});
 const map={inventoryVersion:2,id:crypto.randomUUID(),cols,rows,biome,seed,trees,rocks,exit:{x:(cols-2)*TILE,y:0,width:2*TILE,height:3*TILE},escape:0,inside:0};
 map.boxes=createBoxes(map,random);return map;
}
export function inExit(p,map){const e=map.exit;return p.x>=e.x&&p.x<e.x+e.width&&p.y>=e.y&&p.y<e.y+e.height;}
export function stepBattle(map,players,inputs,seconds){
 const dt=Math.min(.1,Math.max(0,seconds));
 for(const p of players){
  const input=inputs.get(p.id)||{},stats=getPlayerStats(p,map,players);
  const x=Number(input.right===true)-Number(input.left===true),y=Number(input.down===true)-Number(input.up===true),length=Math.hypot(x,y);
  const sprint=length>0&&input.sprint===true&&!p.exhausted&&p.stamina>0;
  // Integrate the final fraction of a sprint frame without granting free speed.
  const sprintTime=sprint?Math.min(dt,p.stamina*stats.staminaDrainTime):0;
  const distance=SPEED*stats.moveSpeed*(dt+.5*sprintTime);
  if(length)movePlayer(map,p,x/length*distance,y/length*distance);
  if(sprint){p.stamina=Math.max(0,p.stamina-dt/stats.staminaDrainTime);if(p.stamina<1e-8){p.stamina=0;p.exhausted=true;}}
  else{p.stamina=Math.min(1,p.stamina+dt/stats.staminaRecoveryTime);if(p.stamina>1-1e-8){p.stamina=1;p.exhausted=false;}}
 }
 stepLoot(map,players,inputs,dt);
 stepCombat(map,players,inputs,dt);
 map.inside=players.filter(p=>inExit(p,map)).length;
 map.escape=players.length>0&&map.inside===players.length?Math.min(3,map.escape+dt):0;
 return map.escape>=3-1e-8;
}

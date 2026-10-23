import {ensureInventory} from './preparation.js';
import {canStand} from './terrain.js';
export const ITEMS=[{id:'food',name:'食料'},{id:'fuel',name:'燃料'},{id:'knife',name:'ナイフ'},{id:'rifle',name:'ライフル'},{id:'medicine',name:'医薬品'}];
export const OPEN_DISTANCE=48;
export function createInventory(){return Object.fromEntries(ITEMS.map(i=>[i.id,0]));}
export function createBoxes(map,random=Math.random){
 const {cols,rows}=map,seen=new Set(),queue=[[1,rows-2]],candidates=[];
 for(let index=0;index<queue.length;index++){
  const [col,row]=queue[index],key=row*cols+col;
  if(col<0||row<0||col>=cols||row>=rows||seen.has(key))continue;
  seen.add(key);if(!canStand(map,col*32+16,row*32+16))continue;
  if(!(col<3&&row>=rows-3)&&!(col>=cols-3&&row<4))candidates.push({col,row});
  queue.push([col-1,row],[col+1,row],[col,row-1],[col,row+1]);
 }
 const boxes=[],count=3+Math.min(2,Math.floor(random()*3));
 while(candidates.length&&boxes.length<count){
  const index=Math.min(candidates.length-1,Math.floor(random()*candidates.length)),cell=candidates[index];
  candidates[index]=candidates[candidates.length-1];candidates.pop();
  if(boxes.some(b=>Math.hypot(b.x-(cell.col*32+16),b.y-(cell.row*32+16))<96))continue;
  boxes.push({id:`box-${boxes.length+1}`,x:cell.col*32+16,y:cell.row*32+16,opened:false});
 }
 return boxes;
}
export function nearestBox(map,p){return (map.boxes||[]).filter(b=>!b.opened&&Math.hypot(b.x-p.x,b.y-p.y)<=OPEN_DISTANCE&&canReachBox(map,p,b)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];}
function canReachBox(map,p,box){
 // Do not allow opening through a tree or rock between player and box.
 const steps=Math.max(1,Math.ceil(Math.hypot(p.x-box.x,p.y-box.y)/6));
 for(let i=0;i<=steps;i++){const t=i/steps;if(!canStand(map,p.x+(box.x-p.x)*t,p.y+(box.y-p.y)*t))return false;}
 return true;
}
export function openBox(map,p,id,random=Math.random){
 const box=(map.boxes||[]).find(b=>b.id===id);
 if(!box||box.opened||Math.hypot(box.x-p.x,box.y-p.y)>OPEN_DISTANCE||!canReachBox(map,p,box))return null;
 const item=ITEMS[Math.min(4,Math.floor(random()*5))].id;
 const quantity=item==='food'||item==='fuel'?1+Math.min(3,Math.floor(random()*4)):1;
 ensureInventory(p);if(item==='food'||item==='fuel')p.inventory[item]+=quantity;else p.battleLoot[item]+=quantity;
 box.opened=true;box.openedBy=p.id;box.loot={item,quantity};return box.loot;
}
export function stepLoot(map,players,inputs,seconds,random=Math.random){
 const dt=Math.min(.1,Math.max(0,seconds));let collected=false;
 for(const player of players){
  const box=inputs.get(player.id)?.interact===true?nearestBox(map,player):null;
  if(!box){player.lootBoxId=null;player.lootProgress=0;continue;}
  if(player.lootBoxId!==box.id){player.lootBoxId=box.id;player.lootProgress=0;}
  player.lootProgress=Math.min(1,(player.lootProgress||0)+dt);
  if(player.lootProgress>=1-1e-8){if(openBox(map,player,box.id,random))collected=true;player.lootBoxId=null;player.lootProgress=0;}
 }
 return collected;
}

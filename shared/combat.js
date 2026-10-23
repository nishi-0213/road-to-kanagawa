import {ensureInventory,syncInventory} from './preparation.js';
export const MAX_HP=100,USABLE_ITEMS=['rifle','knife','medicine'];
export function itemCount(player,item){return player?.inventory?.[item]||0;}
export function availableItems(player){return USABLE_ITEMS.filter(item=>itemCount(player,item)>0);}
export function consumeMedicine(map,player){
 ensureInventory(player);
 const index=player.inventorySlots.findIndex(slot=>slot?.item==='medicine');
 if(index<0)return false;
 const slot=player.inventorySlots[index];if(--slot.quantity<=0)player.inventorySlots[index]=null;syncInventory(player);
 map.itemRevision=(map.itemRevision||0)+1;return true;
}
export function stepCombat(map,players,inputs,dt){
 map.effects=(map.effects||[]).map(effect=>({...effect,age:effect.age+dt})).filter(effect=>effect.age<1.5);
 for(const player of players){
  player.hp=Math.max(0,Math.min(MAX_HP,Number.isFinite(player.hp)?player.hp:MAX_HP));
  player.attackCooldown=Math.max(0,(player.attackCooldown||0)-dt);
  const input=inputs.get(player.id)||{},selected=USABLE_ITEMS.includes(input.selected)&&itemCount(player,input.selected)>0?input.selected:null;
  if(!input.use||selected!=='medicine'){player.healProgress=0;player.healLatched=false;}
  if(!input.use||!selected||player.hp===0)continue;
  if(selected==='medicine'){
   if(player.hp>=MAX_HP||player.healLatched){player.healProgress=0;continue;}
   player.healProgress=Math.min(3,(player.healProgress||0)+dt);
   if(player.healProgress>=3-1e-8){if(consumeMedicine(map,player))player.hp=Math.min(MAX_HP,player.hp+MAX_HP*.5);player.healProgress=0;player.healLatched=true;}
  }else if(player.attackCooldown<=1e-8&&Number.isFinite(input.aimX)&&Number.isFinite(input.aimY)){
   const dx=input.aimX-player.x,dy=input.aimY-player.y,angle=Math.atan2(dy,dx),distance=Math.min(1500,Math.hypot(dx,dy));
   map.effects.push({id:crypto.randomUUID(),type:selected,x:player.x,y:player.y,angle,distance,age:0});
   player.attackCooldown=selected==='rifle'?.3:.5;
  }
 }
}

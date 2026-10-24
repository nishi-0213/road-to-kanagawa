import {getPlayerStats} from './personality.js';
import {ensureInventory,syncInventory} from './preparation.js';
export const KNIFE_DAMAGE=20,STRONG_CHARGE_TIME=.5,STRONG_STAMINA_COST=.3;
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
  const stats=getPlayerStats(player,map,players);player.maxHp=stats.maxHp;player.healDuration=stats.medicineTime;
  player.hp=Math.max(0,Math.min(stats.maxHp,Number.isFinite(player.hp)?player.hp:stats.maxHp));
  player.attackCooldown=Math.max(0,(player.attackCooldown||0)-dt);
  const input=inputs.get(player.id)||{},selected=USABLE_ITEMS.includes(input.selected)&&itemCount(player,input.selected)>0?input.selected:null;
  player.selectedItem=selected;
  if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY))player.aimAngle=Math.atan2(input.aimY-player.y,input.aimX-player.x);
  if(!input.use||selected!=='medicine'){player.healProgress=0;player.healLatched=false;}
  const secondary=input.secondary===true&&selected==='knife'&&player.hp>0;
  if(!secondary){player.strongCharge=0;player.strongLatched=false;}
  if(secondary){
   player.healProgress=0;
   if(player.strongLatched||player.attackCooldown>1e-8||!Number.isFinite(input.aimX)||!Number.isFinite(input.aimY)||(player.stamina||0)<STRONG_STAMINA_COST-1e-8){player.strongCharge=0;continue;}
   player.strongCharge=Math.min(STRONG_CHARGE_TIME,(player.strongCharge||0)+dt);
   if(player.strongCharge>=STRONG_CHARGE_TIME-1e-8){
    player.stamina=Math.max(0,player.stamina-STRONG_STAMINA_COST);if(player.stamina<1e-8){player.stamina=0;player.exhausted=true;}
    map.effects.push({id:crypto.randomUUID(),type:'knife',strong:true,damage:stats.knifeDamage*1.5,damageMultiplier:1.5,x:player.x,y:player.y,angle:Math.atan2(input.aimY-player.y,input.aimX-player.x),distance:0,age:0});
    player.attackCooldown=stats.knifeCooldown;player.strongCharge=0;player.strongLatched=true;
   }
   continue;
  }
  if(!input.use||!selected||player.hp===0)continue;
  if(selected==='medicine'){
   if(player.hp>=stats.maxHp||player.healLatched){player.healProgress=0;continue;}
   player.healProgress=Math.min(stats.medicineTime,(player.healProgress||0)+dt);
   if(player.healProgress>=stats.medicineTime-1e-8){if(consumeMedicine(map,player)){player.hp=Math.min(stats.maxHp,player.hp+stats.maxHp*stats.medicineHeal);if(stats.medicineAura)for(const ally of players)if(ally.id!==player.id&&Math.hypot(ally.x-player.x,ally.y-player.y)<=192){const maxHp=getPlayerStats(ally).maxHp;ally.hp=Math.min(maxHp,(ally.hp??maxHp)+maxHp*stats.medicineAura);}}player.healProgress=0;player.healLatched=true;}
  }else if(player.attackCooldown<=1e-8&&Number.isFinite(input.aimX)&&Number.isFinite(input.aimY)){
   const dx=input.aimX-player.x,dy=input.aimY-player.y,angle=Math.atan2(dy,dx),distance=Math.min(stats.rifleRange,Math.hypot(dx,dy));
   map.effects.push({id:crypto.randomUUID(),type:selected,damage:selected==='knife'?stats.knifeDamage:stats.rifleDamage,damageMultiplier:1,x:player.x,y:player.y,angle,distance,age:0});
   player.attackCooldown=selected==='rifle'?stats.rifleCooldown:stats.knifeCooldown;
  }
 }
}

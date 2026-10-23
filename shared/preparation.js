export const INVENTORY_SLOTS=12,LOOT_SLOTS=12;
export const GEAR=['knife','rifle','medicine','pants','hat','tshirt'];
export const DEFENSE_VALUES={pants:2,hat:1,tshirt:1};
export function getDefense(player){return (player?.inventorySlots||[]).reduce((total,slot)=>total+(DEFENSE_VALUES[slot?.item]||0)*(slot?.quantity||0),0);}
export function createBattleLoot(){return Object.fromEntries(GEAR.map(item=>[item,0]));}
export function ensureInventory(player){
 player.inventory??=Object.fromEntries(['food','fuel',...GEAR].map(item=>[item,0]));
 if(!Array.isArray(player.inventorySlots)){
  player.inventorySlots=[];
  for(const item of GEAR)for(let i=0;i<(player.inventory[item]||0);i++)player.inventorySlots.push({id:crypto.randomUUID(),item,quantity:1});
  while(player.inventorySlots.length<INVENTORY_SLOTS)player.inventorySlots.push(null);
 }
 player.battleLoot??=createBattleLoot();for(const item of GEAR)player.battleLoot[item]??=0;syncInventory(player);return player;
}
export function syncInventory(player){for(const item of GEAR)player.inventory[item]=(player.inventorySlots||[]).filter(slot=>slot?.item===item).reduce((sum,slot)=>sum+slot.quantity,0);player.defense=getDefense(player);}
export function createPreparation(){return {roundId:null,revision:0,loot:Array(LOOT_SLOTS).fill(null)};}
export function finishBattleInventory(map,players){
 const state=createPreparation();state.roundId=map.id;
 if(map.inventoryVersion===2){let index=0;for(const box of map.boxes||[])if(box.opened&&GEAR.includes(box.loot?.item))state.loot[index++]={id:`${map.id}:${box.id}`,item:box.loot.item,quantity:box.loot.quantity};}
 for(const player of players){ensureInventory(player);player.battleLoot=createBattleLoot();}
 return state;
}
export function discardUnclaimed(state,players){state.loot.fill(null);state.revision++;for(const player of players){ensureInventory(player);player.battleLoot=createBattleLoot();}}
export function movePreparationItem(state,players,playerId,action){
 const player=players.find(p=>p.id===playerId);if(!player||!state||!action)return false;ensureInventory(player);
 const source=action.from?.area==='loot'?state.loot:action.from?.area==='inventory'?player.inventorySlots:null;
 const destination=action.to?.area==='loot'?state.loot:action.to?.area==='inventory'?player.inventorySlots:null;
 const from=action.from?.index,to=action.to?.index,trash=action.to?.area==='trash';
 if(!source||!Number.isInteger(from)||from<0||from>=source.length)return false;
 const item=source[from];if(!item||item.id!==action.itemId||!GEAR.includes(item.item))return false;
 if(!trash){
  if(!destination||!Number.isInteger(to)||to<0||to>=destination.length||(source===destination&&from===to))return false;
  if((destination[to]?.id??null)!==(action.targetItemId??null))return false;
  const replaced=destination[to];destination[to]=item;source[from]=replaced;
 }else source[from]=null;
 player.ready=false;state.revision++;syncInventory(player);return true;
}

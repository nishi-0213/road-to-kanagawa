import {availableItems,itemCount,MAX_HP} from '../../shared/combat.js';
import {ITEMS} from '../../shared/items.js';
export function cycleItem(current,player,direction){const items=availableItems(player);if(!items.length)return null;const index=items.indexOf(current);return items[((index<0?0:index)+direction+items.length)%items.length];}
export function renderCombatEffects(scene,map){
 if(scene.effectMap!==map.id){scene.effectMap=map.id;scene.seenEffects=new Set();}
 for(const effect of map.effects||[]){
  if(scene.seenEffects.has(effect.id))continue;scene.seenEffects.add(effect.id);
  const duration=effect.type==='rifle'?Math.max(.05,effect.distance/700):.25;
  if(effect.age>=duration)continue;
  const graphic=scene.add.graphics().setDepth(20000).setName('combat-effect');
  if(effect.type==='rifle'){
   graphic.lineStyle(3,0xffe7a3);graphic.lineBetween(-10,0,3,0);graphic.lineStyle(1,0xffffff);graphic.lineBetween(-7,0,3,0);graphic.setRotation(effect.angle);
   const distance=effect.distance*(effect.age/duration);graphic.setPosition(effect.x+Math.cos(effect.angle)*distance,effect.y+Math.sin(effect.angle)*distance);
   scene.tweens.add({targets:graphic,x:effect.x+Math.cos(effect.angle)*effect.distance,y:effect.y+Math.sin(effect.angle)*effect.distance,duration:(duration-effect.age)*1000,onComplete:()=>graphic.destroy()});
  }else{
   graphic.setPosition(effect.x,effect.y).setRotation(effect.angle);graphic.lineStyle(12,0xccefff,.3);graphic.beginPath();graphic.arc(0,0,37,-Math.PI/2,Math.PI/2);graphic.strokePath();graphic.lineStyle(4,0xedfbff,1);graphic.beginPath();graphic.arc(0,0,42,-Math.PI/2,Math.PI/2);graphic.strokePath();
   scene.tweens.add({targets:graphic,alpha:0,scaleX:1.25,scaleY:1.25,duration:(duration-effect.age)*1000,onComplete:()=>graphic.destroy()});
  }
 }
 // Keep deduplication bounded during long battles.
 if(scene.seenEffects.size>256)scene.seenEffects=new Set((map.effects||[]).map(effect=>effect.id));
}
export function updateCombatHud(scene,player){
 const items=availableItems(player);if(!items.includes(scene.selectedItem))scene.selectedItem=items[0]||null;
 const item=ITEMS.find(item=>item.id===scene.selectedItem);
 scene.equippedText?.setText(item?`選択：${item.name} ×${itemCount(player,item.id)}　ホイール：切替 / ${item.id==='medicine'?'左長押し3秒：治療':'左クリック：使用'}`:'使用できるアイテムを所持していません');
 scene.hpBar?.setScale((player?.hp??MAX_HP)/MAX_HP,1);scene.hpText?.setText(`HP ${Math.ceil(player?.hp??MAX_HP)}/${MAX_HP}`);
 for(const [id,frame] of scene.inventorySelections||[])frame.setVisible(id===scene.selectedItem);
 const progress=player?.healProgress||0;scene.healBack?.setVisible(progress>0);scene.healBar?.setVisible(progress>0).setScale(progress/3,1);scene.healText?.setVisible(progress>0).setText(`治療中 ${progress.toFixed(1)} / 3秒`);
}

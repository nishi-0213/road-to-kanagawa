import {getPlayerStats} from '../../shared/personality.js';
import {getDefense} from '../../shared/preparation.js';
import {availableItems,itemCount,MAX_HP} from '../../shared/combat.js';
import {ITEMS} from '../../shared/items.js';
export function cycleItem(current,player,direction){const items=availableItems(player);if(!items.length)return null;const index=items.indexOf(current);return items[((index<0?0:index)+direction+items.length)%items.length];}
export function renderCombatEffects(scene,map){
 if(scene.effectMap!==map.id){scene.effectMap=map.id;scene.seenEffects=new Set();}
 for(const effect of map.effects||[]){
  if(scene.seenEffects.has(effect.id))continue;scene.seenEffects.add(effect.id);
  const duration=effect.type==='rifle'?Math.max(.05,effect.distance/700):(effect.strong?.35:.25);
  if(effect.age>=duration)continue;
  const graphic=scene.add.graphics().setDepth(20000).setName('combat-effect');
  if(effect.type==='rifle'){
   graphic.lineStyle(3,0xffe7a3);graphic.lineBetween(-10,0,3,0);graphic.lineStyle(1,0xffffff);graphic.lineBetween(-7,0,3,0);graphic.setRotation(effect.angle);
   const distance=effect.distance*(effect.age/duration);graphic.setPosition(effect.x+Math.cos(effect.angle)*distance,effect.y+Math.sin(effect.angle)*distance);
   scene.tweens.add({targets:graphic,x:effect.x+Math.cos(effect.angle)*effect.distance,y:effect.y+Math.sin(effect.angle)*effect.distance,duration:(duration-effect.age)*1000,onComplete:()=>graphic.destroy()});
  }else{
   const radius=effect.strong?49:42,color=effect.strong?0xffcc68:0xedfbff;graphic.setPosition(effect.x,effect.y).setRotation(effect.angle);graphic.lineStyle(effect.strong?18:12,color,.3);graphic.beginPath();graphic.arc(0,0,radius-5,-Math.PI/2,Math.PI/2);graphic.strokePath();graphic.lineStyle(effect.strong?6:4,color,1);graphic.beginPath();graphic.arc(0,0,radius,-Math.PI/2,Math.PI/2);graphic.strokePath();
   scene.tweens.add({targets:graphic,alpha:0,scaleX:1.25,scaleY:1.25,duration:(duration-effect.age)*1000,onComplete:()=>graphic.destroy()});
  }
 }
 // Keep deduplication bounded during long battles.
 if(scene.seenEffects.size>256)scene.seenEffects=new Set((map.effects||[]).map(effect=>effect.id));
}
export function updateCombatHud(scene,player){
 const stats=getPlayerStats(player),maxHp=stats.maxHp;
 const items=availableItems(player);if(!items.includes(scene.selectedItem))scene.selectedItem=items[0]||null;
 const item=ITEMS.find(item=>item.id===scene.selectedItem);
 scene.equippedText?.setText(item?`選択：${item.name} ×${itemCount(player,item.id)}　ホイール：切替 / ${item.id==='medicine'?`左長押し${Number(stats.medicineTime.toFixed(2))}秒：治療`:item.id==='rifle'?'左：射撃 / 右長押し：照準':'左：攻撃 / 右長押し0.5秒：強攻撃（スタミナ30%）'}`:'使用できるアイテムを所持していません');
 scene.defenseText?.setText(`防御力 ${getDefense(player)}`);
 scene.hpBar?.setScale((player?.hp??maxHp)/maxHp,1);scene.hpText?.setText(`HP ${Math.ceil(player?.hp??maxHp)}/${maxHp}`);
 for(const [id,frame] of scene.inventorySelections||[])frame.setVisible(id===scene.selectedItem);
 const charge=player?.strongCharge||0;scene.healBack?.setVisible(charge>0);scene.healBar?.setVisible(charge>0).setScale(charge/.5,1).setFillStyle(0xffcc68);scene.healText?.setVisible(charge>0).setText(`強攻撃のため ${charge.toFixed(1)} / 0.5秒`);
}

export function updateCombatAim(scene,player,secondary){
 const visible=secondary&&scene.selectedItem==='rifle'&&itemCount(player,'rifle')>0&&(player.hp??MAX_HP)>0;
 if(visible&&!scene.scopeMark){
  const g=scene.add.graphics().setScrollFactor(0).setDepth(100001).setName('scope-mark');
  g.lineStyle(4,0x101820,.9);g.strokeCircle(0,0,32);g.lineStyle(1.5,0xf0f5eb,.95);g.strokeCircle(0,0,32);g.lineStyle(1,0xb4d79d,.9);g.strokeCircle(0,0,19);
  for(const sign of [-1,1]){g.lineBetween(sign*9,0,sign*44,0);g.lineBetween(0,sign*9,0,sign*44);for(const tick of [16,24]){g.lineBetween(sign*tick,-3,sign*tick,3);g.lineBetween(-3,sign*tick,3,sign*tick);}}
  g.fillStyle(0xff7063,1);g.fillCircle(0,0,2);scene.scopeMark=g;
 }
 scene.scopeMark?.setVisible(visible).setPosition(scene.input.activePointer.x,scene.input.activePointer.y);
 scene.input.setDefaultCursor(visible?'none':'default');
}

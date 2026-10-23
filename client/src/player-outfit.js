import {EQUIPMENT_SLOTS} from '../../shared/preparation.js';
export function createOutfit(scene,sprite){
 return EQUIPMENT_SLOTS.map(slot=>scene.add.image(sprite.x,sprite.y,slot.item).setDisplaySize(sprite.displayWidth,sprite.displayHeight).setVisible(false));
}
export function updateOutfit(sprite,layers,player){
 layers.forEach((layer,index)=>layer.setPosition(sprite.x,sprite.y).setDepth(sprite.depth+.1+index*.1).setVisible(player.equipmentSlots?.[index]?.item===EQUIPMENT_SLOTS[index].item));
}
export function createHeldItem(scene,sprite){return scene.add.image(sprite.x,sprite.y,'rifle').setDisplaySize(32,32).setVisible(false);}
export function updateHeldItem(actor,player,selected=player.selectedItem,angle=player.aimAngle){
 const held=actor.heldItem,visible=['rifle','knife','medicine'].includes(selected)&&(player.inventory?.[selected]||0)>0&&(player.hp??100)>0;
 held.setVisible(visible);if(!visible)return;
 held.setTexture(selected).setDepth(actor.sprite.depth+.5);
 if(selected==='rifle')held.setDisplaySize(32,32).setOrigin(.3,.5).setPosition(actor.sprite.x,actor.sprite.y).setRotation(Number.isFinite(angle)?angle:0).setFlipY(Math.cos(angle||0)<0);
 else held.setDisplaySize(selected==='knife'?24:20,selected==='knife'?24:20).setOrigin(.5).setPosition(actor.sprite.x+7,actor.sprite.y+4).setRotation(0).setFlipY(false);
}

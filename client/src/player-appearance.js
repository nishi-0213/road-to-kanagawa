import {HAIRSTYLES,SKIN_COLORS} from '../../shared/appearance.js';
export function createSkinMask(scene){
 if(scene.textures.exists('player-skin-mask'))return;
 const source=scene.textures.get('player').getSourceImage(),texture=scene.textures.createCanvas('player-skin-mask',source.width,source.height),context=texture.getContext();
 context.drawImage(source,0,0);const pixels=context.getImageData(0,0,source.width,source.height);
 for(let i=0;i<pixels.data.length;i+=4){if(pixels.data[i]<220||pixels.data[i+1]<220||pixels.data[i+2]<220)pixels.data[i+3]=0;else pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;}
 context.putImageData(pixels,0,0);texture.refresh();
}
export function createAppearanceLayers(scene,sprite){
 return {skin:scene.add.image(sprite.x,sprite.y,'player-skin-mask').setDisplaySize(sprite.displayWidth,sprite.displayHeight),hair:scene.add.image(sprite.x,sprite.y,'h_hage').setDisplaySize(sprite.displayWidth,sprite.displayHeight).setVisible(false)};
}
export function updateAppearanceLayers(sprite,layers,player){
 layers.skin.setPosition(sprite.x,sprite.y).setDepth(sprite.depth+.01).setTint(player.appearance?.skinColor??SKIN_COLORS[0]);
 const hair=player.appearance?.hair;layers.hair.setPosition(sprite.x,sprite.y).setDepth(sprite.depth+.05).setVisible(HAIRSTYLES.includes(hair)&&hair!==null&&hair!==undefined);
 if(layers.hair.visible)layers.hair.setTexture(hair);
}

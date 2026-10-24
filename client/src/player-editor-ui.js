import {HAIRSTYLES,SKIN_COLORS,skinToneForColor} from '../../shared/appearance.js';
import {cyclePersonality} from '../../shared/player-editor.js';
import {createAppearanceLayers,updateAppearanceLayers} from './player-appearance.js';
import {attachPersonalityTooltip} from './personality-tooltip.js';
export function clearPlayerEditor(scene){for(const element of scene.editorElements||[])element.remove();scene.editorElements=[];scene.editorView=null;}
export function drawPlayerEditor(scene,players,selfId,onEdit,onReady){
 const w=scene.scale.width,h=scene.scale.height,right=Math.min(230,w*.2),left=20,gap=14,usable=w-right-60,cardWidth=Math.min(320,(usable-gap*(players.length-1))/players.length),start=left+(usable-cardWidth*players.length-gap*(players.length-1))/2,scale=Math.max(.65,Math.min(1,(h-175)/530)),top=135;
 scene.editorView={ids:players.map(p=>p.id).join(','),cards:new Map()};scene.editorElements=[];scene.editorPlayers=players;
 const text=(x,y,value,style={})=>{const object=scene.text(x,y,value,style);scene.hud.add(object);return object;};
 const native=(type,x,y,width,height)=>{const input=document.createElement('input');input.type=type;input.className='player-editor-control';input.style.cssText=`position:fixed;z-index:3;left:${x}px;top:${y}px;width:${width}px;height:${height}px;padding:5px 8px;font:14px sans-serif;text-transform:none;`;document.querySelector('#app').append(input);scene.editorElements.push(input);return input;};
 players.forEach((player,index)=>{
  const x=start+index*(cardWidth+gap),mine=player.id===selfId,center=x+cardWidth/2;
  scene.hud.add(scene.add.rectangle(x,top,cardWidth,520*scale,0x142633).setOrigin(0).setStrokeStyle(1,mine?0x9cbe94:0x455d6c));
  const heading=text(center,top+10*scale,`プレイヤー${player.slot}${mine?'（あなた）':''}`,{fontSize:'15px',color:mine?'#dbedc6':'#a9bcc8'}).setOrigin(.5,0);
  const sprite=scene.add.image(center,top+67*scale,'player').setDisplaySize(72*scale,72*scale);scene.hud.add(sprite);const appearance=createAppearanceLayers(scene,sprite);scene.hud.add([appearance.skin,appearance.hair]);
  text(x+14,top+115*scale,'名前',{fontSize:'13px'});
  const name=native('text',x+14,top+137*scale,cardWidth-28,34*scale);name.maxLength=16;name.value=player.name;name.readOnly=!mine;name.setAttribute('aria-label',`プレイヤー${player.slot} 名前`);if(mine)name.addEventListener('input',()=>onEdit({name:name.value}));
  text(x+14,top+185*scale,'肌の色',{fontSize:'13px'});
  const skin=native('range',x+14,top+207*scale,cardWidth-28,28*scale);skin.min='0';skin.max='1';skin.step='.01';skin.value=String(skinToneForColor(player.appearance.skinColor));skin.disabled=!mine;skin.setAttribute('aria-label',`プレイヤー${player.slot} 肌の色`);skin.style.background=`linear-gradient(to right,${SKIN_COLORS.map(color=>'#'+color.toString(16).padStart(6,'0')).join(',')})`;if(mine)skin.addEventListener('input',()=>onEdit({skinTone:Number(skin.value)}));
  const values=[];
  for(let row=0;row<4;row++){
   const y=top+(265+row*55)*scale;
   text(x+14,y,row===0?'髪型':`性格${row}`,{fontSize:'13px'});
   const value=text(center,y+22*scale,'',{fontSize:'15px',color:'#f1e6be'}).setOrigin(.5,0);if(row>0)attachPersonalityTooltip(scene,value,null);values.push(value);
   for(const direction of [-1,1]){const arrow=text(direction<0?x+20:x+cardWidth-20,y+23*scale,direction<0?'‹':'›',{fontSize:'22px',color:mine?'#e4f1c7':'#526775'}).setPadding(6,0,6,0).setOrigin(.5,0);if(mine)arrow.setScrollFactor(0).setInteractive({useHandCursor:true}).on('pointerdown',pointer=>{if(pointer.button!==0)return;const current=scene.editorPlayers.find(p=>p.id===selfId);if(row===0){const index=HAIRSTYLES.indexOf(current.appearance.hair);onEdit({hair:HAIRSTYLES[(index+direction+HAIRSTYLES.length)%HAIRSTYLES.length]});}else onEdit({personalities:cyclePersonality(current.personalities,row-1,direction)});});}
  }
  const readyY=top+32+index*70,readyX=w-20-right/2,button=scene.add.rectangle(readyX,readyY,right,52,0x28465c).setScrollFactor(0).setStrokeStyle(1,mine?0x80d5ee:0x405461);scene.hud.add(button);
  const readyLabel=text(readyX,readyY,'',{fontSize:'14px',align:'center'}).setOrigin(.5);
  if(mine)button.setInteractive({useHandCursor:true}).on('pointerdown',pointer=>{if(pointer.button===0&&button.getBounds().contains(pointer.x,pointer.y)){name.blur();onReady();}});
  scene.editorView.cards.set(player.id,{sprite,appearance,name,skin,values,button,readyLabel,heading});
 });
 text(w-20-right/2,top+32+players.length*70,'全員の準備がそろうと\nゲームを開始します。',{fontSize:'13px',align:'center'}).setOrigin(.5,0);
 updatePlayerEditor(scene,players,selfId);
}
export function updatePlayerEditor(scene,players,selfId){
 if(!scene.editorView)return;scene.editorPlayers=players;
 for(const player of players){const card=scene.editorView.cards.get(player.id);if(!card)continue;updateAppearanceLayers(card.sprite,card.appearance,player);if(document.activeElement!==card.name)card.name.value=player.name||`プレイヤー${player.slot}`;if(document.activeElement!==card.skin)card.skin.value=String(skinToneForColor(player.appearance.skinColor));card.values[0].setText(['ハゲ','七三','トラ','なし'][HAIRSTYLES.indexOf(player.appearance.hair)]);player.personalities.forEach((trait,index)=>card.values[index+1].setText(trait).setData('personality',trait));card.button.setFillStyle(player.ready?0x245d50:player.id===selfId?0x28465c:0x1b2c39);card.readyLabel.setText(`${player.name||`プレイヤー${player.slot}`}\n${player.connected===false?'再接続を待っています':player.ready?'準備完了 ✓':'準備完了'}`);}
}

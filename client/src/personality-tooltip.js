import {PERSONALITY_DETAILS} from '../../shared/personality.js';
export function attachPersonalityTooltip(scene,label,trait){
 label.setData('personality',trait).setScrollFactor(0).setInteractive();
 const show=pointer=>{const value=label.getData('personality');if(!value)return;if(!scene.personalityTooltip?.active){const panel=scene.add.container(0,0).setScrollFactor(0).setDepth(300000);panel.add(scene.add.rectangle(0,0,288,160,0x0c1720,.98).setOrigin(0).setStrokeStyle(1,0xb3c98a));panel.add(scene.text(12,10,'',{fontSize:'14px',color:'#e3edda',wordWrap:{width:264,useAdvancedWrap:true}}));scene.personalityTooltip=panel;}scene.personalityTooltip.list[1].setText(`${value}\n${PERSONALITY_DETAILS[value]?.description||''}\n効果：${PERSONALITY_DETAILS[value]?.effect||'未設定'}`);scene.personalityTooltip.setPosition(Math.max(8,Math.min(scene.scale.width-296,pointer.x+14)),Math.max(8,Math.min(scene.scale.height-168,pointer.y+18))).setVisible(true);};
 label.on('pointerover',show).on('pointermove',show).on('pointerout',()=>scene.personalityTooltip?.setVisible(false));
}

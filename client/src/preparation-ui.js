import {getDefense} from '../../shared/preparation.js';
import {ITEMS} from '../../shared/items.js';

export function drawPreparationInventory(scene,players,selfId,state){
 const width=scene.scale.width,height=scene.scale.height,side=Math.min(230,Math.max(170,width*.18));
 const left=20,mainWidth=Math.max(260,width-side-50),top=height/3+116,stripHeight=100,trashWidth=104,gap=16,lootWidth=mainWidth-trashWidth-gap;
 scene.prepItems=new Map();scene.prepFrames=[];scene.inventoryPanels=[];
 const text=(x,y,value,style={})=>{const t=scene.text(x,y,value,style);scene.hud.add(t);return t;};
 const rect=(x,y,w,h,color,alpha=1)=>{const r=scene.add.rectangle(x,y,w,h,color,alpha).setOrigin(0);scene.hud.add(r);return r;};
 const food=players.reduce((sum,p)=>sum+(p.inventory?.food||0),0),fuel=players.reduce((sum,p)=>sum+(p.inventory?.fuel||0),0);
 scene.hud.add(scene.add.image(left+18,top-27,'food').setDisplaySize(24,24));text(left+38,top-37,`食料 ${food}`,{fontSize:'20px',color:'#f2dfad'});
 scene.hud.add(scene.add.image(left+218,top-27,'fuel').setDisplaySize(24,24));text(left+238,top-37,`燃料 ${fuel}`,{fontSize:'20px',color:'#f2dfad'});
 function slot(area,index,x,y,size,item,editable,playerId){
  const frame=scene.add.rectangle(x,y,size-3,size-3,0x1b2d39).setStrokeStyle(1,editable?0x8da99b:0x40515d);scene.hud.add(frame);
  scene.prepFrames.push({area,index,x,y,size,playerId,editable,frame});
  if(editable){frame.setInteractive({dropZone:true});frame.setData('drop',{area,index,targetItemId:item?.id??null});frame.setData('stroke',0x8da99b);}
  if(!item)return;
  const container=scene.add.container(x,y).setSize(size-6,size-6).setName(`prep-item-${item.id}`);
  container.add(scene.add.image(0,-4,item.item).setDisplaySize(Math.min(30,size-16),Math.min(30,size-16)));
  container.add(scene.text(0,size/2-12,ITEMS.find(i=>i.id===item.item)?.name||item.item,{fontSize:`${Math.max(9,Math.min(11,size/5))}px`,color:'#e8eff0'}).setOrigin(.5));
  container.add(scene.text(size/2-7,-size/2+5,String(item.quantity),{fontSize:'10px',color:'#ffe7a5'}).setOrigin(1,0));
  scene.hud.add(container);scene.prepItems.set(item.id,container);
  if(editable){container.setInteractive({useHandCursor:true});scene.input.setDraggable(container);container.setData('source',{area,index});container.setData('itemId',item.id);container.setData('home',{x,y});}else container.setAlpha(.65);
 }
 rect(left,top,lootWidth,stripHeight,0x142633).setStrokeStyle(1,0xa5b5ad);text(left+12,top+10,'直前の戦闘で取得したアイテム',{fontSize:'16px',color:'#f4e6bb'});
 if(lootWidth>500)text(left+12,top+29,'自分の欄へ収納してください。残りは次の戦闘開始時に消去されます。',{fontSize:'10px',color:'#b7c5bd'});
 const size=Math.max(20,Math.min(52,(lootWidth-20)/state.loot.length)),start=left+(lootWidth-state.loot.length*size)/2;
 state.loot.forEach((item,index)=>slot('loot',index,start+size*(index+.5),top+66,size,item,true,null));
 const trash=rect(left+lootWidth+gap,top,trashWidth,stripHeight,0x39252a).setStrokeStyle(1,0xbe8b82).setInteractive({dropZone:true});trash.setData('drop',{area:'trash'});trash.setData('stroke',0xbe8b82);scene.trashFrame=trash;
 text(left+lootWidth+gap+trashWidth/2,top+36,'捨てる',{fontSize:'22px',color:'#f1c8b9'}).setOrigin(.5);text(left+lootWidth+gap+trashWidth/2,top+69,'ドロップで削除',{fontSize:'11px',color:'#d3aaa2'}).setOrigin(.5);
 const panelTop=top+stripHeight+38,panelGap=14,panelWidth=Math.min(360,(mainWidth-panelGap*(players.length-1))/players.length),panelHeight=Math.max(68,height-panelTop-20);
 players.forEach((player,order)=>{
  const x=left+order*(panelWidth+panelGap),mine=player.id===selfId,slots=player.inventorySlots||Array(12).fill(null),rows=Math.ceil(slots.length/4),cell=Math.max(16,Math.min(52,(panelWidth-20)/4,(panelHeight-42)/rows));
  text(x,panelTop-25,`プレイヤー${player.slot} アイテム欄${mine?'（あなた）':''}`,{fontSize:`${Math.max(9,Math.min(16,(panelWidth-8)/(mine?19:14)))}px`,color:mine?'#d0e8b3':'#a1b3be'});
  rect(x,panelTop,panelWidth,panelHeight,0x11222d).setStrokeStyle(1,mine?0x9cbf94:0x455d6c);
  scene.inventoryPanels.push({playerId:player.id,x,y:panelTop,width:panelWidth,height:panelHeight});
  text(x+10,panelTop+8,`防御力 ${getDefense(player)}`,{fontSize:'13px',color:'#bed5f3'});
  const gridX=x+(panelWidth-cell*4)/2,gridY=panelTop+34;
  slots.forEach((item,index)=>slot('inventory',index,gridX+(index%4+.5)*cell,gridY+(Math.floor(index/4)+.5)*cell,cell,item,mine,player.id));
 });
}

export function installPreparationDrag(scene,{isPreparation,onMove,onRefresh}){
 scene.input.on('dragstart',(pointer,object)=>{object.setData('leftDrag',pointer.leftButtonDown());if(!object.getData('leftDrag')||!isPreparation())return;scene.dragging=true;scene.pendingDrop=null;object.setAlpha(.8);scene.hud.bringToTop(object);});
 scene.input.on('drag',(_,object,x,y)=>{if(object.getData('leftDrag')&&isPreparation())object.setPosition(x,y);});
 scene.input.on('dragenter',(_,object,zone)=>{if(object.getData('leftDrag'))zone.setStrokeStyle(2,0xf7df8b);});
 scene.input.on('dragleave',(_,object,zone)=>zone.setStrokeStyle(1,zone.getData('stroke')));
 scene.input.on('drop',(_,object,zone)=>{
  if(!isPreparation()||!object.getData('leftDrag'))return;const target=zone.getData('drop');if(!target)return;
  scene.pendingDrop={type:'move_item',from:object.getData('source'),to:{area:target.area,index:target.index},itemId:object.getData('itemId'),targetItemId:target.targetItemId??null};
 });
 scene.input.on('dragend',(_,object)=>{if(!object.getData('leftDrag'))return;object.setData('leftDrag',false);
  const action=scene.pendingDrop;scene.pendingDrop=null;scene.dragging=false;
  for(const slot of scene.prepFrames||[])if(slot.editable)slot.frame.setStrokeStyle(1,0x8da99b);scene.trashFrame?.setStrokeStyle(1,0xbe8b82);
  if(object.active){const home=object.getData('home');if(home)object.setPosition(home.x,home.y).setAlpha(1);}
  if(action&&isPreparation())onMove(action);
  if(scene.refreshAfterDrag){scene.refreshAfterDrag=false;onRefresh();}
 });
}

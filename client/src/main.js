import Phaser from 'phaser';
import './style.css';
const form=document.querySelector('#login'),codeInput=document.querySelector('#code'),message=document.querySelector('#message');
let socket=null,connecting=false,gameScene=null,mode=null,room='',count=0,connectionTimer,phase='PREPARATION',players=[],selfId=null;
function busy(value){connecting=value;form.querySelectorAll('button,input').forEach(el=>el.disabled=value);}
function report(text){message.textContent=text;}
function showLogin(text=''){mode=null;form.hidden=false;busy(false);report(text);gameScene?.refresh();}
function enter(nextMode){mode=nextMode;form.hidden=true;busy(false);report('');gameScene?.refresh();}
function leave(){clearTimeout(connectionTimer);const ws=socket;socket=null;ws?.close();showLogin();}
async function join(code){
  if(connecting)return;
  code=code.trim().toUpperCase();
  if(!/^[A-F0-9]{12}$/.test(code)){report('12文字のルームコードを入力してください。');return;}
  busy(true);report('接続中…');room=code;
  const url=new URL(`/api/rooms/${code}/ws`,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
  const ws=socket=new WebSocket(url);
  connectionTimer=setTimeout(()=>{if(socket===ws){socket=null;ws.close();showLogin('接続がタイムアウトしました。再度お試しください。');}},10000);
  ws.onmessage=event=>{if(socket!==ws)return;try{const data=JSON.parse(event.data);if(data.type==='room'){clearTimeout(connectionTimer);count=data.count;phase=data.phase;players=data.players;selfId=data.selfId;enter('online');}}catch{}};
  ws.onerror=()=>{if(socket===ws)report('接続できません。ルームコード・満員・通信状態をご確認ください。');};
  ws.onclose=()=>{if(socket!==ws)return;clearTimeout(connectionTimer);socket=null;showLogin('接続が終了しました。ルームコード・満員・通信状態をご確認ください。');};
}
document.querySelector('#solo').onclick=()=>{if(!connecting){phase='PREPARATION';selfId='solo';players=[{id:'solo',slot:1,ready:false}];enter('solo');}};
document.querySelector('#create').onclick=async()=>{
  if(connecting)return;busy(true);report('ルーム作成中…');
  try{const response=await fetch('/api/rooms',{method:'POST',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const data=await response.json();busy(false);await join(data.code);}catch{busy(false);report('ルームを作成できませんでした。再度お試しください。');}
};
form.onsubmit=e=>{e.preventDefault();join(codeInput.value);};
const invited=new URL(location.href).searchParams.get('room');if(invited)codeInput.value=invited.toUpperCase();
class EmptyGame extends Phaser.Scene{
  create(){gameScene=this;this.scale.on('resize',()=>this.refresh());this.refresh();}
  refresh(){
    this.children.removeAll(true);
    if(!mode)return;
    const style={fontFamily:'sans-serif',fontSize:'16px',color:'#b8cbd7'};
    this.add.text(20,20,phase==='BATTLE'?'戦闘フェーズ':'準備フェーズ',{...style,fontSize:'26px',color:'#eff7fa'});
    this.add.text(20,62,mode==='solo'?'1人プレイ':`ルームコード：${room}　${count}/4人`,style);
    const exit=this.add.text(this.scale.width-20,20,'退出',style).setOrigin(1,0).setInteractive({useHandCursor:true});exit.on('pointerdown',leave);
    if(mode==='online'){
      const copy=this.add.text(20,90,'招待URLをコピー',{...style,fontSize:'14px'}).setInteractive({useHandCursor:true});
      copy.on('pointerdown',async()=>{const url=new URL(location.href);url.search='';url.searchParams.set('room',room);try{await navigator.clipboard.writeText(url.href);copy.setText('コピーしました');}catch{copy.setText('ルームコードを共有してください：'+room);}});
    }
    if(phase==='PREPARATION'){
      const width=Math.min(230,this.scale.width-40),x=this.scale.width-20-width/2;
      const gap=Math.min(70,Math.max(42,(this.scale.height-145)/Math.max(1,players.length)));
      players.forEach((player,index)=>{
        const mine=player.id===selfId,y=145+index*gap;
        const background=this.add.rectangle(x,y,width,50,player.ready?0x245d50:mine?0x28465c:0x1b2c39).setStrokeStyle(1,mine?0x80d5ee:0x405461);
        const label=`プレイヤー${player.slot}${mine?'（あなた）':''}\n${player.ready?'準備完了 ✓':'準備完了'}`;
        this.add.text(x,y,label,{...style,fontSize:'16px',align:'center',color:mine?'#eff7fa':'#8da2b1'}).setOrigin(.5);
        if(mine){
          background.setInteractive({useHandCursor:true});
          background.on('pointerdown',()=>{
            if(mode==='solo'){players[0].ready=true;phase='BATTLE';this.refresh();}
            else if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ready',ready:!player.ready}));
          });
        }
      });
    }
  }
}
new Phaser.Game({type:Phaser.AUTO,parent:'app',backgroundColor:'#101820',scene:EmptyGame,scale:{mode:Phaser.Scale.RESIZE,width:window.innerWidth,height:window.innerHeight},audio:{noAudio:true}});

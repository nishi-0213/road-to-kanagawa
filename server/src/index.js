import {ensureInventory,createPreparation,finishBattleInventory,discardUnclaimed,movePreparationItem} from '../../shared/preparation.js';
import {createRoute,upgradeRoute,selectNode,finishBattle,canStartBattle,startBattle} from '../../shared/route.js';
import {createBattle,stepBattle} from '../../shared/battle.js';
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const origin=request.headers.get('Origin');
    if(url.pathname.startsWith('/api/') && origin && origin!==url.origin)return new Response('Forbidden origin',{status:403});
    if(url.pathname==='/api/health')return Response.json({ok:true});
    if(url.pathname==='/api/rooms' && request.method==='POST'){
      const code=crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
      const response=await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch('https://room/init',{method:'POST'});
      if(!response.ok)return new Response('Room creation failed',{status:503});
      return Response.json({code},{headers:{'Cache-Control':'no-store'}});
    }
    const match=url.pathname.match(/^\/api\/rooms\/([A-F0-9]{12})\/ws$/);
    if(match)return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
    if(url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
    return env.ASSETS.fetch(request);
  }
};
export class GameRoom{
  constructor(ctx){
    this.ctx=ctx;this.initialized=false;this.phase='PREPARATION';this.battle=null;this.inputs=new Map();this.timer=null;this.route=null;this.preparation=createPreparation();
    ctx.blockConcurrencyWhile(async()=>{
      // Upgrade sockets opened by the previous room-only deployment.
      const sockets=this.sockets();
      const used=new Set(sockets.map(ws=>ws.deserializeAttachment()?.slot).filter(Boolean));
      for(const ws of sockets){if(!ws.deserializeAttachment()){const slot=[1,2,3,4].find(n=>!used.has(n));used.add(slot);ws.serializeAttachment({id:crypto.randomUUID(),slot,ready:false});}}
      for(const ws of sockets){const player=ensureInventory(ws.deserializeAttachment());ws.serializeAttachment(player);}
      this.preparation=await ctx.storage.get('preparation')||createPreparation();
      this.initialized=await ctx.storage.get('initialized')===true;
      this.phase=await ctx.storage.get('phase')||'PREPARATION';
      const savedRoute=await ctx.storage.get('route');this.route=upgradeRoute(savedRoute);
      if(savedRoute?.version!==2)await ctx.storage.put('route',this.route);
      if(!this.sockets().length){this.phase='PREPARATION';this.route=createRoute();this.preparation=createPreparation();await ctx.storage.put({phase:this.phase,route:this.route,preparation:this.preparation});}
      if(this.phase==='BATTLE'){if(!this.route.battleStarted.includes(this.route.current))this.route.battleStarted.push(this.route.current);await ctx.storage.put('route',this.route);this.battle=await ctx.storage.get('battle');if(this.battle){this.battle.escape=0;this.startTimer();}else{this.phase='PREPARATION';await ctx.storage.put('phase',this.phase);}}
    });
  }
  async fetch(request){
    if(new URL(request.url).pathname==='/init' && request.method==='POST'){
      await this.ctx.storage.put('initialized',true);this.initialized=true;return new Response('ok');
    }
    if(!this.initialized)return new Response('Room not found',{status:404});
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
    if(this.phase!=='PREPARATION')return new Response('Battle already started',{status:409});
    const sockets=this.sockets();
    if(sockets.length>=4)return new Response('Room full',{status:409});
    const used=new Set(sockets.map(ws=>ws.deserializeAttachment().slot));
    const slot=[1,2,3,4].find(n=>!used.has(n));
    const [client,server]=Object.values(new WebSocketPair());
    server.serializeAttachment(ensureInventory({id:crypto.randomUUID(),slot,ready:false}));
    this.ctx.acceptWebSocket(server);this.broadcast();
    return new Response(null,{status:101,webSocket:client});
  }
  sockets(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===1);}
  players(){return this.sockets().map(ws=>ws.deserializeAttachment()).sort((a,b)=>a.slot-b.slot);}
  broadcast(){
    const players=this.players();
    for(const ws of this.sockets()){
      try{ws.send(JSON.stringify({type:'room',count:players.length,phase:this.phase,route:this.route,preparation:this.preparation,battle:this.battle,players,selfId:ws.deserializeAttachment().id}));}catch{}
    }
  }
  async advance(){
    const players=this.players();
    if(!players.length){this.phase='PREPARATION';this.battle=null;this.route=createRoute();this.preparation=createPreparation();this.stopTimer();await this.ctx.storage.put({phase:this.phase,route:this.route,preparation:this.preparation});}
    else if(this.phase==='PREPARATION' && canStartBattle(this.route)&&players.every(p=>p.ready)){
      startBattle(this.route);
      discardUnclaimed(this.preparation,players);
      this.phase='BATTLE';this.battle=createBattle(players);this.battle.city=this.route.nodes[this.route.current].name;
      for(const ws of this.sockets())ws.serializeAttachment(players.find(p=>p.id===ws.deserializeAttachment().id));
      await this.ctx.storage.put({phase:this.phase,battle:this.battle,route:this.route,preparation:this.preparation});this.startTimer();
    }
    this.broadcast();
  }
  startTimer(){
    if(this.timer)return;
    this.lastTick=Date.now();
    this.timer=setInterval(()=>this.tick(),50);
  }
  stopTimer(){clearInterval(this.timer);this.timer=null;this.inputs.clear();}
  tick(){
    if(this.phase!=='BATTLE'||!this.battle)return;
    const now=Date.now(),dt=(now-this.lastTick)/1000;this.lastTick=now;
    for(const [id,input] of this.inputs)if(now-input.at>250)this.inputs.delete(id);
    const players=this.players();
    if(!players.length){this.stopTimer();return;}
    const revisionBefore=this.battle.itemRevision||0;
    const openedBefore=(this.battle.boxes||[]).filter(box=>box.opened).length;
    const complete=stepBattle(this.battle,players,this.inputs,dt);
    if((this.battle.itemRevision||0)!==revisionBefore||(this.battle.boxes||[]).filter(box=>box.opened).length>openedBefore)this.ctx.waitUntil(this.ctx.storage.put('battle',this.battle));
    for(const ws of this.sockets()){const p=players.find(p=>p.id===ws.deserializeAttachment().id);if(p)ws.serializeAttachment(p);}
    if(complete){
      this.preparation=finishBattleInventory(this.battle,players);
      for(const ws of this.sockets()){const p=players.find(p=>p.id===ws.deserializeAttachment().id);if(p)ws.serializeAttachment(p);}
      this.phase='PREPARATION';this.battle=null;finishBattle(this.route);this.stopTimer();
      for(const ws of this.sockets())ws.serializeAttachment({...ws.deserializeAttachment(),ready:false});
      this.ctx.waitUntil(this.ctx.storage.put({phase:this.phase,route:this.route,preparation:this.preparation}));
    }
    this.broadcast();
  }
  async webSocketMessage(ws,raw){
    if(typeof raw!=='string'||raw.length>768){ws.close(1008,'Invalid message');return;}
    let message;try{message=JSON.parse(raw);}catch{ws.close(1008,'Invalid JSON');return;}
    if(message?.type==='move_item'){
      if(this.phase==='PREPARATION'){const players=this.players(),id=ws.deserializeAttachment().id;
        if(movePreparationItem(this.preparation,players,id,message)){
          for(const client of this.sockets()){const player=players.find(p=>p.id===client.deserializeAttachment().id);if(player)client.serializeAttachment(player);}
          await this.ctx.storage.put('preparation',this.preparation);
        }this.broadcast();
      }return;
    }
    if(message?.type==='select_node'){
      if(this.phase==='PREPARATION'&&selectNode(this.route,message.target)){
        for(const client of this.sockets())client.serializeAttachment({...client.deserializeAttachment(),ready:false});
        await this.ctx.storage.put('route',this.route);this.broadcast();
      }return;
    }
    if(message?.type==='open_box')return; // Older clients cannot bypass the timed interaction.
    if(message?.type==='input'){
      if(this.phase==='BATTLE'){const id=ws.deserializeAttachment().id;this.inputs.set(id,{left:message.left===true,right:message.right===true,up:message.up===true,down:message.down===true,sprint:message.sprint===true,interact:message.interact===true,use:message.use===true,selected:['rifle','knife','medicine'].includes(message.selected)?message.selected:null,aimX:Number.isFinite(message.aimX)?Math.max(-10000,Math.min(10000,message.aimX)):null,aimY:Number.isFinite(message.aimY)?Math.max(-10000,Math.min(10000,message.aimY)):null,at:Date.now()});}return;
    }
    if(message?.type!=='ready'||typeof message.ready!=='boolean'){ws.close(1008,'Invalid action');return;}
    if(this.phase!=='PREPARATION'||!canStartBattle(this.route))return;
    const player=ws.deserializeAttachment();
    if(player.ready===message.ready)return;
    // Identity always comes from the socket; clients cannot ready another player.
    ws.serializeAttachment({...player,ready:message.ready});
    await this.advance();
  }
  async webSocketClose(ws){try{ws.close(1000);}finally{await this.advance();}}
  async webSocketError(ws){ws.close(1011,'Connection error');await this.advance();}
}

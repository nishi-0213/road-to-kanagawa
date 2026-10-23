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
    this.ctx=ctx;this.initialized=false;this.phase='PREPARATION';
    ctx.blockConcurrencyWhile(async()=>{
      // Upgrade sockets opened by the previous room-only deployment.
      const sockets=this.sockets();
      const used=new Set(sockets.map(ws=>ws.deserializeAttachment()?.slot).filter(Boolean));
      for(const ws of sockets){if(!ws.deserializeAttachment()){const slot=[1,2,3,4].find(n=>!used.has(n));used.add(slot);ws.serializeAttachment({id:crypto.randomUUID(),slot,ready:false});}}
      this.initialized=await ctx.storage.get('initialized')===true;
      this.phase=await ctx.storage.get('phase')||'PREPARATION';
      if(!this.sockets().length){this.phase='PREPARATION';await ctx.storage.put('phase',this.phase);}
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
    server.serializeAttachment({id:crypto.randomUUID(),slot,ready:false});
    this.ctx.acceptWebSocket(server);this.broadcast();
    return new Response(null,{status:101,webSocket:client});
  }
  sockets(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===1);}
  players(){return this.sockets().map(ws=>ws.deserializeAttachment()).sort((a,b)=>a.slot-b.slot);}
  broadcast(){
    const players=this.players();
    for(const ws of this.sockets()){
      try{ws.send(JSON.stringify({type:'room',count:players.length,phase:this.phase,players,selfId:ws.deserializeAttachment().id}));}catch{}
    }
  }
  async advance(){
    const players=this.players();
    if(!players.length){this.phase='PREPARATION';await this.ctx.storage.put('phase',this.phase);}
    else if(this.phase==='PREPARATION' && players.every(p=>p.ready)){
      this.phase='BATTLE';await this.ctx.storage.put('phase',this.phase);
    }
    this.broadcast();
  }
  async webSocketMessage(ws,raw){
    if(typeof raw!=='string'||raw.length>256){ws.close(1008,'Invalid message');return;}
    let message;try{message=JSON.parse(raw);}catch{ws.close(1008,'Invalid JSON');return;}
    if(message?.type!=='ready'||typeof message.ready!=='boolean'){ws.close(1008,'Invalid action');return;}
    if(this.phase!=='PREPARATION')return;
    const player=ws.deserializeAttachment();
    if(player.ready===message.ready)return;
    // Identity always comes from the socket; clients cannot ready another player.
    ws.serializeAttachment({...player,ready:message.ready});
    await this.advance();
  }
  async webSocketClose(ws){try{ws.close(1000);}finally{await this.advance();}}
  async webSocketError(ws){ws.close(1011,'Connection error');await this.advance();}
}

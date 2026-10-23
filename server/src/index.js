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
    this.ctx=ctx;this.initialized=false;
    ctx.blockConcurrencyWhile(async()=>{this.initialized=await ctx.storage.get('initialized')===true;});
  }
  async fetch(request){
    if(new URL(request.url).pathname==='/init' && request.method==='POST'){
      await this.ctx.storage.put('initialized',true);this.initialized=true;return new Response('ok');
    }
    if(!this.initialized)return new Response('Room not found',{status:404});
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
    if(this.sockets().length>=4)return new Response('Room full',{status:409});
    const [client,server]=Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);this.broadcast();
    return new Response(null,{status:101,webSocket:client});
  }
  sockets(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===1);}
  broadcast(){const sockets=this.sockets(),data=JSON.stringify({type:'room',count:sockets.length});for(const ws of sockets){try{ws.send(data);}catch{}}}
  webSocketMessage(ws){ws.close(1008,'No game messages supported yet');}
  webSocketClose(ws,code){ws.close(code===1005?1000:code);this.broadcast();}
  webSocketError(ws){ws.close(1011,'Connection error');this.broadcast();}
}

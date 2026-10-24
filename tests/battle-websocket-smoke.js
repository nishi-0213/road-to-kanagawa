import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=process.env.TEST_URL||'http://127.0.0.1:8787';
const {code}=await (await fetch(`${base}/api/rooms`,{method:'POST'})).json();const group=[];let timers=[];
async function until(fn,ms=8000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,25));}}
const send=(p,m)=>p.ws.send(JSON.stringify(m));
try{
 for(let i=0;i<4;i++){const p={ws:new WebSocket(`${base.replace(/^http/,'ws')}/api/rooms/${code}/ws`),state:null};group.push(p);p.ws.on('message',raw=>p.state=JSON.parse(raw));await new Promise((r,j)=>{p.ws.once('open',r);p.ws.once('error',j);});await until(()=>p.state);}
 await until(()=>group.every(p=>p.state.count===4));group.forEach(p=>send(p,{type:'ready',ready:true}));await until(()=>group.every(p=>p.state.phase==='PREPARATION'));group.forEach(p=>send(p,{type:'ready',ready:true}));await until(()=>group.every(p=>p.state.phase==='BATTLE'));
 assert.ok(group.every(p=>p.state.battle.id===group[0].state.battle.id));assert.ok(group.every(p=>p.state.players[0].y>p.state.battle.rows*32-100));
 // Coordinates submitted by a client never override authoritative movement.
 const first=group[0],initial=first.state.players[0].x;send(first,{type:'input',x:99999,y:0});await new Promise(r=>setTimeout(r,150));assert.equal(first.state.players[0].x,initial);
 const move=p=>{
  const map=p.state.battle,me=p.state.players.find(x=>x.id===p.state.selfId),blocked=new Set([...map.trees,...(map.rocks||[])].map(t=>t.row*map.cols+t.col));
  const start=Math.floor(me.y/32)*map.cols+Math.floor(me.x/32),goal=map.cols+(map.cols-2),parents=new Map([[start,null]]),queue=[start];
  for(let i=0;i<queue.length&&!parents.has(goal);i++){
   const cell=queue[i],x=cell%map.cols,y=Math.floor(cell/map.cols);
   for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]){const nx=x+dx,ny=y+dy,n=ny*map.cols+nx;if(nx<0||ny<0||nx>=map.cols||ny>=map.rows||blocked.has(n)||parents.has(n))continue;parents.set(n,cell);queue.push(n);}
  }
  assert.ok(parents.has(goal));const path=[];for(let n=goal;n!==null;n=parents.get(n))path.unshift({x:(n%map.cols)*32+16,y:Math.floor(n/map.cols)*32+16});
  let index=0;
  return setInterval(()=>{if(p.state.phase!=='BATTLE')return;const me=p.state.players.find(x=>x.id===p.state.selfId);while(index<path.length-1&&Math.hypot(me.x-path[index].x,me.y-path[index].y)<6)index++;const t=path[index];send(p,{type:'input',right:me.x<t.x-3,left:me.x>t.x+3,up:me.y>t.y+3,down:me.y<t.y-3,sprint:true});},50);
 };
 timers=group.slice(0,3).map(move);
 await until(()=>first.state.battle?.inside===3,45000);await new Promise(r=>setTimeout(r,1200));assert.equal(first.state.phase,'BATTLE');assert.equal(first.state.battle.escape,0);
 timers.push(move(group[3]));await until(()=>first.state.battle?.inside===4,45000);await until(()=>first.state.battle?.escape>1,5000);assert.equal(first.state.phase,'BATTLE');
 await until(()=>group.every(p=>p.state.phase==='PREPARATION'),5000);assert.ok(group.every(p=>p.state.players.every(x=>!x.ready)));assert.ok(group.every(p=>p.state.battle===null));
 assert.equal(group[0].state.route.canAdvance,true);
 send(group[0],{type:'ready',ready:true});await new Promise(r=>setTimeout(r,100));assert.equal(group[0].state.phase,'PREPARATION');assert.ok(group[0].state.players.every(x=>!x.ready));
 const target=group[0].state.route.current+1;send(group[1],{type:'select_node',target});await until(()=>group.every(p=>p.state.route.current===target));assert.ok(group.every(p=>!p.state.route.canAdvance));
 send(group[0],{type:'select_node',target:target+1});await new Promise(r=>setTimeout(r,100));assert.equal(group[0].state.route.current,target);
 group.forEach(p=>send(p,{type:'ready',ready:true}));await until(()=>group.every(p=>p.state.phase==='BATTLE'));assert.ok(group.every(p=>p.state.players.every(x=>x.stamina===1)));assert.ok(group.every(p=>p.state.battle.city==='新大阪'));console.log('PASS: shared random map, server movement and teleport rejection, stamina, 3/4 waiting, 4/4 timed escape, preparation reset and next round');
}finally{timers.forEach(clearInterval);group.forEach(p=>p.ws.close());}

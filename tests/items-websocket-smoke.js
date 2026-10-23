import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=process.env.TEST_URL||'http://127.0.0.1:8787',group=[],timers=[];
const {code}=await (await fetch(`${base}/api/rooms`,{method:'POST'})).json();
async function until(fn,ms=10000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,25));}}
const send=(p,m)=>p.ws.send(JSON.stringify(m));
const total=inventory=>Object.values(inventory||{}).reduce((a,b)=>a+b,0);const acquired=p=>total(p.inventory)+total(p.battleLoot);
try{
 for(let i=0;i<2;i++){const p={ws:new WebSocket(`${base.replace(/^http/,'ws')}/api/rooms/${code}/ws`),state:null};group.push(p);p.ws.on('message',raw=>p.state=JSON.parse(raw));await new Promise((r,j)=>{p.ws.once('open',r);p.ws.once('error',j);});await until(()=>p.state);}
 await until(()=>group.every(p=>p.state.count===2));group.forEach(p=>send(p,{type:'ready',ready:true}));await until(()=>group.every(p=>p.state.phase==='BATTLE'));
 const first=group[0],map=first.state.battle;assert.ok(map.rocks.length>0);assert.ok(map.boxes.length>=3&&map.boxes.length<=5);assert.ok(map.boxes.every(b=>!b.loot));assert.deepEqual(map,group[1].state.battle);
 const start=first.state.players[0],target=[...map.boxes].sort((a,b)=>Math.hypot(a.x-start.x,a.y-start.y)-Math.hypot(b.x-start.x,b.y-start.y))[0];
 send(first,{type:'open_box',id:target.id,item:'rifle',quantity:999});await new Promise(r=>setTimeout(r,120));assert.ok(!first.state.battle.boxes.find(b=>b.id===target.id).opened);assert.ok(first.state.players.every(p=>acquired(p)===0));
 for(const p of group){
  const me=p.state.players.find(x=>x.id===p.state.selfId),blocked=new Set([...map.trees,...map.rocks].map(t=>t.row*map.cols+t.col)),start=Math.floor(me.y/32)*map.cols+Math.floor(me.x/32),goal=Math.floor(target.y/32)*map.cols+Math.floor(target.x/32),parents=new Map([[start,null]]),queue=[start];
  for(let i=0;i<queue.length&&!parents.has(goal);i++){const c=queue[i],x=c%map.cols,y=Math.floor(c/map.cols);for(const [dx,dy] of [[1,0],[0,-1],[-1,0],[0,1]]){const nx=x+dx,ny=y+dy,n=ny*map.cols+nx;if(nx<0||ny<0||nx>=map.cols||ny>=map.rows||blocked.has(n)||parents.has(n))continue;parents.set(n,c);queue.push(n);}}
  assert.ok(parents.has(goal));const path=[];for(let n=goal;n!==null;n=parents.get(n))path.unshift({x:n%map.cols*32+16,y:Math.floor(n/map.cols)*32+16});let index=0;
  timers.push(setInterval(()=>{const me=p.state.players.find(x=>x.id===p.state.selfId);while(index<path.length-1&&Math.hypot(me.x-path[index].x,me.y-path[index].y)<6)index++;const t=path[index];send(p,{type:'input',right:me.x<t.x-3,left:me.x>t.x+3,up:me.y>t.y+3,down:me.y<t.y-3});},50));
 }
 await until(()=>group.every(p=>{const me=p.state.players.find(x=>x.id===p.state.selfId);return Math.hypot(me.x-target.x,me.y-target.y)<12;}),30000);timers.forEach(clearInterval);group.forEach(p=>send(p,{type:'input'}));
 group.forEach(p=>send(p,{type:'open_box',id:target.id,item:'rifle',quantity:999}));await new Promise(r=>setTimeout(r,120));assert.ok(!first.state.battle.boxes.find(b=>b.id===target.id).opened,'instant open cannot bypass timer');
 const hold=setInterval(()=>group.forEach(p=>send(p,{type:'input',interact:true,progress:999,item:'rifle',quantity:999})),50);timers.push(hold);
 await until(()=>first.state.players.every(p=>p.lootProgress>.2));assert.ok(!first.state.battle.boxes.find(b=>b.id===target.id).opened);assert.ok(first.state.players.every(p=>acquired(p)===0));
 await until(()=>group.every(p=>p.state.battle.boxes.find(b=>b.id===target.id).opened));clearInterval(hold);group.forEach(p=>send(p,{type:'input'}));
 const state=first.state,box=state.battle.boxes.find(b=>b.id===target.id);assert.ok(['food','fuel','knife','rifle','medicine'].includes(box.loot.item));assert.ok(box.loot.quantity>=1&&box.loot.quantity<=4);if(['knife','rifle','medicine'].includes(box.loot.item))assert.equal(box.loot.quantity,1);
 assert.equal(state.players.filter(p=>acquired(p)>0).length,1);assert.equal(state.players.reduce((sum,p)=>sum+acquired(p),0),box.loot.quantity);
 const before=JSON.stringify(state.players.map(p=>p.inventory));group.forEach(p=>send(p,{type:'open_box',id:target.id}));await new Promise(r=>setTimeout(r,150));assert.equal(JSON.stringify(first.state.players.map(p=>p.inventory)),before);assert.ok(first.state.battle.boxes.filter(b=>b.id!==target.id).every(b=>!b.loot));
 console.log('PASS: shared boxes and rocks, unopened loot hidden, distance validation, server collision-aware movement, one-second server timer and progress, concurrent single claim, correct inventory and quantity, repeated-open rejection');
}finally{timers.forEach(clearInterval);group.forEach(p=>p.ws.close());}

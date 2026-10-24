import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {HAIRSTYLES} from '../shared/appearance.js';
const base=process.env.TEST_URL||'http://127.0.0.1:8787',connections=[];
async function until(fn){const end=Date.now()+8000;while(!fn()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,25));}}
const pause=()=>new Promise(r=>setTimeout(r,100));
async function create(){const r=await fetch(`${base}/api/rooms`,{method:'POST'});assert.equal(r.status,200);const {code}=await r.json();assert.match(code,/^[A-F0-9]{12}$/);return code;}
async function join(code){
 const entry={state:null,ws:new WebSocket(`${base.replace(/^http/,'ws')}/api/rooms/${code}/ws`)};connections.push(entry);
 entry.ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='room')entry.state=m;});
 await new Promise((resolve,reject)=>{entry.ws.once('open',resolve);entry.ws.once('error',reject);});await until(()=>entry.state);return entry;
}
function ready(entry,value=true,extra={}){entry.ws.send(JSON.stringify({type:'ready',ready:value,...extra}));}
async function denied(code,status){await new Promise((resolve,reject)=>{const ws=new WebSocket(`${base.replace(/^http/,'ws')}/api/rooms/${code}/ws`);ws.on('open',()=>{ws.close();reject(Error('Unexpected connection'));});ws.on('error',()=>{});ws.on('unexpected-response',(_,r)=>{r.resume();ws.terminate();try{assert.equal(r.statusCode,status);resolve();}catch(e){reject(e);}});});}
try{
 const code=await create(),group=[];
 for(let i=0;i<4;i++)group.push(await join(code));
 await until(()=>group.every(e=>e.state.count===4));await denied(code,409);await denied('000000000000',404);
 const appearances=Object.fromEntries(group[0].state.players.map(p=>{assert.ok(Number.isInteger(p.appearance.skinColor));assert.ok(HAIRSTYLES.includes(p.appearance.hair));return [p.id,p.appearance];}));
 for(const entry of group)assert.deepEqual(Object.fromEntries(entry.state.players.map(p=>[p.id,p.appearance])),appearances);
 assert.equal(new Set(group.map(e=>e.state.selfId)).size,4);
 ready(group[0],true,{id:group[3].state.selfId,appearance:{skinColor:0,hair:'forged'}});
 await until(()=>group.every(e=>e.state.players[0].ready));
 assert.equal(group[0].state.players[3].ready,false,'a socket cannot ready another player');
 ready(group[0],false);await until(()=>group.every(e=>!e.state.players[0].ready));
 for(const entry of group.slice(0,3))ready(entry);
 await until(()=>group.every(e=>e.state.players.filter(p=>p.ready).length===3));
 assert.ok(group.every(e=>e.state.phase==='PREPARATION'));
 ready(group[3]);await until(()=>group.every(e=>e.state.phase==='BATTLE'));
 for(const entry of group)assert.deepEqual(Object.fromEntries(entry.state.players.map(p=>[p.id,p.appearance])),appearances);
 await denied(code,409);ready(group[0],false);await pause();assert.ok(group.every(e=>e.state.phase==='BATTLE'));
 group.forEach(e=>e.ws.close());await until(()=>group.every(e=>e.ws.readyState===WebSocket.CLOSED));
 await pause();const reset=await join(code);assert.equal(reset.state.phase,'PREPARATION');assert.equal(reset.state.count,1);assert.equal(reset.state.players[0].ready,false);
 reset.ws.close();await until(()=>reset.ws.readyState===WebSocket.CLOSED);
 for(const n of [1,2,3]){
  const c=await create(),players=[];for(let i=0;i<n;i++)players.push(await join(c));
  for(const p of players)ready(p);await until(()=>players.every(p=>p.state.phase==='BATTLE'));
  players.forEach(p=>p.ws.close());
 }
 const c=await create(),a=await join(c),b=await join(c);ready(a);await until(()=>a.state.players[0].ready);b.ws.close();await until(()=>a.state.phase==='BATTLE');assert.equal(a.state.count,1);
 assert.equal((await fetch(`${base}/api/rooms`,{method:'POST',headers:{Origin:'https://invalid.example'}})).status,403);
 console.log('PASS: 1–4 player readiness, cancellation, identity checks, unanimous transition, late-join rejection, leave/reset, capacity and origin checks, identical random appearance snapshots and transition persistence, client appearance spoof ignored');
}finally{connections.forEach(e=>e.ws.close());}

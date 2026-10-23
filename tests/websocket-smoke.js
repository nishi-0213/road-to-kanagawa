import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=process.env.TEST_URL||'http://127.0.0.1:8787',connections=[];
async function until(fn){const end=Date.now()+8000;while(!fn()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,30));}}
async function denied(code,status){await new Promise((resolve,reject)=>{const ws=new WebSocket(`${base.replace(/^http/,'ws')}/api/rooms/${code}/ws`);ws.on('open',()=>{ws.close();reject(Error('Unexpected connection'));});ws.on('error',()=>{});ws.on('unexpected-response',(_,r)=>{r.resume();try{assert.equal(r.statusCode,status);resolve();}catch(e){reject(e);}});});}
try{
 const r=await fetch(`${base}/api/rooms`,{method:'POST'});assert.equal(r.status,200);const {code}=await r.json();assert.match(code,/^[A-F0-9]{12}$/);
 for(let i=0;i<4;i++){
  const entry={count:0,ws:new WebSocket(`${base.replace(/^http/,'ws')}/api/rooms/${code}/ws`)};connections.push(entry);
  entry.ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='room')entry.count=m.count;});
  await new Promise((resolve,reject)=>{entry.ws.once('open',resolve);entry.ws.once('error',reject);});
 }
 await until(()=>connections.every(e=>e.count===4));await denied(code,409);await denied('000000000000',404);
 connections[3].ws.close();await until(()=>connections.slice(0,3).every(e=>e.count===3));
 assert.equal((await fetch(`${base}/api/rooms`,{method:'POST',headers:{Origin:'https://invalid.example'}})).status,403);
 console.log('PASS: room creation, 4 WebSockets, room capacity, invalid code, leave count, cross-origin rejection');
}finally{connections.forEach(e=>e.ws.close());}

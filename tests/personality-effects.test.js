import {test} from 'node:test';import assert from 'node:assert/strict';
import {PERSONALITIES,PERSONALITY_DETAILS,getPlayerStats} from '../shared/personality.js';import {ensureInventory} from '../shared/preparation.js';import {createBattle,stepBattle} from '../shared/battle.js';import {stepCombat} from '../shared/combat.js';import {openBox,stepLoot} from '../shared/items.js';
const make=traits=>ensureInventory({id:'a',slot:1,personalities:traits,personalityEffectsActive:true});
const map=()=>({id:'effects',cols:100,rows:100,trees:[],rocks:[],boxes:[],biome:'forest',exit:{x:3100,y:0,width:64,height:96},escape:0,inside:0});
test('all 52 personalities have an implemented modifier and numerical tooltip, while unconfirmed profiles retain baseline rules',()=>{
 for(const name of PERSONALITIES){assert.ok(PERSONALITY_DETAILS[name].description);assert.ok(Object.keys(PERSONALITY_DETAILS[name].modifiers).length);assert.notEqual(PERSONALITY_DETAILS[name].effect,'未設定');assert.match(PERSONALITY_DETAILS[name].effect,/\d/);}
 assert.equal(getPlayerStats({personalities:['早歩き']}).moveSpeed,1);
});
test('movement, box opening and medicine duration are affected after editor confirmation',()=>{
 const p=make(['早歩き','素直','手先が器用']),world=map();createBattle([p],()=>.4);p.x=100;p.y=200;for(let i=0;i<20;i++)stepBattle(world,[p],new Map([[p.id,{right:true}]]),.05);assert.ok(Math.abs(p.x-279.2)<.001);
 const box={id:'box',x:p.x,y:p.y,opened:false};world.boxes=[box];for(let i=0;i<14;i++)stepLoot(world,[p],new Map([[p.id,{interact:true}]]),.05,()=>0);assert.equal(box.opened,false);stepLoot(world,[p],new Map([[p.id,{interact:true}]]),.05,()=>0);assert.equal(box.opened,true);assert.ok(Math.abs(getPlayerStats(p).medicineTime-2.55)<1e-8);
});
test('stamina endurance, context conditions and maximum HP alter real battle state',()=>{
 const p=make(['アスリート','早起き','楽天家']),world=map();createBattle([p],()=>.4);p.x=100;p.y=200;for(let i=0;i<80;i++)stepBattle(world,[p],new Map([[p.id,{right:true,sprint:true}]]),.05);assert.ok(p.stamina>.30&&p.stamina<.31);assert.ok(getPlayerStats(p).staminaRecoveryTime<4.34);
 const hp=make(['頑固','正直者','美人']);createBattle([hp],()=>.4);assert.equal(hp.maxHp,130);assert.equal(hp.hp,130);
 const context=make(['植物好き','孤立','社交的']);context.x=0;context.y=0;assert.ok(Math.abs(getPlayerStats(context,{biome:'forest'},[context]).moveSpeed-1.3225)<.0001);const ally={id:'b',x:0,y:10,hp:100};assert.ok(Math.abs(getPlayerStats(context,{biome:'forest'},[context,ally]).moveSpeed-1.265)<.0001);
});
test('rifle range/cooldown, medicine recovery and nearby ally healing use personality values',()=>{
 const p=make(['射手','冷静','眼が悪い']);p.x=0;p.y=0;stepCombat({},[p],new Map([[p.id,{selected:'rifle',use:true,aimX:5000,aimY:0}]]),.05);assert.equal(p.selectedItem,null);
 p.inventorySlots[0]={id:'rifle',item:'rifle',quantity:1};ensureInventory(p);const world={};stepCombat(world,[p],new Map([[p.id,{selected:'rifle',use:true,aimX:5000,aimY:0}]]),.05);assert.ok(Math.abs(world.effects[0].distance-1207.5)<.001);assert.ok(Math.abs(p.attackCooldown-.2376)<1e-8);
 const healer=make(['世話焼き','温厚','自己中心的']);healer.x=0;healer.y=0;healer.hp=10;healer.inventorySlots[0]={id:'medicine',item:'medicine',quantity:1};ensureInventory(healer);const ally={id:'b',x:10,y:0,hp:30};for(let i=0;i<30;i++)stepCombat({},[healer,ally],new Map([[healer.id,{selected:'medicine',use:true}]]),.1);assert.equal(healer.hp,85);assert.equal(healer.inventory.medicine,0);assert.equal(ally.hp,40);
});
test('resource bonuses change actual drops with minimum-one clamp',()=>{
 const p=make(['大食い','悪食','料理上手']);p.x=64;p.y=64;const world=map();world.boxes=[{id:'food',x:64,y:64,opened:false}];assert.deepEqual(openBox(world,p,'food',()=>0),{item:'food',quantity:5});assert.equal(p.inventory.food,5);
 const other=make(['方向音痴','早歩き','素直']);other.x=64;other.y=64;world.boxes=[{id:'fuel',x:64,y:64,opened:false}];const draws=[.13,0];assert.deepEqual(openBox(world,other,'fuel',()=>draws.shift()),{item:'fuel',quantity:1});
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {PERSONALITIES,createPersonalities,ensurePersonalities} from '../shared/personality.js';
import {ensureInventory} from '../shared/preparation.js';import {createBattle} from '../shared/battle.js';
test('52 short personality names include the 12 requested names and always select three unique choices',()=>{
 assert.equal(PERSONALITIES.length,52);assert.equal(new Set(PERSONALITIES).size,52);assert.ok(PERSONALITIES.every(name=>[...name].length<=5));assert.deepEqual(PERSONALITIES.slice(0,12),['怠惰','早歩き','射手','アスリート','犯罪者','有能','植物好き','大食い','孤立','美人','悪食','眼が悪い']);
 for(const random of [()=>0,()=>.999,Math.random])for(let i=0;i<50;i++){const traits=createPersonalities(random);assert.equal(traits.length,3);assert.equal(new Set(traits).size,3);assert.ok(traits.every(trait=>PERSONALITIES.includes(trait)));}
});
test('personalities survive inventory and battle initialization; legacy or invalid data is initialized once',()=>{
 const p=ensureInventory({id:'a',slot:1}),traits=[...p.personalities];ensureInventory(p);createBattle([p],()=>.4);assert.deepEqual(p.personalities,traits);
 const invalid={personalities:['怠惰','怠惰','unknown']};ensurePersonalities(invalid);assert.equal(new Set(invalid.personalities).size,3);
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {editPlayer,cyclePersonality} from '../shared/player-editor.js';import {ensureInventory} from '../shared/preparation.js';import {skinColorAt,skinToneForColor,SKIN_COLORS} from '../shared/appearance.js';import {createBattle} from '../shared/battle.js';
test('editor changes name, skin, hair and three unique personalities atomically and resets readiness',()=>{
 const p=ensureInventory({id:'a',slot:1,ready:true});assert.equal(p.name,'プレイヤー1');assert.ok(editPlayer(p,{name:'  旅人あき  ',skinTone:1,hair:'h_tora',personalities:['怠惰','射手','有能']}));assert.equal(p.name,'旅人あき');assert.equal(p.appearance.skinColor,SKIN_COLORS.at(-1));assert.equal(p.appearance.hair,'h_tora');assert.equal(p.ready,false);
 const before=structuredClone(p);for(const patch of [{name:'変化',skinTone:NaN},{skinTone:2},{hair:'bad'},{personalities:['怠惰','怠惰','射手']},{name:'a'.repeat(17)},{name:123},{id:'b',inventory:{rifle:999}}]){assert.equal(editPlayer(p,patch),false);assert.deepEqual(p,before);}
 assert.ok(editPlayer(p,{name:''}));assert.equal(p.name,'プレイヤー1');const appearance=structuredClone(p.appearance),traits=[...p.personalities];createBattle([p],()=>.4);assert.deepEqual(p.appearance,appearance);assert.deepEqual(p.personalities,traits);
});
test('skin slider maps both ends and personality arrows wrap while excluding duplicates',()=>{
 assert.equal(skinColorAt(0),SKIN_COLORS[0]);assert.equal(skinColorAt(1),SKIN_COLORS.at(-1));assert.equal(skinToneForColor(SKIN_COLORS[0]),0);assert.equal(skinToneForColor(SKIN_COLORS.at(-1)),1);
 let traits=['怠惰','早歩き','射手'];for(let i=0;i<60;i++){traits=cyclePersonality(traits,0,1);assert.equal(new Set(traits).size,3);}assert.equal(cyclePersonality(['怠惰','早歩き','射手'],0,-1)[0],'料理上手');
});

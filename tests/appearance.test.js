import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAppearance,ensureAppearance,HAIRSTYLES,SKIN_COLORS} from '../shared/appearance.js';
import {ensureInventory,createPreparation,discardUnclaimed} from '../shared/preparation.js';
import {createBattle} from '../shared/battle.js';
test('appearance chooses the full skin range and all four hair choices independently',()=>{
 for(let index=0;index<4;index++){const values=[index/3,(index+.5)/4],appearance=createAppearance(()=>values.shift());assert.equal(appearance.hair,HAIRSTYLES[index]);assert.ok(Number.isInteger(appearance.skinColor));assert.ok(appearance.skinColor>=SKIN_COLORS.at(-1)&&appearance.skinColor<=SKIN_COLORS[0]);}
 assert.equal(createAppearance(()=>0).skinColor,SKIN_COLORS[0]);assert.equal(createAppearance(()=>1).skinColor,SKIN_COLORS.at(-1));assert.equal(createAppearance(()=>1).hair,null);
});
test('appearance survives initialization, equipment and battle transitions without rerolling; legacy players gain one',()=>{
 const p=ensureInventory({id:'old',slot:1}),appearance=structuredClone(p.appearance);for(let round=0;round<3;round++){ensureInventory(p);createBattle([p],()=>.4);discardUnclaimed(createPreparation(),[p]);assert.deepEqual(p.appearance,appearance);}
 const black={appearance:{skinColor:0,hair:null}};ensureAppearance(black);assert.deepEqual(black.appearance,{skinColor:0,hair:null});
 const invalid={appearance:{skinColor:NaN,hair:'unknown'}};ensureAppearance(invalid);assert.ok(Number.isInteger(invalid.appearance.skinColor));assert.ok(HAIRSTYLES.includes(invalid.appearance.hair));
});

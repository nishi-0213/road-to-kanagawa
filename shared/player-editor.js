import {HAIRSTYLES,skinColorAt} from './appearance.js';
import {PERSONALITIES} from './personality.js';
export function ensurePlayerName(player){if(typeof player.name!=='string'||!player.name.trim())player.name=`プレイヤー${player.slot||1}`;return player;}
export function editPlayer(player,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))return false;
 const next={};
 if('name' in patch){if(typeof patch.name!=='string')return false;const name=patch.name.replace(/[\u0000-\u001f\u007f]/g,'').trim();if([...name].length>16)return false;next.name=name||`プレイヤー${player.slot||1}`;}
 if('skinTone' in patch){if(!Number.isFinite(patch.skinTone)||patch.skinTone<0||patch.skinTone>1)return false;next.appearance={...player.appearance,skinColor:skinColorAt(patch.skinTone)};}
 if('hair' in patch){if(!HAIRSTYLES.includes(patch.hair))return false;next.appearance={...(next.appearance||player.appearance),hair:patch.hair};}
 if('personalities' in patch){if(!Array.isArray(patch.personalities)||patch.personalities.length!==3||new Set(patch.personalities).size!==3||!patch.personalities.every(trait=>PERSONALITIES.includes(trait)))return false;next.personalities=[...patch.personalities];}
 if(!Object.keys(next).length)return false;
 Object.assign(player,next,{ready:false});return true;
}
export function cyclePersonality(traits,index,direction){
 const next=[...traits],used=new Set(traits.filter((_,i)=>i!==index));let position=PERSONALITIES.indexOf(traits[index]);
 do{position=(position+direction+PERSONALITIES.length)%PERSONALITIES.length;}while(used.has(PERSONALITIES[position]));next[index]=PERSONALITIES[position];return next;
}

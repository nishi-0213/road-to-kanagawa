export const PERSONALITIES=[
 '怠惰','早歩き','射手','アスリート','犯罪者','有能','植物好き','大食い','孤立','美人','悪食','眼が悪い',
 '勤勉','慎重','大胆','臆病','勇敢','短気','温厚','楽天家','悲観的','好奇心旺盛',
 '几帳面','大雑把','神経質','冷静','熱血','せっかち','のんびり','頑固','素直','負けず嫌い',
 '社交的','人見知り','協調的','自己中心的','世話焼き','お人好し','疑り深い','正直者','嘘つき','強欲',
 '倹約家','浪費家','きれい好き','不器用','手先が器用','方向音痴','夜型','早起き','動物好き','料理上手'
];
export function createPersonalities(random=Math.random){
 const pool=[...PERSONALITIES],selected=[];
 for(let i=0;i<3;i++){const index=Math.min(pool.length-1,Math.floor(random()*pool.length));selected.push(pool.splice(index,1)[0]);}
 return selected;
}
export function ensurePersonalities(player){
 if(!Array.isArray(player.personalities)||player.personalities.length!==3||new Set(player.personalities).size!==3||!player.personalities.every(trait=>PERSONALITIES.includes(trait)))player.personalities=createPersonalities();
 return player;
}

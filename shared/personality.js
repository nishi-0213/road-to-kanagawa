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
const DESCRIPTIONS=[
 '楽をすることを好む性格です。','きびきびと歩くことを好みます。','射撃に関心がある人物です。','運動を好む人物です。','法を犯した経歴があります。','物事を要領よくこなす人物です。','草木の世話を好みます。','食べることが大好きです。','一人で過ごすことを好みます。','整った容姿の人物です。','風変わりな食べ物も好みます。','視力が弱い人物です。',
 'こつこつ取り組む性格です。','行動前によく考えます。','思い切った行動を好みます。','危険に敏感な性格です。','困難にも立ち向かう性格です。','気が立ちやすい性格です。','穏やかな性格です。','物事を明るく捉えます。','悪い結果を心配しがちです。','未知の物事に興味を持ちます。',
 '細かなことまで気を配ります。','細部にはこだわらない性格です。','小さな変化も気になります。','落ち着いて物事を考えます。','情熱的に取り組む性格です。','待つことが苦手です。','自分のペースを大切にします。','自分の考えを曲げません。','人の話を受け入れやすい性格です。','勝負に強くこだわります。',
 '人との交流を好みます。','初対面の人が苦手です。','仲間と協力することを好みます。','自分の都合を優先しがちです。','人の面倒を見ることを好みます。','頼み事を断るのが苦手です。','人を簡単には信用しません。','隠し事が苦手です。','話を飾ることがあります。','多くを手に入れたがります。',
 '無駄遣いを嫌います。','気前よく使ってしまいます。','清潔な環境を好みます。','細かな作業が苦手です。','細かな作業を好みます。','道に迷いやすい人物です。','夜に活動することを好みます。','朝早く起きることを好みます。','動物との触れ合いを好みます。','料理をすることを好みます。'
];
export const PERSONALITY_DETAILS=Object.fromEntries(PERSONALITIES.map((name,index)=>[name,{description:DESCRIPTIONS[index],effect:'未設定'}]));
const EFFECTS=[
 ['移動速度−10%、スタミナ回復時間−20%。',{moveSpeed:.9,staminaRecoveryTime:.8}],
 ['移動速度＋12%。',{moveSpeed:1.12}],
 ['ライフルの射撃間隔−20%、射程＋15%。',{rifleCooldown:.8,rifleRange:1.15}],
 ['ダッシュ持続時間＋25%、スタミナ回復時間−15%。',{staminaDrainTime:1.25,staminaRecoveryTime:.85}],
 ['箱の開封時間−25%、最大HP−5。',{lootTime:.75,maxHp:-5}],
 ['開封時間−10%、移動速度＋5%。',{lootTime:.9,moveSpeed:1.05}],
 ['森林地帯で移動速度＋15%。',{forestMove:1.15}],
 ['食料入手数＋1、最大HP＋10。',{foodBonus:1,maxHp:10}],
 ['192px以内に仲間がいない時、移動速度＋15%。',{isolatedMove:1.15}],
 ['最大HP＋10、医薬品の使用時間−10%。',{maxHp:10,medicineTime:.9}],
 ['食料入手数＋2、最大HP−10。',{foodBonus:2,maxHp:-10}],
 ['ライフルの射程−30%、射撃間隔＋10%。',{rifleRange:.7,rifleCooldown:1.1}],
 ['箱の開封時間−20%、スタミナ回復時間＋10%。',{lootTime:.8,staminaRecoveryTime:1.1}],
 ['最大HP＋10、移動速度−5%。',{maxHp:10,moveSpeed:.95}],
 ['ナイフの攻撃値＋20%、最大HP−10。',{knifeDamage:1.2,maxHp:-10}],
 ['移動速度＋8%、ナイフの攻撃値−15%。',{moveSpeed:1.08,knifeDamage:.85}],
 ['ナイフの攻撃値＋15%、最大HP＋5。',{knifeDamage:1.15,maxHp:5}],
 ['ライフル・ナイフの攻撃間隔−15%、ライフル射程−15%。',{rifleCooldown:.85,knifeCooldown:.85,rifleRange:.85}],
 ['医薬品の回復量＋最大HPの10%、ナイフの攻撃値−10%。',{medicineHeal:.1,knifeDamage:.9}],
 ['スタミナ回復時間−15%。',{staminaRecoveryTime:.85}],
 ['最大HP＋10、移動速度−5%。',{maxHp:10,moveSpeed:.95}],
 ['箱の開封時間−15%、燃料入手数＋1。',{lootTime:.85,fuelBonus:1}],
 ['燃料入手数＋1、箱の開封時間＋10%。',{fuelBonus:1,lootTime:1.1}],
 ['箱の開封時間−20%、医薬品回復量−最大HPの5%。',{lootTime:.8,medicineHeal:-.05}],
 ['ライフル射程＋20%、最大HP−5。',{rifleRange:1.2,maxHp:-5}],
 ['ライフル射撃間隔−10%、医薬品使用時間−10%。',{rifleCooldown:.9,medicineTime:.9}],
 ['ダッシュ持続時間＋15%、ナイフ攻撃値＋10%、スタミナ回復時間＋10%。',{staminaDrainTime:1.15,knifeDamage:1.1,staminaRecoveryTime:1.1}],
 ['移動速度＋10%、医薬品使用時間＋15%。',{moveSpeed:1.1,medicineTime:1.15}],
 ['移動速度−8%、医薬品回復量＋最大HPの10%。',{moveSpeed:.92,medicineHeal:.1}],
 ['最大HP＋15、スタミナ回復時間＋15%。',{maxHp:15,staminaRecoveryTime:1.15}],
 ['医薬品使用時間−15%。',{medicineTime:.85}],
 ['HPが半分以下の時、移動速度＋20%。',{lowHpMove:1.2}],
 ['192px以内に仲間がいる時、移動速度＋10%。',{nearbyMove:1.1}],
 ['仲間が192px以内なら移動−5%、いなければ移動＋10%。',{nearbyMove:.95,isolatedMove:1.1}],
 ['192px以内に仲間がいる時、スタミナ回復時間−20%。',{nearbyRecovery:.8}],
 ['医薬品の回復量＋最大HPの15%。',{medicineHeal:.15}],
 ['医薬品使用時、192px以内の仲間も最大HPの10%回復。',{medicineAura:.1}],
 ['医薬品使用時間−20%、回復量−最大HPの5%。',{medicineTime:.8,medicineHeal:-.05}],
 ['ライフル射程＋10%、箱の開封時間＋15%。',{rifleRange:1.1,lootTime:1.15}],
 ['最大HP＋5、医薬品回復量＋最大HPの5%。',{maxHp:5,medicineHeal:.05}],
 ['箱の開封時間−15%、最大HP−5。',{lootTime:.85,maxHp:-5}],
 ['食料・燃料の入手数＋1、移動速度−5%。',{foodBonus:1,fuelBonus:1,moveSpeed:.95}],
 ['燃料入手数＋1、医薬品回復量＋最大HPの5%。',{fuelBonus:1,medicineHeal:.05}],
 ['ライフル射撃間隔−20%、医薬品回復量−最大HPの10%。',{rifleCooldown:.8,medicineHeal:-.1}],
 ['医薬品使用時間−20%、最大HP＋5。',{medicineTime:.8,maxHp:5}],
 ['箱の開封時間＋25%、ナイフ攻撃間隔＋10%。',{lootTime:1.25,knifeCooldown:1.1}],
 ['箱の開封時間−25%。',{lootTime:.75}],
 ['移動速度−5%、燃料入手数−1（最低1個）。',{moveSpeed:.95,fuelBonus:-1}],
 ['スタミナ回復時間−20%、最大HP−5。',{staminaRecoveryTime:.8,maxHp:-5}],
 ['ダッシュ持続時間＋15%。',{staminaDrainTime:1.15}],
 ['最大HP＋10、森林で移動速度＋5%。',{maxHp:10,forestMove:1.05}],
 ['食料入手数＋1、医薬品回復量＋最大HPの5%。',{foodBonus:1,medicineHeal:.05}]
];
for(let index=0;index<PERSONALITIES.length;index++){PERSONALITY_DETAILS[PERSONALITIES[index]].effect=EFFECTS[index][0];PERSONALITY_DETAILS[PERSONALITIES[index]].modifiers=EFFECTS[index][1];}
export function getPlayerStats(player,map=null,players=[]){
 const stats={maxHp:100,moveSpeed:1,staminaDrainTime:4,staminaRecoveryTime:6,rifleCooldown:.3,rifleRange:1500,rifleDamage:20,knifeCooldown:.5,knifeDamage:20,medicineTime:3,medicineHeal:.5,medicineAura:0,lootTime:1,foodBonus:0,fuelBonus:0};
 if(!player?.personalityEffectsActive)return stats;
 const nearby=players.some(other=>other.id!==player.id&&(other.hp??100)>0&&Math.hypot(other.x-player.x,other.y-player.y)<=192);
 for(const trait of player.personalities||[]){const modifiers=PERSONALITY_DETAILS[trait]?.modifiers||{};for(const [key,value] of Object.entries(modifiers)){
  if(['maxHp','medicineHeal','medicineAura','foodBonus','fuelBonus'].includes(key))stats[key]+=value;
  else if(key==='forestMove'){if(map?.biome==='forest')stats.moveSpeed*=value;}
  else if(key==='isolatedMove'){if(!nearby)stats.moveSpeed*=value;}
  else if(key==='nearbyMove'){if(nearby)stats.moveSpeed*=value;}
  else if(key==='nearbyRecovery'){if(nearby)stats.staminaRecoveryTime*=value;}
  else if(key==='lowHpMove'){if((player.hp??100)<=((player.maxHp??100)/2))stats.moveSpeed*=value;}
  else if(key in stats)stats[key]*=value;
 }}
 stats.maxHp=Math.max(50,Math.min(200,stats.maxHp));stats.moveSpeed=Math.max(.5,Math.min(1.75,stats.moveSpeed));stats.medicineHeal=Math.max(.1,Math.min(1,stats.medicineHeal));return stats;
}

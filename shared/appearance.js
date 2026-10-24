export const HAIRSTYLES=['h_hage','h_sitisan','h_tora',null];
export const SKIN_COLORS=[0xf2c6a0,0xd49a70,0xab7049,0x70452f,0x241713];
export function skinColorAt(tone){
 const position=Math.max(0,Math.min(1,tone))*(SKIN_COLORS.length-1),index=Math.min(SKIN_COLORS.length-2,Math.floor(position)),fraction=position-index;
 let skinColor=0;
 for(const shift of [16,8,0]){const a=(SKIN_COLORS[index]>>shift)&255,b=(SKIN_COLORS[index+1]>>shift)&255;skinColor|=Math.round(a+(b-a)*fraction)<<shift;}
 return skinColor;
}
export function skinToneForColor(color){let best=0,distance=Infinity;for(let i=0;i<=100;i++){const candidate=skinColorAt(i/100),d=[16,8,0].reduce((sum,shift)=>sum+(((candidate>>shift)&255)-((color>>shift)&255))**2,0);if(d<distance){distance=d;best=i/100;}}return best;}
export function createAppearance(random=Math.random){
 const skinColor=skinColorAt(random());
 return {skinColor,hair:HAIRSTYLES[Math.min(HAIRSTYLES.length-1,Math.floor(random()*HAIRSTYLES.length))]};
}
export function ensureAppearance(player){
 if(!player.appearance||!Number.isInteger(player.appearance.skinColor)||player.appearance.skinColor<0||player.appearance.skinColor>0xffffff||!HAIRSTYLES.includes(player.appearance.hair))player.appearance=createAppearance();
 return player;
}

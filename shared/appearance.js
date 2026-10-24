export const HAIRSTYLES=['h_hage','h_sitisan','h_tora',null];
export const SKIN_COLORS=[0xf2c6a0,0xd49a70,0xab7049,0x70452f,0x241713];
export function createAppearance(random=Math.random){
 const position=Math.max(0,Math.min(1,random()))*(SKIN_COLORS.length-1),index=Math.min(SKIN_COLORS.length-2,Math.floor(position)),fraction=position-index;
 let skinColor=0;
 for(const shift of [16,8,0]){const a=(SKIN_COLORS[index]>>shift)&255,b=(SKIN_COLORS[index+1]>>shift)&255;skinColor|=Math.round(a+(b-a)*fraction)<<shift;}
 return {skinColor,hair:HAIRSTYLES[Math.min(HAIRSTYLES.length-1,Math.floor(random()*HAIRSTYLES.length))]};
}
export function ensureAppearance(player){
 if(!player.appearance||!Number.isInteger(player.appearance.skinColor)||player.appearance.skinColor<0||player.appearance.skinColor>0xffffff||!HAIRSTYLES.includes(player.appearance.hair))player.appearance=createAppearance();
 return player;
}

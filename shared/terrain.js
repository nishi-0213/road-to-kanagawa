export const BIOMES=['forest','highway','urban'];
export const BIOME_NAMES={forest:'森林地帯',highway:'幹線道路',urban:'市街地区'};
function hash(x,y,seed){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
export function noise(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);const a=hash(ix,iy,seed)*(1-u)+hash(ix+1,iy,seed)*u,b=hash(ix,iy+1,seed)*(1-u)+hash(ix+1,iy+1,seed)*u;return a*(1-v)+b*v;}
function reserved(cols,rows,seed,col,row){
 const path=(cols-3)*(1-row/(rows-1))+1+Math.sin(row*.22+seed%7)*.8;
 // Three guaranteed routes: the winding center, left/top, and bottom/right.
 const outerRoutes=Math.abs(col-2)<=1||Math.abs(row-2)<=1||Math.abs(col-(cols-3))<=1||Math.abs(row-(rows-3))<=1;
 return (col<4&&row>=rows-4)||(col>=cols-4&&row<5)||Math.abs(col-path)<1.8||outerRoutes;
}
export function createTrees(cols,rows,seed){
 const trees=[];
 // A gently winding, two-tile-wide safe corridor always connects spawn and exit.
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  if(reserved(cols,rows,seed,col,row))continue;
  const density=noise(col/7,row/7,seed)*.72+noise(col/3,row/3,seed+83)*.28;
  if(density>.4&&hash(col,row,seed+173)<.08+(density-.4)*1.5)trees.push({col,row});
 }
 return trees;
}
export function createRocks(cols,rows,seed,trees=[]){
 const occupied=new Set(trees.map(t=>t.row*cols+t.col)),candidates=[];
 const target=Math.round((trees.length||createTrees(cols,rows,seed).length)/3);
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)if(!reserved(cols,rows,seed,col,row)&&!occupied.has(row*cols+col))candidates.push({col,row});
 candidates.sort((a,b)=>hash(a.col,a.row,seed+919)-hash(b.col,b.row,seed+919));
 return candidates.slice(0,target);
}
// Movement uses a 20px-wide body against each occupied ground tile.
export function canStand(map,x,y){
 const radius=10;
 const overlaps=t=>x+radius>t.col*32&&x-radius<(t.col+1)*32&&y+radius>t.row*32&&y-radius<(t.row+1)*32;
 return !(map.trees||[]).some(overlaps)&&!(map.rocks||[]).some(overlaps);
}
export function movePlayer(map,p,dx,dy){
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/8));
 for(let i=0;i<steps;i++){
  const x=Math.max(16,Math.min(map.cols*32-16,p.x+dx/steps));if(canStand(map,x,p.y))p.x=x;
  const y=Math.max(16,Math.min(map.rows*32-16,p.y+dy/steps));if(canStand(map,p.x,y))p.y=y;
 }
}

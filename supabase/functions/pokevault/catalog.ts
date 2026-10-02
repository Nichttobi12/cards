import {tcg} from './data.ts';
import {nameScore,rankNames,parseNumber} from './search.ts';
const cache=new Map<string,{expires:number,data:any}>();
export async function catalog(path:string,lang:string){const key=lang+'/'+path,hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.data;const data=await tcg(path,lang);if(cache.size>100)cache.clear();cache.set(key,{data,expires:Date.now()+600000});return data;}
export const physical=(c:any)=>!/^[A-Z]\d|^P-A/.test(c.id);
export const promo=(s:any)=>/promo/i.test(s.name)||['basep','dpp','hgssp','bwp','xyp','smp','swshp','svp','mep'].includes(s.id);
export {parseNumber} from './search.ts';
export function matches(c:any,q:string){const n=parseNumber(q).number,local=String(c.localId).toUpperCase();return /^\d+$/.test(n)?/^\d+$/.test(local)&&Number(local)===Number(n):local===n||Number.isFinite(nameScore(c.name,q));}
export async function searchCards(q:string,lang:string,setId:string,onlyPromo:boolean){
 const parsed=parseNumber(q);setId=setId||parsed.set;let rows:any[];
 if(setId){const s=await catalog('sets/'+setId,lang);rows=s.cards.filter((c:any)=>matches(c,q)).map((c:any)=>({...c,setName:s.name}));}
 else if(onlyPromo){const sets=(await catalog('sets',lang)).filter((s:any)=>physical(s)&&promo(s)).reverse();rows=[];for(let i=0;i<sets.length;i+=4){const batches=await Promise.all(sets.slice(i,i+4).map(async(s:any)=>{const detail=await catalog('sets/'+s.id,lang);return detail.cards.filter((c:any)=>matches(c,q)).map((c:any)=>({...c,setName:s.name}));}));rows.push(...batches.flat());}}
 else {rows=[...await catalog('cards',lang)].reverse().filter((c:any)=>matches(c,q));}
 const numbered=/^\d+$|^[A-Z]+\d+$/.test(parsed.number);
 if(!numbered)rows=rankNames(rows,q,(c:any)=>c.name);
 return rows.filter(physical).slice(0,60);
}
export async function alternateImage(id:string,lang:string){const alternate=lang==='en'?'de':'en';try{const c=await catalog('cards/'+id,alternate);return {image:c.image||null,language:alternate};}catch{return {image:null};}}

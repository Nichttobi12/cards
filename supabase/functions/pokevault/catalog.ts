import {tcg} from './data.ts';
const cache=new Map<string,{expires:number,data:any}>();
export async function catalog(path:string,lang:string){const key=lang+'/'+path,hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.data;const data=await tcg(path,lang);if(cache.size>100)cache.clear();cache.set(key,{data,expires:Date.now()+600000});return data;}
export const physical=(c:any)=>!/^[A-Z]\d|^P-A/.test(c.id);
export const promo=(s:any)=>/promo/i.test(s.name)||['basep','dpp','hgssp','bwp','xyp','smp','swshp','svp','mep'].includes(s.id);
export function parseNumber(q:string){const text=q.split('/')[0].trim().toUpperCase().replace(/[\s-]/g,'');const m=text.match(/^(SVP|MEP|SWSH|SM|XY|BW|HGSS|DP)(\d+)$/);const prefixSets:Record<string,string>={SVP:'svp',MEP:'mep',SWSH:'swshp',SM:'smp',XY:'xyp',BW:'bwp',HGSS:'hgssp',DP:'dpp'};return {text,set:m?prefixSets[m[1]]:'',number:m?(['SVP','MEP'].includes(m[1])?m[2].padStart(3,'0'):m[1]+m[2].padStart(['SWSH','SM'].includes(m[1])?3:2,'0')):text};}
export function matches(c:any,q:string){const n=parseNumber(q).number,local=String(c.localId).toUpperCase();return /^\d+$/.test(n)?/^\d+$/.test(local)&&Number(local)===Number(n):local===n||String(c.name).toLocaleLowerCase().includes(q.toLocaleLowerCase());}
export async function searchCards(q:string,lang:string,setId:string,onlyPromo:boolean){
 const parsed=parseNumber(q);setId=setId||parsed.set;let rows:any[];
 if(setId){const s=await catalog('sets/'+setId,lang);rows=s.cards.filter((c:any)=>matches(c,q)).map((c:any)=>({...c,setName:s.name}));}
 else if(onlyPromo){const sets=(await catalog('sets',lang)).filter((s:any)=>physical(s)&&promo(s)).reverse();rows=[];for(let i=0;i<sets.length;i+=4){const batches=await Promise.all(sets.slice(i,i+4).map(async(s:any)=>{const detail=await catalog('sets/'+s.id,lang);return detail.cards.filter((c:any)=>matches(c,q)).map((c:any)=>({...c,setName:s.name}));}));rows.push(...batches.flat());}}
 else {const numeric=/^\d+$/.test(parsed.number),code=/^[A-Z]+\d+$/.test(parsed.number);const key=numeric||code?'localId':'name';const variants=numeric?[...new Set([String(Number(parsed.number)),parsed.number,parsed.number.padStart(3,'0')])].join('|'):parsed.number;const term=key==='localId'?'eq:'+variants:'like:'+q;rows=await catalog(`cards?${key}=${encodeURIComponent(term)}&pagination:page=1&pagination:itemsPerPage=60`,lang);}
 return rows.filter(physical).slice(0,60);
}
export async function alternateImage(id:string,lang:string){if(lang==='en')return {image:null};try{const c=await catalog('cards/'+id,'en');return {image:c.image||null,language:'en'};}catch{return {image:null};}}

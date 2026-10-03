import {observePrices,seedCardHistory} from './card-history.ts';
import {gradedValue} from './grading.ts';
import {gradedPrice} from './graded-prices.ts';
import {db,tcg} from './data.ts';
import {quote} from './pricing.ts';
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function totals(rows:any[]){let totalCents=0,cardCount=0,valuedCount=0;for(const r of rows){const data=typeof r.data==='string'?JSON.parse(r.data):r.data;const price=r.manual_cents!==null?r.manual_cents/100:r.grading?gradedValue(data,r.grading):quote(data,r.variant).price;cardCount+=r.quantity;if(price!==null){totalCents+=Math.round(price*100)*r.quantity;valuedCount+=r.quantity;}}return {totalCents,cardCount,valuedCount};}
export async function snapshot(owner:string,failed=0){
 const d=db(),[c,r]=await Promise.all([d.prepare('SELECT id FROM collections WHERE owner = ?').bind(owner).all(),d.prepare('SELECT * FROM cards WHERE owner = ?').bind(owner).all()]);
 const scopes=['all',...c.results.map((x:any)=>x.id)],day=today(),captured=new Date().toISOString();
 await d.batch(scopes.map(scope=>{const t=totals(scope==='all'?r.results:r.results.filter((x:any)=>x.collection_id===scope));return d.prepare('INSERT INTO portfolio_snapshots (id,owner,scope,day,total_cents,card_count,valued_count,failed,captured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET total_cents=excluded.total_cents, card_count=excluded.card_count, valued_count=excluded.valued_count, failed=excluded.failed, captured=excluded.captured').bind(`${owner}|${scope}|${day}`,owner,scope,day,t.totalCents,t.cardCount,t.valuedCount,failed,captured);}));
}
export async function refresh(owner:string,cursor=0,failedSoFar=0){
 const d=db(),rows=(await d.prepare('SELECT * FROM cards WHERE owner = ?').bind(owner).all()).results as any[];
 let updated=0,failed=0;const groups=new Map<string,any[]>();for(const r of rows){const k=r.language+'/'+r.card_id;groups.set(k,[...(groups.get(k)||[]),r]);}
 const items=[...groups.values()];for(let i=cursor;i<Math.min(items.length,cursor+10);i+=5){await Promise.all(items.slice(i,Math.min(i+5,cursor+10)).map(async group=>{try{const data=await tcg(`cards/${group[0].card_id}`,group[0].language);await Promise.all(group.map(async row=>{const enriched=row.grading?{...data,gradedQuote:await gradedPrice(row.card_id,row.language,row.grading)}:data;await d.prepare('UPDATE cards SET data = ?, fetched = ? WHERE id = ? AND owner = ?').bind(JSON.stringify(observePrices(seedCardHistory(row),enriched,row.variant,row.grading)),new Date().toISOString(),row.id,owner).run();}));updated+=group.length;}catch{failed+=group.length;}}));}
 const nextCursor=cursor+10<items.length?cursor+10:null;if(nextCursor===null)await snapshot(owner,failedSoFar+failed);return {updated,failed,nextCursor};
}

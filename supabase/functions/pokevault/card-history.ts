import {quote} from './pricing.ts';
import {gradedValue} from './grading.ts';
export type CardPricePoint={day:string,raw:number|null,rawSourceDate:string|null,grades:Record<string,{price:number,comparison:boolean,sourceDate:string|null}>};
export const cardDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function observePrices(previous:any,data:any,variant:string,grading:string,captured=new Date().toISOString()):any{
 const date=new Date(captured);if(!Number.isFinite(date.getTime()))return data;
 const day=cardDay(date),cutoff=new Date(date);cutoff.setUTCDate(cutoff.getUTCDate()-89);
 const history:CardPricePoint[]=(Array.isArray(previous?.cardPriceHistory)?previous.cardPriceHistory:[]).filter((p:any)=>/^\d{4}-\d{2}-\d{2}$/.test(p.day)&&p.day>=cardDay(cutoff)&&p.day<=day).map((p:any)=>({...p,grades:{...p.grades}}));
 const market=quote(data,variant),gradePrice=grading?gradedValue(data,grading):null;
 const old=history.find(p=>p.day===day),point:CardPricePoint={day,raw:market.price,rawSourceDate:market.updated,grades:{...old?.grades}};
 if(gradePrice!==null)point.grades[grading]={price:gradePrice,comparison:!!data.gradedQuote?.comparison,sourceDate:data.gradedQuote?.sourceUpdated||data.gradedQuote?.fetchedAt||null};
 const points=history.filter(p=>p.day!==day);points.push(point);points.sort((a,b)=>a.day.localeCompare(b.day));
 return {...data,cardPriceHistory:points};
}
export function seedCardHistory(row:any):any{
 const data=typeof row.data==='string'?JSON.parse(row.data):row.data;
 return data.cardPriceHistory?.length?data:observePrices({},data,row.variant,row.grading,row.fetched);
}
export function lastThirtyDays(history:CardPricePoint[],grading:string,day=cardDay()){
 const last=new Date(day+'T12:00:00Z');const byDay=new Map(history.map(p=>[p.day,p]));
 return Array.from({length:30},(_,i)=>{const date=new Date(last);date.setUTCDate(date.getUTCDate()-29+i);const day=date.toISOString().slice(0,10),p=byDay.get(day);return {day,raw:typeof p?.raw==='number'&&Number.isFinite(p.raw)?p.raw:null,graded:grading&&typeof p?.grades?.[grading]?.price==='number'?p.grades[grading].price:null};});
}

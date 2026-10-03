import {db} from './data.ts';
import {quote} from './pricing.ts';
import {withLanguagePrices,cachedLanguagePrices} from './language-prices.ts';
export const PRICE_CHANGE_PERCENT=0.10,PRICE_CHANGE_EURO=1;
export function trendValues(card:any,language:string){const clean={...card,languageMarketQuotes:undefined,personalMarketQuote:undefined};const variants=card.variants_detailed||[];const keys=variants.length?variants.map((v:any)=>v.variantId||v.type):Object.keys(card.variants||{});return Object.fromEntries((keys.length?keys:['Standard']).map((v:string)=>[v,quote(clean,v,language).price??card.pricing?.cardmarket?.trend??null]));}
export function volatileTrend(before:any,after:any){return Object.keys(after).some(k=>typeof before?.[k]==='number'&&before[k]>0&&typeof after[k]==='number'&&Math.abs(after[k]-before[k])>=PRICE_CHANGE_EURO&&Math.abs(after[k]-before[k])/before[k]>=PRICE_CHANGE_PERCENT);}
export async function portfolioPrices(card:any,language:string,previous:any){
 const id=card.id+'/'+language,row=await db().prepare('SELECT data, updated_at FROM market_quotes WHERE id = ?').bind(id).first();
 const current=trendValues(card,language),stored=row?.data||{},baseline=stored.trendBaseline||trendValues(previous,language);
 const trigger=volatileTrend(baseline,current);
 let result=trigger&&language==='de'?await withLanguagePrices(card,language):await cachedLanguagePrices(card,language);
 if(trigger){const quotes={...result.languageMarketQuotes};for(const [variant,q] of Object.entries(quotes) as [string,any][]){if(q.manualApproved){quotes[variant]={...q,reviewRequired:true};const approved=(await db().prepare('SELECT * FROM price_submissions WHERE card_id = ? AND language = ? AND variant = ? AND status = ?').bind(card.id,language,variant,'approved').all()).results;for(const s of approved)await db().prepare('UPDATE price_submissions SET status = ?, needs_review = ? WHERE id = ?').bind('pending',true,s.id).run();}}result={...result,languageMarketQuotes:quotes};}
 const latest=await db().prepare('SELECT data, updated_at FROM market_quotes WHERE id = ?').bind(id).first();
 const data={...(latest?.data||stored),languageMarketQuotes:result.languageMarketQuotes||{},trendBaseline:trigger&&result.languagePriceStatus==='error'?baseline:trigger||!stored.trendBaseline?current:baseline,trendCheckedAt:new Date().toISOString()};
 await db().prepare('INSERT INTO market_quotes (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(id,data,latest?.updated_at||row?.updated_at||new Date().toISOString()).run();
 return {...result,marketRefreshTriggered:trigger&&language==='de',trendChanged:trigger};
}

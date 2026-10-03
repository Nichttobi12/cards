import {db} from './data.ts';
import {catalog} from './catalog.ts';
import {parseGrade} from './grading.ts';
import {selectedVariant,specialVariant,variantLabel} from './variants.ts';
declare const Deno:{env:{get(name:string):string|undefined}};
const cache=new Map<string,{expires:number,data:any}>();
const clean=(s:unknown)=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const number=(s:unknown)=>String(s||'').split('/')[0].replace(/^0+(?=\d)/,'').toLowerCase();
export function matchGradedCard(rows:any[],card:any,variant?:any){
 // Exact printed number, name and set; never select the cheapest/first fuzzy match.
 const matches=rows.filter(r=>(specialVariant(variant)?clean(r.version)===clean(variantLabel(variant)):!r.version)&&number(r.card_number)===number(card.localId)&&clean(r.name)===clean(card.name)&&clean(r.episode?.name)===clean(card.set?.name));
 return matches.length===1?matches[0]:null;
}
export function extractGradedPrice(card:any,grading:string){
 const g=parseGrade(grading);if(!g)return null;
 const tier=card.prices?.ebay?.graded?.[g.referenceCompany.toLowerCase()]?.[String(g.referenceGrade)];
 const price=tier?.median_price,count=tier?.sample_size;
 // A listing/asking price or a raw price must never masquerade as a sale median.
 if(typeof price!=='number'||!Number.isFinite(price)||price<=0||!Number.isInteger(count)||count<1)return null;
 const currency=card.prices.ebay.currency;if(!['EUR','USD'].includes(currency))return null;
 return {price,currency,sales:count,...g};
}
export function comparableGradedPrice(card:any,grading:string){
 const g=parseGrade(grading);if(!g)return null;
 const exact=extractGradedPrice(card,grading);if(exact)return {...exact,reference:g.referenceCompany+' '+g.referenceGrade,estimated:g.comparison,estimateReason:g.comparison?'AOG ab 9,5: PSA 10 als Vergleich gemäß deiner Einstellung.':null};
 // Compare the same numerical grade only. Company scales are not equivalent;
 // this is explicitly an estimate, never a sale of the requested slab.
 for(const company of ['PSA','CGC','BGS','SGC','TAG','ACE','GSG','AOG']){
 if(company===g.referenceCompany)continue;
 const q=extractGradedPrice(card,company+' '+g.referenceGrade);
 if(q&&q.sales>=3)return {...q,company:g.company,grade:g.grade,comparison:true,estimated:true,reference:company+' '+g.referenceGrade,estimateReason:'Schätzwert aus Verkäufen derselben Karte in '+company+' '+g.referenceGrade+'. Grading-Skalen und Verkaufspreise können abweichen.'};
 }
 return null;
}
export function retainGradedQuote(previous:any,next:any,grading:string,variant:string){
 if(next?.status==='available')return next;
 if(previous?.status==='available'&&previous.appliedGrading===grading&&(!previous.variant||previous.variant===variant))return {...previous,stale:true,updateMessage:next?.message||'Aktualisierung nicht verfügbar.'};
 return next;
}
const cardCache=new Map<string,{expires:number,data:any}>();
async function provider(path:string,key:string):Promise<any>{
 // Atomic shared daily budget across all Edge instances. Fail closed on DB errors.
 const day=new Date().toISOString().slice(0,10);
 const rows=await db().prepare('INSERT INTO login_attempts (id,attempts,window) VALUES (?, ?, ?)').bind('grading-provider:'+day,1,Date.now()).all();
 if(!rows.results[0]||rows.results[0].attempts>95)throw Error('Tageslimit der Grading-Daten erreicht. Morgen erneut versuchen.');
 const response=await fetch('https://cardmarket-api-tcg.p.rapidapi.com/pokemon/'+path,{headers:{'x-rapidapi-key':key,'x-rapidapi-host':'cardmarket-api-tcg.p.rapidapi.com'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(response.status===403?'Der API-Tarif erlaubt diese Grading-Daten nicht.':response.status===429?'Die Grading-Quelle hat ihr Abfragelimit erreicht.':'Grading-Quelle derzeit nicht erreichbar.');
 return response.json();
}
export async function gradedPrice(id:string,language:string,grading:string,variant=''){
 const grade=parseGrade(grading);if(!grade)return {status:'unsupported',message:'Grading-Anbieter und Note prüfen.'};
 const reference=grade.referenceCompany+' '+grade.referenceGrade;
 const key=Deno.env.get('GRADING_RAPIDAPI_KEY');
 if(!key)return {status:'not_configured',reference,comparison:grade.comparison,message:'Die automatische Grading-Preisquelle ist noch nicht verbunden.'};
 const cacheKey=language+'/'+id+'/'+variant+'/'+grading,hit=cache.get(cacheKey);if(hit&&hit.expires>Date.now())return hit.data;
 try{
 const card=await catalog('cards/'+id,'en');
 const printing=variant?selectedVariant(card,variant):undefined;
 if(variant&&!printing)return {status:'unmatched',message:'Kartenvariante in der Grading-Quelle nicht zuordenbar.'};
 const detailKey=id+'/'+variant,prior=cardCache.get(detailKey);let detail:any;
 if(prior&&prior.expires>Date.now())detail=prior.data;
 else {const response=await provider('cards/search?search='+encodeURIComponent(card.name),key);
 const candidate=matchGradedCard(Array.isArray(response.data)?response.data:[],card,printing);
 if(!candidate)return {status:'unmatched',reference,comparison:grade.comparison,message:'Keine eindeutige Zuordnung von Karte, Set, Nummer und Variante in der Grading-Quelle.'};
 detail=candidate.prices?.ebay?candidate:(await provider('cards/'+encodeURIComponent(candidate.id),key)).data;
 if(cardCache.size>300)cardCache.clear();cardCache.set(detailKey,{expires:Date.now()+86400000,data:detail});}
 const quote=comparableGradedPrice(detail,grading);
 if(!quote)return {status:'missing',reference,comparison:grade.comparison,message:'Keine belegten Verkäufe für diese Note oder ausreichend vergleichbare Verkäufe anderer Grading-Firmen.'};
 let priceEur:number|null=quote.currency==='EUR'?quote.price:null,fxDate:string|null=null;
 if(priceEur===null){try{const r=await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',{signal:AbortSignal.timeout(8000)});if(r.ok){const xml=await r.text(),rate=Number(xml.match(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/)?.[1]);fxDate=xml.match(/time=['"]([\d-]+)['"]/)?.[1]||null;if(rate>0&&fxDate&&Date.now()-Date.parse(fxDate)<7*86400000)priceEur=Math.round(quote.price/rate*100)/100;}}catch{}}
 const result={appliedGrading:grading,status:'available',reference:quote.reference,comparison:quote.comparison,estimated:true,estimateReason:[quote.estimateReason,'Internationaler Verkaufsvergleich: die Sprache wird von der Quelle nicht getrennt ausgewiesen.'].filter(Boolean).join(' '),variant,price:quote.price,currency:quote.currency,priceEur,sales:quote.sales,source:'eBay-Verkaufsmedian via CMAPI',fetchedAt:new Date().toISOString(),sourceUpdated:detail.updated_at||null,fxDate,languageScope:'international',languageNote:'Die Quelle weist die Sprache der Grading-Verkäufe nicht getrennt aus. Internationaler Vergleichswert; kein spezifischer deutscher Kartenpreis.'};
 if(cache.size>300)cache.clear();cache.set(cacheKey,{expires:Date.now()+86400000,data:result});return result;
 }catch(e){return {status:'unavailable',reference,comparison:grade.comparison,message:e instanceof Error?e.message:'Grading-Preisabruf fehlgeschlagen.'};}
}

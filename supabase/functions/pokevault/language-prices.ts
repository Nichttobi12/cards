import {db,tcg} from './data.ts';
import {cardVariants,specialVariant,variantLabel} from './variants.ts';
declare const Deno:{env:{get(name:string):string|undefined}};
const clean=(s:unknown)=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const setName=(s:unknown)=>clean(s).replace(/^(?:me(?:p|ga)evolutionblackstarpromos|mepblackstarpromos|megaevolutionpromos)$/,'megapromos').replace(/^(?:sv(?:p)?blackstarpromos|scarletvioletpromos)$/,'svpromos');
const num=(s:unknown)=>String(s||'').split('/')[0].replace(/^0+(?=\d)/,'').toLowerCase();
const slots=new Map<string,Promise<any>>();
export function matchMarketCard(rows:any[],card:any,variant:any){
 const candidates=rows.filter(r=>num(r.card_number)===num(card.localId)&&clean(r.name)===clean(card.name)&&setName(r.episode?.name)===setName(card.set?.name));
 const onePrinting=cardVariants(card).length===1;
 const matching=candidates.filter(r=>{
  if(/reverse/i.test(variant.type))return /reverse/i.test(r.version||'');
  if(specialVariant(variant)&&!(onePrinting&&!r.version))return clean(r.version)===clean(variantLabel(variant));
  return !r.version;
 });
 return matching.length===1?matching[0]:null;
}
export function extractLanguagePrice(row:any,language:string,variant:string){
 const p=row?.prices?.cardmarket,field='lowest_near_mint_'+(language==='ja'?'JP':language.toUpperCase());
 const price=p?.[field];
 // Unsuffixed low/trend are not proof of language and are never used here.
 if(p?.currency!=='EUR'||typeof price!=='number'||!Number.isFinite(price)||price<=0)return null;
 return {price,language,variant,scope:'language',metric:'near-mint-asking-low',source:'Cardmarket via TCGGO',condition:'NM',updated:row.updated_at||null,fetchedAt:new Date().toISOString()};
}
async function request(path:string,key:string){
 const day=new Date().toISOString().slice(0,10),r=await db().prepare('INSERT INTO login_attempts (id,attempts,window) VALUES (?, ?, ?)').bind('grading-provider:'+day,1,Date.now()).all();
 if(!r.results[0]||r.results[0].attempts>95)throw Error('Tageslimit der Preisquelle erreicht.');
 const response=await fetch('https://cardmarket-api-tcg.p.rapidapi.com/'+path,{headers:{'x-rapidapi-key':key,'x-rapidapi-host':'cardmarket-api-tcg.p.rapidapi.com'},signal:AbortSignal.timeout(15000)});

 if(!response.ok)throw Error(response.status===429?'Abfragelimit erreicht.':response.status===403?'Diese Daten sind im API-Tarif nicht verfügbar.':'Preisquelle meldet HTTP '+response.status+'.');
 return response.json() as Promise<any>;
}
async function load(card:any,language:string){
 const key=Deno.env.get('GRADING_RAPIDAPI_KEY');if(!key)return {...card,marketLanguage:language,languagePriceStatus:'not_configured'};
 const id=card.id+'/'+language,stored=await db().prepare('SELECT data, updated_at FROM market_quotes WHERE id = ?').bind(id).first();
 const cached=stored?.data;
 if(cached&&(cached.languagePriceStatus==='error'?Date.now()-Date.parse(stored.updated_at)<900000:String(stored.updated_at).slice(0,10)===new Date().toISOString().slice(0,10)))return {...card,...cached,marketLanguage:language};
 try{
  const identity=language==='ja'?card:await tcg('cards/'+card.id,'en');
  const game=language==='ja'?'pokemon-jp':'pokemon';
  const response=await request(game+'/cards/search?name='+encodeURIComponent(identity.name)+'&card_number='+encodeURIComponent(identity.localId),key);
  const quotes:Record<string,any>={};
  for(const variant of cardVariants(card,language)){
   const candidate=matchMarketCard(Array.isArray(response.data)?response.data:[],identity,variant);if(!candidate)continue;
   let price:any=extractLanguagePrice(candidate,language,variant.value);
   // The documented history endpoint explicitly filters cm_low by language.
   if(!price&&language==='en'){
    const h=await request(game+'/cards/'+encodeURIComponent(candidate.id)+'/history-prices?lang=en&sort=desc',key);
    const entry=Object.entries(h.data||{}).filter(([d])=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort(([a],[b])=>b.localeCompare(a))[0];
    const value=(entry?.[1] as any)?.cm_low;
    if(entry&&Date.now()-Date.parse(entry[0])<7*86400000&&typeof value==='number'&&Number.isFinite(value)&&value>0)price={price:value,language,variant:variant.value,scope:'language',metric:'asking-low',source:'Cardmarket via TCGGO',condition:null,updated:entry[0],fetchedAt:new Date().toISOString()};
   }
   if(price)quotes[variant.value]={...price,providerId:candidate.id};
  }
  const data={marketLanguage:language,languageMarketQuotes:quotes,languagePriceStatus:Object.keys(quotes).length?'available':'missing'};
  await db().prepare('INSERT INTO market_quotes (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(id,data,new Date().toISOString()).run();
  return {...card,...data};
 }catch(e){const failed={...(cached||{}),marketLanguage:language,languagePriceStatus:'error',languagePriceMessage:e instanceof Error?e.message:'Preisabruf fehlgeschlagen.',languagePriceStale:!!cached?.languageMarketQuotes};await db().prepare('INSERT INTO market_quotes (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(id,failed,new Date().toISOString()).run().catch(()=>{});return {...card,...failed};}
}
export async function withLanguagePrices(card:any,language:string){
 const id=card.id+'/'+language;let job=slots.get(id);if(!job){job=load(card,language);slots.set(id,job);}
 try{return await job;}finally{slots.delete(id);}
}

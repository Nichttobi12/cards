import {strict as assert} from 'node:assert';
import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const temp=await mkdtemp(join(tmpdir(),'pv-policy-'));
try{
await build({stdin:{contents:"export * from './supabase/functions/pokevault/price-policy.ts';export * from './supabase/functions/pokevault/manual-prices.ts';export * from './supabase/functions/pokevault/pricing.ts';export {catalog} from './supabase/functions/pokevault/catalog.ts';export {collector} from './supabase/functions/pokevault/community.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:join(temp,'test.mjs')});
const {volatileTrend,portfolioPrices,validatePriceInput,submitPrice,quote,catalog,collector}=await import(join(temp,'test.mjs'));
assert.equal(volatileTrend({normal:10},{normal:10.5}),false);assert.equal(volatileTrend({normal:10},{normal:11}),true);assert.equal(volatileTrend({normal:10},{normal:9}),true);assert.equal(volatileTrend({normal:1},{normal:1.5}),false);assert.equal(volatileTrend({}, {normal:42}),false);
const base={id:'test-1',name:'Pikachu',localId:'1',set:{name:'Test'},variants:{normal:true},pricing:{cardmarket:{trend:10}}};
const rows=[{id:'own',owner:'one',card_id:base.id,language:'de',variant:'normal',condition:'NM',grading:'',manual_cents:null,quantity:1,data:JSON.stringify(base)}],cache=new Map(),submissions=[];let calls=0;
globalThis.crypto ||= (await import('node:crypto')).webcrypto;
globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_test"}',GRADING_RAPIDAPI_KEY:'fixture'}[n])}};
globalThis.fetch=async(input,opts={})=>{const u=new URL(input),body=opts.body?JSON.parse(opts.body):null;
if(u.hostname==='api.tcgdex.net')return Response.json(base);
if(u.hostname==='cardmarket-api-tcg.p.rapidapi.com'){calls++;return Response.json({data:[{id:77,name:'Pikachu',card_number:1,episode:{name:'Test'},prices:{cardmarket:{currency:'EUR',lowest_near_mint_DE:15}}}]});}
if(u.pathname.endsWith('/rpc/portal_login_attempt'))return Response.json([{attempts:1}]);
let data=u.pathname.endsWith('/market_quotes')?[...cache.values()]:u.pathname.endsWith('/price_submissions')?submissions:u.pathname.endsWith('/cards')?rows:u.pathname.endsWith('/portal_accounts')?[{user_id:'one',username:'collector',active:true}]:[];
for(const [k,v] of u.searchParams)if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));
if(opts.method==='POST'){if(u.pathname.endsWith('/market_quotes'))cache.set(body.id,body);if(u.pathname.endsWith('/price_submissions'))submissions.push(body);return Response.json([body]);}
if(opts.method==='PATCH'){data.forEach(r=>Object.assign(r,body));}return Response.json(data);
};
await catalog('cards/test-1','de');assert.equal(calls,0);
await portfolioPrices(base,'de',base);assert.equal(calls,0);
await portfolioPrices({...base,pricing:{cardmarket:{trend:10.5}}},'de',base);assert.equal(calls,0);
const changed={...base,pricing:{cardmarket:{trend:11}}};const result=await portfolioPrices(changed,'de',base);assert.equal(calls,1);assert.equal(quote(result,'normal','de').price,15);
await portfolioPrices(changed,'de',base);assert.equal(calls,1);
const enData=await portfolioPrices(changed,'en',base);assert.equal(calls,1);assert.equal(enData.marketRefreshTriggered,false);assert.equal(quote({...enData,languageMarketQuotes:{normal:{scope:'language',language:'en',variant:'normal',price:99}}},'normal','en').price,11);
const jpData=await portfolioPrices(changed,'ja',base);assert.equal(calls,1);assert.equal(jpData.marketRefreshTriggered,false);
const manual={scope:'language',language:'en',variant:'normal',price:20,manualApproved:true};
cache.set('test-1/en',{id:'test-1/en',updated_at:new Date().toISOString(),data:{marketLanguage:'en',languagePriceStatus:'available',trendBaseline:{normal:10},languageMarketQuotes:{normal:manual}}});
assert.equal(quote({...base,marketLanguage:'en',languageMarketQuotes:{normal:manual}},'normal','en').price,20);
const rechecked=await portfolioPrices(changed,'en',base);assert.equal(calls,1);assert.equal(rechecked.languageMarketQuotes.normal.reviewRequired,true);assert.equal(quote(rechecked,'normal','en').price,11);
const date=new Date().toISOString().slice(0,10),proposal={id:'own',price:'20,50',sourceUrl:'https://www.cardmarket.com/de/Pokemon/Products/Singles/Test/Pikachu',observedOn:date};
assert.equal(validatePriceInput(proposal).cents,2050);
for(const bad of [{...proposal,price:-1},{...proposal,sourceUrl:'https://www.cardmarket.com.evil.com/de/Pokemon/Products/Singles/x'},{...proposal,observedOn:'2020-01-01'}])assert.throws(()=>validatePriceInput(bad));
await assert.rejects(()=>submitPrice('other',proposal));await submitPrice('one',proposal);assert.equal(calls,1);const saved=JSON.parse(rows[0].data);assert.equal(quote(saved,'normal','de').scope,'personal');assert.equal(quote(saved,'normal','de').price,20.5);assert.equal(cache.get('test-1/de').data.languageMarketQuotes.normal.price,15);
const friend=await collector('collector');assert.equal(friend.cards[0].data.personalMarketQuote,undefined);assert.equal(friend.cards[0].valueCents,1000);
console.log('Passed policy: no search calls, no initial/stable calls, accumulated 10% + €1 trigger, shared cache; private proposals, ownership, source/date validation, no global publication and friend isolation.');
}finally{await rm(temp,{recursive:true,force:true});}

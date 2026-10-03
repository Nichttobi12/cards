import {strict as assert} from 'node:assert';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const folder=await mkdtemp(join(tmpdir(),'card-history-'));
try{
const file=join(folder,'history.mjs');
await build({entryPoints:['supabase/functions/pokevault/card-history.ts'],bundle:true,format:'esm',platform:'node',outfile:file});
const {observePrices,seedCardHistory,lastThirtyDays}=await import(file);
const card=p=>({pricing:{cardmarket:{trend:p,updated:'2026-10-02'}}});
let data=observePrices({},card(50),'Standard','', '2026-10-02T12:00:00Z');
data=observePrices(data,card(52),'Standard','','2026-10-03T12:00:00Z');
data=observePrices(data,card(53),'Standard','','2026-10-03T13:00:00Z');
assert.equal(data.cardPriceHistory.length,2);assert.equal(data.cardPriceHistory[1].raw,53);
const graded={...card(53),gradedQuote:{status:'available',appliedGrading:'AOG 9.5',priceEur:239.87,comparison:true,fetchedAt:'2026-10-03T12:00:00Z'}};
data=observePrices(data,graded,'Standard','AOG 9.5','2026-10-03T14:00:00Z');
const points=lastThirtyDays(data.cardPriceHistory,'AOG 9.5','2026-10-03');
assert.equal(points.length,30);assert.equal(points.filter(p=>p.raw!==null).length,2);assert.equal(points[29].graded,239.87);
assert.equal(lastThirtyDays(data.cardPriceHistory,'PSA 9','2026-10-03')[29].graded,null);
const seeded=seedCardHistory({data:card(50),variant:'Standard',grading:'',fetched:'2026-10-01T12:00:00Z'});assert.equal(seeded.cardPriceHistory[0].day,'2026-10-01');
const missing=observePrices(data,{pricing:{}},'Standard','','2026-10-04T12:00:00Z');assert.equal(missing.cardPriceHistory[2].raw,null);assert.equal(missing.cardPriceHistory[0].raw,50);
const future=observePrices(data,card(1),'Standard','','2027-02-01T12:00:00Z');assert.equal(future.cardPriceHistory.length,1);
console.log('Passed real daily observations, daily overwrite, missing-day gaps, grade isolation, safe legacy seed and retention.');
}finally{await rm(folder,{recursive:true,force:true});}

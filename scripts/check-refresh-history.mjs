import {strict as assert} from 'node:assert';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const folder=await mkdtemp(join(tmpdir(),'refresh-history-'));
try{
 const file=join(folder,'refresh.mjs');await build({entryPoints:['supabase/functions/pokevault/history.ts'],bundle:true,format:'esm',platform:'node',outfile:file});
 const rows=Array.from({length:15},(_,i)=>({id:String(i).padStart(3,'0'),owner:'one',collection_id:'collection',card_id:'xy-'+i,language:'de',variant:'Standard',grading:'',manual_cents:null,quantity:1,fetched:'2026-10-01T12:00:00Z',data:JSON.stringify({pricing:{cardmarket:{trend:1}}})}));const refreshed=[];
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_fixture"}'}[n])}};
 globalThis.fetch=async(input,options={})=>{const u=new URL(input);if(u.hostname==='api.tcgdex.net'){const id=u.pathname.split('/').pop();refreshed.push(id);return Response.json({id,pricing:{cardmarket:{trend:42}}});}
 const table=u.pathname.split('/').pop();if(table==='cards'){if(options.method==='PATCH'){const id=u.searchParams.get('id').slice(3),index=rows.findIndex(r=>r.id===id);const [row]=rows.splice(index,1);Object.assign(row,JSON.parse(options.body));rows.push(row);return Response.json([row]);}return Response.json(u.searchParams.get('order')==='id.asc'?[...rows].sort((a,b)=>a.id.localeCompare(b.id)):rows);}
 if(table==='market_quotes'){return Response.json(options.method==='POST'?[JSON.parse(options.body)]:[]);}
 if(table==='sealed_items')return Response.json([]);if(table==='collections')return Response.json([{id:'collection'}]);if(table==='portfolio_snapshots')return Response.json([]);throw Error('Unexpected request');};
 const {refresh}=await import(file);let cursor=0,updated=0;do{const result=await refresh('one',cursor);assert.equal(result.failed,0);updated+=result.updated;cursor=result.nextCursor;}while(cursor!==null);
 assert.equal(updated,15);assert.equal(new Set(refreshed).size,15);assert.equal(refreshed.length,15);assert.ok(rows.every(r=>JSON.parse(r.data).cardPriceHistory.length===2));console.log('Passed stable refresh pagination despite changing physical row order; all 15 cards updated once and history persisted.');
}finally{await rm(folder,{recursive:true,force:true});}

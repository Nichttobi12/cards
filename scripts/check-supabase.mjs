import {strict as assert} from 'node:assert';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temp=await mkdtemp(join(tmpdir(),'pokevault-check-'));
const output=join(temp,'edge.mjs');
await build({entryPoints:['supabase/functions/pokevault/index.ts'],bundle:true,platform:'node',format:'esm',outfile:output});
const users=[{id:'one',email:'one@example.com',email_confirmed_at:'2026-01-01'},{id:'two',email:'two@example.com',email_confirmed_at:'2026-01-01'}];
const slots=users.map((u,i)=>({user_id:u.id,email:u.email,username:'collector'+i}));
const collections=users.map(u=>({id:'collection-'+u.id,owner:u.id,name:u.id,created:'2026-01-01'}));
globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_fixture"}',SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_fixture"}'}[n])},serve:()=>{}};
globalThis.fetch=async(input,options={})=>{const u=new URL(input);let data=[];if(u.pathname==='/auth/v1/user'){const id=options.headers.Authorization?.replace('Bearer ','');data=users.find(x=>x.id===id);if(!data)return Response.json({}, {status:401});}else if(u.pathname.startsWith('/rest/v1/')){const table=u.pathname.split('/')[3];data=table==='portal_accounts'?slots:table==='collections'?collections:[];for(const [field,query] of u.searchParams){if(query.startsWith('eq.'))data=data.filter(x=>String(x[field])===query.slice(3));}}else if(u.hostname==='api.tcgdex.net'){const path=u.pathname.split('/').slice(3);const sets=[{id:'30th',name:'30 Jahre',count:158},{id:'me02.5',name:'Erhabene Helden',count:295},{id:'mep',name:'MEP Promos',count:88},{id:'B1',name:'Pocket',count:10}];if(path[0]==='sets'&&!path[1])data=sets;else if(path[0]==='sets'){const set=sets.find(s=>s.id===path[1]);data={...set,cards:Array.from({length:set.count},(_,i)=>({id:set.id+'-'+String(i+1).padStart(3,'0'),localId:String(i+1).padStart(3,'0'),name:'Karte '+(i+1)}))};}else data={id:path[1],pricing:{cardmarket:{trend:42,updated:'2026-10-02'}}};}else throw Error('Unexpected fixture request');return Response.json(data);};
const {handle}=await import(output);
const request=(path,user,body,origin)=>new Request('https://fixture.supabase.co/functions/v1/pokevault'+path,{method:body?'POST':'GET',headers:{...(user?{Cookie:'__Host-pv-access='+user}:{}),...(origin?{Origin:origin}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
assert.equal((await handle(request('/api/vault'))).status,401);
for(const user of ['one','two']){const r=await handle(request('/api/vault',user));assert.equal(r.status,200);assert.deepEqual((await r.json()).collections.map(x=>x.owner),[user]);}
assert.equal((await handle(request('/api/vault','one',{op:'add',collectionId:'collection-two'}))).status,400);
assert.equal((await handle(request('/api/vault','one',{op:'collection',name:'x'},'https://foreign.example'))).status,403);
assert.equal((await handle(request('/api/daily',null,{}))).status,401);
const catalog=await handle(request('/api/vault?op=sets','one'));assert.ok(!(await catalog.json()).some(s=>s.id==='B1'));
for(const [id,count] of [['30th',158],['me02.5',295]]){const set=await handle(request('/api/vault?op=set&id='+id,'one'));assert.equal(set.status,200);assert.equal((await set.json()).cards.length,count);}
const prices=await handle(request('/api/vault?op=prices&ids=30th-001,30th-002','one'));assert.equal(prices.status,200);assert.deepEqual((await prices.json()).map(c=>c.price),[42,42]);
assert.equal((await handle(request('/api/vault?op=prices&ids='+Array.from({length:7},(_,i)=>'30th-'+i).join(','),'one'))).status,400);
assert.equal((await handle(request('/api/vault?op=prices&ids=30th-001'))).status,401);
await rm(temp,{recursive:true,force:true});
console.log('Passed: anonymous access denied, account isolation, foreign collection rejected, foreign origin rejected, cron protected, complete latest sets, Pocket excluded and price batch limits.');

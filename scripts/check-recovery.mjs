import {strict as assert} from 'node:assert';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temp=await mkdtemp(join(tmpdir(),'pv-recovery-'));
await build({entryPoints:['supabase/functions/pokevault/index.ts'],bundle:true,platform:'node',format:'esm',outfile:join(temp,'edge.mjs')});
globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_fixture"}',SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_fixture"}'}[n])},serve:()=>{}};
const users=[{id:'one',email:'one@example.com',email_confirmed_at:'2026-01-01'},{id:'two',email:'two@example.com',email_confirmed_at:'2026-01-01'}],slots=users.map(u=>({...u,user_id:u.id,active:u.id==='one',role:'user'}));
const attempts=new Map(),calls=[];
globalThis.fetch=async(input,opts={})=>{
 const u=new URL(input),body=opts.body?JSON.parse(opts.body):null;calls.push({path:u.pathname,body,token:opts.headers?.Authorization,query:u.search});
 if(u.pathname==='/rest/v1/rpc/portal_login_attempt'){const count=(attempts.get(body.attempt_id)||0)+1;attempts.set(body.attempt_id,count);return Response.json([{attempts:count}]);}
 if(u.pathname==='/rest/v1/login_attempts')return Response.json([{attempts:attempts.get(u.searchParams.get('id').slice(3))||0}]);
 if(u.pathname==='/rest/v1/portal_accounts')return Response.json(slots.filter(s=>!u.searchParams.get('email')||u.searchParams.get('email')==='eq.'+s.email));
 if(u.pathname==='/auth/v1/recover')return Response.json({});
 if(u.pathname==='/auth/v1/verify'){assert.equal(body.type,'recovery');return body.token==='123456'||body.token_hash==='a'.repeat(64)?Response.json({access_token:'one'}):Response.json({}, {status:401});}
 if(u.pathname==='/auth/v1/user'){const user=users.find(u=>opts.headers.Authorization==='Bearer '+u.id);if(!user)return Response.json({}, {status:401});return Response.json(user);}
 if(u.pathname==='/auth/v1/logout')return Response.json({});
 throw Error('Unexpected '+u.pathname);
};
const {handle}=await import(join(temp,'edge.mjs'));
const req=(path,body,origin)=>new Request('https://fixture.supabase.co/functions/v1/pokevault/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
assert.equal((await handle(req('recover',{email:'one@example.com'},'https://evil.example'))).status,403);
const real=await handle(req('recover',{email:'one@example.com'}));assert.equal(real.status,200);const msg=await real.json();
assert.deepEqual(await (await handle(req('recover',{email:'unknown@example.com'}))).json(),msg);
assert.deepEqual(await (await handle(req('recover',{email:'two@example.com'}))).json(),msg);
assert.equal(calls.filter(c=>c.path==='/auth/v1/recover').length,1);assert.ok(calls.find(c=>c.path==='/auth/v1/recover').query.includes(encodeURIComponent('https://cards-chi-dusky.vercel.app/')));
assert.equal((await handle(req('reset',{email:'one@example.com',code:'000000',password:'new-fixture-123'}))).status,401);
assert.equal((await handle(req('reset',{email:'one@example.com',password:'new-fixture-123'}))).status,401);
assert.equal((await handle(req('reset',{access_token:'two',password:'new-fixture-123'}))).status,403);
assert.equal((await handle(req('reset',{access_token:'fake',password:'new-fixture-123'}))).status,401);
assert.equal((await handle(req('reset',{access_token:'one',password:'short'}))).status,400);
const changed=await handle(req('reset',{email:'two@example.com',access_token:'one',password:'new-fixture-123'}));assert.equal(changed.status,200);assert.match(changed.headers.get('set-cookie'),/HttpOnly/);
assert.equal(calls.find(c=>c.path==='/auth/v1/user'&&c.body?.password)?.token,'Bearer one');
assert.equal((await handle(req('reset',{email:'one@example.com',code:'123456',password:'new-fixture-123'}))).status,200);
assert.equal((await handle(req('reset',{token_hash:'a'.repeat(64),password:'new-fixture-123'}))).status,200);
for(let i=0;i<2;i++)assert.equal((await handle(req('recover',{email:'one@example.com'}))).status,200);
assert.equal((await handle(req('recover',{email:'one@example.com'}))).status,429);
console.log('Passed recovery: CSRF, generic account responses, inactive accounts, verified token ownership, invalid/expired proof, password length, OTP/link recovery, cookie clearing and request limits. No real emails or passwords changed.');
await rm(temp,{recursive:true,force:true});

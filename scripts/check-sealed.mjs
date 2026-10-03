import {strict as assert} from 'node:assert';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const folder=await mkdtemp(join(tmpdir(),'pv-sealed-'));
try{
 await build({entryPoints:['supabase/functions/pokevault/sealed.ts'],bundle:true,platform:'node',format:'esm',outfile:join(folder,'test.mjs')});
 const {sealedCatalog,sealedMutation,sealedRows}=await import(join(folder,'test.mjs'));
 assert.ok(sealedCatalog.length>=350);assert.equal(new Set(sealedCatalog.map(p=>p.id)).size,sealedCatalog.length);assert.ok(sealedCatalog.every(p=>p.language==='de'&&p.image.startsWith('https://cdn.shopify.com/')&&p.name&&p.sourceUrl.startsWith('https://crispycards.de/products/')));
 const collections=[{id:'sealed',owner:'one',kind:'sealed'},{id:'cards',owner:'one',kind:'cards'},{id:'foreign',owner:'two',kind:'sealed'}],rows=[];let vendor=0;
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_test"}'}[n])}};
 globalThis.fetch=async(input,opts={})=>{const u=new URL(input);if(!u.pathname.startsWith('/rest/v1/')){vendor++;throw Error('Unexpected vendor call');}const all=u.pathname.endsWith('/sealed_items')?rows:collections;let data=all.filter(r=>[...u.searchParams].every(([k,v])=>!v.startsWith('eq.')||String(r[k])===v.slice(3)));if(opts.method==='POST'){const body=JSON.parse(opts.body);rows.push(body);return Response.json([body]);}if(opts.method==='PATCH'){data.forEach(r=>Object.assign(r,JSON.parse(opts.body)));}if(opts.method==='DELETE'){data.forEach(r=>rows.splice(rows.indexOf(r),1));return Response.json([]);}return Response.json(data);};
 const b={op:'sealed-add',collectionId:'sealed',productId:sealedCatalog[0].id,quantity:2,cost:'25.50',value:'30',condition:'Originalversiegelt',note:'private'};
 for(const bad of [{...b,collectionId:'cards'},{...b,collectionId:'foreign'},{...b,productId:'fake'},{...b,quantity:0},{...b,value:-1}])await assert.rejects(()=>sealedMutation('one',bad));
 await sealedMutation('one',b);assert.equal(rows.length,1);assert.equal(rows[0].value_cents,3000);assert.equal((await sealedRows('one'))[0].note,'private');const shared=(await sealedRows('one',true))[0];assert.equal(shared.note,undefined);assert.equal(shared.cost_cents,undefined);assert.ok(shared.product.image);assert.equal((await sealedRows('two')).length,0);
 await assert.rejects(()=>sealedMutation('two',{...b,op:'sealed-edit',id:rows[0].id,collectionId:'foreign'}));
 await sealedMutation('one',{...b,op:'sealed-edit',id:rows[0].id,quantity:3});assert.equal(rows[0].quantity,3);assert.equal(vendor,0);
 await sealedMutation('one',{op:'sealed-delete',id:rows[0].id});assert.equal(rows.length,0);
 console.log('Passed German image catalogue, sealed-only collection enforcement, owner isolation, quantity/price validation, edit/delete, friend privacy and zero provider requests.');
}finally{await rm(folder,{recursive:true,force:true});}

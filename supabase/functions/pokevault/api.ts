import {getUser} from './auth.ts';
import { db, tcg } from './data.ts';
import {snapshot,refresh,today} from './history.ts';
export const dynamic='force-dynamic';
const json=(v:any,status=200)=>Response.json(v,{status});
const langs=['de','en','ja','fr','it','es'];
function decode(row:any){return {...row,data:JSON.parse(row.data)};}
export async function GET(request:Request){
 try{
 const user=await getUser(request); if(!user)return json({error:'Bitte anmelden.'},401);
 const u=new URL(request.url),op=u.searchParams.get('op')||'state',lang=u.searchParams.get('lang')||'de';
 if(!langs.includes(lang))return json({error:'Ungültige Sprache.'},400);
 if(op==='sets'){const sets=await tcg('sets',lang);return json(sets.filter((s:any)=>!/^A\d|^P-A/.test(s.id)).reverse());}
 if(op==='detail'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.-]+$/.test(id))return json({error:'Ungültige Karten-ID.'},400);return json(await tcg(`cards/${id}`,lang));}
 if(op==='search'){
 const q=(u.searchParams.get('q')||'').trim(),set=u.searchParams.get('set');
 if(!q||q.length>100)return json({error:'Bitte Name oder Kartennummer eingeben.'},400);
 const number=q.split('/')[0].trim(); let rows:any[];
 if(set){if(!/^[a-zA-Z0-9.-]+$/.test(set))throw Error('Ungültiges Set.');const data=await tcg(`sets/${set}`,lang);rows=data.cards.filter((c:any)=>/^\d+$/.test(number)?Number(c.localId)===Number(number):c.localId.toLowerCase()===number.toLowerCase()||c.name.toLowerCase().includes(q.toLowerCase())); rows=rows.map(c=>({...c,setName:data.name}));}
 else {const key=/^[0-9]+$/.test(number)||/^[a-z]+[0-9]+$/i.test(number)?'localId':'name';const term=key==='localId'?number:`like:${q}`;rows=await tcg(`cards?${key}=${encodeURIComponent(term)}&pagination:itemsPerPage=60`,lang);}
 rows=rows.filter(c=>!/^A\d|^P-A/.test(c.id)); return json(rows.slice(0,60));
 }
 const d=db();const [collections,cards,history]=await Promise.all([d.prepare('SELECT * FROM collections WHERE owner = ? ORDER BY created').bind(user.userId).all(),d.prepare('SELECT * FROM cards WHERE owner = ? ORDER BY fetched DESC').bind(user.userId).all(),d.prepare('SELECT * FROM portfolio_snapshots WHERE owner = ? ORDER BY day').bind(user.userId).all()]);
 return json({collections:collections.results,cards:cards.results.map(decode),history:history.results,today:today()});
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'Abruf fehlgeschlagen.'},503);}
}
export async function POST(request:Request){
 try{
 const user=await getUser(request);if(!user)return json({error:'Bitte anmelden.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Anfrage abgelehnt.'},403);
 const b=await request.json() as any,d=db(),owner=user.userId;
 if(b.op==='collection') {const name=String(b.name||'').trim();if(!name||name.length>80)return json({error:'Bitte einen Sammlungsnamen mit höchstens 80 Zeichen eingeben.'},400);const id=crypto.randomUUID();await d.prepare('INSERT INTO collections (id, owner, name, created) VALUES (?, ?, ?, ?)').bind(id,owner,name,new Date().toISOString()).run();await snapshot(owner);return json({id});}
 if(b.op==='delete'){await d.prepare('DELETE FROM cards WHERE id = ? AND owner = ?').bind(b.id,owner).run();await snapshot(owner);return json({ok:true});}
 if(b.op==='refresh'){return json(await refresh(owner,Number(b.cursor)||0,Number(b.failedSoFar)||0));}
 if(!['add','edit'].includes(b.op))return json({error:'Ungültige Aktion.'},400);
 const collection=await d.prepare('SELECT id FROM collections WHERE id = ? AND owner = ?').bind(b.collectionId,owner).first();if(!collection)return json({error:'Bitte eine eigene Sammlung wählen.'},400);
 if(!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>9999)return json({error:'Anzahl muss zwischen 1 und 9999 liegen.'},400);
 if(!langs.includes(b.language)||!['NM','EX','GD','LP','PL','PO'].includes(b.condition))return json({error:'Ungültige Kartendetails.'},400);
 const cents=(x:any)=>x===null||x===''||x===undefined?null:Math.round(Number(x)*100);
 const cost=cents(b.cost),manual=cents(b.manual);if([cost,manual].some(x=>x!==null&&(!Number.isSafeInteger(x)||x<0||x>100000000)))return json({error:'Bitte einen gültigen Eurobetrag eingeben.'},400);
 const grading=String(b.grading||'').slice(0,80),note=String(b.note||'').slice(0,1000);
 if(b.op==='edit'){await d.prepare('UPDATE cards SET collection_id = ?, quantity = ?, condition = ?, cost_cents = ?, manual_cents = ?, grading = ?, note = ? WHERE id = ? AND owner = ?').bind(b.collectionId,b.quantity,b.condition,cost,manual,grading,note,b.id,owner).run();await snapshot(owner);return json({ok:true});}
 if(!/^[a-zA-Z0-9.-]+$/.test(b.cardId))return json({error:'Ungültige Karte.'},400);
 const data=await tcg(`cards/${b.cardId}`,b.language);const variants=data.variants_detailed||[];if(variants.length&&!variants.some((v:any)=>(v.variantId||v.type)===b.variant))return json({error:'Bitte Kartenvariante wählen.'},400);
 await d.prepare('INSERT INTO cards (id,owner,collection_id,card_id,language,variant,condition,quantity,cost_cents,manual_cents,grading,note,data,fetched) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(),owner,b.collectionId,b.cardId,b.language,String(b.variant||'Standard').slice(0,100),b.condition,b.quantity,cost,manual,grading,note,JSON.stringify(data),new Date().toISOString()).run();await snapshot(owner);return json({ok:true});
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'Speichern fehlgeschlagen. Bitte erneut versuchen.'},503);}
}

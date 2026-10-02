import {withPhotos,savePhoto,removePhoto,photoUrl} from './photos.ts';
import {attachImage,verifiedImages} from './verified-images.ts';
import {cardMetadata} from './metadata.ts';
import {getUser} from './auth.ts';
import { db, tcg } from './data.ts';
import {catalog,physical,searchCards,alternateImage} from './catalog.ts';
import {quote} from './pricing.ts';
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
 if(op==='photo'){
 const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))return json({error:'Ungültige Karte.'},400);
 const d=db(),row=await d.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first();const accounts=(await d.prepare('SELECT user_id, username FROM portal_accounts').all()).results.filter((a:any)=>a.user_id);
 if(!row||accounts.length!==2||!accounts.some((a:any)=>a.user_id===row.owner))return json({error:'Foto nicht verfügbar.'},404);
 return json({image:await photoUrl(row)});
 }
 if(op==='community'){
 const d=db();const accounts=(await d.prepare('SELECT user_id, username FROM portal_accounts').all()).results.filter((a:any)=>a.user_id);
 if(accounts.length!==2||!accounts.some((a:any)=>a.user_id===user.userId))return json({error:'Gemeinsamer Bereich nicht verfügbar.'},403);
 const collectors=await Promise.all(accounts.map(async(a:any)=>{
 const [collections,cards]=await Promise.all([d.prepare('SELECT * FROM collections WHERE owner = ? ORDER BY created').bind(a.user_id).all(),d.prepare('SELECT * FROM cards WHERE owner = ? ORDER BY fetched DESC').bind(a.user_id).all()]);
 return {username:a.username,collections:collections.results.map((c:any)=>({id:c.id,name:c.name})),cards:(await withPhotos(cards.results)).map((r:any)=>{const data=JSON.parse(r.data),market=quote(data,r.variant);return {id:r.id,collection_id:r.collection_id,quantity:r.quantity,language:r.language,variant:r.variant,condition:r.condition,grading:r.grading,data:attachImage({...data,customImageUrl:r.customImageUrl,customPhotoId:r.id},r.language),valueCents:r.manual_cents!==null?r.manual_cents:r.grading?null:market.price===null?null:Math.round(market.price*100),valueSource:r.manual_cents!==null?'Eigener Wert':r.grading?'Grading: Wert offen':'Cardmarket-Trend',priceDate:market.updated};})};
 }));return json({collectors,today:today()});
 }
 if(op==='sets'){const sets=await catalog('sets',lang);return json(sets.filter(physical).reverse());}
 if(op==='set'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.-]+$/.test(id)||!physical({id}))return json({error:'Ungültiges Set.'},400);const set=await catalog('sets/'+id,lang);return json({...set,cards:set.cards.map((c:any)=>attachImage(c,lang))});}
 if(op==='metadata'){const ids=[...new Set((u.searchParams.get('ids')||'').split(','))];if(ids.length>6||ids.some(id=>!id||id.length>100||! /^[a-zA-Z0-9.-]+$/.test(id)||!physical({id})))return json({error:'Ungültige Kartenliste.'},400);return json(await Promise.all(ids.map(id=>cardMetadata(id,lang))));}
 if(op==='setcover'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.-]{1,100}$/.test(id)||!physical({id}))return json({error:'Ungültiges Set.'},400);const set=await catalog('sets/'+id,lang);const cards=[...set.cards].reverse();const cover=cards.find((c:any)=>verifiedImages[lang+'/'+c.id])||cards.find((c:any)=>c.image)||cards[0];return json(cover?.image||verifiedImages[lang+'/'+cover?.id]?attachImage({...cover,imageLanguage:lang},lang):cover?await cardMetadata(cover.id,lang):{image:null});}
 if(op==='prices'){const ids=[...new Set((u.searchParams.get('ids')||'').split(','))];if(ids.length>6||ids.some(id=>!id||id.length>100||! /^[a-zA-Z0-9.-]+$/.test(id)||!physical({id})))return json({error:'Ungültige Kartenliste.'},400);return json(await Promise.all(ids.map(async id=>{try{const c=await tcg('cards/'+id,lang);const variant=c.variants_detailed?.[0]?.variantId||c.variants_detailed?.[0]?.type||'Standard';return {id,...quote(c,variant)};}catch{return {id,error:true};}})));}
 if(op==='detail'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.-]+$/.test(id))return json({error:'Ungültige Karten-ID.'},400);return json(attachImage(await tcg(`cards/${id}`,lang),lang));}
 if(op==='image'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.-]+$/.test(id))return json({error:'Ungültige Karten-ID.'},400);return json(await alternateImage(id,lang));}
 if(op==='search'){
 const q=(u.searchParams.get('q')||'').trim(),set=u.searchParams.get('set');
 if(!q||q.length>100)return json({error:'Bitte Name oder Kartennummer eingeben.'},400);
 if(set&&!/^[a-zA-Z0-9.-]+$/.test(set))return json({error:'Ungültiges Set.'},400);
 return json((await searchCards(q,lang,set||'',u.searchParams.get('type')==='promo')).map((c:any)=>attachImage(c,lang)));
 }
 const d=db();const [collections,cards,history]=await Promise.all([d.prepare('SELECT * FROM collections WHERE owner = ? ORDER BY created').bind(user.userId).all(),d.prepare('SELECT * FROM cards WHERE owner = ? ORDER BY fetched DESC').bind(user.userId).all(),d.prepare('SELECT * FROM portfolio_snapshots WHERE owner = ? ORDER BY day').bind(user.userId).all()]);
 return json({collections:collections.results,cards:(await withPhotos(cards.results)).map((r:any)=>({...decode(r),data:attachImage({...JSON.parse(r.data),customImageUrl:r.customImageUrl,customPhotoId:r.id},r.language)})),history:history.results,today:today()});
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'Abruf fehlgeschlagen.'},503);}
}
export async function POST(request:Request){
 try{
 const user=await getUser(request);if(!user)return json({error:'Bitte anmelden.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Anfrage abgelehnt.'},403);
 const b=await request.json() as any,d=db(),owner=user.userId;
 if(b.op==='photo'){try{return json(await savePhoto(owner,String(b.id||''),b.content));}catch(e){return json({error:e instanceof Error?e.message:'Foto fehlgeschlagen.'},400);}}
 if(b.op==='collection') {const name=String(b.name||'').trim();if(!name||name.length>80)return json({error:'Bitte einen Sammlungsnamen mit höchstens 80 Zeichen eingeben.'},400);const id=crypto.randomUUID();await d.prepare('INSERT INTO collections (id, owner, name, created) VALUES (?, ?, ?, ?)').bind(id,owner,name,new Date().toISOString()).run();await snapshot(owner);return json({id});}
 if(b.op==='delete'){const row=await d.prepare('SELECT * FROM cards WHERE id = ? AND owner = ?').bind(b.id,owner).first();await d.prepare('DELETE FROM cards WHERE id = ? AND owner = ?').bind(b.id,owner).run();if(row)await removePhoto(row);await snapshot(owner);return json({ok:true});}
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

import {cachedLanguagePrices} from './language-prices.ts';
import {PhotoLockedError} from './image-policy.ts';
import {members,directory,collector} from './community.ts';
import {rpc} from './data.ts';
import {displaySet,promoSeries} from './promo-catalog.ts';
import {cardVariants} from './variants.ts';
import {observePrices,seedCardHistory} from './card-history.ts';
import {gradedValue} from './grading.ts';
import {gradedPrice,retainGradedQuote} from './graded-prices.ts';
import {withPhotos,savePhoto,photoUrl,catalogPhotos} from './photos.ts';
import {attachImage,verifiedImages} from './verified-images.ts';
import {cardMetadata} from './metadata.ts';
import {getUser} from './auth.ts';
import { db, tcg } from './data.ts';
import {catalog,physical,searchCards,alternateImage,scanCards} from './catalog.ts';
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
 const d=db(),row=await d.prepare('SELECT * FROM card_images WHERE id = ?').bind(id).first();const accounts=await members();
 if(!row||!accounts.some((a:any)=>a.user_id===row.owner)||!accounts.some((a:any)=>a.user_id===user.userId))return json({error:'Foto nicht verfügbar.'},404);

 return json({image:await photoUrl(row)});
 }
 if(op==='community'){const search=(u.searchParams.get('q')||'').slice(0,30),page=Math.max(0,Math.min(10000,Number(u.searchParams.get('page'))||0));return json(await directory(search,Math.floor(page)));}
 if(op==='collector'){const result=await collector(u.searchParams.get('username')||'');return result?json(result):json({error:'Nutzer nicht gefunden.'},404);}
 if(op==='moderation'){if(user.role!=='admin')return json({error:'Nur für Administratoren.'},403);const accounts=await members(),rows=(await db().prepare('SELECT * FROM photo_submissions WHERE status = ? ORDER BY created_at').bind('pending').all()).results;return json({users:accounts.map((a:any)=>({username:a.username,role:a.role})),images:await Promise.all(rows.slice(0,60).map(async(r:any)=>({id:r.id,cardId:r.card_id,cardName:r.card_name,language:r.language,username:accounts.find((a:any)=>a.user_id===r.owner)?.username||'Deaktivierter Nutzer',createdAt:r.created_at,image:await photoUrl(r)}))),total:rows.length});}
 if(op==='sets'){const sets=await catalog('sets',lang);return json(await Promise.all(sets.filter(physical).reverse().map(async(s:any)=>displaySet(s.id==='mep'?{...s,cardCount:{...s.cardCount,total:(await catalog('sets/mep',lang)).cards.length}}:s,lang))));}
 if(op==='set'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.+-]+$/.test(id)||!physical({id}))return json({error:'Ungültiges Set.'},400);const set=await catalog('sets/'+id,lang);return json({...displaySet(set,lang),cards:await catalogPhotos(set.cards.map((c:any)=>attachImage(c,lang)),user.userId,lang)});}
 if(op==='metadata'){const ids=[...new Set((u.searchParams.get('ids')||'').split(','))];if(ids.length>6||ids.some(id=>!id||id.length>100||! /^[a-zA-Z0-9.+-]+$/.test(id)||!physical({id})))return json({error:'Ungültige Kartenliste.'},400);return json(await catalogPhotos(await Promise.all(ids.map(id=>cardMetadata(id,lang))),user.userId,lang));}
 if(op==='setcover'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.+-]{1,100}$/.test(id)||!physical({id}))return json({error:'Ungültiges Set.'},400);const set=await catalog('sets/'+id,lang);const series=promoSeries[id];const base=series?await catalog('sets/'+series.base,lang).catch(()=>null):null;const alternate=lang==='de'?await catalog('sets/'+(series?.base||id),'en').catch(()=>null):null;return json({alternateLogo:alternate?.logo||null,logo:set.logo||base?.logo||null,symbol:set.symbol||base?.symbol||null,name:displaySet(set,lang).name,series:series?.[lang==='de'?'de':'en']||null});}
 if(op==='prices'){const ids=[...new Set((u.searchParams.get('ids')||'').split(','))];if(ids.length>6||ids.some(id=>!id||id.length>100||! /^[a-zA-Z0-9.+-]+$/.test(id)||!physical({id})))return json({error:'Ungültige Kartenliste.'},400);return json(await Promise.all(ids.map(async id=>{try{const c=await cachedLanguagePrices(await catalog('cards/'+id,lang,false),lang);const variant=c.variants_detailed?.[0]?.variantId||c.variants_detailed?.[0]?.type||'Standard';return {id,...quote(c,variant)};}catch{return {id,error:true};}})));}
 if(op==='graded'){const id=u.searchParams.get('id')||'',grading=u.searchParams.get('grading')||'';if(!/^[a-zA-Z0-9.+-]{1,100}$/.test(id)||grading.length>80)return json({error:'Ungültige Grading-Anfrage.'},400);return json(await gradedPrice(id,lang,grading,(u.searchParams.get('variant')||'').slice(0,100)));}
 if(op==='detail'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.+-]+$/.test(id))return json({error:'Ungültige Karten-ID.'},400);return json((await catalogPhotos([attachImage(await catalog(`cards/${id}`,lang),lang)],user.userId,lang,true))[0]);}
 if(op==='image'){const id=u.searchParams.get('id')||'';if(!/^[a-zA-Z0-9.+-]+$/.test(id))return json({error:'Ungültige Karten-ID.'},400);return json(await alternateImage(id,lang));}
 if(op==='scan'){const number=(u.searchParams.get('number')||'').trim(),name=(u.searchParams.get('name')||'').trim(),set=u.searchParams.get('set')||'';if((!number&&!name)||number.length>30||name.length>100||(set&&!/^[a-zA-Z0-9.+-]{1,100}$/.test(set)))return json({error:'Bitte erkannte Nummer oder Namen prüfen.'},400);return json(await catalogPhotos((await scanCards(number,name,lang,set)).map((c:any)=>attachImage(c,lang)),user.userId,lang));}
 if(op==='search'){
 const q=(u.searchParams.get('q')||'').trim(),set=u.searchParams.get('set');
 if(!q||q.length>100)return json({error:'Bitte Name oder Kartennummer eingeben.'},400);
 if(set&&!/^[a-zA-Z0-9.+-]+$/.test(set))return json({error:'Ungültiges Set.'},400);
 return json(await catalogPhotos((await searchCards(q,lang,set||'',u.searchParams.get('type')==='promo')).map((c:any)=>attachImage(c,lang)),user.userId,lang));
 }
 const d=db();const [collections,cards,history]=await Promise.all([d.prepare('SELECT * FROM collections WHERE owner = ? ORDER BY created').bind(user.userId).all(),d.prepare('SELECT * FROM cards WHERE owner = ? ORDER BY fetched DESC').bind(user.userId).all(),d.prepare('SELECT * FROM portfolio_snapshots WHERE owner = ? ORDER BY day').bind(user.userId).all()]);
 return json({collections:collections.results,cards:(await withPhotos(cards.results)).map((r:any)=>({...decode(r),data:attachImage({...JSON.parse(r.data),customImageUrl:r.customImageUrl,customPhotoId:r.customPhotoId,customImageShared:r.customImageShared},r.language)})),history:history.results,today:today()});
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'Abruf fehlgeschlagen.'},503);}
}
export async function POST(request:Request){
 try{
 const user=await getUser(request);if(!user)return json({error:'Bitte anmelden.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Anfrage abgelehnt.'},403);
 const b=await request.json() as any,d=db(),owner=user.userId;
 if(b.op==='review-photo'){if(user.role!=='admin')return json({error:'Nur für Administratoren.'},403);if(!['approved','rejected'].includes(b.decision)||! /^[a-f0-9-]{36}$/.test(b.id||''))return json({error:'Ungültige Freigabe.'},400);return json(await rpc('portal_review_photo',{submission_id:b.id,reviewer_id:owner,decision:b.decision}));}
 if(b.op==='photo'){try{return json(await savePhoto(owner,String(b.id||''),b.content,b.cardId,b.language));}catch(e){return json({error:e instanceof Error?e.message:'Foto fehlgeschlagen.'},e instanceof PhotoLockedError?403:400);}}
 if(b.op==='collection') {if((await d.prepare('SELECT id FROM collections WHERE owner = ?').bind(owner).all()).results.length>=100)return json({error:'Höchstens 100 Sammlungen pro Konto.'},400);const name=String(b.name||'').trim();if(!name||name.length>80)return json({error:'Bitte einen Sammlungsnamen mit höchstens 80 Zeichen eingeben.'},400);const id=crypto.randomUUID();await d.prepare('INSERT INTO collections (id, owner, name, created) VALUES (?, ?, ?, ?)').bind(id,owner,name,new Date().toISOString()).run();await snapshot(owner);return json({id});}
 if(b.op==='delete'){await d.prepare('DELETE FROM cards WHERE id = ? AND owner = ?').bind(b.id,owner).run();await snapshot(owner);return json({ok:true});}
 if(b.op==='refresh'){return json(await refresh(owner,Number(b.cursor)||0,Number(b.failedSoFar)||0));}
 if(!['add','edit'].includes(b.op))return json({error:'Ungültige Aktion.'},400);
 const collection=await d.prepare('SELECT id FROM collections WHERE id = ? AND owner = ?').bind(b.collectionId,owner).first();if(!collection)return json({error:'Bitte eine eigene Sammlung wählen.'},400);
 if(!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>9999)return json({error:'Anzahl muss zwischen 1 und 9999 liegen.'},400);
 if(!langs.includes(b.language)||!['NM','EX','GD','LP','PL','PO'].includes(b.condition))return json({error:'Ungültige Kartendetails.'},400);
 const cents=(x:any)=>x===null||x===''||x===undefined?null:Math.round(Number(x)*100);
 const cost=cents(b.cost),manual=cents(b.manual);if([cost,manual].some(x=>x!==null&&(!Number.isSafeInteger(x)||x<0||x>100000000)))return json({error:'Bitte einen gültigen Eurobetrag eingeben.'},400);
 const grading=String(b.grading||'').slice(0,80),note=String(b.note||'').slice(0,1000);
 if(b.op==='edit'){const existing=await d.prepare('SELECT * FROM cards WHERE id = ? AND owner = ?').bind(b.id,owner).first();if(!existing)return json({error:'Karteneintrag nicht gefunden.'},404);let data=seedCardHistory(existing);const variant=String(b.variant||existing.variant);if(!cardVariants(data,existing.language).some((v:any)=>v.value===variant))return json({error:'Bitte eine verfügbare Kartenvariante wählen.'},400);const previousQuote=data.gradedQuote;delete data.gradedQuote;if(variant!==existing.variant){data.cardPriceHistoriesByVariant={...data.cardPriceHistoriesByVariant,[existing.variant]:data.cardPriceHistory};data.cardPriceHistory=data.cardPriceHistoriesByVariant[variant]||[];}if(grading)data.gradedQuote=retainGradedQuote(variant===existing.variant?previousQuote:null,await gradedPrice(existing.card_id,existing.language,grading,variant),grading,variant);data=observePrices(data,data,variant,grading);await d.prepare('UPDATE cards SET variant = ?, collection_id = ?, quantity = ?, condition = ?, cost_cents = ?, manual_cents = ?, grading = ?, note = ?, data = ? WHERE id = ? AND owner = ?').bind(variant,b.collectionId,b.quantity,b.condition,cost,manual,grading,note,JSON.stringify(data),b.id,owner).run();await snapshot(owner);return json({ok:true});}
 if((await d.prepare('SELECT id FROM cards WHERE owner = ?').bind(owner).all()).results.length>=5000)return json({error:'Höchstens 5.000 Karteneinträge pro Konto.'},400);
 if(!/^[a-zA-Z0-9.+-]+$/.test(b.cardId))return json({error:'Ungültige Karte.'},400);
 const data=await catalog(`cards/${b.cardId}`,b.language);const variants=cardVariants(data,b.language);if(!variants.some((v:any)=>v.value===b.variant))return json({error:'Bitte Kartenvariante wählen.'},400);if(grading)data.gradedQuote=await gradedPrice(b.cardId,b.language,grading,b.variant);
 await d.prepare('INSERT INTO cards (id,owner,collection_id,card_id,language,variant,condition,quantity,cost_cents,manual_cents,grading,note,data,fetched) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(),owner,b.collectionId,b.cardId,b.language,String(b.variant||'Standard').slice(0,100),b.condition,b.quantity,cost,manual,grading,note,JSON.stringify(observePrices({},data,b.variant,grading)),new Date().toISOString()).run();await snapshot(owner);return json({ok:true});
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'Speichern fehlgeschlagen. Bitte erneut versuchen.'},503);}
}

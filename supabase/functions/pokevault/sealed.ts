import {db} from './data.ts';
import {sealedCatalog} from './sealed-catalog.ts';
export {sealedCatalog};
export async function sealedRows(owner:string,shared=false){const rows=(await db().prepare('SELECT * FROM sealed_items WHERE owner = ? ORDER BY created_at DESC').bind(owner).all()).results;return rows.map((r:any)=>{const product=sealedCatalog.find(p=>p.id===r.product_id);return shared?{id:r.id,collection_id:r.collection_id,quantity:r.quantity,condition:r.condition,value_cents:r.value_cents,product}: {...r,product};});}
export async function sealedMutation(owner:string,b:any){
 const d=db();if(b.op==='sealed-delete'){await d.prepare('DELETE FROM sealed_items WHERE id = ? AND owner = ?').bind(String(b.id),owner).run();return {ok:true};}
 const collection=await d.prepare('SELECT * FROM collections WHERE id = ? AND owner = ?').bind(String(b.collectionId),owner).first();
 if(!collection||collection.kind!=='sealed')throw Error('Bitte eine eigene Sealed-Sammlung wählen. Karten und versiegelte Produkte werden getrennt gesammelt.');
 if(!sealedCatalog.some(p=>p.id===b.productId))throw Error('Bitte ein deutsches Produkt aus dem Katalog wählen.');
 if(!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>9999)throw Error('Bitte eine gültige Anzahl eingeben.');
 if(!['Originalversiegelt','Folie beschädigt','Verpackung beschädigt'].includes(b.condition))throw Error('Bitte den Verpackungszustand wählen.');
 const cents=(x:any)=>x===null||x===''||x===undefined?null:Math.round(Number(String(x).replace(',','.'))*100),cost=cents(b.cost),value=cents(b.value);
 if([cost,value].some(x=>x!==null&&(!Number.isSafeInteger(x)||x<0||x>100000000)))throw Error('Bitte einen gültigen Eurobetrag eingeben.');
 const note=String(b.note||'').slice(0,1000);
 if(b.op==='sealed-edit'){const row=await d.prepare('SELECT * FROM sealed_items WHERE id = ? AND owner = ?').bind(String(b.id),owner).first();if(!row)throw Error('Produkt nicht gefunden.');await d.prepare('UPDATE sealed_items SET collection_id = ?, quantity = ?, cost_cents = ?, value_cents = ?, condition = ?, note = ? WHERE id = ? AND owner = ?').bind(collection.id,b.quantity,cost,value,b.condition,note,row.id,owner).run();}
 else {if((await d.prepare('SELECT id FROM sealed_items WHERE owner = ?').bind(owner).all()).results.length>=5000)throw Error('Höchstens 5.000 Produkteinträge pro Konto.');await d.prepare('INSERT INTO sealed_items (id,owner,collection_id,product_id,quantity,cost_cents,value_cents,condition,note) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,collection.id,b.productId,b.quantity,cost,value,b.condition,note).run();}
 return {ok:true};
}

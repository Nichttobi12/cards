import {trendValues} from './price-policy.ts';
import {db} from './data.ts';
export function validatePriceInput(b:any){
 const price=Number(String(b.price??'').replace(',','.')),cents=Math.round(price*100),date=String(b.observedOn||'');let url:URL;
 try{url=new URL(String(b.sourceUrl));}catch{throw Error('Bitte einen Cardmarket-Link eingeben.');}
 if(url.protocol!=='https:'||!['cardmarket.com','www.cardmarket.com'].includes(url.hostname)||!url.pathname.includes('/Pokemon/Products/'))throw Error('Bitte einen direkten HTTPS-Link zur Pokémon-Karte auf Cardmarket eingeben.');
 if(!Number.isFinite(price)||price<=0||!Number.isSafeInteger(cents)||cents>100000000)throw Error('Bitte einen gültigen Eurobetrag eingeben.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||date!==new Date(Date.parse(date)).toISOString().slice(0,10)||Date.parse(date)>Date.now()||Date.now()-Date.parse(date)>7*86400000)throw Error('Der Preis muss aus den letzten sieben Tagen stammen.');
 return {cents,date,url:url.href};
}
export async function submitPrice(owner:string,b:any){
 const d=db(),input=validatePriceInput(b),row=await d.prepare('SELECT * FROM cards WHERE id = ? AND owner = ?').bind(b.id,owner).first();
 if(!row)throw Error('Bitte eine eigene Karte aus der Sammlung wählen.');
 if(row.grading||row.condition!=='NM')throw Error('Dieser Vorschlag gilt für ungegradete NM-Karten. Für andere Zustände nutze den eigenen Wert.');
 const pending=(await d.prepare('SELECT id FROM price_submissions WHERE owner = ? AND status = ?').bind(owner,'pending').all()).results;
 if(pending.length>=100)throw Error('Bitte zuerst die Prüfung deiner offenen Vorschläge abwarten.');
 const data=JSON.parse(row.data),id=crypto.randomUUID();
 await d.prepare('INSERT INTO price_submissions (id,owner,row_id,card_id,card_name,language,variant,condition,price_cents,source_url,observed_on,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner,row.id,row.card_id,String(data.name||row.card_id),row.language,row.variant,'NM',input.cents,input.url,input.date,'pending').run();
 const own=(await d.prepare('SELECT * FROM cards WHERE owner = ? AND card_id = ? AND language = ?').bind(owner,row.card_id,row.language).all()).results;
 for(const r of own.filter((r:any)=>r.variant===row.variant&&r.condition==='NM'&&!r.grading)){
 const existing=JSON.parse(r.data);existing.marketLanguage=r.language;existing.personalMarketQuote={price:input.cents/100,language:row.language,variant:row.variant,condition:'NM',scope:'personal',trendBaseline:trendValues(existing,r.language),source:'Cardmarket · eigener Vorschlag',updated:input.date,sourceUrl:input.url,status:'pending',submissionId:id};
 await d.prepare('UPDATE cards SET data = ? WHERE id = ? AND owner = ?').bind(JSON.stringify(existing),r.id,owner).run();
 }
 return {ok:true};
}

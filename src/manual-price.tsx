import {useState} from 'react';
import {api} from './api';
export default function ManualPrice({row,onSaved}:{row:any,onSaved:()=>Promise<void>}){
 const [price,setPrice]=useState(''),[url,setUrl]=useState(''),[date,setDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date())),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const submit=async()=>{setBusy(true);setMessage('');try{await api('',{op:'submit-price',id:row.id,price,sourceUrl:url,observedOn:date});await onSaved();setMessage('Für dich gespeichert. Ein Administrator prüft den Vorschlag vor der allgemeinen Übernahme.');}catch(e:any){setMessage(e.message);}finally{setBusy(false);}};
 if(row.grading||row.condition!=='NM')return null;
 return <details className="manual-price"><summary>Aktuellen Cardmarket-Preis hinzufügen</summary><p>Für diese Sprache und Druckvariante: niedrigster vergleichbarer NM-Angebotspreis ohne Versand. Gilt zunächst nur für dich.</p><label>Preis pro Karte (€)<input type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Direkter Cardmarket-Link<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.cardmarket.com/…"/></label><label>Nachgesehen am<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" className="secondary" disabled={busy||!price||!url} onClick={submit}>{busy?'Speichern …':'Preis zur Prüfung einreichen'}</button>{message&&<p role="status">{message}</p>}</details>;
}

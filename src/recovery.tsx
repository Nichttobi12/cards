import React,{useState} from 'react';
export type RecoveryCredentials={access_token?:string;token_hash?:string};
// Capture recovery credentials once, then remove them from browser history immediately.
export function readRecovery():RecoveryCredentials|null{
 const u=new URL(location.href),hash=new URLSearchParams(u.hash.slice(1));
 const isRecovery=hash.get('type')==='recovery'||u.searchParams.get('type')==='recovery';
 const access_token=isRecovery?hash.get('access_token'):null,token_hash=isRecovery?u.searchParams.get('token_hash'):null;
 const hasError=hash.has('error_description');
 if(!access_token&&!token_hash&&!hasError)return null;
 history.replaceState(null,'',u.pathname);
 return {...(access_token?{access_token}:{}),...(token_hash?{token_hash}:{})};
}
export default function Recovery({credentials,onBack,onDone}:{credentials:RecoveryCredentials|null;onBack:()=>void;onDone:()=>void}){
 const [email,setEmail]=useState(''),[sent,setSent]=useState(Boolean(credentials)),[manual,setManual]=useState(false),[proof,setProof]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const reset=Boolean(credentials?.access_token||credentials?.token_hash)||manual;
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setMessage('');setBusy(true);try{
  let data:any={email};
  if(reset){
   if(password!==confirm)throw Error('Die Passwörter stimmen nicht überein.');
   data={...data,...credentials,password};
   if(!credentials?.access_token&&!credentials?.token_hash){
    if(/^\d{6,8}$/.test(proof.trim()))data.code=proof.trim();
    else{try{const u=new URL(proof.trim());if(u.protocol!=='https:'||!['ctwwwlfbrtkvkpxmwyfa.supabase.co','cards-chi-dusky.vercel.app'].includes(u.hostname))throw Error();const h=new URLSearchParams(u.hash.slice(1));const token=u.searchParams.get('token_hash')||u.searchParams.get('token');if(token)data.token_hash=token;else if(h.get('type')==='recovery'&&h.get('access_token'))data.access_token=h.get('access_token');else throw Error();}catch{throw Error('Gib den Code aus der E-Mail ein oder kopiere den vollständigen Zurücksetzen-Link hier hinein.');}}
   }
  }
  const r=await fetch('/api/auth/'+(reset?'reset':'recover'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),result:any=await r.json();
  if(!r.ok)throw Error(result.error||'Bitte versuche es später erneut.');
  if(reset){setPassword('');setConfirm('');setProof('');onDone();}else{setSent(true);setMessage(result.message);}
 }catch(e:any){setError(e.message||'Der Dienst ist gerade nicht erreichbar.');}finally{setBusy(false);}}
 return <><h2>{reset?'Neues Passwort festlegen':'Passwort vergessen?'}</h2><p>{reset?'Wähle ein neues Passwort für dein PokéVault-Konto.':'Gib die E-Mail-Adresse ein, die zu deinem Konto gehört. Du erhältst eine E-Mail zum Zurücksetzen.'}</p><form onSubmit={submit}>
 {!credentials?.access_token&&!credentials?.token_hash&&<label>E-Mail-Adresse<input required type="email" autoComplete="email" autoFocus value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>}
 {reset&&<>{!credentials?.access_token&&!credentials?.token_hash&&<label>Code oder Link aus der E-Mail<input required value={proof} onChange={e=>setProof(e.target.value)} autoComplete="one-time-code" placeholder="Code oder vollständiger Link"/></label>}<label>Neues Passwort<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><small>Mindestens 8 Zeichen. Verwende ein einzigartiges Passwort.</small></label><label>Passwort wiederholen<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></>}
 {error&&<p role="alert" className="message error">{error}</p>}{message&&<p role="status" className="message">{message}</p>}
 <button className="primary" disabled={busy}>{busy?'Bitte warten …':reset?'Passwort speichern':sent?'E-Mail erneut anfordern':'E-Mail zum Zurücksetzen senden'}</button>
 </form>{sent&&!reset&&<><p className="recovery-help">Öffne den Link in deiner E-Mail. Falls du einen Code erhalten hast oder der Link nicht geöffnet werden kann, kannst du ihn hier eingeben.</p><button className="recovery-link" onClick={()=>{setManual(true);setError('');setMessage('');}}>Code oder Link eingeben</button></>}
 <button className="recovery-link" disabled={busy} onClick={onBack}>Zurück zur Anmeldung</button></>;
}

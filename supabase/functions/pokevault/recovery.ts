import {db} from './data.ts';
type Provider=(path:string,options?:RequestInit,token?:string)=>Promise<Response>;
const generic='Wenn diese E-Mail-Adresse zu einem aktiven Konto gehört, erhältst du eine E-Mail zum Zurücksetzen. Prüfe auch deinen Spam-Ordner.';
export async function recovery(request:Request,provider:Provider){
 const b=await request.json().catch(()=>null) as any;
 if(!b||typeof b!=='object')return Response.json({error:'Ungültige Anfrage.'},{status:400});
 const send=new URL(request.url).pathname.endsWith('/recover');
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode((send?'recover:':'reset:')+email));
 const window=Math.floor(Date.now()/600000),key=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')+'|'+window;
 await db().prepare('INSERT INTO login_attempts (id, attempts, window) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1').bind(key,window).run();
 const row:any=await db().prepare('SELECT attempts FROM login_attempts WHERE id=?').bind(key).first();
 if(row.attempts>(send?3:10))return Response.json({error:'Zu viele Versuche. Bitte in zehn Minuten erneut versuchen.'},{status:429});
 if(send){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return Response.json({error:'Bitte gib eine gültige E-Mail-Adresse ein.'},{status:400});
  const slot=await db().prepare('SELECT user_id, role, active FROM portal_accounts WHERE email = ?').bind(email).first();
  if(slot?.user_id&&slot.active!==false){
   const r=await provider('recover?redirect_to='+encodeURIComponent('https://cards-chi-dusky.vercel.app/'),{method:'POST',body:JSON.stringify({email})});
   if(!r.ok)return Response.json({error:r.status===429?'Bitte warte etwas, bevor du eine weitere E-Mail anforderst.':'Die E-Mail konnte gerade nicht versendet werden. Bitte versuche es später erneut.'},{status:r.status===429?429:503});
  }
  return Response.json({ok:true,message:generic});
 }
 if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)return Response.json({error:'Das neue Passwort muss 8 bis 128 Zeichen lang sein.'},{status:400});
 let token='';
 if(typeof b.token_hash==='string'&&/^[a-zA-Z0-9_-]{20,512}$/.test(b.token_hash)||typeof b.code==='string'&&/^\d{6,8}$/.test(b.code)&&email){
  const r=await provider('verify',{method:'POST',body:JSON.stringify(b.token_hash?{token_hash:b.token_hash,type:'recovery'}:{email,token:b.code,type:'recovery'})});
  if(r.ok){const d:any=await r.json();token=d.access_token||'';}
 }else if(typeof b.access_token==='string'&&b.access_token.length<8192)token=b.access_token;
 if(!token)return Response.json({error:'Der Link oder Code ist ungültig oder abgelaufen. Fordere eine neue E-Mail an.'},{status:401});
 // Infer the account from a provider-validated token, never from submitted email/user IDs.
 const identity=await provider('user',{},token);
 if(!identity.ok)return Response.json({error:'Der Link ist abgelaufen. Fordere eine neue E-Mail an.'},{status:401});
 const u:any=await identity.json();
 const slot=u.email&&u.email_confirmed_at?await db().prepare('SELECT user_id, role, active FROM portal_accounts WHERE email = ?').bind(u.email.toLowerCase()).first():null;
 if(!slot?.user_id||slot.user_id!==u.id||slot.active===false)return Response.json({error:'Für dieses Konto ist kein Zurücksetzen möglich.'},{status:403});
 const updated=await provider('user',{method:'PUT',body:JSON.stringify({password:b.password})},token);
 if(!updated.ok)return Response.json({error:'Das Passwort konnte nicht gespeichert werden. Wähle ein anderes sicheres Passwort oder fordere einen neuen Link an.'},{status:400});
 await provider('logout?scope=global',{method:'POST'},token).catch(()=>{});
 const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});
 for(const name of ['__Host-pv-access','__Host-pv-refresh'])headers.append('Set-Cookie',`${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
 return new Response(JSON.stringify({ok:true}),{headers});
}

import {db,adminAuth,rpc} from './data.ts';
import {snapshot} from './history.ts';
export async function createAccount(request:Request){
 const b:any=await request.json(),username=String(b.username||'').trim(),email=String(b.email||'').trim().toLowerCase();
 if(!/^[A-Za-z0-9_]{3,30}$/.test(username)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof b.password!=='string'||b.password.length<8||b.password.length>1024)return Response.json({error:'Ungültige Kontodaten.'},{status:400});
 const accounts=(await db().prepare('SELECT username, email FROM portal_accounts').all()).results;if(accounts.some((a:any)=>a.username.toLowerCase()===username.toLowerCase()||a.email===email))return Response.json({error:'Benutzername oder E-Mail bereits vergeben.'},{status:409});
 const response=await adminAuth('admin/users',{method:'POST',body:JSON.stringify({email,password:b.password,email_confirm:true})});
 if(!response.ok)return Response.json({error:'Das Benutzerkonto konnte nicht angelegt werden.'},{status:response.status===422?409:503});
 const data:any=await response.json(),userId=data.id||data.user?.id;if(!userId)throw Error('Konto konnte nicht zugeordnet werden.');
 await rpc('portal_register_account',{account_id:userId,account_username:username,account_email:email});await snapshot(userId);
 return Response.json({ok:true,username,role:'user'});
}

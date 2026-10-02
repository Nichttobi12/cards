import {db,env,storage} from './data.ts';
const bucket='card-photos';
function ownPath(path:string,owner:string){return path.startsWith(owner+'/')&&/^[a-f0-9-]+\.jpg$/.test(path.slice(owner.length+1));}
export async function photoUrl(row:any){if(!row.photo_path||!ownPath(row.photo_path,row.owner))return null;try{const r=await storage('object/sign/'+bucket+'/'+row.photo_path,{method:'POST',body:JSON.stringify({expiresIn:3600})});return env.SUPABASE_URL+'/storage/v1'+r.signedURL;}catch{return null;}}
export async function withPhotos(rows:any[]){const result=[];for(let i=0;i<rows.length;i+=6)result.push(...await Promise.all(rows.slice(i,i+6).map(async r=>({...r,customImageUrl:await photoUrl(r)}))));return result;}
export async function removePhoto(row:any){if(row.photo_path&&ownPath(row.photo_path,row.owner))await storage('object/'+bucket,{method:'DELETE',body:JSON.stringify({prefixes:[row.photo_path]})}).catch(()=>{});}
export async function savePhoto(owner:string,id:string,content:any){const d=db(),row=await d.prepare('SELECT * FROM cards WHERE id = ? AND owner = ?').bind(id,owner).first();if(!row)throw Error('Bitte eine eigene gespeicherte Karte wählen.');
 if(typeof content!=='string'||content.length>1400000||! /^[A-Za-z0-9+/=]+$/.test(content))throw Error('Bitte ein Foto bis 1 MB auswählen.');let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(content),c=>c.charCodeAt(0));}catch{throw Error('Ungültiges Foto.');}if(bytes.length>1048576||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Bitte ein gültiges JPEG-Foto bis 1 MB auswählen.');
 const path=owner+'/'+crypto.randomUUID()+'.jpg';await storage('object/'+bucket+'/'+path,{method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false'},body:bytes as unknown as BodyInit});
 try{await d.prepare('UPDATE cards SET photo_path = ? WHERE id = ? AND owner = ?').bind(path,id,owner).run();}catch(e){await removePhoto({owner,photo_path:path});throw e;}await removePhoto(row);return {ok:true};
}

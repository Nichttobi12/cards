declare const Deno: {env:{get(name:string):string|undefined}};
export const env = {get SUPABASE_URL(){return Deno.env.get('SUPABASE_URL')||'';}};
function keySet(name:string){try{return JSON.parse(Deno.env.get(name)||'{}').default||'';}catch{return '';}}
export function publicKey(){return keySet('SUPABASE_PUBLISHABLE_KEYS')||Deno.env.get('SUPABASE_ANON_KEY')||'';}
function adminKey(){return keySet('SUPABASE_SECRET_KEYS')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';}
export async function isAdmin(request:Request){const k=adminKey();if(k&&(request.headers.get('apikey')===k||request.headers.get('authorization')==='Bearer '+k))return true;const bearer=request.headers.get('authorization')||'';if(!bearer.startsWith('Bearer ')||bearer.length<40)return false;const rows=await rest('portal_scheduler_secret?select=token&limit=1');return rows.length===1&&bearer==='Bearer '+rows[0].token;}
async function rest(path:string,options:RequestInit={}):Promise<any[]>{
 const key=adminKey();if(!env.SUPABASE_URL||!key)throw Error('Datenbank noch nicht eingerichtet.');
 const headers:Record<string,string>={apikey:key,'Content-Type':'application/json'};
 if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
 const r=await fetch(env.SUPABASE_URL+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(15000)});
 if(!r.ok){console.error('Database operation failed',r.status);throw Error('Datenbankabfrage fehlgeschlagen.');}
 return r.status===204?[]:r.json() as Promise<any[]>;
}
const tables=new Set(['collections','cards','portfolio_snapshots','portal_accounts','login_attempts','refresh_jobs','card_images','photo_submissions']);
// Compatibility for the small, fixed set of internal queries used by this portal.
// SQL never comes from a request, and is never executed as arbitrary SQL.
class Statement{
 values:any[]=[]; constructor(private sql:string){} bind(...values:any[]){this.values=values;return this;}
 async execute():Promise<any[]>{
  const s=this.sql.replace(/\s+/g,' ').trim();let index=0;
  const filters=(where:string,q:URLSearchParams)=>{for(const term of where.split(/ AND /i)){const m=term.trim().match(/^(\w+)\s*(=|<)\s*\?$/);if(!m)throw Error('Unsupported query filter');q.set(m[1],(m[2]==='='?'eq.':'lt.')+String(this.values[index++]));}};
  let m=s.match(/^SELECT (DISTINCT )?(.+?) FROM (\w+)(?: WHERE (.+?))?(?: ORDER BY (\w+)( DESC)?)?$/i);
  if(m){if(!tables.has(m[3]))throw Error('Unsupported table');const q=new URLSearchParams({select:m[2]});if(m[4])filters(m[4],q);if(m[5])q.set('order',m[5]+(m[6]?'.desc':'.asc'));let rows:any[]=[];for(let offset=0;offset<100000;offset+=1000){const chunk=await rest(m[3]+'?'+q,{headers:{Range:offset+'-'+(offset+999),'Range-Unit':'items'}});rows.push(...chunk);if(chunk.length<1000)break;}if(m[1])rows=[...new Map(rows.map(r=>[JSON.stringify(r),r])).values()];return rows;}
  m=s.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)(.*)$/i);
  if(m){if(!tables.has(m[1]))throw Error('Unsupported table');if(m[1]==='login_attempts')return await rest('rpc/portal_login_attempt',{method:'POST',body:JSON.stringify({attempt_id:this.values[0],attempt_window:this.values[1]})});
   const columns=m[2].split(',').map(x=>x.trim());const body=Object.fromEntries(columns.map((c,i)=>[c,this.values[i]]));const conflict=m[4].match(/ON CONFLICT\(([\w, ]+)\)/i);const q=conflict?'?on_conflict='+conflict[1].replace(/ /g,''):'';
   return await rest(m[1]+q,{method:'POST',headers:{Prefer:conflict?'resolution=merge-duplicates,return=representation':'return=representation'},body:JSON.stringify(body)});}
  m=s.match(/^UPDATE (\w+) SET (.+?) WHERE (.+)$/i);
  if(m){if(!tables.has(m[1]))throw Error('Unsupported table');const body:Record<string,any>={};for(const term of m[2].split(',')){const field=term.trim().match(/^(\w+)\s*=\s*\?$/);if(!field)throw Error('Unsupported update');body[field[1]]=this.values[index++];}const q=new URLSearchParams();filters(m[3],q);return await rest(m[1]+'?'+q,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});}
  m=s.match(/^DELETE FROM (\w+) WHERE (.+)$/i);
  if(m){if(!tables.has(m[1]))throw Error('Unsupported table');const q=new URLSearchParams();filters(m[2],q);return await rest(m[1]+'?'+q,{method:'DELETE',headers:{Prefer:'return=representation'}});}
  throw Error('Unsupported internal query');
 }
 async all(){return {results:await this.execute()};}async first(){return (await this.execute())[0]||null;}async run(){await this.execute();return {success:true};}
}
export function db(){return {prepare:(sql:string)=>new Statement(sql),batch:(queries:Statement[])=>Promise.all(queries.map(q=>q.run()))};}
export async function tcg(path:string,lang:string){const r=await fetch(`https://api.tcgdex.net/v2/${lang}/${path}`,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(r.status===404?'Karte oder Set nicht gefunden.':'Der Kartenanbieter ist gerade nicht erreichbar.');return r.json() as Promise<any>;}
// Private photo bucket: only the authenticated portal API can sign or modify objects.
export async function storage(path:string,options:RequestInit={}):Promise<any>{
 const key=adminKey();const headers:Record<string,string>={apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'};
 const r=await fetch(env.SUPABASE_URL+'/storage/v1/'+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Foto konnte nicht gespeichert oder geladen werden.');return r.json();
}

export async function rpc(name:string,body:any){if(name!=='portal_review_photo')throw Error('Unsupported operation');return rest('rpc/'+name,{method:'POST',body:JSON.stringify(body)});}

// Only non-secret project coordinates are configured here. Privileged keys stay in Supabase.
const project='https://ctwwwlfbrtkvkpxmwyfa.supabase.co';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const path=String(req.query.route||'');
 if(!['auth','auth/refresh','auth/logout','auth/recover','auth/reset','vault'].includes(path)){res.status(404).json({error:'Nicht gefunden.'});return;}
 if(!['GET','POST'].includes(req.method)){res.status(405).json({error:'Methode nicht erlaubt.'});return;}
 if(req.method==='POST'&&req.headers.origin){const host=String(req.headers.host||'');if(req.headers.origin!=='https://'+host){res.status(403).json({error:'Anfrage abgelehnt.'});return;}}
 try{const q=new URLSearchParams();for(const [name,value] of Object.entries(req.query)){if(name==='route')continue;if(typeof value==='string')q.set(name,value);}
 const headers:Record<string,string>={'Content-Type':'application/json'};if(req.headers.cookie)headers.Cookie=req.headers.cookie;
 const r=await fetch(project+'/functions/v1/pokevault/api/'+path+'?'+q,{method:req.method,headers,body:req.method==='POST'?JSON.stringify(req.body||{}):undefined,signal:AbortSignal.timeout(55000)});
 const cookies=r.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);res.setHeader('Content-Type',r.headers.get('Content-Type')||'application/json');res.status(r.status).send(await r.text());
 }catch{res.status(503).json({error:'Der Server ist gerade nicht erreichbar.'});}
}

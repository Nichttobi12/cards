import { env } from 'cloudflare:workers';
export function db(){ if(!env.DB) throw new Error('Die Datenbank ist gerade nicht erreichbar. Bitte später erneut versuchen.'); return env.DB; }
export async function tcg(path:string,lang:string){
 const response=await fetch(`https://api.tcgdex.net/v2/${lang}/${path}`,{signal:AbortSignal.timeout(25000)});
 if(!response.ok) throw new Error(response.status===404?'Karte oder Set nicht gefunden.':'Der Kartenanbieter ist gerade nicht erreichbar.');
 return response.json() as Promise<any>;
}

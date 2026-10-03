import {useEffect,useRef,useState} from 'react';
import {api} from './api';
const covers=new Map<string,Promise<any>>();
const formats=(base?:string)=>base?(/\.(png|webp|jpg)$/i.test(base)?[base]:[base+'.webp',base+'.png']):[];
export default function SetImage({set,language}:{set:any,language:string}){
 const [cover,setCover]=useState<any>(null),[visible,setVisible]=useState(false),[attempt,setAttempt]=useState(0);const holder=useRef<HTMLSpanElement>(null);
 useEffect(()=>{setAttempt(0);setCover(null);const el=holder.current;if(!el)return;const o=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);o.disconnect();}},{rootMargin:'120px'});o.observe(el);return()=>o.disconnect();},[set.id,language]);
 useEffect(()=>{if(!visible)return;let cancelled=false;const key=language+'/'+set.id;if(!covers.has(key))covers.set(key,api('?op=setcover&lang='+language+'&id='+encodeURIComponent(set.id)).catch(()=>null));covers.get(key)!.then(c=>{if(!cancelled)setCover(c)});return()=>{cancelled=true}},[visible,set.id,language]);
 const sources=[...formats(cover?.logo||set.logo),...formats(cover?.alternateLogo),...formats(cover?.symbol||set.symbol)];
 return <span ref={holder} className="set-cover">{sources[attempt]?<img alt={(cover?.series?'Reihenlogo: ':'Setlogo: ')+(cover?.series||set.name)} src={sources[attempt]} onError={()=>setAttempt(a=>a+1)}/>:<svg viewBox="0 0 160 110" role="img" aria-label={'Set-Signet: '+set.name}><rect x="3" y="3" width="154" height="104" rx="14" fill="var(--surface)" stroke="var(--blue)"/><circle cx="80" cy="38" r="20" fill="var(--red)"/><path d="M60 38h40" stroke="var(--ink)" strokeWidth="4"/><circle cx="80" cy="38" r="7" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3"/><text x="80" y="80" textAnchor="middle" fill="var(--ink)" fontSize="14" fontWeight="700">{set.id.toUpperCase()}</text><text x="80" y="97" textAnchor="middle" fill="var(--muted)" fontSize="9">{cover?.series?'BLACK STAR PROMOS':'POKÉMON TCG'}</text></svg>}</span>;
}

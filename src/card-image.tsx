import {useEffect,useRef,useState} from 'react';
import {Image as ImageIcon} from 'lucide-react';
const alternates=new Map<string,Promise<any>>();
const formats=(base?:string)=>base?[base+'/high.webp',base+'/low.webp',base+'/high.png']:[];
export function cardNumber(c:any){const official=c.set?.cardCount?.official;return String(c.localId)+(official>0&&!/promo/i.test(c.set?.name||'')?'/'+official:'');}
export default function CardImage({card,language,compact=false}:{card:any,language:string,compact?:boolean}){
 const [attempt,setAttempt]=useState(0),[extra,setExtra]=useState<string[]>([]),[resolved,setResolved]=useState(false),[visible,setVisible]=useState(false);
 const holder=useRef<HTMLSpanElement>(null);const sources=[...formats(card.image),...extra];const source=sources[attempt],english=extra.length>0&&attempt>=formats(card.image).length;
 useEffect(()=>{setAttempt(0);setExtra([]);setResolved(false);setVisible(false);},[card.id,card.image,language]);
 useEffect(()=>{const el=holder.current;if(!el)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'100px'});observer.observe(el);return()=>observer.disconnect();},[card.id]);
 useEffect(()=>{if(source||resolved||!visible)return;let cancelled=false;if(language==='en'){setResolved(true);return;}const key=language+'/'+card.id;if(!alternates.has(key))alternates.set(key,fetch(`/api/vault?op=image&lang=${language}&id=${encodeURIComponent(card.id)}`).then(r=>r.ok?r.json():null).catch(()=>null));alternates.get(key)!.then(data=>{if(!cancelled){setExtra(formats(data?.image));setResolved(true);}});return()=>{cancelled=true;};},[source,resolved,visible,language,card.id]);
 return <span ref={holder} className={'card-image'+(compact?' compact':'')}>{source?<img src={source} alt={card.name+(english?' – englische Bildvorschau':'')} loading="lazy" decoding="async" onError={()=>setAttempt(n=>n+1)}/>:<span className="image-placeholder"><ImageIcon size={compact?24:36}/><small>{resolved?'Bild fehlt beim Anbieter':'Bild wird geladen …'}</small></span>}{english&&source&&<span className="image-language" title="Deutsches Bild nicht verfügbar. Die Kartensprache bleibt unverändert.">Bild: EN</span>}</span>;
}

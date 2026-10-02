import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {Image as ImageIcon} from 'lucide-react';
const alternates=new Map<string,Promise<any>>();
const formats=(base?:string)=>base?[base+'/high.webp',base+'/low.webp',base+'/high.png',base+'/high.jpg',base+'/low.png',base+'/low.jpg']:[];
export function cardNumber(c:any){const official=c.set?.cardCount?.official;return String(c.localId)+(official>0&&!/promo/i.test(c.set?.name||'')?'/'+official:'');}
export default function CardImage({card,language,compact=false}:{card:any,language:string,compact?:boolean}){
 const [loaded,setLoaded]=useState(false);
 const [freshPhoto,setFreshPhoto]=useState(''),[photoRetried,setPhotoRetried]=useState(false),[attempt,setAttempt]=useState(0),[extra,setExtra]=useState<{url:string,language:string}[]>([]),[resolved,setResolved]=useState(false),[visible,setVisible]=useState(false);
 const holder=useRef<HTMLSpanElement>(null);
 const entries=[...(card.customImageUrl?[{url:freshPhoto||card.customImageUrl,language,own:true}]:[]),...(card.verifiedImageUrl?[{url:card.verifiedImageUrl,language:card.verifiedImageLanguage||language,own:false}]:[]),...formats(card.image).map(url=>({url,language:card.imageLanguage||language,own:false})),...extra.map(e=>({...e,own:false}))];
 const sources=entries.filter((entry,i)=>entries.findIndex(e=>e.url===entry.url)===i),source=sources[attempt];
 useEffect(()=>{setAttempt(0);setLoaded(false);setFreshPhoto('');setPhotoRetried(false);setExtra([]);setResolved(false);setVisible(false);},[card.id,card.image,card.verifiedImageUrl,card.customImageUrl,language]);
 useEffect(()=>{const el=holder.current;if(!el)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'150px'});observer.observe(el);return()=>observer.disconnect();},[card.id,card.image,card.verifiedImageUrl,card.customImageUrl,language]);
 useEffect(()=>{if(attempt!==1||!card.customImageUrl||!card.customPhotoId||photoRetried||!visible)return;let cancelled=false;setPhotoRetried(true);api('?op=photo&id='+encodeURIComponent(card.customPhotoId)).then(r=>{if(!cancelled&&r.image){setFreshPhoto(r.image);setAttempt(0);}}).catch(()=>{});return()=>{cancelled=true;};},[attempt,card.customImageUrl,card.customPhotoId,visible]);
 useEffect(()=>{if(source||resolved||!visible)return;let cancelled=false;const key=language+'/'+card.id;if(!alternates.has(key))alternates.set(key,api(`?op=image&lang=${language}&id=${encodeURIComponent(card.id)}`).catch(()=>null));alternates.get(key)!.then(data=>{if(!cancelled){setExtra(formats(data?.image).map(url=>({url,language:data?.language||'en'})));setResolved(true);}});return()=>{cancelled=true;};},[source?.url,resolved,visible,language,card.id]);
 const alternate=source&&!source.own&&source.language!==language;
 return <span ref={holder} className={'card-image'+(compact?' compact':'')}>{source?<img src={source.url} alt={card.name+(alternate?' – '+(source.language==='en'?'englische':'deutsche')+' Bildvorschau':'')} loading={visible?'eager':'lazy'} decoding="async" onLoad={()=>setLoaded(true)} onError={()=>{setLoaded(false);setAttempt(n=>n+1);}}/>:<span className="image-placeholder"><ImageIcon size={compact?24:36}/><small>{resolved?'Bild fehlt beim Anbieter':'Bild wird geladen …'}</small></span>}{source&&!loaded&&<span className="image-loading" role="status">Bild lädt …</span>}{source?.own&&<span className="image-language">Eigenes Foto</span>}{alternate&&<span className="image-language" title="Ersatzvorschau derselben Karte. Die Kartensprache bleibt unverändert.">Bild: {source.language.toUpperCase()}</span>}</span>;
}

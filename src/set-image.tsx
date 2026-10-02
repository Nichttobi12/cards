import {useEffect,useRef,useState} from 'react';
import {Folder} from 'lucide-react';
import {api} from './api';
import CardImage from './card-image';
const covers=new Map<string,Promise<any>>();
export default function SetImage({set,language}:{set:any,language:string}){const [cover,setCover]=useState<any>(null),[visible,setVisible]=useState(false);const holder=useRef<HTMLSpanElement>(null);useEffect(()=>{const el=holder.current;if(!el)return;const o=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);o.disconnect();}},{rootMargin:'120px'});o.observe(el);return()=>o.disconnect();},[set.id]);useEffect(()=>{if(!visible)return;let cancelled=false;const key=language+'/'+set.id;if(!covers.has(key))covers.set(key,api('?op=setcover&lang='+language+'&id='+encodeURIComponent(set.id)).catch(()=>null));covers.get(key)!.then(c=>{if(!cancelled)setCover(c)});return()=>{cancelled=true}},[visible,set.id,language]);return <span ref={holder} className="set-cover">{(cover?.image||cover?.verifiedImageUrl)?<CardImage card={cover} language={language}/>:<Folder size={32}/>}</span>;}

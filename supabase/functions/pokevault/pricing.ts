import {selectedVariant,specialVariant} from './variants.ts';
export function quote(data:any,variant:string){
 const v=selectedVariant(data,variant),specific=v?.pricing?.cardmarket;
 // A different pattern/stamp is a different product, never reuse the base price.
 if(!specific&&specialVariant(v))return {price:null,updated:null};
 if(!v&&variant&&variant!=='Standard')return {price:null,updated:null};
 const p=specific||data.pricing?.cardmarket;if(!p)return {price:null,updated:null};
 const reverse=/reverse/i.test(v?.type||variant);
 const value=reverse&&!specific?p['trend-holo']:p.trend;
 return {price:typeof value==='number'&&Number.isFinite(value)&&value>0?value:null,updated:p.updated||null};
}

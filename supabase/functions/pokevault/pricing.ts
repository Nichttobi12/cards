export function quote(data:any,variant:string){
 const detailed=data.variants_detailed?.find((v:any)=>(v.variantId||v.type)===variant);
 const p=detailed?.pricing?.cardmarket||data.pricing?.cardmarket;
 if(!p) return {price:null,updated:null};
 const reverse=/reverse/i.test(detailed?.type||variant);
 // Never use a standard price for a reverse variant without variant-specific pricing.
 const value=reverse&&!detailed?.pricing?.cardmarket?p['trend-holo']:p.trend;
 return {price:typeof value==='number'&&value>0?value:null,updated:p.updated||null};
}

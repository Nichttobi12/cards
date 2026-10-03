import {selectedVariant,specialVariant} from './variants.ts';
export function quote(data:any,variant:string,language?:string){
 const lang=language||data.marketLanguage,exact=data.languageMarketQuotes?.[variant],personal=data.personalMarketQuote;
 if(personal?.scope==='personal'&&personal.language===lang&&personal.variant===variant&&Number.isFinite(personal.price)&&personal.price>0)return {...personal};
 if(exact?.scope==='language'&&exact.language===lang&&exact.variant===variant&&Number.isFinite(exact.price)&&exact.price>0)return {...exact,updated:exact.updated||exact.fetchedAt,stale:!!data.languagePriceStale};
 const v=selectedVariant(data,variant),specific=v?.pricing?.cardmarket;
 // A different pattern/stamp is a different product, never reuse the base price.
 if(!specific&&specialVariant(v))return {price:null,updated:null};
 if(!v&&variant&&variant!=='Standard')return {price:null,updated:null};
 const p=specific||data.pricing?.cardmarket;if(!p)return {price:null,updated:null};
 const reverse=/reverse/i.test(v?.type||variant);
 const value=reverse&&!specific?p['trend-holo']:p.trend;
 return {price:typeof value==='number'&&Number.isFinite(value)&&value>0?value:null,updated:p.updated||null,scope:'general',source:'Cardmarket-Trend · sprachübergreifend',language:lang||null,metric:'trend'};
}

export function quoteLabel(q:any){
 const languages:Record<string,string>={de:'Deutsch',en:'Englisch',ja:'Japanisch',fr:'Französisch',es:'Spanisch',it:'Italienisch'};
 if(q.scope==='personal')return 'Eigener Cardmarket-Preis · '+(q.status==='rejected'?'nicht freigegeben':'Freigabe ausstehend');
 if(q.manualApproved)return 'Cardmarket-Angebot · manuell geprüft · '+(languages[q.language]||q.language)+' · NM';
 return q.scope==='language'?'Cardmarket-Angebot ab · '+(languages[q.language]||q.language)+(q.condition?' · '+q.condition:''):'Cardmarket-Trend · sprachübergreifend';
}

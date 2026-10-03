const names:Record<string,string>={normal:'Normal',holo:'Holo',reverse:'Reverse Holo',metal:'Metall',lenticular:'Lentikular',pokeball:'Pokéball',masterball:'Meisterball',greatball:'Superball',ultraball:'Hyperball',cosmos:'Cosmos',galaxy:'Galaxy',starlight:'Starlight',energy:'Energie-Muster','cracked-ice':'Cracked Ice',mirror:'Spiegel',league:'Liga','player-reward':'Prize Pack',gold:'Gold',rainbow:'Rainbow',glitter:'Glitzer',tinsel:'Tinsel',loveball:'Sympaball',friendball:'Freundesball',quickball:'Flottball',duskball:'Finsterball','team-rocket':'Team Rocket','1st-edition':'1. Edition','pre-release':'Prerelease',staff:'Staff','pokemon-center':'Pokémon Center','set-logo':'Set-Stempel','w-promo':'W-Promo','30th-anniversary':'30. Jubiläum',shadowless:'Shadowless',unlimited:'Unlimited','gold-border':'Goldrand'};
export const variantName=(s:unknown)=>names[String(s||'').toLowerCase()]||String(s||'');
export function variantLabel(v:any){return [variantName(v.type),variantName(v.foil),variantName(v.subtype),...(Array.isArray(v.stamp)?v.stamp:[]).map(variantName),v.size&&String(v.size).toLowerCase()!=='standard'?variantName(v.size):''].filter(Boolean).join(' · ');}
export function cardVariants(card:any,language?:string){
 const detailed=(Array.isArray(card?.variants_detailed)?card.variants_detailed:[]).filter((v:any)=>!language||!v.languages?.length||v.languages.includes(language));
 if(detailed.length)return detailed.map((v:any)=>({...v,value:v.variantId||v.type,label:variantLabel(v)}));
 const variants=Object.entries(card?.variants||{}).filter(([k,v])=>v===true&&['normal','holo','reverse'].includes(k)).map(([type])=>({type,value:type,label:variantName(type)}));
 return variants.length?variants:[{type:'Standard',value:'Standard',label:'Standard'}];
}
export function selectedVariant(card:any,value:string){return cardVariants(card).find((v:any)=>v.value===value);}
export function specialVariant(v:any){return !!(v?.foil||v?.subtype||v?.stamp?.length||v?.size&&String(v.size).toLowerCase()!=='standard');}

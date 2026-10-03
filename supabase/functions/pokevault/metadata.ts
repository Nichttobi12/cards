import {attachImage} from './verified-images.ts';
import {catalog,alternateImage} from './catalog.ts';
import {quote} from './pricing.ts';
export async function cardMetadata(id:string,lang:string){try{const c=await catalog('cards/'+id,lang);const variant=c.variants_detailed?.[0]?.variantId||c.variants_detailed?.[0]?.type||'Standard';const alternate=c.image?null:await alternateImage(id,lang);return attachImage({id,name:c.name,localId:c.localId,image:c.image||alternate?.image||null,imageLanguage:c.image?(c.imageLanguage||lang):alternate?.language||lang,rarity:c.rarity||'',types:c.types||[],category:c.category||'',...quote(c,variant)},lang);}catch{return {id,error:true};}}

import {japaneseAlias} from './japanese-names.ts';
// Shared by the browser and API: punctuation-insensitive, ranked name matching.
export function normalize(text:string){return String(text||'').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC').toLowerCase().replace(/ß/g,'ss').replace(/[^\p{L}\p{N}\u3099\u309a]+/gu,' ').trim().replace(/^m (?=[a-z])/,'mega ');}
function distance(a:string,b:string){if(Math.abs(a.length-b.length)>2)return 99;const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+Number(a[i-1]!==b[j-1]));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);}return d[a.length][b.length];}
function directNameScore(name:string,query:string){const n=normalize(name),q=normalize(query);if(!q)return 0;if(n===q)return 0;if(n.replaceAll(' ','')===q.replaceAll(' ',''))return 1;if(n.includes(q))return 2+(n.startsWith(q)?0:1);const words=n.split(' '),terms=q.split(' ');let score=4;for(const t of terms){if(words.includes(t))continue;if(words.some(w=>w.startsWith(t))){score+=1;continue;}const tolerance=t.length>=8?2:t.length>=4?1:0;if(!tolerance)return Infinity;const diff=Math.min(...words.map(w=>distance(t,w)));if(diff>tolerance)return Infinity;score+=10+diff;}return score;}
export function nameScore(name:string,query:string){const score=directNameScore(name,query);if(!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(name)||!/[a-zäöüß]/i.test(query))return score;return Math.min(score,directNameScore(japaneseAlias(name,'de'),query),directNameScore(japaneseAlias(name,'en'),query));}
export function rankNames<T>(rows:T[],query:string,name:(row:T)=>string){return rows.map((row,index)=>({row,index,score:nameScore(name(row),query)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>a.score-b.score||a.index-b.index).map(x=>x.row);}
export function suggestions(names:string[],query:string){return [...new Set(rankNames(names,query,n=>n))].slice(0,5);}

export function parseNumber(q:string){const text=q.split('/')[0].trim().toUpperCase().replace(/[\s-]/g,'');const m=text.match(/^(SVP|MEP|SWSH|SM|XY|BW|HGSS|DP)(\d+)$/);const prefixSets:Record<string,string>={SVP:'svp',MEP:'mep',SWSH:'swshp',SM:'smp',XY:'xyp',BW:'bwp',HGSS:'hgssp',DP:'dpp'};return {text,set:m?prefixSets[m[1]]:'',number:m?(['SVP','MEP'].includes(m[1])?m[2].padStart(3,'0'):m[1]+m[2].padStart(['SWSH','SM'].includes(m[1])?3:2,'0')):text};}
export function cardMatches(c:any,q:string){return matchesQuery(c,parseCardQuery(q));}

export function parseCardQuery(query:string){
 const q=query.normalize('NFKC').trim();
 const id=/^(?:[a-z]+\d[a-z0-9.+]*|MC|MF|AGF|ALP|(?:SV|S|SM|XY|M)-P|bwp|xyp|smp|swshp|svp|mep|hgssp|dpp)-[a-z0-9]+$/i.test(q)?q:'';
 if(id)return {name:'',number:'',total:'',set:'',id};
 const fraction=q.match(/((?:(?:SV|TG|GG|RC|SH)\s*)?\d{1,3})\s*\/\s*((?:(?:SV|TG|GG|RC|SH)\s*)?\d{1,3})(?!\d)/i);
 const japanesePromo=q.match(/(?:^|\s)(\d{1,3})\s*\/\s*((?:SV|S|SM|XY|M)-P)(?=$|\s)/i)||q.match(/(?:^|\s)((?:SV|S|SM|XY|M)-P)\s+(\d{1,3})(?=$|\s)/i);
 const promo=q.match(/\b(SVP|MEP|SWSH|SM|XY|BW|HGSS|DP)\s*\d{1,3}\b/i),plain=q.match(/(?:^|\s)(\d{1,3})(?=$|\s)/);
 const hit=japanesePromo||fraction||promo||plain;
 const token=japanesePromo?( /^\d/.test(japanesePromo[1])?japanesePromo[1]:japanesePromo[2]):fraction?fraction[1]:promo?promo[0]:plain?plain[1]:'';
 const p=token?parseNumber(token):{number:'',set:''};
 let name=hit?q.replace(hit[0],' ').trim():q;
 // Printed Japanese set codes may be entered in either case.
 const setCode=name.match(/(?:^|\s)((?:Pt|SV|SM|XY|PCG|PMCG|ADV|CP|BW|DP|M|S)\d+[A-Za-z+]*|AGF|ALP|(?:SV|S|SM|XY|M)-P)(?=$|\s)/i);
 const set=japanesePromo?(/^\d/.test(japanesePromo[1])?japanesePromo[2]:japanesePromo[1]):setCode?setCode[1]:p.set;
 if(setCode)name=name.replace(setCode[0],' ').trim();
 return {name,number:p.number,total:japanesePromo?'':fraction?fraction[2].replace(/\s/g,'').toUpperCase():'',set,id:''};
}
export function matchesQuery(c:any,q:ReturnType<typeof parseCardQuery>){if(q.id)return String(c.id).toLowerCase()===q.id.toLowerCase();if(q.set&&String(c.set?.id||String(c.id).slice(0,String(c.id).lastIndexOf('-'))).toLowerCase()!==q.set.toLowerCase())return false;const local=String(c.localId||'').toUpperCase();if(q.number){const numberMatches=/^\d+$/.test(q.number)?/^\d+$/.test(local)&&Number(local)===Number(q.number):local===q.number;if(!numberMatches)return false;}if(q.total&&c.set?.cardCount?.official&&/^\d+$/.test(q.total)&&Number(q.total)!==Number(c.set.cardCount.official))return false;return !q.name||Number.isFinite(nameScore(c.name,q.name));}

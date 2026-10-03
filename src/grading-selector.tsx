import {parseGrade} from '../supabase/functions/pokevault/grading';
export default function GradingSelector({value,onChange}:{value:string,onChange:(value:string)=>void}){
 const grade=parseGrade(value),company=grade?.company||'';
 return <fieldset className="grading-selector"><legend>Grading</legend><div className="grading-buttons" aria-label="Grading-Anbieter">
 {['','PSA','AOG','BGS','CGC'].map(c=><button type="button" key={c} aria-pressed={company===c&&!(!grade&&!!value)} className={company===c?'selected':''} onClick={()=>onChange(c?c+' '+(c==='PSA'&&(grade?.grade||10)%1?10:grade?.grade||10):'')}>{c||'Ungegradet'}</button>)}
 </div>{company&&<label>Note<select aria-label="Grading-Note" value={grade?.grade||10} onChange={e=>onChange(company+' '+e.target.value)}>{Array.from({length:company==='PSA'?10:19},(_,i)=>10-i*(company==='PSA'?1:0.5)).map(n=><option key={n} value={n}>{n.toLocaleString('de-DE')}</option>)}</select></label>}

 <details><summary>Anderer Anbieter / vorhandene Beschriftung</summary><label>Grading-Beschriftung<input value={value} maxLength={80} placeholder="z. B. GSG 10" onChange={e=>onChange(e.target.value)}/></label></details></fieldset>;
}

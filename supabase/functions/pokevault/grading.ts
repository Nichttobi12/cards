export type Grade = {company:string, grade:number, referenceCompany:string, referenceGrade:number, comparison:boolean};
export function parseGrade(value:string):Grade|null {
 const m=value.trim().toUpperCase().replace(',', '.').match(/^(PSA|AOG|BGS|CGC|GSG|SGC|ACE|TAG)\s*(10|[1-9](?:\.5)?)$/);
 if(!m||m[1]==='PSA'&&m[2].includes('.'))return null;
 const company=m[1],grade=Number(m[2]),comparison=company==='AOG'&&grade>=9.5;
 return {company,grade,referenceCompany:comparison?'PSA':company,referenceGrade:comparison?10:grade,comparison};
}
export function gradedValue(data:any,grading:string):number|null {
 const q=data?.gradedQuote;
 return q?.status==='available'&&q.appliedGrading===grading&&Number.isFinite(q.priceEur)&&q.priceEur>0?q.priceEur:null;
}

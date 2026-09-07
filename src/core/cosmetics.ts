export const WING_IDS=Array.from({length:16},(_,index)=>`wing-${String(index+1).padStart(2,'0')}`);
export const wingName=(id:string):string=>`灰烬羽翼 ${Number(id.slice(-2))}`;


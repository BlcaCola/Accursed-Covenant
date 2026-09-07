/** Generated raster atlas; DOM supplies accessible labels on the enclosing controls. */
const frames: Record<string, number> = { lightning:0,frost:1,fire:2,arcane:3,stormOrb:4,summon:5,poison:6,shield:7,corpse:8,bones:9,blades:10,blood:11,cleave:12,warcry:13,lance:14,dash:15,sword:12,helm:13,boots:15,armor:7,ring:4,amulet:5,chest:7 };
export function icon(name:string):string { const i=frames[name]??12;return `<span class="asset-icon" aria-hidden="true" style="background-position:${i%4*100/3}% ${Math.floor(i/4)*100/3}%"></span>`; }
export const slotIcon: Record<string,string> = { weapon:'sword',offhand:'shield',head:'helm',chest:'armor',feet:'boots',amulet:'amulet',ring1:'ring',ring2:'ring' };

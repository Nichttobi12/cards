import {strict as assert} from 'node:assert';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'pokevault-scan-'));
const file=join(dir,'scan.mjs');
await build({entryPoints:['src/scan-text.ts'],bundle:true,platform:'node',format:'esm',outfile:file});
const {scanText,scanRegions,scanNames}=await import(file);
assert.deepEqual(scanText('Mega-Gengar-ex HP 350\nNightmare\n284/217'),{number:'284',name:'Mega-Gengar-ex'});
assert.deepEqual(scanText('Basis\nPikachu KP 70\nSVP 027\n©2026'),{number:'SVP 027',name:'Pikachu'});
assert.equal(scanText('Charizard ex\nDamage\n199 / 165').number,'199');
assert.equal(scanText('Gardevoir ex\nSV049/SV122').number,'SV049');
assert.equal(scanText('Mega-Gengar ex HP 350\nMEG EN 284/217').number,'284');
assert.deepEqual(scanText(''),{number:'',name:''});
// Attack/copyright text outside the name region must never become the card name.
const regional=scanRegions('BASIS Mega-Gengar-ex KP 350', [{text:'Illus. Artist 2026',confidence:95},{text:'MEG DE 284/217',confidence:78},{text:'350',confidence:99}]);assert.equal(regional.name,'Mega-Gengar-ex');assert.equal(regional.number,'284');assert.equal(regional.total,'217');assert.equal(regional.uncertain,false);
assert.equal(scanRegions('',[{text:'©2026 Pokémon Nintendo',confidence:99}]).number,'');
assert.equal(scanRegions('Pikachu KP 70',[{text:'027',confidence:50}]).uncertain,true);
const voted=scanRegions('Pikachu',[{text:'181/132',confidence:70},{text:'181/132',confidence:72},{text:'189/132',confidence:99}]);assert.equal(voted.number,'181');assert.ok(voted.alternatives.includes('189/132'));const corrected=scanRegions('Gengar',[{text:'18I/I32',confidence:80},{text:'181/132',confidence:70}]);assert.equal(corrected.number,'181');assert.equal(corrected.total,'132');assert.equal(corrected.uncertain,false);assert.deepEqual(scanNames([{text:'Copyright Pokémon',confidence:99},{text:'BASIC Pikachu HP 70',confidence:70}]),['Pikachu']);
const boundsFile=join(dir,'bounds.mjs');await build({entryPoints:['src/scan-regions.ts'],bundle:true,platform:'node',format:'esm',outfile:boundsFile});const {regionBounds,nameRegion,footerRegions}=await import(boundsFile);const crop={x:.1,y:.1,w:.7,h:.8};const nameBox=regionBounds(crop,nameRegion);assert.ok(nameBox.y+nameBox.h<.3);for(const footer of footerRegions){const box=regionBounds(crop,footer);assert.ok(box.y>.7);assert.ok(box.x+box.w<=.81);assert.ok(box.y+box.h<=.91);}
await rm(dir,{recursive:true,force:true});
console.log('Passed scan text: German/English names, HP/KP stripping, printed numbers, promo IDs, subset numbering and empty recognition.');

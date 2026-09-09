import fs from 'node:fs';
import ts from 'typescript';
import {setLocale,t} from '../src/i18n';

const files=[
  'src/ui/interface.ts','src/ui/debugPanel.ts','src/main.ts','src/render/scene.ts',
  'src/core/run.ts','src/core/catalog.ts','src/core/characters.ts','src/core/cosmetics.ts',
  'src/core/bestiary.ts','src/core/loot.ts',
  'src/core/equipment.ts','src/core/talents.ts','src/core/themes.ts','src/core/themeDesigns.ts',
  'src/core/monsterCatalog.ts','src/core/buildMechanics.ts','src/core/evolutions.ts'
].filter(fs.existsSync);
const found=new Map<string,Set<string>>();
for(const file of files){
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const visit=(node:ts.Node)=>{
    if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node))&&/[\u3400-\u9fff]/.test(node.text)){
      const locations=found.get(node.text)??new Set<string>();locations.add(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line+1}`);found.set(node.text,locations);
    }
    ts.forEachChild(node,visit);
  };visit(source);
}
setLocale('en');
// `中` is the compact switch label shown while English is active. `的` is an
// internal generated-name joiner removed after both surrounding words translate.
const intentional=new Set(['中','的']);
const missing=[...found].filter(([source])=>!intentional.has(source)).map(([source,locations])=>({source,translated:t(source),locations:[...locations]})).filter(item=>/[\u3400-\u9fff]/.test(item.translated));
for(const item of missing)console.log(`${item.locations.join(', ')}\n  ZH: ${item.source}\n  EN: ${item.translated}`);
console.log(`\n${missing.length} untranslated of ${found.size} Chinese literals`);
process.exitCode=missing.length?1:0;

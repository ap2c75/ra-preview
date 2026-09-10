import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {diffPartnerRegistry,validatePartnerRegistry,withRegistryHistory} from '../partner-registry.mjs';

const inputPath=process.argv[2];
const write=process.argv.includes('--write');
if(!inputPath)throw new Error('사용법: node chatbot/tools/update-partner-registry.mjs <새 명단.json> [--write]');
const registryPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../api/partner-registry.json');
const previous=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const supplied=JSON.parse(fs.readFileSync(path.resolve(inputPath),'utf8'));
const next={format:'somun-partners-v1',version:supplied.version,effectiveFrom:supplied.effectiveFrom,partners:supplied.partners,history:[]};
validatePartnerRegistry(previous,{allowDraft:true});validatePartnerRegistry(next);
const diff=diffPartnerRegistry(previous,next);
const updated=withRegistryHistory(previous,next);
console.log(JSON.stringify({version:updated.version,partnerCount:updated.partners.length,...diff},null,2));
if(write){fs.writeFileSync(registryPath,JSON.stringify(updated,null,2)+'\n');console.log('partner registry updated');}
else console.log('dry run only; add --write to update the registry');

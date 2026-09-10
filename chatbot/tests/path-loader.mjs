import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function resolve(specifier,context,nextResolve){
  if(specifier.startsWith('/ra-preview/')){const [relative,query]=specifier.slice('/ra-preview/'.length).split('?');return {url:pathToFileURL(path.join(root,relative)).href+(query?'?'+query:''),shortCircuit:true};}
  return nextResolve(specifier,context);
}

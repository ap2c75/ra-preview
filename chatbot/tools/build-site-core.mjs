import fs from 'node:fs';

const source=new URL('../site-data.json',import.meta.url);
const target=new URL('../site-data-core.json',import.meta.url);
const data=JSON.parse(fs.readFileSync(source,'utf8'));
if(data.format!=='somun-site-v1'||!Array.isArray(data.carriers)||!Array.isArray(data.categories)||!Array.isArray(data.products))throw new Error('INVALID_SITE_DATA');
const core={
  format:data.format,
  collectedAt:data.collectedAt,
  asOf:data.asOf,
  sourceBase:data.sourceBase,
  categories:data.categories,
  carriers:data.carriers,
  products:[],
};
fs.writeFileSync(target,JSON.stringify(core));
console.log(`site core: ${data.products.length} product details excluded, ${Buffer.byteLength(JSON.stringify(core))} bytes written`);

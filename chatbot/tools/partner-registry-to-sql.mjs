import fs from 'node:fs';
import {validatePartnerRegistry} from '../partner-registry.mjs';
const source=process.argv[2]||new URL('../api/partner-registry.json',import.meta.url),registry=JSON.parse(fs.readFileSync(source,'utf8'));
validatePartnerRegistry(registry);
const q=value=>"'"+String(value).replaceAll("'","''")+"'",created=new Date().toISOString();
const lines=['BEGIN;',`INSERT OR IGNORE INTO partner_registry_versions(version,effective_from,created_at) VALUES(${q(registry.version)},${q(registry.effectiveFrom)},${q(created)});`];
for(const p of registry.partners)lines.push(`INSERT INTO partners(id,business_name,purpose,retention_days,effective_from,effective_until,registry_version,active,created_at,updated_at) VALUES(${q(p.id)},${q(p.name)},${q(p.purpose)},${p.retentionDays},${q(p.effectiveFrom)},${p.effectiveUntil?q(p.effectiveUntil):'NULL'},${q(registry.version)},1,${q(created)},${q(created)}) ON CONFLICT(id) DO UPDATE SET business_name=excluded.business_name,purpose=excluded.purpose,retention_days=excluded.retention_days,effective_from=excluded.effective_from,effective_until=excluded.effective_until,registry_version=excluded.registry_version,active=1,updated_at=excluded.updated_at;`);
lines.push(`UPDATE partners SET active=0,updated_at=${q(created)} WHERE registry_version<>${q(registry.version)};`,'COMMIT;');
process.stdout.write(lines.join('\n')+'\n');

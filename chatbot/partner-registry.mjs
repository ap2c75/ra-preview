const fail=code=>{throw new Error(code);};
const clean=(value,max=120)=>typeof value==='string'&&value.trim()&&value.length<=max&&!/[<>\r\n]/.test(value);
const time=value=>{const parsed=Date.parse(value);if(!Number.isFinite(parsed))fail('INVALID_PARTNER_DATE');return parsed;};

export function validatePartnerRegistry(registry,{allowDraft=false}={}){
 if(!registry||registry.format!=='somun-partners-v1'||!clean(registry.version,80)||!Array.isArray(registry.partners)||!Array.isArray(registry.history))fail('INVALID_PARTNER_REGISTRY');
 if(!allowDraft&&(!registry.effectiveFrom||!registry.partners.length))fail('PARTNER_REGISTRY_NOT_READY');
 if(registry.effectiveFrom)time(registry.effectiveFrom);
 const ids=new Set(),names=new Set();
 for(const partner of registry.partners){
  if(!partner||!clean(partner.id,80)||!clean(partner.name)||!clean(partner.purpose,300)||partner.retentionDays!==90||!clean(partner.effectiveFrom,40))fail('INVALID_PARTNER');
  time(partner.effectiveFrom);if(partner.effectiveUntil&&time(partner.effectiveUntil)<=time(partner.effectiveFrom))fail('INVALID_PARTNER_PERIOD');
  if(ids.has(partner.id)||names.has(partner.name.trim()))fail('DUPLICATE_PARTNER');ids.add(partner.id);names.add(partner.name.trim());
 }
 for(const event of registry.history){if(!event||!clean(event.version,80)||!clean(event.changedAt,40)||!Array.isArray(event.added)||!Array.isArray(event.removed)||!Array.isArray(event.changed))fail('INVALID_PARTNER_HISTORY');time(event.changedAt);}
 return registry;
}
export function activePartners(registry,now=Date.now()){
 validatePartnerRegistry(registry,{allowDraft:true});
 return registry.partners.filter(partner=>time(partner.effectiveFrom)<=now&&(!partner.effectiveUntil||time(partner.effectiveUntil)>now));
}
export function publicPartnerList(registry,now=Date.now()){
 return activePartners(registry,now).map(partner=>({name:partner.name.trim(),purpose:partner.purpose.trim(),retention:`제공받은 날부터 ${partner.retentionDays}일`}));
}
export function diffPartnerRegistry(previous,next){
 validatePartnerRegistry(previous,{allowDraft:true});validatePartnerRegistry(next,{allowDraft:true});
 const before=new Map(previous.partners.map(v=>[v.id,v])),after=new Map(next.partners.map(v=>[v.id,v]));
 const added=[...after.keys()].filter(id=>!before.has(id));
 const removed=[...before.keys()].filter(id=>!after.has(id));
 const changed=[...after.keys()].filter(id=>before.has(id)&&JSON.stringify(before.get(id))!==JSON.stringify(after.get(id)));
 return {added,removed,changed};
}
export function withRegistryHistory(previous,next,changedAt=new Date().toISOString()){
 if(previous.version===next.version)fail('PARTNER_VERSION_REQUIRED');time(changedAt);
 const diff=diffPartnerRegistry(previous,next);
 return {...next,history:[...previous.history,{version:next.version,changedAt:new Date(changedAt).toISOString(),...diff}]};
}

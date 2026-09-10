export const STATUS_ORDER=Object.freeze(['queued','received','consulting','completed']);
export const PURPOSE='렌탈 상품 상담, 영업 안내 및 계약 접수';

export function cleanLead(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_FIELDS');
  const allowed=['name','phone','address'];
  if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('UNCONSENTED_FIELD');
  const name=String(value.name||'').trim(),phone=String(value.phone||'').replace(/[^0-9]/g,''),address=String(value.address||'').trim();
  if(!/^[\p{L} .'-]{2,40}$/u.test(name))throw new Error('INVALID_NAME');
  if(!/^0\d{9,10}$/.test(phone))throw new Error('INVALID_PHONE');
  if(address!=='설치 주소 미정'&&(address.length<5||address.length>200||/[<>\r\n\x00-\x1f]/.test(address)))throw new Error('INVALID_ADDRESS');
  return {name,phone,address};
}

export function cleanSelection(values,max=3){
  if(!Array.isArray(values))return [];
  return [...new Set(values.map(v=>String(v).trim()).filter(v=>/^[\p{L}\p{N}._() +\-/]{1,160}$/u.test(v)))].slice(0,max);
}

export function validateConsent(value,current){
  if(!value||value.collectionUse!==true||value.thirdParty!==true||value.over14!==true)throw new Error('CONSENT_REQUIRED');
  if(value.policyVersion!==current.policyVersion)throw new Error('POLICY_VERSION_CHANGED');
  if(value.partnerRegistryVersion!==current.registryVersion)throw new Error('PARTNER_REGISTRY_CHANGED');
  return {collectionUse:true,thirdParty:true,over14:true,policyVersion:current.policyVersion,registryVersion:current.registryVersion};
}

export function canTransition(from,to,role='partner'){
  const a=STATUS_ORDER.indexOf(from),b=STATUS_ORDER.indexOf(to);
  if(a<0||b<0)return false;
  return role==='admin'?a!==b:b===a+1;
}

export function operationalIssues({enabled,privacyContact,partners,registryVersion,encryptionKey}){
  const issues=[];
  if(!enabled)issues.push('operationsDisabled');
  if(!privacyContact?.trim())issues.push('privacyContact');
  if(!registryVersion?.trim())issues.push('partnerRegistryVersion');
  if(!Array.isArray(partners)||!partners.length)issues.push('partners');
  if(!encryptionKey?.trim())issues.push('encryptionKey');
  return issues;
}

export function retentionDeadline(now,days=90){return new Date(new Date(now).getTime()+days*86400000).toISOString();}
export function safeQualityEvent(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_EVENT');
  const allowed=['outcome','intent','selectedCount','feedbackReason'];
  if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('UNSAFE_EVENT');
  const outcome=String(value.outcome||'').slice(0,40),intent=String(value.intent||'').slice(0,80),feedbackReason=value.feedbackReason==null?null:String(value.feedbackReason).slice(0,40);
  if(!/^[a-z0-9_-]+$/i.test(outcome)||!/^[a-z0-9_-]+$/i.test(intent)||feedbackReason&&!/^[a-z0-9_-]+$/i.test(feedbackReason))throw new Error('INVALID_EVENT');
  return {outcome,intent,selectedCount:Math.max(0,Math.min(3,Number(value.selectedCount)||0)),feedbackReason};
}

// V2 policy is deliberately incomplete until the operating facts are approved.
// No browser parameter or consent checkbox can override this server configuration.
export const FIELDS = Object.freeze([
  { id: 'name', label: '이름', required: true, stage: 'consultation', max: 40 },
  { id: 'phone', label: '연락처', required: true, stage: 'consultation', max: 20 },
  { id: 'product_interest', label: '관심 품목', required: false, stage: 'legacy', max: 40 },
  { id: 'current_brand', label: '현재 이용 브랜드', required: false, stage: 'legacy', max: 40 },
  // Preserved from V1. Necessity and contract-stage collection must be approved first.
  { id: 'birth', label: '생년월일', required: false, stage: 'contract', max: 8 },
  { id: 'address', label: '설치 주소', required: true, stage: 'consultation', max: 200 },
]);
export const DEFAULT_POLICY = Object.freeze({
  version: 'somun-consultation-third-party-20260910', controller: '브로씨앤씨',
  purpose: '렌탈 상담 연락 및 설치 장소 확인',
  optionalPurpose: '',
  retentionDays: 90, retentionText: '상담 접수일로부터 90일', privacyContact: null,
  refusal: '동의를 거부할 수 있습니다. 필수 항목에 동의하지 않으면 상담 연락을 신청할 수 없습니다. 상품 탐색은 계속 이용할 수 있습니다.',
  optionalRefusal: '선택 항목에 동의하지 않아도 상담 신청과 상품 탐색을 이용할 수 있습니다.',
  relationship: 'third_party', recipient: '제휴총판',
  recipientPurpose: '렌탈 상품 상담, 영업 안내 및 계약 접수',
  recipientRetention: '제공받은 날부터 90일', partnerCompanies: [],
  contractRef: null, operationsApproved: false,
});
export const consultationFields = () => FIELDS.filter(f => f.stage === 'consultation');
export function policyIssues(p) {
  const issues = [];
  for (const k of ['version', 'controller', 'purpose', 'retentionText', 'privacyContact']) {
    if (typeof p[k] !== 'string' || !p[k].trim()) issues.push(k);
  }
  if (!Number.isInteger(p.retentionDays) || p.retentionDays < 1) issues.push('retentionDays');
  if (!p.operationsApproved) issues.push('operationsApproved');
  if (!['internal', 'processor', 'third_party'].includes(p.relationship)) issues.push('relationship');
  if (typeof p.recipient !== 'string' || !p.recipient.trim()) issues.push('recipient');
  if (p.relationship === 'internal' && p.recipient !== p.controller) issues.push('internalRecipient');
  if (p.relationship === 'processor' && !p.contractRef) issues.push('contractRef');
  if (p.relationship === 'processor' && !p.recipientPurpose?.trim()) issues.push('processorPurpose');
  if (p.relationship === 'third_party' && (!p.recipientPurpose || !p.recipientRetention)) issues.push('recipientTerms');
  if(p.partnerCompanies!==undefined){
    if(!Array.isArray(p.partnerCompanies)||p.partnerCompanies.length>500||p.partnerCompanies.some(v=>!v||typeof v.name!=='string'||!v.name.trim()||v.name.length>120||typeof v.purpose!=='string'||!v.purpose.trim()||typeof v.retention!=='string'||!v.retention.trim())||new Set(p.partnerCompanies.map(v=>v?.name?.trim())).size!==p.partnerCompanies.length)issues.push('partnerCompanies');
    else if(p.relationship==='third_party'&&!p.partnerCompanies.length)issues.push('partnerCompaniesEmpty');
    else if(p.relationship==='third_party'&&p.recipient!=='제휴총판'&&!p.partnerCompanies.some(v=>v.name===p.recipient))issues.push('recipientNotListed');
  }
  return issues;
}
export function consentRequirements(p) {
  return Object.freeze({
    collectionUse: true,
    thirdParty: p.relationship === 'third_party',
    over14: true,
  });
}
export function consentEvidence(p, choices, agreedAt = new Date().toISOString()) {
  const issues = policyIssues(p);
  if (issues.length) throw new Error('POLICY_NOT_READY:' + issues.join(','));
  const required = consentRequirements(p);
  if (choices?.collectionUse !== true) throw new Error('COLLECTION_CONSENT_REQUIRED');
  if (required.thirdParty && choices?.thirdParty !== true) throw new Error('THIRD_PARTY_CONSENT_REQUIRED');
  if (required.over14 && choices?.over14 !== true) throw new Error('AGE_CONFIRMATION_REQUIRED');
  if (!Number.isFinite(Date.parse(agreedAt))) throw new Error('INVALID_AGREED_AT');
  return Object.freeze({
    policyVersion: p.version,
    agreedAt: new Date(agreedAt).toISOString(),
    collectionUse: true,
    thirdParty: required.thirdParty,
    over14: true,
    recipients: required.thirdParty ? p.partnerCompanies.map(v => v.name) : [],
  });
}
export function notice(p) {
  return {
    version: p.version, controller: p.controller, controllerDisplay: p.controller, purpose: p.purpose,
    addressHelp: '설치 장소가 아직 정해지지 않았다면 설치 주소 미정을 선택할 수 있습니다.',
    requiredItems: consultationFields().filter(f => f.required).map(f => f.label),
    optionalItems: consultationFields().filter(f => !f.required).map(f => f.label),
    optionalPurpose: null, retention: p.retentionText,
    refusal: p.refusal, optionalRefusal: null, privacyContact: p.privacyContact,
    relationship: p.relationship,
    useRestriction: '신청한 렌탈 상담과 접수 처리에만 이용합니다. 별도 동의 없는 광고 발송, 다른 상품 영업, DB 판매·재제공에는 이용하지 않습니다.',
    processor: p.relationship==='processor'?{recipient:p.recipient,purpose:p.recipientPurpose,restriction:'브로씨앤씨가 위탁한 상담 업무 범위에서만 처리하며, 수탁자의 독립적인 영업 DB로 이용하지 않습니다.'}:null,
    partners: Array.isArray(p.partnerCompanies)?p.partnerCompanies.filter(v=>v&&typeof v.name==='string').map(v=>({name:v.name,purpose:v.purpose||'',retention:v.retention||''})):p.relationship==='third_party'&&p.recipient?[{name:p.recipient,purpose:p.recipientPurpose,retention:p.recipientRetention}]:[],
    recipient: p.recipient,
    transfer: p.relationship === 'third_party' ? {
      recipient: p.recipient, purpose: p.recipientPurpose,
      items: consultationFields().filter(f => f.required).map(f => f.label),
      retention: p.recipientRetention,
      refusal: '제공에 동의하지 않으면 총판 상담을 신청할 수 없습니다. 상품 탐색은 계속 이용할 수 있습니다.',
    } : null,
  };
}
export function noticeIssues(n) {
  const issues=[];
  if(!n||typeof n!=='object'||Array.isArray(n))return ['notice'];
  for(const key of ['version','controller','purpose','retention','refusal','privacyContact'])if(typeof n[key]!=='string'||!n[key].trim())issues.push(key);
  if(!Array.isArray(n.requiredItems)||!n.requiredItems.length||n.requiredItems.some(v=>typeof v!=='string'||!v.trim()))issues.push('requiredItems');
  if(n.relationship==='third_party'||n.transfer){
    const t=n.transfer;
    if(!t||typeof t!=='object'||!['recipient','purpose','retention','refusal'].every(key=>typeof t[key]==='string'&&t[key].trim())||!Array.isArray(t.items)||!t.items.length)issues.push('transfer');
    if(!Array.isArray(n.partners)||!n.partners.length||n.partners.some(v=>!v||typeof v.name!=='string'||!v.name.trim()||typeof v.purpose!=='string'||!v.purpose.trim()||typeof v.retention!=='string'||!v.retention.trim()))issues.push('partners');
  }
  return [...new Set(issues)];
}
export function validateLead(values, choices) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('INVALID_FIELDS');
  const allowed = consultationFields().filter(f => f.required || choices.optional === true);
  if (Object.keys(values).some(k => !allowed.some(f => f.id === k))) throw new Error('UNCONSENTED_FIELD');
  const clean = {};
  for (const f of allowed) {
    if (values[f.id] != null && typeof values[f.id] !== 'string') throw new Error('INVALID_FIELD');
    const v = (values[f.id] || '').trim();
    if ((f.required && !v) || v.length > f.max || /[\r\n<>]/.test(v)) throw new Error('INVALID_FIELD');
    if (v) clean[f.id] = v;
  }
  if (!/^[\p{L} .'-]{2,40}$/u.test(clean.name)) throw new Error('INVALID_NAME');
  clean.phone = clean.phone.replace(/[ -]/g, '');
  if (!/^0\d{9,10}$/.test(clean.phone)) throw new Error('INVALID_PHONE');
  if (clean.address!=='설치 주소 미정' && (clean.address.length < 5 || !/[\p{L}]/u.test(clean.address) || /[\x00-\x1f\x7f]/.test(clean.address))) throw new Error('INVALID_ADDRESS');
  return clean;
}

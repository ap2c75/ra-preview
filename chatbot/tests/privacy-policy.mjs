import assert from 'node:assert/strict';
import {DEFAULT_POLICY, consentEvidence, consentRequirements, notice, noticeIssues, policyIssues, validateLead} from '../privacy.mjs';

const partners = [
  {name:'총판 테스트A',purpose:'렌탈 상품 상담, 영업 안내 및 계약 접수',retention:'제공받은 날부터 90일'},
  {name:'총판 테스트B',purpose:'렌탈 상품 상담, 영업 안내 및 계약 접수',retention:'제공받은 날부터 90일'},
];
const ready = {...DEFAULT_POLICY,privacyContact:'privacy@example.com',operationsApproved:true,partnerCompanies:partners};

assert.deepEqual(consentRequirements(ready),{collectionUse:true,thirdParty:true,over14:true});
assert.deepEqual(policyIssues(ready),[]);
assert.ok(policyIssues(DEFAULT_POLICY).includes('privacyContact'));
assert.ok(policyIssues(DEFAULT_POLICY).includes('operationsApproved'));
assert.ok(policyIssues(DEFAULT_POLICY).includes('partnerCompaniesEmpty'));

const n=notice(ready);
assert.deepEqual(noticeIssues(n),[]);
assert.equal(n.controller,'브로씨앤씨');
assert.equal(n.retention,'상담 접수일로부터 90일');
assert.equal(n.transfer.recipient,'제휴총판');
assert.deepEqual(n.partners.map(v=>v.name),['총판 테스트A','총판 테스트B']);

assert.throws(()=>consentEvidence(ready,{collectionUse:true,over14:true}),/THIRD_PARTY_CONSENT_REQUIRED/);
const evidence=consentEvidence(ready,{collectionUse:true,thirdParty:true,over14:true},'2026-09-10T01:02:03+09:00');
assert.equal(evidence.policyVersion,ready.version);
assert.equal(evidence.agreedAt,'2026-09-09T16:02:03.000Z');
assert.deepEqual(evidence.recipients,['총판 테스트A','총판 테스트B']);

assert.deepEqual(validateLead({name:'테스트고객',phone:'010-1234-5678',address:'설치 주소 미정'},{optional:false}),{
  name:'테스트고객',phone:'01012345678',address:'설치 주소 미정',
});
assert.throws(()=>validateLead({name:'테스트고객',phone:'010-1234-5678',address:'직접 입력 주소',current_brand:'브랜드'},{optional:false}),/UNCONSENTED_FIELD/);
assert.ok(noticeIssues({...n,partners:[]}).includes('partners'));

console.log('privacy policy: 17 assertions passed');

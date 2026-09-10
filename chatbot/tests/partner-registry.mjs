import assert from 'node:assert/strict';
import {activePartners,diffPartnerRegistry,publicPartnerList,validatePartnerRegistry,withRegistryHistory} from '../partner-registry.mjs';

const draft={format:'somun-partners-v1',version:'draft',effectiveFrom:null,partners:[],history:[]};
assert.throws(()=>validatePartnerRegistry(draft),/NOT_READY/);
assert.equal(validatePartnerRegistry(draft,{allowDraft:true}),draft);
const partner={id:'partner-a',name:'총판 테스트A',purpose:'렌탈 상품 상담, 영업 안내 및 계약 접수',retentionDays:90,effectiveFrom:'2026-09-10T00:00:00+09:00',effectiveUntil:null};
const ready={...draft,version:'2026-09-10-v1',effectiveFrom:'2026-09-10T00:00:00+09:00',partners:[partner]};
assert.equal(activePartners(ready,Date.parse('2026-09-10T12:00:00+09:00')).length,1);
assert.deepEqual(publicPartnerList(ready,Date.parse('2026-09-10T12:00:00+09:00')),[{name:'총판 테스트A',purpose:partner.purpose,retention:'제공받은 날부터 90일'}]);
const changed={...ready,version:'2026-09-11-v1',partners:[{...partner,purpose:'렌탈 상담과 계약 접수'},{...partner,id:'partner-b',name:'총판 테스트B'}]};
assert.deepEqual(diffPartnerRegistry(ready,changed),{added:['partner-b'],removed:[],changed:['partner-a']});
const history=withRegistryHistory(ready,changed,'2026-09-11T00:00:00+09:00');
assert.equal(history.history.length,1);
assert.equal(history.history[0].version,'2026-09-11-v1');
assert.throws(()=>validatePartnerRegistry({...ready,partners:[partner,{...partner}]}),/DUPLICATE/);
console.log('partner registry: 8 assertions passed');

import test from 'node:test';
import assert from 'node:assert/strict';
import {canTransition,cleanLead,cleanSelection,operationalIssues,retentionDeadline,safeQualityEvent} from '../src/core.mjs';

test('lead validation accepts only consented fields',()=>{
 assert.deepEqual(cleanLead({name:'테스트 고객',phone:'010-1234-5678',address:'설치 주소 미정'}),{name:'테스트 고객',phone:'01012345678',address:'설치 주소 미정'});
 assert.throws(()=>cleanLead({name:'테스트 고객',phone:'010-1234-5678',address:'서울 강남구 테헤란로 1',email:'x@y.z'}),/UNCONSENTED_FIELD/);
});
test('selection is bounded and deduplicated',()=>assert.deepEqual(cleanSelection(['a','a','b','c','d']),['a','b','c']));
test('partner transition is forward-only',()=>{assert.equal(canTransition('queued','received','partner'),true);assert.equal(canTransition('queued','completed','partner'),false);assert.equal(canTransition('completed','queued','admin'),true);});
test('operational gate requires all real-world facts',()=>assert.deepEqual(operationalIssues({enabled:true,privacyContact:'privacy@example.com',partners:[{}],registryVersion:'v1',encryptionKey:'key'}),[]));
test('retention is exactly 90 days',()=>assert.equal(retentionDeadline('2026-09-10T00:00:00.000Z',90),'2026-12-09T00:00:00.000Z'));
test('quality event rejects raw text',()=>{assert.deepEqual(safeQualityEvent({outcome:'responded',intent:'recommendation',selectedCount:9}),{outcome:'responded',intent:'recommendation',selectedCount:3,feedbackReason:null});assert.throws(()=>safeQualityEvent({outcome:'responded',intent:'x',userText:'전화번호'}),/UNSAFE_EVENT/);});

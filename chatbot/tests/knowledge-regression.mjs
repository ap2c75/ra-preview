import assert from 'node:assert/strict';
import fs from 'node:fs';
import {activeEntries,knowledgeReply} from '../knowledge.mjs';

const data=JSON.parse(fs.readFileSync(new URL('../api/knowledge.json',import.meta.url),'utf8'));
const now=Date.parse('2026-09-10T12:00:00+09:00');
const entries=activeEntries(data.entries,now);
const state={filters:{category:null,brand:null,brands:[]}};

assert.equal(entries.length,5);
for(const [question,pattern] of [
  ['설치는 언제 받을 수 있나요?',/공통 설치 소요일이 확정되어 있지/],
  ['설치비는 얼마예요?',/설치비와 등록비는 상품 및 렌탈사 조건/],
  ['고장 나면 AS는 어떻게 돼요?',/상품별 계약서/],
  ['지금 신청하면 할인은 언제까지예요?',/공통 마감일을 확정하지 않았/],
  ['오늘 신청하면 언제 상담 받을 수 있나요?',/담당자가 접수 내용을 확인한 뒤 연락/],
]){
  const result=knowledgeReply(question,state,entries,now);
  assert.ok(result,question);
  assert.match(result.reply,pattern,question);
  assert.ok(result.sources.length>=1,question);
}
const consultation=knowledgeReply('오늘 신청하면 언제 상담 받을 수 있나요?',state,entries,now);
assert.doesNotMatch(consultation.reply,/설치 시기/, '상담 시점을 설치 일정으로 바꾸면 안 됩니다.');

console.log('knowledge regression: 17 assertions passed');

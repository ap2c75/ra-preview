import {isConsultationTiming} from '/ra-preview/chatbot/knowledge.mjs';
import { STANDARD } from '/ra-preview/chatbot/vendor/standard-data.mjs';
import { classify, checkAnswer } from '/ra-preview/chatbot/vendor/respondkit-rules.mjs';
import { checkStandard } from '/ra-preview/chatbot/standard.mjs';
export const intentNames = Object.fromEntries(STANDARD.intents.map(i => [i.id, i.name]));
// Priority routes handle Korean compounds before weighted keyword classification.
export function classifyRequest(text) {
  if (/개인정보|동의|정보.*(삭제|보관|수집)|누구세요|로봇|챗봇|인공지능|(사람|상담사|상담원).*(맞|인가|이야|에요|예요)/.test(text)) return null;
  if (isConsultationTiming(text)) return 'consultation-timing';
  if(/얼마나.*기다|언제.*(?:받|와|오)/.test(text))return 'schedule';
  if (/(사람|상담사|상담원|담당자).*(말|얘기|이야기|바꿔|연결|통화)|전화\s*주세요/.test(text)) return 'human';
  if (/불만|화가|화나|실망|최악|신고|소비자원|책임|말.*바뀌|아까.*다르/.test(text)) return 'complaint';
  if (/위약금|해지|환불|청약\s*철회|반품|중도|취소/.test(text)) return 'cancel';
  const intent = classify(STANDARD, text, STANDARD.industries[0]).intent;
  return intent==='human' && !/사람|상담사|상담원|담당자|통화|전화/.test(text) ? null : intent;
}
export function handoffReply(){return '현재는 고객사 검토용 사이트로 실제 상담 신청·담당자 연결은 지원하지 않습니다. 상품 질문과 주소 입력 동작을 테스트해 주세요.';}
// Customer text never enters metrics. Topic IDs and counts only.
export function trackOutcome(out, intent, unresolved = false, context = {}) {
  const s = out.state;
  s.quality ||= { responded:0, unresolved:0, handoff:0, blocked:0 };
  s.lastIntent = intent || s.lastIntent || null;
  if (unresolved) {
    const topic = out.requestSummary ? (intent || 'pending')+':'+out.requestSummary : intent || s.awaiting || s.lastIntent || 'clarification';
    const count = s.failures?.topic === topic ? s.failures.count + 1 : 1;
    s.failures = {topic, count:Math.min(count,3)};
    s.quality.unresolved++;
    if (count >= 2) {
      out.reply = '같은 확인 필요 안내를 반복하지 않을게요. 현재 자료만으로 확정할 수 없어 담당자 확인이 필요합니다.\n'+handoffReply(context);
      out.handoff = true; out.suggestions = []; out.resume = false;
    }
  } else { s.failures = null; if (!out.handoff) s.quality.responded++; }
  if (out.handoff) s.quality.handoff++;
  out.resolution='unconfirmed'; // Responding is never proof that the customer is satisfied.
  out.intent = intent || null;
  out.outcome = out.handoff ? 'handoff' : unresolved ? 'unresolved' : 'responded';
  return out;
}
export function inspectReply(reply, {intent, evidence = '', candidateCount = 0} = {}) {
  // R2 uses the existing rental block-aware check; card conditions span lines.
  const native = checkAnswer(STANDARD,{text:reply,intent,industryId:'rental',evidence,candidateCount,turn:1});
  return [...native.blocks.filter(h=>h.rule!=='R2'), ...checkStandard(reply).filter(h=>h.rule==='R2' && h.severity==='block')];
}
export const SAFE_REPLY = '확인된 자료로 안내할 수 있는 범위를 다시 확인해야 해요. 상품과 조건은 그대로 두었습니다. 상담 신청 안내에서 확인해 주세요.';

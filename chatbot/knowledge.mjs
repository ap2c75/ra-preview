import {TOPICS} from '/ra-preview/chatbot/public-topics.mjs';
const fail=()=>{throw new Error('INVALID_KNOWLEDGE');};
const keys=(v,expected)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===expected.length&&Object.keys(v).every(k=>expected.includes(k));
const clean=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[<>\x00-\x08\x0b-\x1f]|수수료|커미션|리베이트|commission|CRO|비공개/i.test(v);
export function validPublicUrl(value){try{if(typeof value!=='string'||value.length>2048)return false;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!/^localhost$|\.localhost$|\.local$|\.internal$|^\d+(?:\.\d+){3}$|:/.test(u.hostname)&&/\.[a-z]{2,}$/i.test(u.hostname);}catch{return false;}}
export const knowledgeTime=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)||!Number.isFinite(Date.parse(value)))fail();const date=value.slice(0,10);if(new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)fail();return Date.parse(value);};
export function validateEntries(entries){
 if(!Array.isArray(entries)||entries.length>100)fail();const seen=new Set();
 for(const e of entries){
  if(!keys(e,['id','answer','scope','source','validFrom','validUntil'])||!TOPICS.some(t=>t.id===e.id)||!clean(e.answer,1200)||!keys(e.scope,['category','brand'])||!keys(e.source,['label','url'])||!clean(e.source.label,100)||!validPublicUrl(e.source.url))fail();
  if([e.scope.category,e.scope.brand].some(v=>v!==null&&!clean(v,40))||knowledgeTime(e.validFrom)>=knowledgeTime(e.validUntil))fail();
  if(/무조건|100\s*%|반드시.*(승인|가능)|즉시.*연결|바로.*연결|심사.*없이|승인.*보장/.test(e.answer))fail();
  const identity=JSON.stringify([e.id,e.scope.category,e.scope.brand]);if(seen.has(identity))fail();seen.add(identity);
 }
 return entries;
}
export function activeEntries(entries,now=Date.now()) {try{return validateEntries(entries).filter(e=>Date.parse(e.validFrom)<=now&&Date.parse(e.validUntil)>now);}catch{return [];}}
// Timing needs an explicit subject: receiving a call is not receiving an installation.
export const isConsultationTiming=text=>/(상담|연락|전화|콜백|해피콜|통화)/.test(text)&&/(언제|몇\s*시|며칠|얼마나|시간|일정|날짜|오늘|내일|주말|평일|기다|소요|아직|안\s*(?:와|오)|연락이\s*없)/.test(text);
export const isInstallationTiming=text=>/(?:기사님|설치\s*기사).*(?:오시|방문|언제|며칠)|설치(?!비)(?!\s*(?:말고|아니라)).*?(언제|일정|날짜|며칠|빨리|얼마나\s*(?:걸|기다|소요))|(?:언제|오늘|내일|며칠).*설치(?!비)(?!\s*(?:말고|아니라))/.test(text);
export const matchingTopics=text=>TOPICS.filter(t=>t.id==='install-lead-time'?isInstallationTiming(text):t.id==='escalation-policy'?(isConsultationTiming(text)||t.match.test(text)):t.match.test(text));
export function knowledgeReply(text,state,entries=[],now=Date.now()){
 if(/개인정보|동의|정보.*(삭제|보관|수집)|로봇|챗봇|인공지능|누구세요|(사람|상담사|상담원).*(맞|인가|이야|에요|예요)/.test(text))return null;
 const topics=matchingTopics(text);if(!topics.length)return null;
 const active=activeEntries(entries,now),parts=[],sources=[],unresolved=[],answered=[];
 const brand=state.filters.brand||(state.filters.brands?.length===1?state.filters.brands[0]:null);
 for(const topic of topics){
  const eligible=active.filter(e=>e.id===topic.id&&(!e.scope.category||e.scope.category===state.filters.category)&&(!e.scope.brand||e.scope.brand===brand));
  const score=e=>Number(!!e.scope.brand)+Number(!!e.scope.category),best=Math.max(-1,...eligible.map(score)),matching=eligible.filter(e=>score(e)===best);
  if(matching.length!==1){parts.push(topic.id==='escalation-policy'?'상담 연락 시점은 현재 확정된 운영시간이나 대기시간 정보가 없어 정확히 안내하기 어려워요. 오늘 신청하셔도 당일 상담을 약속드릴 수는 없습니다.':topic.title+': 지금 자료로는 확정할 수 없어요. 상품·브랜드에 맞는 안내를 확인해야 합니다.');unresolved.push(topic.title);continue;}
  const entry=matching[0];parts.push(topic.title+': '+entry.answer);sources.push({topic:topic.title,...entry.source,scope:[entry.scope.brand,entry.scope.category].filter(Boolean).join(' · ')||'공통 안내',validUntil:entry.validUntil});answered.push(topic.title);
 }
 return {reply:parts.join('\n\n')+'\n\n보시던 조건으로 상품 탐색을 이어갈 수 있어요.',sources,unresolved,answered,evidence:parts.filter((_,i)=>!unresolved.includes(topics[i].title)).join(' ')};
}

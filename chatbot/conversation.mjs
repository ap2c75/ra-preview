import {siteReferenceReply} from '/ra-preview/chatbot/site-reference.mjs';
import {rentalFaqReply} from '/ra-preview/chatbot/rental-faq.mjs';
import {PAGE_SIZE,SORTS,validSort,pageData,orderDescription,browseRequest} from '/ra-preview/chatbot/browse.mjs';
import {normalizeText,interpret,referenceAction,referenceQuestion,referenceComparison,referenceDecision,asksReason} from '/ra-preview/chatbot/language.mjs?v=conversation-repair-20260910-6';
import { classifyRequest, handoffReply, trackOutcome, inspectReply, SAFE_REPLY } from '/ra-preview/chatbot/response-policy.mjs?v=conversation-repair-20260910-2';
import {GENERAL_FACTS as FACTS,TOPICS} from '/ra-preview/chatbot/public-topics.mjs';
import {knowledgeReply,matchingTopics,isInstallationTiming} from '/ra-preview/chatbot/knowledge.mjs';
const UNKNOWN=TOPICS.map(f=>({id:f.id,match:f.match,what:f.what,fact:f}));
const withParticle=(word,a,b)=>{const s=String(word).trim(),n=s.charCodeAt(s.length-1);return s+(n>=0xac00&&n<=0xd7a3&&(n-0xac00)%28!==0?a:b);};
import { toCategory } from '/ra-preview/chatbot/taxonomy.mjs';
import { mask } from '/ra-preview/chatbot/detect.mjs';

const norm = v => String(v ?? '').replace(/\s+/g, '').toLowerCase();
export const initialState = () => ({ filters: {}, selected: [], unresolved: [], offset: 0, sort: 'default', view: 'list', preferences: {}, awaiting: null, visibleCodes: [], recommendedCodes: [], focusCode: null, reprompt: null });
export const filterLabels = f => [f.category, f.model && `모델 ${f.model}`, f.brand, f.brands?.join(' · '), ...(f.excludedBrands||[]).map(b=>b+' 제외'), f.excludeIce&&'얼음 제외', ...(f.excludedTerms||[]).map(n=>n+'개월 제외'), ...(f.excludedCare||[]).map(v=>(v==='visit'?'방문관리':'자가관리')+' 제외'), f.maker, f.term && `${f.term}개월`, f.feature === 'ice' && '얼음', f.care === 'visit' && '방문관리', f.care === 'self' && '자가관리', f.budget && `월 ${f.budget.toLocaleString('ko-KR')}원 이하`].filter(Boolean);
function eligibleOptions(t, f) {
  return (t.options || [{ fee: t.fee }]).filter(o => {
    const fee = o.discountedFee ?? o.fee;
    const care=/방문/.test(o.careType||'')?'visit':/자가|셀프/.test(o.careType||'')?'self':'unknown';
    return !f.excludedCare?.includes(care) && Number.isFinite(fee) && fee >= 0 && (!f.budget || fee <= f.budget) &&
      (!f.care || (f.care === 'visit' ? /방문/.test(o.careType || '') : /셀프|자가/.test(o.careType || '')));
  });
}
export function catalogCategory(p) {
  // Prefer the source category over incidental product words such as '아이스'.
  if (/커피/.test(p.category || '')) return '커피머신';
  return toCategory(p.category) || toCategory(p.name);
}
const modelKey=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const catalogBrand=brand=>brand==='CKOO'?'쿠쿠':brand;
function matchesModel(p,query){
 if(!query)return true;
 const q=modelKey(query);
 return [p.code,...(String(p.name||'').match(/[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*/gi)||[])].some(v=>modelKey(v).includes(q));
}
export function cardsFor(catalog, f) {
  return catalog.filter(p => matchesModel(p,f.model) && !/^\d+개월\s*(반값|할인)/.test(p.name) && (!f.category || catalogCategory(p) === f.category) &&
    (!f.brand || catalogBrand(p.brand) === f.brand) && (!f.brands?.length || f.brands.includes(catalogBrand(p.brand))) && !f.excludedBrands?.includes(catalogBrand(p.brand)) && (!f.maker || norm(p.maker || p.name).includes(norm(f.maker))) &&
    (!f.feature || /얼음|아이스/i.test(p.name)) && (!f.excludeIce || !/얼음|아이스/i.test(p.name))).flatMap(p => {
    const plans = (p.terms || []).filter(t => (!f.term || t.m === f.term) && !f.excludedTerms?.includes(t.m)).flatMap(t => {
      const options = eligibleOptions(t, f);
      if (!options.length) return [];
      const fees = options.map(o => o.discountedFee ?? o.fee);
      return [{ months: t.m, min: Math.min(...fees), max: Math.max(...fees),
        options: options.map(o => ({ fee: o.discountedFee ?? o.fee, baseFee: o.fee,
          care: /방문|자가|셀프/.test(o.careType || '') ? o.careType : '관리 방식 확인 필요', rawCare: o.careType, cycle: o.careCycle,
          condition: o.condition, note: o.note, promo: o.promo, discount: o.discountText,
          totalMonths: o.totalMonths, sourceRow: o.sourceRow ?? null })) }];
    });
    return plans.length ? [{ code: p.code, name: p.name, brand: catalogBrand(p.brand), plans }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
function categoryNameMatch(card,category){
 const patterns={정수기:/정수기|이온수기/,공기청정기:/공기\s*청정기|공청기|에어\s*퓨리파이어/i,비데:/비데/,연수기:/연수기/,제습기:/제습기/,'에어컨·냉난방':/에어컨|냉난방|냉방기|온풍기|항온항습/,'매트리스·침대':/매트리스|침대/,'소파·가구':/소파|의자|책상|식탁|가구/,'안마·힐링':/안마|마사지|힐링|리클라이너/,청소기:/청소기/,전기레인지:/전기레인지|인덕션|하이라이트|가스레인지|전기그리들/,음식물처리기:/음식물처리|음처기/,식기세척기:/식기세척|식세기/,의류관리기:/의류관리|스타일러|의류청정/,'건조기·세탁기':/건조기|세탁기|워시/,냉장고:/냉장고|김치냉장고/,TV:/\btv\b|티비|올레드|qned|qled/i,커피머신:/커피|에스프레소|그라인더/,제빙기:/제빙기/,'업소용 냉장·냉동':/냉장|냉동|쇼케이스|워크인/,'업소용 주방':/오븐|튀김기|절단기|슬라이서|반죽기|진공포장/,'전기자전거·스쿠터':/전기자전거|전동스쿠터|전동킥보드/,'PC·사무기기':/노트북|전자칠판|복합기|프린터|모니터|\bpc\b/i};
 return patterns[category]?.test(card.name)||false;
}
function publicRecommendationValue(card,category){
  let maxDiscount=0,benefitSignals=0,minFee=Number.MAX_SAFE_INTEGER;
  for(const plan of card.plans)for(const option of plan.options){
    minFee=Math.min(minFee,option.fee);
    if(Number.isFinite(option.baseFee))maxDiscount=Math.max(maxDiscount,option.baseFee-option.fee);
    if(option.promo||option.discount)benefitSignals+=1;
  }
  return {maxDiscount,benefitSignals,categoryMatch:categoryNameMatch(card,category)?1:0,minFee};
}
function recommendationsByBrand(all,limit=3,excludedCodes=[],category=null){
  const excluded=new Set(excludedCodes);
  const groups=new Map();
  for(const card of all){if(excluded.has(card.code))continue;if(!groups.has(card.brand))groups.set(card.brand,[]);groups.get(card.brand).push(card);}
  return [...groups.entries()].map(([brand,cards])=>{
    const exact=cards.filter(card=>categoryNameMatch(card,category)),pool=exact.length?exact:cards;
    const ranked=pool.map(card=>({card,value:publicRecommendationValue(card,category)})).sort((a,b)=>b.value.maxDiscount-a.value.maxDiscount||b.value.benefitSignals-a.value.benefitSignals||a.value.minFee-b.value.minFee||a.card.name.localeCompare(b.card.name,'ko'));
    return {brand,card:ranked[0].card,value:ranked[0].value,count:cards.length};
  }).sort((a,b)=>b.value.maxDiscount-a.value.maxDiscount||b.value.benefitSignals-a.value.benefitSignals||b.value.categoryMatch-a.value.categoryMatch||b.count-a.count||a.value.minFee-b.value.minFee||a.brand.localeCompare(b.brand,'ko')).slice(0,limit).map(item=>item.card);
}
const feeLabel=plan=>plan.min===plan.max?`${plan.min.toLocaleString('ko-KR')}원`:`${plan.min.toLocaleString('ko-KR')}~${plan.max.toLocaleString('ko-KR')}원`;
function contextualProductReply(s,query,catalog){
 const all=cardsFor(catalog,{...s.filters,term:null,excludedTerms:[]});
 const card=all.find(item=>item.code===query.code);
 if(!card)return {state:s,reply:'조건이 바뀌어 해당 상품 정보를 다시 찾지 못했어요. 현재 상품 목록에서 번호를 다시 말씀해 주세요.',requestSummary:'상품 다시 확인',needsReview:true,suggestions:[]};
 s.focusCode=card.code;
 const label=`${card.brand} · ${card.name}`;
 const plans=query.requestedMonths?card.plans.filter(plan=>plan.months===query.requestedMonths):card.plans;
 const evidence=card.plans.flatMap(plan=>[String(plan.months),...plan.options.flatMap(option=>[String(option.fee),option.fee.toLocaleString('ko-KR')])]).join(' ');
 if(query.requestedMonths&&!plans.length){
  const terms=card.plans.map(plan=>`${plan.months}개월`).join(' · ');
  return {state:s,reply:`${label}은 현재 ${query.requestedMonths}개월 요금이 등록되어 있지 않아요. 확인 가능한 약정은 ${terms}이에요.`,requestSummary:'상품 약정 문의',needsReview:true,referenceEvidence:evidence,suggestions:[]};
 }
 if(query.topic==='price'||(query.topic==='term'&&query.requestedMonths)){
  const fees=plans.map(plan=>`${plan.months}개월 월 ${feeLabel(plan)}`).join(' · ');
  return {state:s,reply:`${label}은 등록된 요금 기준으로 ${fees}이에요. 관리 방식과 적용 조건에 따라 달라질 수 있어요.`,requestSummary:'상품 월요금 문의',evidenceIds:['catalog-product-plan'],referenceEvidence:evidence,suggestions:[]};
 }
 if(query.topic==='term'){
  const terms=card.plans.map(plan=>`${plan.months}개월`).join(' · ');
  return {state:s,reply:`${label}에서 확인 가능한 약정은 ${terms}이에요. 기간별 월요금은 상품 카드에서 함께 비교할 수 있어요.`,requestSummary:'상품 약정 문의',evidenceIds:['catalog-product-plan'],referenceEvidence:evidence,suggestions:[]};
 }
 if(query.topic==='care'){
  const options=plans.flatMap(plan=>plan.options.map(option=>option.care));
  const known=[...new Set(options.filter(value=>value!=='관리 방식 확인 필요'))];
  const unknown=options.includes('관리 방식 확인 필요');
  const askedVisit=/방문\s*관리/.test(query.text||'');
  const askedSelf=/자가\s*관리|셀프\s*관리/.test(query.text||'');
  let detail;
  if(!known.length)detail='현재 등록 자료에는 관리 방식이 없어 확인이 필요해요.';
  else if(askedVisit)detail=known.some(value=>/방문/.test(value))?'방문관리 옵션이 등록되어 있어요.':'현재 등록된 옵션에는 방문관리가 확인되지 않아요. '+known.join(' · ')+'만 확인돼요.';
  else if(askedSelf)detail=known.some(value=>/자가|셀프/.test(value))?'자가관리 옵션이 등록되어 있어요.':'현재 등록된 옵션에는 자가관리가 확인되지 않아요. '+known.join(' · ')+'만 확인돼요.';
  else detail=`등록된 관리 방식은 ${known.join(' · ')}${unknown?'이며, 일부 옵션은 관리 방식 확인이 필요해요.':'이에요.'}`;
  return {state:s,reply:`${label}은 ${detail}`,requestSummary:'상품 관리 방식 문의',needsReview:unknown&&!known.length,evidenceIds:known.length?['catalog-product-plan']:undefined,referenceEvidence:evidence+' '+known.join(' '),suggestions:[]};
 }
 const benefits=[...new Set(plans.flatMap(plan=>plan.options.flatMap(option=>[option.promo,option.discount]).filter(Boolean)))];
 return {state:s,reply:benefits.length?`${label}에 등록된 혜택은 ${benefits.slice(0,3).join(' · ')}이에요. 실제 적용 여부는 상담 시점에 확인해 주세요.`:`${label}은 현재 자료에 별도 혜택 문구가 등록되어 있지 않아요. 실제 적용 혜택은 상담 시점에 확인이 필요해요.`,requestSummary:'상품 혜택 문의',needsReview:!benefits.length,evidenceIds:benefits.length?['catalog-product-plan']:undefined,referenceEvidence:evidence+' '+benefits.join(' '),suggestions:[]};
}
const careLabels=card=>[...new Set(card.plans.flatMap(plan=>plan.options.map(option=>option.care)).filter(value=>value!=='관리 방식 확인 필요'))];
const benefitLabels=card=>[...new Set(card.plans.flatMap(plan=>plan.options.flatMap(option=>[option.promo,option.discount]).filter(Boolean)))];
function contextualComparisonReply(s,query,catalog){
 const all=cardsFor(catalog,s.filters),cards=query.codes.map(code=>all.find(card=>card.code===code)).filter(Boolean);
 if(cards.length!==query.codes.length)return {state:s,reply:'조건이 바뀌어 비교할 상품을 다시 찾지 못했어요. 현재 목록에서 상품 번호를 다시 말씀해 주세요.',requestSummary:'비교 상품 다시 확인',needsReview:true,suggestions:[]};
 s.selected=[...query.codes];s.view='compare';s.focusCode=null;
 const label=(card,index)=>`${index+1}번 ${card.brand} · ${card.name}`;
 const evidence=cards.flatMap(card=>[card.brand,card.name,...card.plans.flatMap(plan=>[String(plan.months),...plan.options.flatMap(option=>[String(option.fee),option.fee.toLocaleString('ko-KR'),option.care,option.promo,option.discount].filter(Boolean))])]).join(' ');
 let lines=[];
 if(query.criterion==='care')lines=cards.map((card,index)=>`${label(card,index)}: ${careLabels(card).join(' · ')||'관리 방식 확인 필요'}`);
 else if(query.criterion==='benefit')lines=cards.map((card,index)=>`${label(card,index)}: ${(benefitLabels(card).slice(0,2).join(' · '))||'등록된 별도 혜택 문구 없음'}`);
 else if(query.criterion==='term')lines=cards.map((card,index)=>`${label(card,index)}: ${card.plans.map(plan=>plan.months+'개월').join(' · ')}`);
 else {
  const common=[...new Set(cards[0].plans.map(plan=>plan.months))].filter(months=>cards.every(card=>card.plans.some(plan=>plan.months===months))).sort((a,b)=>a-b);
  if(common.length)lines=common.map(months=>{const plans=cards.map(card=>card.plans.find(item=>item.months===months)),lowest=Math.min(...plans.map(plan=>plan.min)),lower=plans.map((plan,index)=>plan.min===lowest?index+1:null).filter(Boolean);const result=lower.length===cards.length?'동일':lower.join('·')+'번이 낮음';return `${months}개월: `+plans.map((plan,index)=>`${index+1}번 월 ${feeLabel(plan)}`).join(' / ')+(query.criterion==='price'?` → ${result}`:'');});
  else lines=cards.map((card,index)=>{const plan=[...card.plans].sort((a,b)=>a.min-b.min)[0];return `${label(card,index)}: ${plan.months}개월 월 ${feeLabel(plan)}`;});
 }
 const intro=query.criterion==='care'?'등록된 관리 방식을 비교했어요.':query.criterion==='benefit'?'등록된 혜택 문구를 비교했어요.':query.criterion==='term'?'확인 가능한 약정 기간을 비교했어요.':'같은 약정끼리 등록된 월요금 범위를 비교했어요.';
 return {state:s,reply:`${intro}\n${lines.join('\n')}\n상품 카드에서 세부 조건을 확인하고, 원하는 상품 하나만 남겨 상담을 이어갈 수 있어요.`,requestSummary:'상품 비교',cards,comparison:true,evidenceIds:['catalog-product-plan'],referenceEvidence:evidence,suggestions:[]};
}
function contextualDecisionReply(s,query,catalog){
 const all=cardsFor(catalog,s.filters),cards=query.codes.map(code=>all.find(card=>card.code===code)).filter(Boolean);
 if(cards.length!==query.codes.length)return {state:s,reply:'조건이 바뀌어 결정할 상품을 다시 찾지 못했어요. 현재 상품 목록에서 다시 선택해 주세요.',requestSummary:'결정 상품 다시 확인',needsReview:true,suggestions:[]};
 let card=query.code?cards.find(item=>item.code===query.code):null,basis='비교 화면에서 고르신';
 if(query.criterion==='price'){
  const common=(query.requestedMonths?[query.requestedMonths]:cards[0].plans.map(plan=>plan.months)).filter(months=>cards.every(item=>item.plans.some(plan=>plan.months===months)));
  if(!common.length)return {state:s,reply:query.requestedMonths?`${query.requestedMonths}개월 요금이 두 상품에 모두 등록되어 있지 않아 낮은 쪽을 정할 수 없어요. 다른 약정을 말씀해 주세요.`:'두 상품에 공통으로 등록된 약정이 없어 월요금을 같은 기준으로 비교할 수 없어요. 상품 번호를 직접 골라주세요.',requestSummary:'비교 기준 확인',needsReview:true,cards,comparison:true,suggestions:[]};
  const winners=common.map(months=>{const plans=cards.map(item=>item.plans.find(plan=>plan.months===months)),min=Math.min(...plans.map(plan=>plan.min)),indexes=plans.map((plan,index)=>plan.min===min?index:null).filter(index=>index!==null);return indexes.length===1?indexes[0]:null;});
  if(winners.some(index=>index===null)||new Set(winners).size!==1)return {state:s,reply:'약정 기간에 따라 낮은 상품이 달라지거나 같은 요금이 있어 자동으로 하나를 정하기 어려워요. 약정 기간이나 상품 번호를 말씀해 주세요.',requestSummary:'비교 기준 확인',needsReview:true,cards,comparison:true,suggestions:common.map(months=>months+'개월').slice(0,3)};
  card=cards[winners[0]];basis=`공통 ${common.join('·')}개월의 등록 월요금 하한에서 더 낮게 확인된`;
 }
 if(query.criterion==='visit'||query.criterion==='self'){
  const pattern=query.criterion==='visit'?/방문/:/자가|셀프/,matched=cards.filter(item=>careLabels(item).some(value=>pattern.test(value)));
  if(matched.length!==1)return {state:s,reply:matched.length?'해당 관리 방식이 가능한 상품이 여러 개예요. 상품 번호를 하나 골라주세요.':'비교 중인 상품에서 해당 관리 방식이 확인되지 않아요. 다른 관리 방식이나 상품 번호를 말씀해 주세요.',requestSummary:'관리 방식 선택 확인',needsReview:true,cards,comparison:true,suggestions:[]};
  card=matched[0];basis=`등록 자료에서 ${query.criterion==='visit'?'방문관리':'자가관리'} 옵션이 확인된`;
 }
 if(!card)return {state:s,reply:'선택할 상품을 확인하지 못했어요. 비교 상품 번호를 다시 말씀해 주세요.',requestSummary:'상품 선택 확인',needsReview:true,cards,comparison:true,suggestions:[]};
 const position=query.codes.indexOf(card.code)+1,evidence=[card.brand,card.name,...card.plans.flatMap(plan=>[String(plan.months),...plan.options.flatMap(option=>[String(option.fee),option.fee.toLocaleString('ko-KR'),option.care].filter(Boolean))])].join(' ');
 s.selected=[card.code];s.view='list';s.focusCode=card.code;
 return {state:s,reply:`${basis} ${position}번 ${card.brand} · ${card.name} 하나로 정리했어요. 이 상품 기준으로 상담을 이어갈게요. 월요금·약정·관리 방식 중 더 궁금한 점을 말씀해 주세요.`,requestSummary:'비교 후 상품 결정',cards:[card],evidenceIds:['catalog-product-plan'],referenceEvidence:evidence,suggestions:[]};
}
// Structured state and presentation summaries only. Never persist raw messages.
function guidance(s, catalog) {
  if(s.filters.model)return {question:'모델 검색 결과예요. 약정과 관리 조건을 확인해 주세요.',suggestions:['모델 검색 해제']};
  if (!s.filters.category) return { question: '어떤 제품을 알아보고 계세요?', suggestions: ['정수기','공기청정기','비데'] };
  if (!s.filters.brand && !s.filters.maker && !s.preferences.brandAny) {
    s.awaiting = 'brand';
    return { question: '혹시 선호하시는 브랜드가 있으세요?', suggestions: ['브랜드 상관없어요','코웨이','쿠쿠'] };
  }
  if (!s.filters.term && !s.preferences.termAny) {
    s.awaiting = 'term';
    const terms = [...new Set(cardsFor(catalog, s.filters).flatMap(p => p.plans.map(t => t.months)))].sort((a,b)=>a-b);
    return { question: '생각해 두신 약정 기간도 있으세요?', suggestions: [...terms.slice(0,2).map(n=>n+'개월'), '약정 상관없어요'] };
  }
  s.awaiting = null;
  return { question: '마음에 드는 제품을 골라 비교해 볼까요?', suggestions: [] };
}
function noResultRecovery(s,catalog){
 const f=s.filters,options=[];
 const add=(active,filters,label,suggestion)=>{if(!active)return;const count=cardsFor(catalog,filters).length;if(count)options.push({count,label,suggestion});};
 add(f.brand||f.maker||f.brands?.length,{...f,brand:null,maker:null,brands:[],excludedBrands:[]},'브랜드 조건', '브랜드 상관없어요');
 add(f.term||f.excludedTerms?.length,{...f,term:null,excludedTerms:[]},f.term?`${f.term}개월 약정 조건`:'약정 제외 조건','약정 상관없어요');
 add(f.care||f.excludedCare?.length,{...f,care:null,excludedCare:[]},f.care==='visit'?'방문관리 조건':f.care==='self'?'자가관리 조건':'관리 방식 조건','관리 방식 확인 보류');
 add(Number.isFinite(f.budget),{...f,budget:null},`월 ${f.budget?.toLocaleString('ko-KR')}원 상한`,'예산 해제');
 const viable=options.sort((a,b)=>a.count-b.count).slice(0,2);
 if(!viable.length)return null;
 const detail=viable.map(item=>`${item.label}을 풀면 ${item.count.toLocaleString('ko-KR')}개`).join(', ');
 return {reply:`현재 조건을 모두 만족하는 상품은 없어요. ${detail}를 확인할 수 있어요. 어느 조건을 넓힐까요?`,suggestions:viable.map(item=>item.suggestion)};
}
function respondCatalog(previous, input, catalog) {
  const s = structuredClone(previous || initialState());
  s.preferences ||= {}; s.awaiting ??= null;
  const text = String(input.text || '').trim().slice(0, 500);
  const repeatedQuestionRepair=/(?:왜\s*)?(?:또|자꾸).{0,12}(?:같은|똑같은|반복|물어|묻)|(?:같은|똑같은).{0,8}(?:질문|말).{0,8}(?:또|자꾸|반복)|아까\s*(?:말|답)했(?:잖|는데)/.test(text);
  const recommendationRequested=/추천|골라(?:줘|주세요)?|뭐가\s*좋|어떤(?:게|것이)\s*좋|알아서|그냥.{0,8}(?:골라|보여|추천)|네가.{0,8}(?:골라|추천)/.test(text)||(repeatedQuestionRepair&&!!s.filters.category);
  const safety = mask(text, { profile: 'storage' });
  let requestSummary = null;
  const result = (reply, extra = {}) => ({ state:s, reply, requestSummary, ...extra });
  if (safety.kinds.length) return result('연락처는 상담 신청 화면에서 따로 받을게요.\n여기에는 찾으시는 제품이나 조건만 말씀해 주세요.');
  if(input.action==='undo'){
    if(!input.undoAvailable)return result('아직 되돌릴 조건 변경이 없어요. 원하시는 상품이나 조건을 말씀해 주세요.');
    const restored=structuredClone(input.restoreState||initialState()),all=cardsFor(catalog,restored.filters);
    const recommended=(restored.recommendedCodes||[]).map(code=>all.find(card=>card.code===code)).filter(Boolean);
    const selected=(restored.selected||[]).map(code=>all.find(card=>card.code===code)).filter(Boolean);
    let display={cards:[],suggestions:['정수기','공기청정기','비데']};
    if(restored.view==='compare'&&selected.length>=2)display={cards:selected,comparison:true};
    else if(recommended.length)display={cards:recommended,total:recommended.length,page:1,pages:1,start:1,end:recommended.length,previous:false,more:false,recommendation:true};
    else if(restored.filters.category||restored.filters.model)display=pageData(all,restored);
    return {state:restored,reply:'바로 전 조건으로 되돌렸어요. 여기서 다시 이어갈게요.',requestSummary:null,...display};
  }
  if (input.action === 'reset' || /^(처음으로|조건 초기화)$/.test(text)) return {state:initialState(),reply:'새로 찾아볼게요. 어떤 제품이 필요하세요?',requestSummary:'조건 새로 고르기',cards:[],suggestions:['정수기','공기청정기','비데']};
  if(input.catalogUnavailable&&(['select','compare','resume','more','previous','first','sort'].includes(input.action)||String(input.action||'').startsWith('repair')||input.parsed?.changed||/추천|상품|제품|보여|찾아/.test(text)))return result('상품 자료를 확인하지 못해 지금은 상품과 요금을 안내할 수 없어요. 입력한 조건은 유지됩니다. 상품 자료 다시 불러오기를 눌러 주세요.',{catalogUnavailable:true,needsReview:true,requestSummary:filterLabels(s.filters).join(' · ')||'상품 자료 확인 필요'});
  if(input.action==='repairRepeat'){
    if(!s.filters.category&&!s.filters.model)return result('같은 질문을 반복했네요. 필요한 제품 종류만 알려주시면 그다음 선택 질문은 건너뛰고 바로 찾아볼게요.',{suggestions:['정수기','공기청정기','비데']});
    s.preferences.brandAny=true;s.preferences.termAny=true;s.awaiting=null;s.reprompt=null;
    const all=cardsFor(catalog,s.filters),cards=recommendationsByBrand(all,3,[],s.filters.category);s.recommendedCodes=cards.map(card=>card.code);
    return result('같은 질문은 건너뛰고 현재 조건에서 바로 골라봤어요. 마음에 드는 상품 하나만 선택해도 상담을 이어갈 수 있어요.',{cards,total:cards.length,page:1,pages:1,start:1,end:cards.length,previous:false,more:false,recommendation:true});
  }
  if(input.action==='repairMisread')return result('제가 다르게 이해했네요. 지금까지 고른 조건은 유지해 둘게요. 바꾸려는 부분만 말씀해 주세요. 예: “코웨이 말고 쿠쿠로 보여줘.”',{suggestions:['조건 초기화','브랜드 상관없어요']});
  if(input.action==='repairInsufficient')return result('답변이 부족했네요. 궁금한 기준을 골라주시거나 한 문장으로 다시 말씀해 주세요.',{suggestions:['월요금 낮은 순','약정 상관없어요','방문관리 상품']});
  if(input.action==='repairRecommendation'){
    if(!s.filters.category&&!s.filters.model)return result('다른 상품을 다시 고르려면 먼저 필요한 제품 종류를 알려주세요.',{suggestions:['정수기','공기청정기','비데']});
    const all=cardsFor(catalog,s.filters),cards=recommendationsByBrand(all,3,s.recommendedCodes||[],s.filters.category);
    if(!cards.length)return result('현재 조건에서 새로 바꿔 보여드릴 상품이 더 없어요. 브랜드나 예산 조건을 넓혀볼까요?',{suggestions:['브랜드 상관없어요','조건 초기화']});
    s.recommendedCodes=cards.map(card=>card.code);s.view='list';
    return result('앞서 보여드린 상품은 제외하고 다른 후보로 바꿨어요. 이 중 하나만 선택해도 상담을 이어갈 수 있어요.',{cards,total:cards.length,page:1,pages:1,start:1,end:cards.length,previous:false,more:false,recommendation:true});
  }
  if (/^(안녕|안녕하세요|반가워|하이)[.!~?\s]*$/.test(text)) {
    requestSummary = '인사'; const guide=guidance(s,catalog);
    return result('안녕하세요. 편하게 말씀해 주세요.\n'+guide.question,guide);
  }
  if (/고마워|감사합니다|감사해|수고했/.test(text)) {
    requestSummary = '감사 인사';
    return result('도움이 되셨으면 좋겠어요.\n다른 조건도 궁금하시면 이어서 말씀해 주세요.');
  }
  if (/(사람|상담사|상담원).*(맞|이야|인가|에요|예요)|누구세요|누구야|누구니|로봇|챗봇|인공지능/.test(text)) {
    requestSummary = '상담 안내';
    return result('저는 소문의 자동 상담 도우미예요.\n등록된 상품을 찾아드리고, 조건을 비교하는 일을 돕고 있어요. 실제 담당자와의 상담은 접수 안내에서 확인하실 수 있어요.');
  }
  if (input.action === 'select' || input.action === 'clearSelection') {
    const all = cardsFor(catalog,s.filters);
    const recommended=(s.recommendedCodes||[]).map(code=>all.find(card=>card.code===code)).filter(Boolean);
    const display = () => s.view==='compare'&&s.selected.length>=2
      ? {cards:s.selected.map(code=>all.find(c=>c.code===code)).filter(Boolean),comparison:true}
      : recommended.length
        ? (s.view='list',{cards:recommended,total:recommended.length,previous:false,more:false,recommendation:true})
        : (s.view='list',pageData(all,s));
    if(input.action==='clearSelection') {
      s.selected=[]; requestSummary='담은 상품 비우기';
      return result('담은 상품을 비웠어요.',display());
    }
    const card = all.find(c=>c.code===input.code);
    if (!card) return result('조건이 바뀌어서 지금은 이 제품을 고를 수 없어요. 현재 목록에서 다시 골라주시겠어요?');
    const removing = input.selectionMode==='remove' || (input.selectionMode!=='add' && s.selected.includes(card.code));
    requestSummary = removing ? '담은 상품에서 빼기' : '상담할 상품 담기';
    if(!removing&&!s.selected.includes(card.code)&&s.selected.length>=3)
      return result('상담할 상품은 한 번에 3개까지 담을 수 있어요. 상품 하나를 뺀 뒤 새 상품을 골라주세요.',{...display(),selectionLimit:true});
    s.selected = removing ? s.selected.filter(c=>c!==card.code) : [...new Set([...s.selected,card.code])];
    return result(removing ? '담은 상품에서 뺐어요.' : s.selected.length===1 ? '상담할 상품으로 담았어요. 지금 바로 상담을 이어가거나 상품을 더 담아 비교할 수 있어요.' : '담았어요. 바로 상담을 이어가거나 선택한 상품을 비교할 수 있어요.',display());
  }
  if(input.action==='consultSelection'){
    const all=cardsFor(catalog,s.filters),cards=s.selected.map(code=>all.find(card=>card.code===code)).filter(Boolean);
    requestSummary='담은 상품으로 상담 이어가기';s.view='list';
    if(!cards.length)return result('상담할 상품을 하나 담아주세요.',pageData(all,s));
    const names=cards.map(card=>card.brand+' '+card.name).join(' · ');
    return result(names+' 기준으로 상담을 이어갈게요. 월요금, 약정, 관리 방식이나 혜택 중 궁금한 점을 편하게 말씀해 주세요.',{cards});
  }
  if (input.action === 'apply' || /상담.*(신청|연결)|사람.*상담/.test(text)) {
    requestSummary = '상담 신청 안내';
    return result('상담 신청을 도와드릴게요.\n먼저 어떤 정보를 받는지 확인해 주세요.',{consent:true});
  }
  if (input.action === 'compare' || /^(비교|비교해줘|골라둔 제품 비교)$/.test(text)) {
    requestSummary = '고른 제품 비교하기';
    const all=cardsFor(catalog,s.filters),cards=s.selected.map(code=>all.find(c=>c.code===code)).filter(Boolean);
    s.view=cards.length>=2?'compare':'list';
    return result(cards.length>=2?'고르신 제품을 나란히 놓아봤어요.\n월요금과 관리 조건을 같이 살펴보세요.':'비교하고 싶은 제품을 2~3개 담아주시겠어요?',cards.length>=2?{cards,comparison:true}:pageData(all,s));
  }
  if (/인터넷|통신|결합|와이파이/.test(text)) {
    requestSummary = '인터넷·TV 상담';
    return result('인터넷·TV 사이트 자료를 아직 불러오지 못했어요. 잠시 후 다시 문의하거나 고객 사이트의 인터넷·TV 메뉴에서 조건을 확인해 주세요.');
  }
  if (/개인정보|동의|정보.*(삭제|보관|수집)/.test(text)) {
    requestSummary = '개인정보 안내';
    return result('상담을 신청하실 때 어떤 정보를 왜 받는지, 얼마나 보관하는지 먼저 안내해 드려요.\n동의하지 않으셔도 상품은 계속 둘러보실 수 있어요.');
  }
  const pending=UNKNOWN.find(u=>matchingTopics(text).some(t=>t.id===u.id));
  if (pending&&!(recommendationRequested&&s.filters.category)) {
    requestSummary = pending.fact.title;
    s.unresolved=[...new Set([...s.unresolved,pending.fact.title])];
    return result(withParticle(pending.what,'은','는')+' 지금 자료로는 확정할 수 없어요. 상담할 때 확인이 필요한 부분이에요.\n보시던 조건으로 상품 탐색을 이어갈 수 있어요.',{resume:true});
  }
  if (/위약금|해지|환불|청약철회/.test(text)) {
    requestSummary = '해지·환불 조건 문의';
    return result('그 부분은 상품별 계약 조건을 확인해야 정확히 안내할 수 있어요.\n아까 보시던 제품은 그대로 두었어요.',{resume:true});
  }
  const {patch:next={},changed=false,anyBrand=false,anyTerm=false}=input.parsed||{};
  if(recommendationRequested&&s.filters.category&&!s.filters.brand&&!s.filters.brands?.length&&!s.filters.maker){s.preferences.brandAny=true;s.preferences.termAny=true;s.awaiting=null;}
  const wantsResults=changed || ['resume','more','previous','first','sort'].includes(input.action) || /추천|상품|다시 보기|보여|얼마|비교/.test(text) || repeatedQuestionRepair;
  if(!wantsResults) {
    const waiting=s.awaiting,guide=guidance(s,catalog);
    if(waiting&&waiting===s.awaiting){
      const count=s.reprompt?.key===waiting?s.reprompt.count+1:1;s.reprompt={key:waiting,count};
      if(waiting==='brand'){
        if(count>=2){s.preferences.brandAny=true;s.preferences.termAny=true;s.awaiting=null;s.reprompt=null;const all=cardsFor(catalog,s.filters),cards=recommendationsByBrand(all,3,[],s.filters.category);s.recommendedCodes=cards.map(card=>card.code);return result('선호 브랜드는 선택 사항이라 건너뛰고, 서로 다른 브랜드에서 바로 골라봤어요.\n마음에 드는 상품 하나만 담아도 상담을 이어갈 수 있어요.',{cards,total:cards.length,page:1,pages:1,start:1,end:cards.length,previous:false,more:false,recommendation:true});}
        return result('선호 브랜드가 없거나 잘 모르셔도 괜찮아요. 제가 서로 다른 세 브랜드에서 바로 골라드릴 수도 있어요.',{...guide,suggestions:['추천해주세요','브랜드 상관없어요']});
      }
      if(waiting==='term'){
        if(count>=2){s.preferences.termAny=true;s.awaiting=null;s.reprompt=null;const all=cardsFor(catalog,s.filters),page=pageData(all,s);return result('약정 기간은 선택 사항이라 건너뛰고 현재 조건의 상품부터 보여드릴게요. 상품 카드에서 기간별 월요금을 비교할 수 있어요.',page);}
        return result('약정 기간을 아직 정하지 않으셨다면 전체 기간을 함께 볼 수 있어요.',{...guide,suggestions:['약정 상관없어요']});
      }
    }
    s.reprompt=null;
    return result('말씀하신 내용을 상품 조건으로 연결하지 못했어요. 제품 종류나 원하는 조건을 편하게 말씀해 주세요.',{...guide,suggestions:guide.suggestions||[]});
  }
  s.reprompt=null;
  requestSummary = ['previous','first','sort'].includes(input.action) ? ({previous:'이전 상품 보기',first:'첫 상품 보기',sort:SORTS[validSort(input.sort)]})[input.action] : input.action==='resume' ? '보던 상품 이어 보기' : input.action==='more' ? '다른 상품도 보기' :
    anyBrand ? '브랜드는 상관없어요' : anyTerm ? '약정은 상관없어요' : filterLabels(next).join(' · ') || '조건 변경';
  if(!s.filters.category&&!s.filters.model) return result(repeatedQuestionRepair?'같은 질문을 반복했다면 죄송해요. 먼저 필요한 제품 종류만 알려주시면, 이미 답한 내용을 다시 묻지 않고 이어갈게요.':'먼저 어떤 제품이 필요한지 알려주시겠어요?',{...guidance(s,catalog),needsReview:true});
  const all=cardsFor(catalog,s.filters);
  s.selected=s.selected.filter(code=>all.some(c=>c.code===code));
  s.view='list';
  if(input.action==='sort'){s.sort=validSort(input.sort);s.offset=0;}
  if(input.action==='more')s.offset+=PAGE_SIZE;
  if(input.action==='previous')s.offset-=PAGE_SIZE;
  if(input.action==='first')s.offset=0;
  const recommendations=recommendationRequested?recommendationsByBrand(all,3,[],s.filters.category):null;
  if(recommendations){s.offset=0;s.recommendedCodes=recommendations.map(card=>card.code);}
  else s.recommendedCodes=[];
  const page=recommendations?{cards:recommendations,total:recommendations.length,page:1,pages:1,start:1,end:recommendations.length,previous:false,more:false}:pageData(all,s);
  if(s.filters.care||s.filters.excludedCare?.length){
    const unknown=cardsFor(catalog,{...s.filters,care:null,excludedCare:[]}).filter(c=>c.plans.some(p=>p.options.some(o=>o.care==='관리 방식 확인 필요')));
    if(!all.length&&unknown.length)return result('다른 조건에 맞는 상품은 있지만 관리 방식이 등록되지 않은 상품이 있어요. 방문·자가관리 가능 여부는 확인이 필요합니다. 관리 방식 확인을 보류하고 상품부터 보실까요?',{cards:[],total:0,more:false,needsReview:true,suggestions:['관리 방식 확인 보류'],requestSummary:'관리 방식 자료 확인 필요'});
  }
  if(!all.length&&s.filters.model)return result('입력하신 모델과 현재 조건에 맞는 상품을 찾지 못했어요. 모델명 철자를 확인하거나 모델 검색을 해제해 주세요.',{cards:[],total:0,more:false,suggestions:['모델 검색 해제']});
  if(!all.length){const recovery=noResultRecovery(s,catalog);return result(recovery?.reply||'말씀하신 조건으로는 맞는 상품을 찾지 못했어요.\n브랜드나 약정 기간을 조금 넓혀볼까요?',{cards:[],total:0,more:false,suggestions:recovery?.suggestions||[]});}
  const guide=guidance(s,catalog);
  let lead;
  if(recommendationRequested){const list=page.cards.map((card,index)=>(index+1)+'. '+card.brand+' · '+card.name).join('\n'),scope=s.filters.brand||s.filters.maker?`${s.filters.brand||s.filters.maker} ${(s.filters.category||'해당 카테고리')} 상품 중에서`:`${s.filters.category||'해당 카테고리'}에서 서로 다른 브랜드 상품을`;lead=(repeatedQuestionRepair?'같은 질문을 반복했네요. 이미 확인한 조건은 그대로 두고 추가 질문은 건너뛸게요.\n':'')+scope+' 바로 골라봤어요.\n'+list+'\n현재 공개된 월요금과 등록 혜택 기준이며, 최종 지원 혜택은 상담 시점에 확인해 주세요.\n마음에 드는 상품 하나만 담아도 바로 상담을 이어갈 수 있어요.';}
  else if(input.action==='more') lead=s.offset===previous.offset?'마지막 페이지예요. 이전 상품으로 돌아가거나 조건을 바꿔보세요.':'다음 상품을 가져왔어요.';
  else if(input.action==='previous')lead=s.offset===previous.offset?'첫 페이지예요.':'이전 상품으로 돌아왔어요.';
  else if(input.action==='first')lead='첫 페이지로 돌아왔어요.';
  else if(input.action==='sort'||input.parsed?.sortChanged)lead=SORTS[validSort(s.sort)]+'으로 다시 보여드릴게요.';
  else if(input.action==='resume') lead='아까 보시던 상품이에요.';
  else if(next.model) lead='입력하신 모델명으로 찾아봤어요.';
  else if(anyBrand) lead='네, 브랜드는 넓게 볼게요.';
  else if(anyTerm) lead='네, 약정 기간별로 같이 살펴볼게요.';
  else if(next.brands?.length) lead=next.brands.join(' · ')+' 제품을 함께 찾아봤어요.';
  else if(next.brand || next.maker) lead=(next.brand || next.maker)+' 제품으로 다시 찾아봤어요.';
  else if(next.term) lead=next.term+'개월 약정으로 찾아봤어요.';
  else if(next.category) lead=next.category+' 알아보고 계시는군요. 조건에 맞는 상품을 찾아봤어요.';
  else lead=changed?'확인된 검색 조건으로 다시 찾아봤어요.':'현재 설정된 조건의 상품을 보여드릴게요.';
  return result(recommendationRequested?lead:lead+'\n'+guide.question,{...guide,...page,recommendation:recommendationRequested});
}

// Preserve the entry controller and structured product state; do not call
// Respondkit collectFlow or its model API from this adapter.
export function respond(previous, input, catalog, context = {}) {
  const selectedBefore=previous?.selected||[];
  const raw = String(input.text || '').trim().slice(0,500);
  let text = raw;
  const safety = mask(text,{profile:'storage'});
  if (safety.kinds.length) return respondCatalog(previous,input,catalog);
  const site= !input.action?siteReferenceReply(previous||initialState(),normalizeText(raw),context.siteData,context.now??Date.now()):null;
  if(site){
    const violations=inspectReply(site.reply,{evidence:site.siteEvidence||'',candidateCount:0});
    if(violations.length)return trackOutcome({...site,reply:SAFE_REPLY,siteSources:[],blockedRules:violations.map(x=>x.rule),handoff:true},null,true,context);
    const progressed=JSON.stringify([site.state.filters,site.state.siteInternet])!==JSON.stringify([previous?.filters,previous?.siteInternet]);
    return trackOutcome(site,'site-reference',!site.siteEvidence&&!progressed,context);
  }
  if(/정수기|공기청정기|비데|냉장고|세탁기|매트리스|에어컨/.test(raw)&&previous?.siteInternet){previous=structuredClone(previous);delete previous.siteInternet;}
  text=normalizeText(raw);
  const decisionResult=!input.action?referenceDecision(text,{visibleCodes:previous?.visibleCodes||[],selectedCodes:previous?.selected||[],view:previous?.view||'list'}):null;
  const comparisonResult=!input.action&&!decisionResult?referenceComparison(text,{visibleCodes:previous?.visibleCodes||[],selectedCodes:previous?.selected||[],view:previous?.view||'list'}):null;
  const referenceQuestionResult=!input.action&&!comparisonResult&&!decisionResult?referenceQuestion(text,{visibleCodes:previous?.visibleCodes||[],focusCode:previous?.focusCode||null,selectedCodes:previous?.selected||[]}):null;
  if(referenceQuestionResult)referenceQuestionResult.text=text;
  const faqQuestion=!input.action&&!referenceQuestionResult&&!comparisonResult&&!decisionResult?rentalFaqReply(text):null;
  const parsed=(input.action||faqQuestion||referenceQuestionResult||comparisonResult||decisionResult)?{state:structuredClone(previous||initialState()),patch:{},changed:false}:interpret(text,previous||initialState());
  const s=parsed.state;
  const browsing=input.action?{}:browseRequest(text);
  if(browsing.clarification)parsed.clarification=browsing.clarification;
  if(browsing.sort&&!parsed.clarification){s.sort=browsing.sort;s.offset=0;parsed.changed=true;parsed.sortChanged=true;}
  if(parsed.changed)s.view='list';
  if(browsing.action)input={...input,action:browsing.action};
  const ref=input.action||referenceQuestionResult||comparisonResult||decisionResult?null:referenceAction(text,previous?.visibleCodes||[]);
  const referenceConflict=ref?.action&&(parsed.sortChanged||JSON.stringify(s.filters)!==JSON.stringify((previous||initialState()).filters));
  if(referenceConflict)parsed.clarification='상품 조건·순서 변경과 번호 선택은 나누어 진행해 주세요. 먼저 바꿀 조건을 확인할까요?';
  if(parsed.clarification){Object.assign(s,structuredClone(previous||initialState()));parsed.changed=false;}
  input={...input,text,parsed,catalogUnavailable:context.catalogAvailable===false,...(ref?.action&&!referenceConflict?ref:{})};
  const intent=input.action?null:classifyRequest(text);
  previous=s;

  let out;
  const base = (reply, summary, extra={}) => ({state:s,reply,requestSummary:summary,...extra});
  if(context.catalogAvailable===false&&(decisionResult?.code||decisionResult?.criterion||comparisonResult?.codes||referenceQuestionResult?.code)) {
    out=base('상품 자료를 확인하지 못해 지금은 해당 상품을 비교하거나 요금을 안내할 수 없어요. 상품 자료 다시 불러오기를 눌러 주세요.','상품 자료 확인 필요',{catalogUnavailable:true,needsReview:true,suggestions:[]});
  } else if(parsed.clarification||ref?.clarification||referenceQuestionResult?.clarification||comparisonResult?.clarification||decisionResult?.clarification) {
    out=base(parsed.clarification||ref?.clarification||referenceQuestionResult?.clarification||comparisonResult?.clarification||decisionResult.clarification,'입력 조건 확인',{needsReview:true,suggestions:[]});
    out.requestSummary='입력 조건 확인';
  } else if(decisionResult?.code||decisionResult?.criterion) {
    out=contextualDecisionReply(s,decisionResult,catalog);
  } else if(comparisonResult?.codes) {
    out=contextualComparisonReply(s,comparisonResult,catalog);
  } else if(referenceQuestionResult?.code) {
    out=contextualProductReply(s,referenceQuestionResult,catalog);
  } else if(intent==='schedule'&&!faqQuestion&&!parsed.changed&&!isInstallationTiming(text)) {
    out=base('상담 연락을 받을 시점이 궁금하신가요, 아니면 제품 설치 날짜가 궁금하신가요?','일정 문의 확인',{needsReview:true,suggestions:[]});
  } else if(asksReason(text)&&!['human','complaint','cancel'].includes(intent)) {
    out=!s.filters.category?base('먼저 어떤 상품이 필요한지 알려주세요. 조건에 맞는 상품을 찾은 뒤 표시 기준을 설명해 드릴게요.','상품 조건 확인',{needsReview:true}):base('입력하신 '+[s.filters.category,s.filters.brand,s.filters.brands?.join(' · '),s.filters.term&&s.filters.term+'개월 약정',s.filters.budget&&'예산',s.filters.care&&'관리 방식'].filter(Boolean).join(' · ')+' 조건으로 찾았어요. '+orderDescription(s)+'\n개인별 적합도를 평가한 추천 순위는 아니에요. 실제 사용 환경에 맞는지는 제품 사양과 관리 조건을 함께 확인해야 합니다.','상품 표시 기준',{evidenceIds:['catalog-filter-order']});
  } else if (intent==='human' || intent==='complaint') {
    out = base((intent==='complaint'?'불편하셨겠어요. 어떤 제품을 고를지보다 겪으신 불편을 먼저 확인해야겠네요.\n':'담당자와 직접 상담하고 싶으시군요.\n')+handoffReply(context), intent==='human'?'담당자 상담 요청':'불편 사항 상담', {handoff:true,suggestions:[]});
  } else if (intent==='cancel') {
    out = base('해지·환불은 선택하신 상품의 계약 조건을 함께 확인해야 해요.\n약정 기간, 이용한 기간, 위약금 기준, 신청 방법을 확인해 주세요. 지금 자료만으로 금액이나 처리 가능 여부를 확정할 수는 없어요.', '해지·환불 조건 문의', {resume:true,needsReview:true});
    s.unresolved=[...new Set([...s.unresolved,'해지·환불 조건'])];
  } else {
    const knowledge=!input.action?knowledgeReply(text,s,context.knowledgeEntries||[],context.now??Date.now()):null;
    const faq=!input.action?rentalFaqReply(text):null;
    if(faq&&!knowledge?.sources.length){out=base(faq.reply,faq.titles.join(' · '),{needsReview:true,faqIds:faq.ids,suggestions:[],resume:!!s.filters.category});s.unresolved=[...new Set([...s.unresolved,...faq.titles])];}
    else if(knowledge){out=base(knowledge.reply,knowledge.unresolved.length?knowledge.unresolved.join(' · '):knowledge.answered.join(' · '),{resume:true,needsReview:knowledge.unresolved.length>0,sources:knowledge.sources,evidenceIds:knowledge.sources.length?['reviewed-knowledge']:undefined,knowledgeEvidence:knowledge.evidence});s.unresolved=[...new Set([...s.unresolved.filter(t=>!knowledge.answered.includes(t)),...knowledge.unresolved])];}
    // Only facts whose wording is suitable without a live handoff are reused.
    const fact = !input.action && FACTS.find(f=>['total-vs-monthly','ownership'].includes(f.id) && f.status==='confirmed' && f.match.test(text));
    if (!out&&fact) out = base(fact.id==='total-vs-monthly'
      ? '총 납입금액은 월 렌탈료에 약정 개월을 곱한 값과 다를 수 있어요. 선납·면제 개월·프로모션 조건을 함께 확인해야 합니다.'
      : '약정이 끝나면 소유권이 넘어오는 상품과 그렇지 않은 상품이 있어요. 고르신 상품의 계약 조건에서 소유권 이전 여부를 확인해야 합니다.',fact.title,{resume:true,evidenceIds:[fact.id]});
    else if(!out) out = respondCatalog(previous,input,catalog);
  }
  if (!input.action && !parsed.changed && !out.requestSummary && ['place','schedule','eligibility','howto'].includes(intent)) {
    const guidance = {
      place:['상담 창구·운영시간','상담 창구와 운영시간은 아직 확정된 자료가 없어요. 아래 상담 신청 안내에서 현재 접수 가능 여부를 확인해 주세요.'],
      schedule:isInstallationTiming(text)?['설치·방문 일정','설치·방문 일정은 상품과 지역, 재고에 따라 확인이 필요해요. 지금 자료만으로 날짜를 약속드리기는 어려워요.']:['일정 문의 확인','상담 연락을 받을 시점이 궁금하신가요, 아니면 제품 설치 날짜가 궁금하신가요?'],
      eligibility:['가입·이용 조건','가입이나 이용 가능 여부는 상품별 조건을 확인해야 해요. 지금 자료만으로 가능하다고 확정할 수는 없어요.'],
      howto:['사용법·문제 해결','제품마다 사용법과 점검 방법이 달라요. 해당 모델의 설명서나 제조사 고객센터에서 확인해 주세요. 보시던 상품과 조건은 그대로 두었습니다.'],
    };
    const [summary,reply] = guidance[intent];
    out = {...out,reply,requestSummary:summary,needsReview:true,suggestions:[],resume:!!out.state.filters.category};
    out.state.unresolved=[...new Set([...out.state.unresolved,summary])];
  }
  if (intent==='howto' && out.resume && !out.evidenceIds && !/설명서|제조사/.test(out.reply)) {
    out.reply += '\n제품 사용·점검 방법은 해당 모델의 설명서나 제조사 고객센터에서 확인해 주세요.';
  }
  const unsupported=!input.action&&!['human','complaint','cancel'].includes(intent)&&!out.consent&&[
    [/원룸|혼자\s*사|1인\s*가구|작은\s*(?:제품|정수기)|소형|슬림|컴팩트/,'크기·사용 환경 적합성'],
    [/냉수|온수|뜨거운\s*물|냉온/,'출수 기능'],
    [/소음|조용|전력|전기세|에너지/,'소음·전력 사양']
  ].filter(([pattern])=>pattern.test(text)).map(([,label])=>label);
  if(unsupported?.length){
    out.reply=unsupported.join(' · ')+'은 현재 상품 자료만으로 확인할 수 없어 검색 조건에 반영하지 않았어요. 모델별 사양 확인이 필요합니다.\n'+out.reply;
    out.needsReview=true;out.requestSummary||='상품 사양 확인 필요';
    out.state.unresolved=[...new Set([...out.state.unresolved,...unsupported])];
  }
  const current=cardsFor(catalog,out.state.filters);
  if(context.catalogAvailable!==false)out.state.selected=out.state.selected.filter(code=>current.some(c=>c.code===code));
  if(context.catalogAvailable!==false && parsed.changed && !out.cards && out.state.filters.category) {
    if(out.resume)out.reply='말씀하신 상품 조건을 반영했어요.\n'+out.reply;
    Object.assign(out,pageData(current,out.state));
  }
  if(parsed.changed&&selectedBefore.some(code=>!out.state.selected.includes(code)))out.reply+='\n바뀐 조건에 맞지 않는 상품은 담은 목록에서 뺐어요.';
  const unanswered = !!out.needsReview || (!!out.resume && !out.evidenceIds) || (!input.action && !out.requestSummary) || out.total===0;
  out = trackOutcome(out,intent,unanswered,context);
  if(out.handoff){delete out.sources;delete out.knowledgeEvidence;}
  // Price evidence is scoped to the current filters, never the entire catalog.
  const valid = cardsFor(catalog,out.state.filters);
  const evidence = valid.flatMap(c=>[c.brand,c.name,c.code,...c.plans.flatMap(p=>[String(p.months),...p.options.flatMap(o=>[String(o.fee),o.fee.toLocaleString('ko-KR')])])]).join(' ');
  const violations = inspectReply(out.reply,{intent,evidence:evidence+' '+(out.referenceEvidence||'')+' '+(out.knowledgeEvidence||''),candidateCount:valid.length});
  const invalidCards = out.cards?.some(c=>!valid.some(v=>v.code===c.code && JSON.stringify(v)===JSON.stringify(c)));
  if (violations.length || invalidCards) {
    if (out.outcome==='responded') out.state.quality.responded--;
    out = {...out,reply:SAFE_REPLY,cards:undefined,suggestions:[],handoff:true,resume:false,outcome:'blocked',blockedRules:violations.map(v=>v.rule)};
    delete out.cards;delete out.sources;delete out.knowledgeEvidence;
    out.state.quality.blocked++;
  }
  if(context.catalogAvailable!==false&&out.state.focusCode&&!valid.some(card=>card.code===out.state.focusCode))out.state.focusCode=null;
  if(out.cards)out.state.visibleCodes=out.cards.map(c=>c.code);
  delete out.referenceEvidence;
  return out;
}

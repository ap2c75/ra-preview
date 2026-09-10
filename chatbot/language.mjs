import {findBrand,findMaker,findCategory} from '/ra-preview/chatbot/catalog-language.mjs';
const digits={영:0,일:1,이:2,삼:3,사:4,오:5,육:6,칠:7,팔:8,구:9,한:1,두:2,세:3,네:4,다섯:5,여섯:6};
function numberOf(raw) {
 const t=raw.replace(/[\s,]/g,''); if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
 let total=0,section=0,n=0;
 for(const part of t.match(/\d+(?:\.\d+)?|[영일이삼사오육칠팔구한두세네십백천만]/g)||[]) {
  if(part==='만'){total+=(section+n||1)*10000;section=0;n=0;}
  else if('십백천'.includes(part)){section+=(n||1)*({십:10,백:100,천:1000}[part]);n=0;}
  else n=digits[part]??Number(part);
 }
 return total+section+n;
}
export function normalizeText(raw) {
 return String(raw||'').trim().slice(0,500).replace(/정슈기|정수긔/g,'정수기').replace(/언재|언졔/g,'언제').replace(/잇나요/g,'있나요')
  .replace(/(다섯|여섯|[영일이삼사오육칠팔구한두세네십백\d]+)\s*(년|개월)/g,(_,v,u)=>numberOf(v)+u)
  .replace(/([영일이삼사오육칠팔구십백천만\d.,]+(?:\s*[영일이삼사오육칠팔구십백천만\d.,]+)*)\s*원/g,(_,v)=>numberOf(v)+'원')
  // Remove explicitly declined service actions, not questions such as '해지 안 되나요?'.
  .replace(/(?:해지|환불|취소|반품)(?:는|은|를|을)?\s*(?:안\s*(?:할\s*거(?:고|예요)?|할게요|하겠어요|해요|합니다)|하지\s*않(?:을게요|아요|겠습니다)|말고)/g,' ');
}
const denied=/^(?:\s|은|는|이|가|을|를|도)*(?:말고|빼|제외|아니(?:고|라|에요|요|야)|아닌|필요\s*없|원하지\s*않|싫|안\s*(?:할|해|하)|하지\s*않)/;
function mentions(text,pattern,resolve) {
 const matches=[...text.matchAll(pattern)];
 return matches.map((m,i)=>({value:resolve(m[0]),negative:denied.test(text.slice(m.index+m[0].length,matches[i+1]?.index)),index:m.index})).filter(m=>m.value);
}
const unique=a=>[...new Set(a)];
const brandPattern=/코웨이|coway|삼성(?:전자)?|엘지|lg(?:전자)?|쿠쿠|cuckoo|ckoo|sk\s*매직|에스케이매직|skmagic|교원웰스|교원|웰스|wells|청호나이스|청호|chungho|세스코|cesco|동양매직|동양렌탈|bs렌탈|비에스렌탈|유버스|ubus|캐리어|carrier|루헨스|ruhens/gi;
export function interpret(text,previous) {
 const s=structuredClone(previous),patch={};let clarification=null;
 const modelTokens=[...text.matchAll(/(?<![a-z0-9])[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*(?![a-z0-9])/gi)].map(m=>m[0]).filter(v=>v.length>=4&&v.length<=40&&/[a-z]/i.test(v)&&/\d/.test(v));
 if(modelTokens.length>1)clarification='모델명이 여러 개 있어요. 먼저 찾을 모델명 하나를 알려주세요.';
 else if(modelTokens.length===1)patch.model=modelTokens[0].toUpperCase();
 if(/모델(?:명)?\s*(?:검색|조건)?\s*(?:해제|상관없)|전체\s*(?:상품|제품)/.test(text))patch.model=null;
 const brandHits=mentions(text,brandPattern,findBrand);
 const positives=unique(brandHits.filter(m=>!m.negative).map(m=>m.value));
 const negatives=unique(brandHits.filter(m=>m.negative).map(m=>m.value));
 const categories=mentions(text,/얼음\s*정수기|공기\s*청정기|정수기|비데|에어컨|안마의자|매트리스|커피머신|냉장고|세탁기|건조기/g,findCategory);
 const category=categories.filter(m=>!m.negative).at(-1)?.value || (!categories.length?findCategory(text):null);
 if(category)patch.category=category;
 if(category&&category!==s.filters.category){s.filters={};s.selected=[];s.preferences={};s.awaiting=null;s.visibleCodes=[];}
 if(brandHits.length){
  patch.excludedBrands=unique([...(s.filters.excludedBrands||[]),...negatives]).filter(b=>!positives.includes(b));
  if(positives.length){patch.brand=positives.length===1?positives[0]:null;patch.brands=positives.length>1?positives:[];patch.maker=null;s.preferences.brandAny=positives.length>1;}
  else {if(negatives.includes(s.filters.brand))patch.brand=null;patch.brands=(s.filters.brands||[]).filter(b=>!negatives.includes(b));s.preferences.brandAny=true;}
 }
 if(!brandHits.length){const maker=findMaker(text);if(maker){patch.maker=maker;patch.brand=null;patch.brands=[];s.preferences.brandAny=false;}}
 const terms=mentions(text,/\d+\s*(?:개월|년)/g,v=>Number(v.match(/\d+/)[0])*(v.includes('년')?12:1));
 const term=terms.filter(m=>!m.negative).at(-1)?.value;
 if(term){patch.term=term;s.preferences.termAny=false;}
 if(terms.some(m=>m.negative)){
  patch.excludedTerms=unique([...(s.filters.excludedTerms||[]),...terms.filter(m=>m.negative).map(m=>m.value)]).filter(v=>v!==term);
  if(!term&&patch.excludedTerms.includes(s.filters.term))patch.term=null;
 }
 const noPreference=/^(없어요|없어|없습니다|상관없어요|상관없어|아무거나(?:\s*(?:괜찮아요?|좋아요?|해주세요))?|아니요|아뇨|딱히요|딱히 없어요|아직\s*없어요|특별히\s*없어요)[.!~\s]*$/.test(text);
 const anyBrand=/브랜드.*(전체|상관없|없어|없습니다)|모든 브랜드/.test(text)||(s.awaiting==='brand'&&noPreference);
 const anyTerm=/약정.*(전체|상관없)/.test(text)||(s.awaiting==='term'&&noPreference);
 if(anyBrand){patch.brand=null;patch.maker=null;patch.brands=[];patch.excludedBrands=[];s.preferences.brandAny=true;}
 if(anyTerm){patch.term=null;patch.excludedTerms=[];s.preferences.termAny=true;}
 const ice=mentions(text,/얼음|아이스/g,()=>true);
 if(ice.length){const last=ice.at(-1);patch.feature=last.negative?null:'ice';patch.excludeIce=last.negative;}
 if(/얼음.*없이|일반\s*정수기/.test(text)){patch.feature=null;patch.excludeIce=true;}
 if(/관리\s*방식\s*(?:확인\s*보류|상관없|해제)/.test(text)){patch.care=null;patch.excludedCare=[];}
 const careHits=mentions(text,/방문\s*관리|자가\s*관리|자가|셀프/g,v=>/방문/.test(v)?'visit':'self');
 if(careHits.length){
  const care=careHits.filter(m=>!m.negative).at(-1);
  patch.excludedCare=unique([...(s.filters.excludedCare||[]),...careHits.filter(m=>m.negative).map(m=>m.value)]).filter(v=>v!==care?.value);
  if(care)patch.care=care.value;else if(patch.excludedCare.includes(s.filters.care))patch.care=null;
 }
 const moneyHits=mentions(text,/\d+(?:\.\d+)?\s*원/g,v=>Number(v.replace(/[^\d.]/g,'')));
 const positiveAmounts=moneyHits.filter(m=>!m.negative);
 if(moneyHits.length&&!positiveAmounts.length)clarification='제외할 금액은 확인했어요. 월요금 상한을 얼마로 바꿀까요?';
 if(positiveAmounts.length>1)clarification='금액이 여러 개 있어요. 월요금 상한을 하나로 알려주시겠어요?';
 const amount=positiveAmounts.length===1?[null,positiveAmounts[0].value]:null;
 if(amount){
  const value=Number(amount[1]);
  if(/낮춰|줄여|내려|올려|높여|늘려/.test(text)){
   if(!Number.isFinite(s.filters.budget))clarification='현재 예산이 정해지지 않았어요. 월요금 상한을 얼마로 잡을까요?';
   else {const next=s.filters.budget+(/낮춰|줄여|내려/.test(text)?-value:value);if(next<=0)clarification='조정한 예산이 너무 낮아요. 월요금 상한을 다시 알려주세요.';else patch.budget=next;}
  }else if(/원\s*(?:이하|이내|까지|안쪽|미만|아래)|(?:최대|상한)\s*\d+\s*원|원.{0,5}(?:넘지|안\s*넘)/.test(text))patch.budget=value-(/원\s*미만/.test(text)?1:0);
 }
 if(/예산.*(해제|상관없)|가격.*상관없/.test(text))patch.budget=null;
 if(!clarification){s.filters={...s.filters,...patch};if(Object.keys(patch).length)s.offset=0;}
 return {state:clarification?structuredClone(previous):s,patch:clarification?{}:patch,changed:!clarification&&Object.keys(patch).length>0,anyBrand,anyTerm,clarification};
}
export function referenceAction(text,visibleCodes=[]) {
 if(!/담아|담을|선택|빼|제외|비교|상담|진행|이걸로|할게|정했/.test(text))return null;
 const references=[...text.matchAll(/(첫|한|두|둘|세|셋|네|넷|\d+)\s*(?:번째|번)(?:\s*제품)?/g)],m=references.at(-1);
 if(!m)return /(?:그거|이거|저거|이걸로|아까\s*것).*(?:담아|선택|빼|상담|진행|할게)/.test(text)?{clarification:'어떤 제품인지 확인해 주세요. 상품 번호를 말씀하시거나 상품 카드의 상담 버튼을 눌러주세요.'}:null;
 const n=({첫:1,한:1,두:2,둘:2,세:3,셋:3,네:4,넷:4}[m[1]]??Number(m[1]));
 if(!visibleCodes[n-1])return {clarification:'현재 표시된 상품에 해당 번호가 없어요. 상품 목록의 번호를 다시 확인해 주세요.'};
 const tail=text.slice((m.index||0)+m[0].length);
 return {action:'select',code:visibleCodes[n-1],selectionMode:/빼|제외/.test(tail)?'remove':'add'};
}
const ordinalValue=raw=>({첫:1,한:1,두:2,둘:2,세:3,셋:3,네:4,넷:4}[raw]??Number(raw));
export function referenceDecision(text,{visibleCodes=[],selectedCodes=[],view='list'}={}) {
 if(view!=='compare'||selectedCodes.length<2)return null;
 const decisionCue=/(?:으로|걸로).{0,10}(?:할게|하자|해줘|선택|상담|진행)|(?:선택|상담|진행).{0,8}(?:할게|하자|해줘)|정했/.test(text);
 if(!decisionCue)return null;
 const pool=visibleCodes.length>=2?visibleCodes:selectedCodes;
 const ordinal=[...text.matchAll(/(첫|한|두|둘|세|셋|네|넷|\d+)\s*(?:번째|번)(?:\s*(?:상품|제품))?/g)].at(-1);
 if(ordinal){
  const n=ordinalValue(ordinal[1]);
  if(!pool[n-1])return {clarification:'현재 비교 중인 상품에 해당 번호가 없어요. 1번부터 비교 상품 번호를 다시 확인해 주세요.'};
  return {code:pool[n-1],codes:[...pool]};
 }
 const requestedMonths=Number(text.match(/(\d+)\s*개월/)?.[1])||null;
 const criterion=/방문\s*관리/.test(text)?'visit':/자가\s*관리|셀프\s*관리/.test(text)?'self':/싼|싸|저렴|낮은|가격|요금/.test(text)?'price':null;
 if(!criterion)return {clarification:'어느 상품인지 번호로 말씀해 주세요. 예: “1번으로 상담할게요.”'};
 return {criterion,requestedMonths,codes:[...pool]};
}
export function referenceComparison(text,{visibleCodes=[],selectedCodes=[],view='list'}={}) {
 const cue=/비교|차이|다르|달라|(?:둘|셋)\s*중|어느\s*(?:게|것)|뭐가\s*(?:더)?\s*(?:싼|싸|저렴|낮)|더\s*(?:싼|싸|저렴|낮)/.test(text);
 if(!cue)return null;
 const references=[...text.matchAll(/(첫|한|두|둘|세|셋|네|넷|\d+)\s*(?:번째|번)(?:\s*(?:상품|제품))?/g)];
 let codes=[];
 if(references.length){
  for(const match of references){
   const n=ordinalValue(match[1]);
   if(!visibleCodes[n-1])return {clarification:'현재 표시된 상품에 해당 번호가 없어요. 상품 목록의 번호를 다시 확인해 주세요.'};
   codes.push(visibleCodes[n-1]);
  }
  codes=[...new Set(codes)];
 } else if(view==='compare'&&visibleCodes.length>=2&&visibleCodes.length<=3) codes=[...visibleCodes];
 else if(selectedCodes.length>=2&&selectedCodes.length<=3) codes=[...selectedCodes];
 if(codes.length<2)return {clarification:'비교할 상품 두 개를 번호로 말씀해 주세요. 예: “1번이랑 2번 비교해줘.”'};
 const criterion=/방문\s*관리|자가\s*관리|셀프\s*관리|관리\s*방식|케어/.test(text)?'care':/혜택|프로모션|할인|지원금/.test(text)?'benefit':/약정|개월/.test(text)?'term':/싼|싸|저렴|낮|가격|요금|얼마/.test(text)?'price':'general';
 return {codes:codes.slice(0,3),criterion};
}
export function referenceQuestion(text,{visibleCodes=[],focusCode=null,selectedCodes=[]}={}) {
 const monthlyPrice=/(?:월\s*)?(?:가격|요금|렌탈료)|월\s*얼마/.test(text)||(/얼마/.test(text)&&!/설치비|등록비|배송비|위약금|해지|총\s*납입/.test(text));
 const topic=monthlyPrice?'price':/방문\s*관리|자가\s*관리|셀프\s*관리|관리\s*(?:방식|돼|되|가능)|케어/.test(text)?'care':/혜택|프로모션|할인|지원금/.test(text)?'benefit':/약정|(?:\d+|몇)\s*개월/.test(text)?'term':null;
 if(!topic)return null;
 const ordinal=[...text.matchAll(/(첫|한|두|둘|세|셋|네|넷|\d+)\s*(?:번째|번)(?:\s*(?:상품|제품))?/g)].at(-1);
 let code=null;
 if(ordinal){
  const n=ordinalValue(ordinal[1]);
  if(!visibleCodes[n-1])return {clarification:'현재 표시된 상품에 해당 번호가 없어요. 상품 목록의 번호를 다시 확인해 주세요.'};
  code=visibleCodes[n-1];
 } else if(/(?:그거|그건|그게|이거|이건|이게|저거|저건|아까\s*(?:것|상품|제품))/.test(text)) {
  code=focusCode||(selectedCodes.length===1?selectedCodes[0]:visibleCodes.length===1?visibleCodes[0]:null);
  if(!code)return {clarification:'어떤 상품인지 번호로 말씀해 주세요. 예: “두 번째 상품 월요금 알려줘.”'};
 } else if(focusCode&&/\d+\s*개월\s*(?:이면|은|는|일\s*때|으로는)/.test(text)) code=focusCode;
 if(!code)return null;
 const requestedMonths=Number(text.match(/(\d+)\s*개월/)?.[1])||null;
 return {code,topic,requestedMonths};
}
export const asksReason=text=>/왜.*(?:추천|제품|보여)|추천.*(?:이유|근거)|선정.*기준/.test(text);

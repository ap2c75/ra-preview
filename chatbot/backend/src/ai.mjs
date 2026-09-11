const ROUTES=['consultation','contact_change','catalog','faq','complaint','cancel','smalltalk','unknown'];
const PHONE=/(?:^|\D)01[016789][\s-]?\d{3,4}[\s-]?\d{4}(?:\D|$)/;
const EMAIL=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const ADDRESS=/(?:도로|로|길|번길|동|읍|면|리)\s*\d{1,5}(?:-\d{1,5})?(?:(?:으로|로|에|에서)?(?:\s|,|$))/;
export function cleanAiRequest(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_AI_REQUEST');
 const text=String(value.text||'').trim();
 if(!text||text.length>500)throw new Error('INVALID_AI_TEXT');
 if(PHONE.test(text)||EMAIL.test(text)||ADDRESS.test(text))throw new Error('PII_NOT_ALLOWED');
 const state=value.state&&typeof value.state==='object'&&!Array.isArray(value.state)?value.state:{};
 return {text,state:{category:cleanLabel(state.category),brand:cleanLabel(state.brand),term:Number.isFinite(Number(state.term))?Number(state.term):null,selectedCount:Math.max(0,Math.min(3,Number(state.selectedCount)||0)),awaiting:['contactPermission'].includes(state.awaiting)?state.awaiting:null}};
}
function cleanLabel(value){const text=String(value||'').trim();return /^[\p{L}\p{N} .·_-]{1,40}$/u.test(text)?text:null;}
export function normalizeAiResult(value){
 const route=ROUTES.includes(value?.route)?value.route:'unknown';
 const normalizedText=String(value?.normalizedText||'').trim().replace(/[\r\n]+/g,' ').slice(0,200);
 return {route,normalizedText,confidence:Math.max(0,Math.min(1,Number(value?.confidence)||0))};
}
export function outputText(response){
 for(const candidate of response?.candidates||[])for(const part of candidate?.content?.parts||[])if(typeof part?.text==='string')return part.text;
 return '';
}
const schema={type:'object',additionalProperties:false,required:['route','normalizedText','confidence'],properties:{route:{type:'string',enum:ROUTES},normalizedText:{type:'string',maxLength:200},confidence:{type:'number',minimum:0,maximum:1}}};
const instruction='당신은 한국 렌탈 상담 챗봇의 의도 분류기다. 고객 문장을 자연스러운 의미로 판단한다. 상담을 원하거나 자세한 내용을 사람에게 듣고 싶으면 consultation, 저장한 연락처 대신 다른 번호를 쓰거나 연락처 변경을 물으면 contact_change, 상품 탐색·추천·가격·브랜드·약정 조건이면 catalog, 렌탈 절차·설치·관리·소유권 같은 일반 질문이면 faq, 불만은 complaint, 해지·취소·환불은 cancel, 인사는 smalltalk, 그 외는 unknown으로 분류한다. normalizedText는 원문의 뜻을 보존한 짧은 한국어 문장으로 쓰며 사실·가격·혜택을 새로 만들지 않는다.';
export async function classifyWithAI(request,env,fetcher=fetch){
 if(!env.GEMINI_API_KEY)throw new Error('AI_NOT_CONFIGURED');
 const value=cleanAiRequest(request),model=env.GEMINI_MODEL||'gemini-2.5-flash-lite';
 const response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},contents:[{role:'user',parts:[{text:JSON.stringify(value)}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,temperature:0,maxOutputTokens:180}}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error(response.status===429?'AI_RATE_LIMITED':'AI_UPSTREAM_ERROR');
 const data=await response.json(),text=outputText(data);if(!text)throw new Error('AI_EMPTY_RESPONSE');
 return normalizeAiResult(JSON.parse(text));
}
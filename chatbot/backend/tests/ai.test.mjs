import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanAiRequest,classifyWithAI,normalizeAiResult,outputText} from '../src/ai.mjs';

test('AI request keeps only public conversation state',()=>{
 const value=cleanAiRequest({text:'상담으로 자세히 듣고 싶어요',state:{category:'정수기',brand:'코웨이',term:60,selectedCount:8,awaiting:'contactPermission',name:'고객'}});
 assert.deepEqual(value,{text:'상담으로 자세히 듣고 싶어요',state:{category:'정수기',brand:'코웨이',term:60,selectedCount:3,awaiting:'contactPermission'}});
});

test('AI request rejects direct customer identifiers',()=>{
 assert.throws(()=>cleanAiRequest({text:'010-1234-5678로 연락해줘'}),/PII_NOT_ALLOWED/);
 assert.throws(()=>cleanAiRequest({text:'test@example.com으로 보내줘'}),/PII_NOT_ALLOWED/);
 assert.throws(()=>cleanAiRequest({text:'테헤란로 123으로 와주세요'}),/PII_NOT_ALLOWED/);
});

test('Gemini classification uses structured output',async()=>{
 let sent;
 const fetcher=async(url,options)=>{
  sent={url,headers:options.headers,body:JSON.parse(options.body)};
  const modelResult={route:'contact_change',normalizedText:'상담 연락처를 변경하고 싶어요',confidence:0.98};
  const responseBody={
   candidates:[{
    content:{parts:[{text:JSON.stringify(modelResult)}]}
   }]
  };
  return new Response(JSON.stringify(responseBody),{status:200,headers:{'content-type':'application/json'}});
 };
 const result=await classifyWithAI({text:'저장한 번호 말고 다른 번호로 받고 싶어요',state:{selectedCount:1}},{GEMINI_API_KEY:'test-secret',GEMINI_MODEL:'gemini-2.5-flash-lite'},fetcher);
 assert.equal(result.route,'contact_change');assert.equal(result.confidence,0.98);
 assert.match(sent.url,/gemini-2\.5-flash-lite:generateContent$/);
 assert.equal(sent.body.generationConfig.responseMimeType,'application/json');
 assert.equal(sent.body.generationConfig.responseJsonSchema.type,'object');
 assert.deepEqual(sent.body.generationConfig.responseJsonSchema.required,['route','normalizedText','confidence']);
 assert.equal(sent.headers['x-goog-api-key'],'test-secret');
});

test('unknown AI output falls back safely',()=>{
 assert.deepEqual(normalizeAiResult({route:'invented',normalizedText:'x',confidence:4}),{route:'unknown',normalizedText:'x',confidence:1});
 assert.equal(outputText({candidates:[{content:{parts:[{text:'ok'}]}}]}),'ok');
});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialState,respond} from '../conversation.mjs';
import {createQualityRecorder} from '../quality-recorder.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../api/catalog.json',import.meta.url),'utf8')).products;
const context={catalogAvailable:true};
const send=(state,text)=>respond(state,{text},catalog,context);

const category=send(initialState(),'정수기');
assert.equal(category.state.filters.category,'정수기');
assert.match(category.reply,/선호하시는 브랜드/);

const recommended=send(category.state,'추천해주세요');
assert.equal(recommended.recommendation,true);
assert.equal(recommended.cards.length,3);
assert.equal(new Set(recommended.cards.map(card=>card.brand)).size,3);
assert.doesNotMatch(recommended.reply,/선호하시는 브랜드|약정 기간.*(?:알려|있으)/);

const direct=send(initialState(),'정수기 추천해주세요');
assert.equal(direct.cards.length,3);
assert.equal(new Set(direct.cards.map(card=>card.brand)).size,3);

const repaired=send(category.state,'왜 자꾸 같은 걸 물어봐?');
assert.equal(repaired.cards.length,3);
assert.match(repaired.reply,/같은 질문을 반복했네요/);
assert.doesNotMatch(repaired.reply,/선호하시는 브랜드/);

const firstNoMatch=send(category.state,'잘 모르겠는데요');
assert.deepEqual(firstNoMatch.suggestions,['추천해주세요','브랜드 상관없어요']);
assert.doesNotMatch(firstNoMatch.reply,/조금만 더 알려주시겠어요/);
const secondNoMatch=send(firstNoMatch.state,'그냥 잘 모르겠어요');
assert.equal(secondNoMatch.recommendation,true);
assert.equal(secondNoMatch.cards.length,3);
assert.match(secondNoMatch.reply,/선택 사항이라 건너뛰고/);

const selected=respond(recommended.state,{action:'select',code:recommended.cards[0].code},catalog,context);
assert.equal(selected.state.selected.length,1);
assert.equal(selected.recommendation,true);
assert.deepEqual(selected.cards.map(card=>card.code),recommended.cards.map(card=>card.code));

const ordinal=send(recommended.state,'첫 번째로 상담할게요');
assert.equal(ordinal.state.selected[0],recommended.cards[0].code);

const unresolvedOnce=send(category.state,'설치비 얼마예요?');
const unresolvedTwice=send(unresolvedOnce.state,'설치비가 얼마냐고요');
assert.equal(unresolvedTwice.handoff,true);
assert.match(unresolvedTwice.reply,/반복하지 않을게요/);

const corrected=send(category.state,'코웨이 말고 쿠쿠로 보여줘');
assert.equal(corrected.state.filters.brand,'쿠쿠');
assert.ok(corrected.state.filters.excludedBrands.includes('코웨이'));
assert.ok(corrected.cards.every(card=>card.brand==='쿠쿠'));

const combined=send(category.state,'브랜드는 없어요. 그냥 추천해주세요');
assert.equal(combined.cards.length,3);
assert.doesNotMatch(combined.reply,/선호하시는 브랜드/);

const naturalNoPreference=send(category.state,'아무거나 괜찮아요');
assert.doesNotMatch(naturalNoPreference.reply,/선호하시는 브랜드/);
assert.equal(naturalNoPreference.state.preferences.brandAny,true);

const secondOrdinal=send(recommended.state,'그럼 두 번째로 할게요');
assert.equal(secondOrdinal.state.selected[0],recommended.cards[1].code);

const correctedOrdinal=send(recommended.state,'첫 번째 말고 두 번째로 상담할게요');
assert.equal(correctedOrdinal.state.selected[0],recommended.cards[1].code);

const typo=send(initialState(),'정슈기 추천해줘');
assert.equal(typo.state.filters.category,'정수기');
assert.equal(typo.cards.length,3);

const changedCategory=send(recommended.state,'비데로 바꿔줘');
assert.equal(changedCategory.state.filters.category,'비데');
assert.deepEqual(changedCategory.state.selected,[]);
assert.deepEqual(changedCategory.state.recommendedCodes,[]);

const quality=createQualityRecorder();
quality.add({reason:'의도 오인식',userText:'제 번호는 010-1234-5678이고 정수기 추천',assistantText:'알겠습니다.',context:{filters:['정수기'],awaiting:'brand',selectedCount:0}});
const qualityText=quality.exportText();
assert.doesNotMatch(qualityText,/010-1234-5678/);
assert.match(qualityText,/\[전화번호\]/);
assert.match(qualityText,/의도 오인식/);
quality.clear();
assert.equal(quality.all().length,0);

console.log('conversation regression: 17 scenarios / 40 assertions passed');


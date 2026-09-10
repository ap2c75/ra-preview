import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialState,respond} from '../conversation.mjs';
import {createQualityRecorder} from '../quality-recorder.mjs';
import {createTurnHistory,isUndoRequest} from '../turn-history.mjs';
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
assert.ok(direct.cards.every(card=>/정수기|이온수기/.test(card.name)));
assert.ok(direct.cards.every(card=>!/조리수기/.test(card.name)));

const airRecommendation=send(initialState(),'공기청정기 추천해주세요');
assert.equal(airRecommendation.cards.length,3);
assert.equal(new Set(airRecommendation.cards.map(card=>card.brand)).size,3);
assert.ok(airRecommendation.cards.every(card=>/공기\s*청정기|공청기|에어\s*퓨리파이어/i.test(card.name)));

const bidetRecommendation=send(initialState(),'비데 추천해주세요');
assert.equal(bidetRecommendation.cards.length,3);
assert.equal(new Set(bidetRecommendation.cards.map(card=>card.brand)).size,3);
assert.ok(bidetRecommendation.cards.every(card=>/비데/.test(card.name)));

const cuckooRecommendation=send(initialState(),'쿠쿠 정수기 추천해줘');
assert.equal(cuckooRecommendation.state.filters.brand,'쿠쿠');
assert.ok(cuckooRecommendation.cards.length>0);
assert.ok(cuckooRecommendation.cards.every(card=>card.brand==='쿠쿠'));
assert.doesNotMatch(cuckooRecommendation.reply,/서로 다른 브랜드/);

const lgRecommendation=send(initialState(),'엘지 공기청정기 추천해줘');
assert.equal(lgRecommendation.state.filters.brand,'엘지');
assert.ok(lgRecommendation.cards.length>0);
assert.ok(lgRecommendation.cards.every(card=>card.brand==='엘지'));

const combinedConditions=send(initialState(),'정수기 월 2만원 안 넘고 방문관리 되는 걸로 추천해줘');
assert.equal(combinedConditions.state.filters.category,'정수기');
assert.equal(combinedConditions.state.filters.care,'visit');
assert.equal(combinedConditions.state.filters.budget,20000);
assert.equal(combinedConditions.cards.length,3);
assert.ok(combinedConditions.cards.every(card=>card.plans.some(plan=>plan.options.some(option=>option.fee<=20000&&option.care==='방문관리'))));

const noResultRecovery=send(initialState(),'쿠쿠 정수기 60개월 월 1000원 이하로 추천해줘');
assert.equal(noResultRecovery.cards.length,0);
assert.match(noResultRecovery.reply,/월 1,000원 상한을 풀면/);
assert.deepEqual(noResultRecovery.suggestions,['예산 해제']);
const recoveredBudget=send(noResultRecovery.state,'예산 해제');
assert.ok(recoveredBudget.cards.length>0);
assert.ok(recoveredBudget.cards.every(card=>card.brand==='쿠쿠'));

const alternateByText=send(direct.state,'다른 거 보여줘');
assert.equal(alternateByText.recommendation,true);
assert.equal(alternateByText.cards.length,3);
assert.ok(alternateByText.cards.every(card=>!direct.cards.some(previous=>previous.code===card.code)));
assert.equal(new Set(alternateByText.cards.map(card=>card.brand)).size,3);

const cheaperByText=send(direct.state,'좀 더 싼 걸로 보여줘');
assert.equal(cheaperByText.state.sort,'priceAsc');
assert.equal(cheaperByText.cards.length,3);
assert.ok(cheaperByText.cards.every(card=>!/조리수기/.test(card.name)));

const iceRecommendation=send(initialState(),'얼음정수기 추천해줘');
const withoutIce=send(iceRecommendation.state,'얼음 없는 걸로 바꿔줘');
assert.equal(withoutIce.state.filters.feature,null);
assert.equal(withoutIce.state.filters.excludeIce,true);
assert.ok(withoutIce.cards.length>0);
assert.ok(withoutIce.cards.every(card=>!/얼음|아이스/i.test(card.name)));

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

const secondPrice=send(recommended.state,'두 번째는 얼마예요?');
assert.equal(secondPrice.state.focusCode,recommended.cards[1].code);
assert.match(secondPrice.reply,new RegExp(recommended.cards[1].name));
assert.match(secondPrice.reply,/36개월 월 16,900~18,900원/);
const focusedTerm=send(secondPrice.state,'60개월이면요?');
assert.equal(focusedTerm.state.focusCode,recommended.cards[1].code);
assert.match(focusedTerm.reply,/60개월 월 12,900~14,900원/);
const focusedCare=send(focusedTerm.state,'그건 방문관리 돼요?');
assert.equal(focusedCare.state.focusCode,recommended.cards[1].code);
assert.match(focusedCare.reply,/방문관리 옵션이 등록되어 있어요/);
const ambiguousReference=send(recommended.state,'그건 얼마예요?');
assert.match(ambiguousReference.reply,/어떤 상품인지 번호로/);
assert.equal(ambiguousReference.needsReview,true);
const benefitReference=send(recommended.state,'세 번째 혜택은 뭐예요?');
assert.equal(benefitReference.state.focusCode,recommended.cards[2].code);
assert.match(benefitReference.reply,/등록된 혜택|별도 혜택 문구/);

const recommendationReason=send(recommended.state,'왜 이 제품들을 추천했어요?');
assert.equal(recommendationReason.recommendation,true);
assert.deepEqual(recommendationReason.cards.map(card=>card.code),recommended.cards.map(card=>card.code));
assert.match(recommendationReason.reply,/카테고리에 정확히 맞는 상품|등록 할인·혜택과 월요금/);
const firstRecommendationReason=send(recommended.state,'1번을 추천한 이유가 뭐예요?');
assert.ok(firstRecommendationReason.reply.includes(recommended.cards[0].name));
assert.ok(!firstRecommendationReason.reply.includes(recommended.cards[1].name));

const visibleBenefitComparison=send(recommended.state,'셋 중 혜택 좋은 건 뭐예요?');
assert.equal(visibleBenefitComparison.comparison,true);
assert.equal(visibleBenefitComparison.cards.length,3);
assert.match(visibleBenefitComparison.reply,/등록된 혜택 문구를 비교/);
const visiblePriceComparison=send(recommended.state,'셋 중 월요금 가장 싼 건?');
assert.equal(visiblePriceComparison.comparison,true);
assert.equal(visiblePriceComparison.cards.length,3);
assert.match(visiblePriceComparison.reply,/번이 낮음|동일/);
const visibleGeneralComparison=send(recommended.state,'세 개 차이를 알려줘');
assert.equal(visibleGeneralComparison.comparison,true);
assert.equal(visibleGeneralComparison.cards.length,3);

const directComparison=send(recommended.state,'1번이랑 2번 비교해줘');
assert.equal(directComparison.comparison,true);
assert.deepEqual(directComparison.state.selected,[recommended.cards[0].code,recommended.cards[1].code]);
assert.deepEqual(directComparison.cards.map(card=>card.code),directComparison.state.selected);
assert.match(directComparison.reply,/같은 약정끼리/);
const cheaperFollowup=send(directComparison.state,'둘 중 싼 건?');
assert.equal(cheaperFollowup.comparison,true);
assert.deepEqual(cheaperFollowup.cards.map(card=>card.code),directComparison.cards.map(card=>card.code));
assert.match(cheaperFollowup.reply,/번이 낮음|→ 동일/);
const careComparison=send(cheaperFollowup.state,'관리 방식은 뭐가 달라?');
assert.equal(careComparison.comparison,true);
assert.match(careComparison.reply,/등록된 관리 방식/);
const ambiguousComparison=send(recommended.state,'둘 중 싼 건?');
assert.equal(ambiguousComparison.needsReview,true);
assert.match(ambiguousComparison.reply,/비교할 상품 두 개를 번호로/);
assert.equal(ambiguousComparison.state.sort,'default');
const unavailableComparison=respond(recommended.state,{text:'1번이랑 2번 비교해줘'},catalog,{catalogAvailable:false});
assert.equal(unavailableComparison.catalogUnavailable,true);
assert.match(unavailableComparison.reply,/상품 자료를 확인하지 못해/);
const explicitDecision=send(directComparison.state,'그럼 1번으로 상담할게요');
assert.deepEqual(explicitDecision.state.selected,[directComparison.cards[0].code]);
assert.equal(explicitDecision.state.view,'list');
assert.equal(explicitDecision.cards.length,1);
assert.match(explicitDecision.reply,new RegExp(directComparison.cards[0].name));
const priceDecision=send(directComparison.state,'그럼 싼 걸로 할게요');
const commonDecisionTerm=directComparison.cards[0].plans.map(plan=>plan.months).find(months=>directComparison.cards.every(card=>card.plans.some(plan=>plan.months===months)));
const expectedPriceCode=directComparison.cards.map(card=>({code:card.code,min:card.plans.find(plan=>plan.months===commonDecisionTerm).min})).sort((a,b)=>a.min-b.min)[0].code;
assert.equal(priceDecision.state.selected[0],expectedPriceCode);
assert.match(priceDecision.reply,/등록 월요금 하한에서 더 낮게/);
assert.equal(priceDecision.cards.length,1);
const careDecision=send(directComparison.state,'방문관리 되는 걸로 할게요');
assert.equal(careDecision.needsReview,true);
assert.match(careDecision.reply,/가능한 상품이 여러 개|상품 번호를 하나/);
const ambiguousDecision=send(directComparison.state,'그럼 이걸로 할게요');
assert.equal(ambiguousDecision.needsReview,true);
assert.match(ambiguousDecision.reply,/어느 상품인지 번호로/);
const invalidDecision=send(directComparison.state,'3번으로 상담할게요');
assert.equal(invalidDecision.needsReview,true);
assert.match(invalidDecision.reply,/현재 비교 중인 상품에 해당 번호가 없어요/);

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

const repairedByFeedback=respond(category.state,{action:'repairRepeat'},catalog,context);
assert.equal(repairedByFeedback.cards.length,3);
assert.equal(repairedByFeedback.recommendation,true);
assert.doesNotMatch(repairedByFeedback.reply,/선호하시는 브랜드/);

const misreadRecovery=respond(recommended.state,{action:'repairMisread'},catalog,context);
assert.equal(misreadRecovery.state.filters.category,'정수기');
assert.match(misreadRecovery.reply,/바꾸려는 부분만/);

const insufficientRecovery=respond(recommended.state,{action:'repairInsufficient'},catalog,context);
assert.ok(insufficientRecovery.suggestions.includes('월요금 낮은 순'));
assert.equal(insufficientRecovery.state.filters.category,'정수기');
const sortedAfterRecovery=send(insufficientRecovery.state,'월요금 낮은 순');
assert.equal(sortedAfterRecovery.state.sort,'priceAsc');

const alternateRecommendation=respond(recommended.state,{action:'repairRecommendation'},catalog,context);
assert.equal(alternateRecommendation.recommendation,true);
assert.ok(alternateRecommendation.cards.length>0);
assert.ok(alternateRecommendation.cards.every(card=>!recommended.cards.some(previous=>previous.code===card.code)));
assert.equal(new Set(alternateRecommendation.cards.map(card=>card.brand)).size,alternateRecommendation.cards.length);

assert.equal(isUndoRequest('방금 선택 취소해줘'),true);
assert.equal(isUndoRequest('이전 조건으로 돌아가자'),true);
assert.equal(isUndoRequest('정수기 추천해줘'),false);
const history=createTurnHistory({limit:2});
assert.equal(history.checkpoint(recommended.state,secondPrice.state),false);
assert.equal(history.checkpoint(initialState(),category.state),true);
assert.equal(history.checkpoint(category.state,recommended.state),true);
const undoRecommendation=history.undo(recommended.state);
assert.equal(undoRecommendation.restored,true);
assert.deepEqual(undoRecommendation.state.filters,category.state.filters);
const undoResult=respond(recommended.state,{action:'undo',restoreState:undoRecommendation.state,undoAvailable:true},catalog,context);
assert.equal(undoResult.state.filters.category,'정수기');
assert.deepEqual(undoResult.state.recommendedCodes,[]);
assert.match(undoResult.reply,/바로 전 조건으로/);
const noUndo=respond(initialState(),{action:'undo',restoreState:initialState(),undoAvailable:false},catalog,context);
assert.match(noUndo.reply,/되돌릴 조건 변경이 없어요/);

console.log('conversation regression: 55 scenarios / 151 assertions passed');


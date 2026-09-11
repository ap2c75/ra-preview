import {interpret,normalizeText} from './language.mjs';
import {browseRequest} from './browse.mjs';
import {rentalFaqReply} from './rental-faq.mjs';
// Site snapshots are reference data, never an approval or live quote.
const BASE='https://rentalagit-preview.pages.dev';
const fmt=n=>Number.isFinite(n)?n.toLocaleString('ko-KR')+'원':'확인 필요';
const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const aliases=[['skbSaving',/sk\s*브로드밴드\s*알뜰|skb\s*알뜰|요즘\s*우리\s*결합/i],['skylife',/스카이\s*라이프|skylife/i],['hellovision',/헬로\s*비전|hellovision/i],['dlive',/딜라이브|dlive/i],['hcn',/hcn|에이치씨엔/i],['kt',/\bkt\b|케이티/i],['lg',/\blg\b|엘지|유플러스/i],['skt',/\bsk(?:t|b)?\b|에스케이/i]];
const carrierTokens=/sk\s*브로드밴드\s*알뜰|skb\s*알뜰|요즘\s*우리\s*결합|(?:KT\s*)?스카이\s*라이프|skylife|(?:LG\s*)?헬로\s*비전|hellovision|딜라이브|dlive|(?:KT\s*)?hcn|에이치씨엔|\bkt\b|케이티|\blg\b|엘지|유플러스|\bsk(?:t|b)?\b|에스케이/gi;
const negativeTail=/^(?:\s|은|는|이|가|을|를|도|으로|로|인터넷|통신사)*(?:말고|아니(?:고|라|에요|요)|제외|빼)/;
function choices(text,pattern,resolve){const m=[...text.matchAll(pattern)];return m.map((x,i)=>({value:resolve(x),negative:negativeTail.test(text.slice(x.index+x[0].length,m[i+1]?.index))}));}
function carrierChoices(text){
 // A phone's carrier is a different slot from the requested fixed-line carrier.
 if(/휴대폰|핸드폰/.test(text)&&/인터넷(?:은|는)/.test(text))text=text.slice(text.search(/인터넷(?:은|는)/));
 return choices(text.replace(/SK\s*매직/gi,''),carrierTokens,m=>aliases.find(([,r])=>r.test(m[0]))?.[0]).filter(x=>x.value);
}
const evidence=rows=>JSON.stringify(rows)+' '+rows.flatMap(row=>Object.values(row).filter(v=>typeof v==='number').flatMap(n=>[String(n),n.toLocaleString('ko-KR')])).join(' ');
export function siteReferenceReply(previous,text,data,now=Date.now()){
 text=normalizeText(text);
 if(!data||!Array.isArray(data.carriers)||!Array.isArray(data.products))return null;
 const siteGeneral=[
 [/소문.*(?:어떤|무슨|역할)|계약.*(?:상대|누구|어디)|상담.*(?:신청|접수).*(?:계약|가입).*(?:되|체결)/,'사이트에서는 소문이 상담 접수와 안내를 맡고, 실제 렌탈 계약 상대방은 렌탈사라고 안내합니다. 고객정보 접수만으로 렌탈 계약이 체결되지는 않아요.','/apply'],
 [/사이트.*(?:총액|총\s*납입)|총\s*납입.*(?:계산|카드|포함)/,'사이트 계산기는 월 납입료와 계약기간을 기준으로 총액을 표시하고 제휴카드 할인을 총액에 반영하지 않는다고 안내합니다. 설치비·등록비 등 추가 비용과 실제 납부 일정은 계약 전에 별도로 확인해야 해요.','/notice'],
 [/해지.*(?:서식|접수처|처리\s*기간)|취소.*서식/,'사이트의 해지 접수처·서식·처리기간은 렌탈사 원문 확인 후 게시할 항목으로 표시되어 있어요. 현재 등록된 서식이나 처리기간을 확정해서 드릴 수 없습니다. 계약한 렌탈사의 접수처를 확인해 주세요.','/cancel'],
 [/사이트.*(?:최저|카드\s*가격|가격.*다르)|카드\s*할인가.*(?:뜻|왜|기준)/,'사이트 목록의 낮은 요금은 상품에 등록된 특정 약정·관리 조건의 금액일 수 있어요. 제휴카드 할인가에는 실적 등 별도 조건이 붙습니다. 상품 상세의 기본 월요금과 약정, 관리 방식, 카드 조건을 함께 확인해 주세요.','/electronics']
 ];
 const general=siteGeneral.find(([pattern])=>pattern.test(text));if(general)return {state:structuredClone(previous),reply:general[1],requestSummary:'사이트 이용 안내',siteSources:[{label:'고객 사이트 안내',url:BASE+general[2]}],needsReview:true,suggestions:[]};
 if(/개인정보|정보.*삭제|동의|상담|연락|전화\s*(?:해|주|언제)|사람.*연결/.test(text))return null;
 const s=structuredClone(previous),st=s.siteInternet||{},carrierHits=carrierChoices(text),carriers=[...new Set(carrierHits.filter(x=>!x.negative).map(x=>x.value))],carrier=carriers.length===1?carriers[0]:null;
 const appliance=/정수기|공기청정기|비데|냉장고|세탁기|매트리스|안마|에어컨/.test(text);
 const modelMatches=/인터넷|통신사|셋톱|메가|기가|\b\d+(?:M|G)\b/i.test(text)?[]:data.products.filter(p=>p.model&&key(p.model).length>=4&&key(text).includes(key(p.model)));
 const internet=!appliance&&!modelMatches.length&&(/인터넷|통신사|셋톱|와이파이|스카이라이프|헬로비전|딜라이브|hcn/i.test(text)||carrier||s.siteInternet&&/^(?:\s|\d|기가|메가|g|m|tv|티비|단독|포함|미결합|결합|사은품형|요금할인형|휴대폰|1대|인터넷|요금|월|얼마|설치비|공유기|채널|베이직|스탠다드|프리미엄|UHD|HD|약정|년|개월|해지|위약금|카드|사은품|지급|언제|주세요|으로|은|는|이|가|요|부터|없|안|할|해|돼|되|\?|\.)/i.test(text));
 const sources=path=>[{label:'고객 사이트 원문',url:BASE+path}];
 const make=(reply,summary,extra={})=>({state:s,reply,requestSummary:summary,siteSources:sources('/internet'),needsReview:true,suggestions:[],...extra});
 const stale=!Number.isFinite(Date.parse(data.collectedAt))||now-Date.parse(data.collectedAt)>7*86400000;
 if(internet){
  delete s.siteProduct;
  if(carriers.length>1)return make('통신사 비교는 같은 속도·TV 구성·결합 자격으로 맞춰야 해요. '+carriers.map(code=>data.carriers.find(c=>c.code===code)?.name||code).join(' · ')+'를 비교할 대상으로 확인했어요. 아직 한 곳을 선택하지 않았습니다. 먼저 조회할 통신사 하나를 골라 주세요.','인터넷 비교 조건',{suggestions:carriers.map(code=>data.carriers.find(c=>c.code===code)?.name+' 인터넷')});
  s.siteInternet={...st};const f=s.siteInternet;
  if(carrier&&carrier!==st.carrier){f.carrier=carrier;delete f.combine;delete f.tv;}
  else if(!carrier&&carrierHits.some(x=>x.negative&&x.value===f.carrier))delete f.carrier;
  const c=data.carriers.find(c=>c.code===f.carrier);
  if(stale)return make('수집한 사이트 자료가 오래되어 금액과 조건 안내를 보류했어요. 원문에서 최신 정보를 확인해 주세요.','사이트 자료 재확인');
  if(/광랜|케이블|대칭|비대칭/.test(text)&&/차이|비교|망|대칭/.test(text))return make('광랜·케이블 등 망 종류는 설치 주소와 통신사에 따라 확인해야 해요. 망 종류가 다른 요금을 같은 조건으로 비교할 수는 없습니다. 어떤 망을 조회할지와 설치 가능 여부 확인이 필요합니다.','인터넷 망 종류 확인');
  if(/채널/.test(text))return make('채널 편성과 스포츠 채널 포함 여부는 선택한 TV 상품의 최신 채널표 확인이 필요해요. 현재 자료에 채널 편성표가 없어 시청 가능하다고 확정할 수 없습니다.','TV 채널 확인');
  if(/취소|해지|반환|환수|위약금/.test(text))return make('인터넷 해지는 통신사 계약과 사은품 지급 조건을 함께 확인해야 해요. 사이트에 반환 조건 안내가 있지만 적용 기간이 확인되지 않아 지금 계약의 반환액을 확정할 수 없습니다. 계약한 통신사의 약정과 접수처를 확인해 주세요.','인터넷 해지 조건',{siteSources:sources('/internet')});
  if(/사은품.*(?:언제|지급|입금|보장|이번\s*주|다음\s*주|오늘|내일|받을|받아)|(?:언제|당일).*(?:사은품|입금)|지급.*(?:시기|방법)/.test(text))return make('사이트에 사은품 지급 시기·지급 방법·지급 보장 정책이 등록되어 있지 않아 확정해서 안내드릴 수 없어요. 신청할 요금제의 지급 조건을 담당자에게 확인해야 합니다.','인터넷 사은품 지급');
  if(/몇\s*년|약정.*(?:기간|기준)|1\s*년/.test(text)&&!c)return make('사이트의 기본 인터넷 요금표는 3년 약정 기준입니다. 별도 약정이 있는 통신사는 그 조건을 구분해야 하며, 현재 적용 가능 여부는 확인이 필요해요.','인터넷 약정 기준');
  if(!c)return make('인터넷·TV는 '+data.carriers.map(c=>c.name).join(', ')+'의 등록 자료를 확인할 수 있어요. 어느 통신사부터 볼까요?\n요금과 혜택은 사이트 등록 기준이며 현재 적용 여부는 확인이 필요합니다.','인터넷 통신사 선택',{suggestions:data.carriers.slice(0,4).map(c=>c.name+' 인터넷')});
  const origin={siteSources:sources('/internet/'+c.code)};
  if(/설치비|설치.*비용|주말.*비용/.test(text)){const rows=c.install;return make(c.name+' 사이트 등록 설치비입니다.\n'+rows.map(r=>r.item+': 평일 '+fmt(r.weekday_fee)+' / 주말 '+fmt(r.weekend_fee)+(r.note?' · '+r.note:'')).join('\n')+'\n평일·주말 기준 설치비이며 적용 기간과 현장 조건에 따른 추가 비용은 별도 확인이 필요합니다.','인터넷 설치비',{...origin,siteEvidence:evidence(rows)});}
  if(/공유기|셋톱|부가세|vat|포함.*(?:요금|금액)/i.test(text)){const rows=c.options.filter(o=>/셋톱/.test(text)?/SETTOP|셋톱/i.test(o.option_group+' '+o.option_name):/공유기|와이파이/.test(text)?/WIFI|ROUTER|공유기|와이파이/i.test(o.option_group+' '+o.option_name):false);return make(c.name+' 사이트 안내: '+c.feeNote+(rows.length?'\n등록된 선택 옵션\n'+rows.map(o=>[o.option_name,fmt(o.monthly_fee),o.speed_condition,o.option_desc].filter(Boolean).join(' · ')).join('\n'):'')+'\n선택 옵션 금액을 기본 요금에 무조건 더하는 것은 아닙니다. 포함 여부와 현재 적용 조건을 확인해야 해요.','인터넷 요금 포함 항목',{...origin,siteEvidence:evidence(rows)+' '+c.feeNote});}
  if(/제휴\s*카드|카드.*할인|전월.*실적/.test(text))return make(c.name+' 사이트에 등록된 제휴카드 조건입니다.\n'+c.cards.map(r=>[r.issuer,r.card_name,r.spend_condition,'할인 '+fmt(r.discount_amount),r.period_note].filter(Boolean).join(' · ')).join('\n')+'\n렌탈료 자체의 할인과 카드 청구 할인은 다릅니다. 현재 발급·적용 가능 여부는 카드사 확인이 필요합니다.','인터넷 제휴카드',{...origin,siteEvidence:evidence(c.cards)});
  if(/(?:휴대폰|핸드폰).*(?:쓰|사용)/.test(text)&&/인터넷(?:은|는)/.test(text))return make(c.name+' 인터넷을 알아보시는군요. 휴대폰 통신사와 신청할 인터넷 통신사는 따로 확인했어요. 결합 할인 적용 여부는 별도 확인이 필요합니다. 인터넷 단독과 인터넷+TV 중 어떤 구성을 원하세요?','인터넷 구성 확인',{...origin,suggestions:['인터넷 단독','인터넷+TV']});
  if(/결합.*(?:종류|뭐|혜택|조건|어떻게)|휴대폰.*(?:요금제|쓰|사용)/.test(text))return make(c.name+' 사이트에 등록된 결합 안내입니다.\n'+c.bundles.map(r=>r.bundle_name+': '+r.condition_text+' / '+r.benefit_text).join('\n')+'\n결합 자격과 실제 할인은 통신사 확인이 필요해요. 휴대폰 통신사만으로 적용을 확정하지 않습니다.','인터넷 결합 조건',{...origin,siteEvidence:evidence(c.bundles)});
  if(/tv\s*(?:없이|빼|안)|인터넷\s*단독/i.test(text)){f.bundle='INTERNET';delete f.tv;}
  else if(/tv\s*단독/i.test(text))f.bundle='TV';
  else if(/tv|티비|티브이/i.test(text))f.bundle='INTERNET_TV';
  const speedHits=choices(text,/(100|160|200|320|500)\s*(?:m|메가)|1\s*(?:g|기가)/gi,m=>m[1]?m[1]+'M':'1G');
  const speeds=[...new Set(speedHits.filter(x=>!x.negative).map(x=>x.value))];
  if(speeds.length>1)return make('속도가 여러 개 있어요. 조회할 인터넷 속도를 하나로 골라 주세요.','인터넷 속도 확인',origin);
  if(speeds.length)f.speed=speeds[0];
  else if(speedHits.some(x=>x.negative&&x.value===f.speed))delete f.speed;
  if(/^(100|160|200|320|500)$/.test(text.trim())&&c.speeds.includes(text.trim()+'M'))f.speed=text.trim()+'M';
  if(/미결합|결합\s*(?:없|안)|결합하지/.test(text))f.combine='NONE';
  else if(/사은품형/.test(text))f.combine='GIFT_TYPE';else if(/요금할인형/.test(text))f.combine='RATE_DISCOUNT_TYPE';
  else if(/요즘.*결합/.test(text))f.combine='YOZUM';else if(/1\s*대\s*결합|휴대폰\s*결합/.test(text))f.combine='MOBILE_1';
  const exactCombine=c.combines.find(x=>key(x.label)===key(text));if(exactCombine)f.combine=exactCombine.state;
  if(text.trim()==='기가'&&c.speeds.includes('기가'))f.speed='기가';
  const term=text.match(/([123])\s*년/);if(term)f.term=Number(term[1]);
  if(!f.bundle)return make(c.name+'의 어떤 구성을 볼까요? 인터넷 단독과 인터넷+TV는 별도 요금입니다.','인터넷 구성 확인',{...origin,suggestions:['인터넷 단독','인터넷+TV','TV 단독']});
  if(!f.speed&&f.bundle!=='TV')return make('원하는 인터넷 속도를 골라 주세요. '+c.speeds.join(' · ')+'가 사이트에 등록되어 있어요.','인터넷 속도 확인',{...origin,suggestions:c.speeds.map(x=>x)});
  if(!f.combine&&c.combines.length>1)return make('결합 조건에 따라 요금이 달라요. 사이트의 '+c.combines.map(x=>x.label).join(' / ')+' 중 어떤 조건을 볼까요?','인터넷 결합 확인',{...origin,suggestions:c.combines.map(x=>x.label)});
  const tvNames=[...new Set(c.offers.map(r=>r.tv_product_name).filter(Boolean))];const selectedTv=tvNames.find(name=>key(text).includes(key(name)));if(selectedTv)f.tv=selectedTv;
  const rows=c.offers.filter(r=>(!f.tv||r.tv_product_name===f.tv)&&r.bundle_type===f.bundle&&(!f.speed||r.speed_label===f.speed)&&(!f.combine||r.combine_state===f.combine)&&(!f.term||r.contract_years===f.term));
  if(!rows.length)return make('선택한 구성·속도·결합·약정과 일치하는 등록 요금이 없어요. 다른 조건으로 다시 확인해 주세요.','인터넷 조건 불일치',{...origin,suggestions:['인터넷 단독','인터넷+TV']});
  if(stale)return make('수집한 요금표가 오래되어 금액 안내를 보류했어요. 원문에서 최신 요금과 혜택을 확인해 주세요.','인터넷 자료 재확인',origin);
  const selected=rows.slice(0,4);
  return make(c.name+' · 사이트 등록 요금 ('+data.asOf+' 기준)\n'+selected.map(r=>[r.speed_label,r.bundle_type==='INTERNET'?'인터넷 단독':r.tv_product_name||r.bundle_type,r.access_network,r.combine_state_label,r.contract_years?r.contract_years+'년 약정':null,'월 '+fmt(r.monthly_fee),'포함 '+r.fee_includes.map(x=>x==='VAT'?'부가세':x).join('·'),'사은품 '+(r.gift_masked||!Number.isFinite(r.gift_cash)?'확인 필요':fmt(r.gift_cash))].filter(Boolean).join(' · ')).join('\n')+(rows.length>4?'\n일치하는 '+rows.length+'개 조건 중 앞의 4개입니다. 전체 조건은 원문에서 확인해 주세요.':'')+'\n선택한 조건에 표시된 포함 항목만 적용합니다. 공유기·셋톱 추가 선택 비용은 별도 확인이 필요해요.\n현재 적용 기간이 확인되지 않은 등록 정보입니다. 확정 견적·지급 보장이 아니며 설치비와 추가 옵션은 별도 확인이 필요해요.','인터넷 등록 요금',{...origin,siteEvidence:evidence(rows)+' '+data.asOf+' '+c.feeNote+' '+rows.length+' '+selected.length});
 }
 // Exact model lookup exposes the complete source conditions without replacing reviewed catalog data.
 const longest=Math.max(0,...modelMatches.map(p=>key(p.model).length));
 const matches=modelMatches.filter(p=>key(p.model).length===longest);
 if(matches.length){
  delete s.siteInternet;
  const p=matches[0],link=BASE+'/p?sku='+encodeURIComponent(p.sku);
  if(matches.length>1)return make('모델 표기가 겹치는 상품이 '+matches.length+'개 있어요. 브랜드와 정확한 모델명을 확인해 주세요.','사이트 모델 확인',{siteSources:[{label:'상품 목록',url:BASE+'/electronics'}]});
  const detail=(reply,rows=[])=>make(p.brand+' '+p.name+' · '+p.model+'\n'+reply+'\n사이트 등록 기준이며 현재 적용 여부와 계약별 조건은 원문 확인이 필요합니다.','사이트 모델 자료',{siteSources:[{label:'해당 상품 원문',url:link}],siteEvidence:evidence(rows)+' '+JSON.stringify(p)});
  if(stale)return detail('수집 자료가 오래되어 금액과 계약 조건 안내를 보류했어요.');
  if(/설치비|등록비|설치.*비용/.test(text))return detail(Number.isFinite(p.installFee)?'사이트 등록 설치비: '+fmt(p.installFee)+' · 현장 추가 비용 별도 확인':'설치비·등록비가 숫자로 등록되어 있지 않아 무료라고 안내할 수 없습니다.');
  if(/필터|관리.*주기|방문.*주기|a\/?s|고장|보증/i.test(text)){const rows=p.offers;const facts=[...new Set(rows.map(o=>[o.rentalCo,o.term?o.term+'개월 조건':null,o.visitCycle,o.as].filter(Boolean).join(' · ')).filter(Boolean))];return detail('계약 조건별 등록 관리·A/S 안내\n'+facts.slice(0,4).join('\n')+'\n필터 교체 주기나 수리 가능 여부가 따로 명시되지 않은 경우 담당자 확인이 필요합니다.',rows);}
  if(/카드|총액|총\s*납입/.test(text)){const rows=p.offers.filter(o=>o.fee>0&&!o.feeIsPlaceholder);return detail(rows.slice(0,4).map(o=>[o.rentalCo,o.term+'개월 약정','기본 월 '+fmt(o.fee),/카드/.test(text)?'카드할인 표기 '+(o.cardDiscountRaw||'확인 필요'):'등록 총액 '+fmt(o.total)].join(' · ')).join('\n')+'\n카드사·실적 조건과 총액 포함 범위는 확인이 필요합니다. 카드 할인액을 임의로 빼거나 미등록 총액을 계산해 확정하지 않습니다.',rows);}
  if(/크기|사이즈|용량|무게|스펙|규격|스팩/.test(text))return detail(p.specs.length?p.specs.map(x=>x.key+': '+x.value).join('\n'):'상세 사양이 등록되어 있지 않습니다.');
  const rows=p.offers.filter(o=>Number.isFinite(o.fee)&&o.fee>0&&!o.feeIsPlaceholder);
  const reply=p.brand+' '+p.name+' · '+p.model+'\n'+(stale?'수집 자료가 오래되어 금액 안내를 보류했어요.':rows.length?rows.slice(0,4).map(o=>[o.rentalCo,o.term+'개월 약정','소유권 '+(o.own?o.own+'개월':'확인 필요'),'월 '+fmt(o.fee),o.visitCycle,o.as].filter(Boolean).join(' · ')).join('\n'):'확정된 숫자 요금이 없어 상담 확인이 필요한 상품입니다.')+'\n'+p.specs.slice(0,5).map(x=>x.key+': '+x.value).join(' · ')+'\n사이트 수집 기준의 참고 정보입니다. 전체 약정·관리·카드 조건과 현재 적용 여부는 상품 원문을 확인해 주세요.';
  return make(reply,'사이트 모델 자료',{siteSources:[{label:'해당 상품 원문',url:link}],siteEvidence:evidence(rows)+' '+JSON.stringify(p)});
 }
 const parsed=interpret(text,s),navigation=browseRequest(text);
 const explicitCategory=text.match(/정수기|공기청정기|비데|냉장고|냉동고|세탁기|건조기|식기세척기|안마의자|매트리스|소파|커피머신|제빙기|에어컨/);
 const category=explicitCategory?.[0]||parsed.state.filters.category;
 const followup=s.siteProduct&&(parsed.changed||navigation.sort||navigation.action);
 if(category&&(/사이트/.test(text)||followup)&&!rentalFaqReply(text)){
  if(parsed.clarification||navigation.clarification)return make(parsed.clarification||navigation.clarification,'사이트 상품 조건 확인',{siteSources:sources('/electronics')});
  Object.assign(s,parsed.state);delete s.siteInternet;s.siteProduct=true;
  s.filters.category=category;
  const f=s.filters;
  const namedBrands=[...new Set(data.products.map(p=>p.brand))].filter(b=>b&&text.includes(b));
  if(!f.brand&&!f.brands?.length&&namedBrands.length===1)f.brand=namedBrands[0];
  if(navigation.sort)s.sort=navigation.sort;
  if(parsed.changed||navigation.sort)s.offset=0;
  if(navigation.action==='more')s.offset=(s.offset||0)+3;
  if(navigation.action==='previous')s.offset=Math.max(0,(s.offset||0)-3);
  if(navigation.action==='first')s.offset=0;
  const found=data.products.filter(p=>(p.name.includes(category)||p.category?.legacyName?.includes(category))&&(!f.brand||p.brand===f.brand)&&(!f.brands?.length||f.brands.includes(p.brand))&&!f.excludedBrands?.includes(p.brand)).map(p=>({p,rows:p.offers.filter(o=>o.fee>0&&!o.feeIsPlaceholder&&(!f.term||o.term===f.term)&&!f.excludedTerms?.includes(o.term)&&(!f.budget||o.fee<=f.budget))})).filter(x=>x.rows.length);
  const minimum=x=>Math.min(...x.rows.map(o=>o.fee));
  if(s.sort==='priceAsc'||s.sort==='priceDesc')found.sort((a,b)=>(minimum(a)-minimum(b))*(s.sort==='priceAsc'?1:-1)||a.p.sku.localeCompare(b.p.sku));
  if(!found.length)return make('해당'+' 품목·브랜드·약정·예산과 일치하는 숫자 요금 자료를 찾지 못했어요. 다른 조건으로 확인해 주세요.','사이트 상품 검색',{siteSources:sources('/electronics')});
  s.offset=Math.min(s.offset||0,Math.floor((found.length-1)/3)*3);
  const chosen=found.slice(s.offset,s.offset+3),refs=chosen.map(({p})=>({label:p.brand+' '+(p.model||p.name),url:BASE+'/p?sku='+encodeURIComponent(p.sku)}));
  if(stale)return make('수집 자료가 오래되어 금액 안내를 보류했어요. 상품 원문을 확인해 주세요.','사이트 상품 검색',{siteSources:refs});
  return make('사이트에 등록된 '+category+' '+found.length+'개 중 최대 3개를 보여드려요. '+(s.sort==='priceAsc'?'현재 조건의 월요금이 낮은 순입니다.':s.sort==='priceDesc'?'현재 조건의 월요금이 높은 순입니다.':'추천 순위가 아닙니다.')+'\n'+chosen.map(({p,rows})=>{const o=[...rows].sort((a,b)=>a.fee-b.fee)[0];return p.brand+' '+p.name+' / '+o.rentalCo+' / '+o.term+'개월 약정 / 기본 월 '+fmt(o.fee)+' / 소유권 '+(o.own?o.own+'개월':'확인 필요');}).join('\n')+'\n카드 할인 전 등록 조건입니다. 현재 적용 여부와 전체 옵션은 원문에서 확인해 주세요.','사이트 상품 검색',{siteSources:refs,siteEvidence:JSON.stringify(chosen)+' '+evidence(chosen.flatMap(x=>x.rows))+' '+found.length+' 3'});
 }
 if(/사이트.*(?:상품|품목|종류)|어떤.*(?:가전|품목).*있|취급.*품목/.test(text))return make('고객 사이트에는 '+data.categories.map(c=>c.name).join(', ')+' 분류가 있어요. 모델명 또는 ‘사이트 코웨이 정수기 3년’처럼 품목·조건을 알려주시면 등록 자료를 찾을 수 있습니다.','사이트 취급 품목',{siteSources:[{label:'가전 상품 목록',url:BASE+'/electronics'}]});
 if(appliance)delete s.siteInternet;
 return null;
}

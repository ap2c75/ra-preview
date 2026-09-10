// Generated from support/facts.mjs; customer-safe fields only.
const hydrate=rows=>rows.map(({pattern,flags,...r})=>({...r,match:new RegExp(pattern,flags)}));
export const TOPICS=hydrate([
  {
    "id": "install-lead-time",
    "title": "설치 일정 (신청 후 며칠)",
    "what": "설치 일정",
    "pattern": "설치.*(언제|일정|날짜|며칠|얼마나|빨리)|언제.*(설치|와|오|받)|언제까지.*되",
    "flags": ""
  },
  {
    "id": "eligibility",
    "title": "가입 조건 (신용조회·연령·명의)",
    "what": "가입 조건",
    "pattern": "가입.*(조건|가능|되나|될까|자격)|신용|심사|승인.*되|나이.*(되|제한)|명의|미성년|연체|될까요|되는\\s*거\\s*맞",
    "flags": ""
  },
  {
    "id": "install-fee",
    "title": "설치비·등록비",
    "what": "설치비와 등록비",
    "pattern": "설치비|설치.*비용|등록비|가입비|초기\\s*비용|처음에.*내",
    "flags": ""
  },
  {
    "id": "support-warranty",
    "title": "A/S·보증 조건",
    "what": "A/S 조건",
    "pattern": "a\\/?s|에이에스|고장|수리|보증|as\\s*기간|망가지",
    "flags": "i"
  },
  {
    "id": "gift",
    "title": "사은품",
    "what": "사은품",
    "pattern": "사은품|사은|경품|상품권|증정|덤|끼워",
    "flags": ""
  },
  {
    "id": "cash-support",
    "title": "현금 지원금",
    "what": "현금 지원 금액",
    "pattern": "지원금|현금|캐시백|페이백|얼마.*지원|돌려주|환급.*받",
    "flags": ""
  },
  {
    "id": "promo-deadline",
    "title": "프로모션 적용 기간",
    "what": "프로모션 마감일",
    "pattern": "오늘까지|이번\\s*달까지|언제까지.*할인|마감|기간.*끝|지금\\s*(하면|예약|신청).*(할인|혜택)",
    "flags": ""
  },
  {
    "id": "escalation-policy",
    "title": "상담사 연결 경로와 운영 시간",
    "what": "상담 연결 방법",
    "pattern": "상담.*(연결|전화|시간|가능)|사람.*바꿔|전화.*(주세요|해\\s*줘)|운영\\s*시간|몇\\s*시까지",
    "flags": ""
  }
]);
export const GENERAL_FACTS=hydrate([
  {
    "id": "total-vs-monthly",
    "title": "총 납입금액과 월 렌탈료의 관계",
    "status": "confirmed",
    "pattern": "총액|총\\s*얼마|다\\s*합치면|전부\\s*얼마|총\\s*납입|곱하면|다\\s*내면",
    "flags": ""
  },
  {
    "id": "ownership",
    "title": "약정 종료 후 소유권",
    "status": "confirmed",
    "pattern": "소유권|내\\s*것|가져|양도|이전|끝나면.*주|만기",
    "flags": ""
  }
]);

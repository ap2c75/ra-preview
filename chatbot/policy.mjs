/* 렌탈아지트 홈페이지 챗봇 — 🔒 정책 정본
 *
 * 근거 = library/regulations/personal-data-consignment-and-transfer.md §4·§5
 *        CRO_CURRENT.md §6-3 · §12-13
 *
 * ══════════════════════════════════════════════════════════════
 *  🔑 설계의 축 — 「마스킹해서 보낸다」가 아니라 「감지되면 안 보낸다」
 * ══════════════════════════════════════════════════════════════
 *
 * 완벽한 마스킹은 불가능하다. 한국어 이름·주소는 정규식으로 못 가른다.
 * 그래서 마스킹을 1차 방어선으로 삼지 않는다.
 *
 *   1차 = 흐름 설계   개인정보를 받는 단계에는 LLM 이 아예 없다 (규칙 기반 슬롯 채우기)
 *   2차 = 강한 신호   전화·이메일·주민번호·카드·계좌가 보이면 LLM 을 부르지 않는다
 *   3차 = 약한 신호   이름·주소로 보이는 것은 마스킹 후 보낸다
 *
 * → 개인정보가 LLM 에 닿지 않으면 §28조의8 국외이전 판단 자체를 피한다.
 *   모델 선택이 틀려도 개인정보 사고로 가지 않는다.
 */

/* ── 1. 탐지 등급 ──────────────────────────────────────────────── */
export const LEVEL = {
  BLOCK: 'block',   // LLM 미호출. 규칙 기반으로 답한다
  MASK:  'mask',    // 통째로 가린 뒤 LLM 에 보낸다
};

/* 🔴 부분 마스킹을 쓰지 않는다.
      "010-****-5678" 은 여전히 식별 가능하다. 통째로 바꾼다. */
export const PLACEHOLDER = {
  phone:   '[전화번호]',
  email:   '[이메일]',
  rrn:     '[주민등록번호]',
  card:    '[카드번호]',
  account: '[계좌번호]',
  name:    '[이름]',
  address: '[주소]',
  age:     '[나이]',
  birth:   '[생년월일]',
};

/* ── 무엇을 받는가 ─────────────────────────────────────────────
 *
 * 🔴 여기가 유일한 정의다. **고지 문구도 질문 순서도 이 배열에서 나온다.**
 *    두 곳에 따로 적으면 「고지에는 있는데 안 묻는」 항목이나
 *    「묻는데 고지에 없는」 항목이 생긴다. 후자는 그 자체가 위반이다.
 *
 * 🔑 enabled 한 줄로 켜고 끈다. 켜면 고지문이 자동으로 따라간다.
 * 🔴 끈 것들은 지운 게 아니라 **왜 껐는지와 함께** 남겨 뒀다 — 켤지는 판단할 사람이 정한다.
 */
export const LEAD_FIELDS = [
  {
    id: 'name', label: '이름', enabled: true, validate: 'name', maskAs: 'name',
    ask: '먼저 성함이 어떻게 되세요?',
    confirm: v => `${v}님, 반갑습니다.`,
  },
  {
    id: 'birth', label: '생년월일', enabled: true, validate: 'birth', maskAs: 'birth',
    ask: '생년월일도 알려주시겠어요?',
    hint: '8자리로 입력해 주세요. (예: 19901231)',
    confirm: () => '생년월일 확인했어요.',
    why: '2026-09-08 손 이사 지시로 켬. 🔴 상담 단계에 꼭 필요한 근거는 못 찾았으나 판단은 담당이 한다.',
  },
  {
    id: 'phone', label: '연락처', enabled: true, validate: 'phone', maskAs: 'phone',
    ask: '연락드릴 번호를 알려주세요.',
    hint: '010으로 시작하는 번호면 됩니다.',
    confirm: () => '연락처 잘 받았습니다.',
  },
  {
    id: 'address', label: '설치 주소', enabled: true, validate: 'address', maskAs: 'address',
    ask: '설치하실 상세 주소를 알려주세요.',
    hint: '도로명과 건물명, 동·호수까지 적어주시면 확인이 더 빨라요.',
    confirm: () => '설치 주소 확인했어요.',
    why: '2026-09-08 손 이사 지시로 켬.',
  },
  {
    id: 'region', label: '설치 지역', enabled: false, validate: 'region', maskAs: 'address',
    ask: '설치하실 지역을 알려주세요.',
    hint: '시·군·구까지만 적어주셔도 됩니다. (예: 서울 강서구)',
    confirm: v => `${v} 확인했어요.`,
    why: '🔴 상세 주소를 켜면서 껐다 — 둘 다 켜면 같은 것을 두 번 묻는다. 상세 주소 안에 지역이 들어 있다.',
  },
  {
    id: 'current_brand', label: '현재 쓰시는 렌탈 제품', enabled: true,
    ask: '지금 쓰고 계신 렌탈 제품이 있으세요?',
    choices: ['코웨이', 'SK매직', '청호나이스', '쿠쿠', '교원웰스', '다른 회사', '지금은 없어요'],
    confirm: v => (v === '지금은 없어요' ? '알겠습니다.' : `${v} 확인했어요.`),
    why: '🔑 혜택표에 「타사보상」 할인이 실제로 있다(교원웰스·쿠쿠·SK매직). 이 답이 적용 여부를 가른다.',
  },
  {
    id: 'product_interest', label: '관심 품목', enabled: true,
    ask: '어떤 제품을 알아보고 계세요?',
    choices: ['정수기', '공기청정기', '비데', '매트리스·침대', '전기레인지', '기타'],
    confirm: v => `${v} 확인했어요.`,
  },
  {
    id: 'email', label: '이메일', enabled: false, validate: 'email', maskAs: 'email',
    ask: '이메일 주소도 알려주시겠어요?',
    confirm: () => '이메일 확인했어요.',
    why: '🔴 연락처가 있으면 상담에 필요 없다. 마케팅 발송용이라면 별도 동의가 따로 필요하다(정보통신망법 §50).',
  },
];

/** 지금 실제로 받는 항목 */
export const activeFields = () => LEAD_FIELDS.filter(f => f.enabled);

/* ── 2. 고지·동의 ──────────────────────────────────────────────
 *
 * 🔴 챗봇에는 체크박스가 없다. 대화 안에서 고지하고 명시적 의사표시를 받는다.
 * 🔑 고지 시점 = **개인정보를 받기 직전**. 대화 첫머리 한 번으로 끝내지 않는다.
 *    (regulations §5 — 이용자는 아무 때나 개인정보를 말한다)
 *
 * 🔑 동의 문구에 버전을 붙인다. 나중에 「무엇에 동의했는지」를 증명해야 한다.
 *    문구를 고치면 버전을 올린다. 기존 동의 기록은 옛 버전을 가리킨 채로 남는다.
 */
export const CONSENT = {
  version: 'v1-260908',
  purpose: '렌탈 상담 및 계약 안내',
  get items() { return activeFields().map(f => f.label); },   // 🔴 실제 묻는 것과 어긋나지 않게 여기서 만든다
  retention: null,                       // ⏳ 미정 — 게이트가 막는다
  refusal: '동의를 거부하실 수 있으며, 거부하시면 상담 연락을 드리기 어렵습니다.',
  handler: null,                         // ⏳ ⑦ 명의구조 — 개인정보처리자가 누구인지
};

/* 🔴 제3자 제공 동의는 랜딩과 같은 이유로 지금 걸 수 없다.
      위탁이면 §26③ 통지, 제공이면 §17 별도 동의 — ⑦ 명의구조가 갈린다. */
export const CONSENT_3RD = { enabled: false, blockedBy: '⑦ 명의구조 (고객 미결정)' };

/* ── 3. 저장 규칙 ──────────────────────────────────────────────
 *
 * 🔴 대화 로그 전체가 개인정보가 될 수 있다 (regulations §5).
 *    원문을 저장하지 않는다. 마스킹본만 남긴다.
 *    슬롯 값(이름·연락처)은 동의 후 별도 필드에 넣고 로그 본문에는 남기지 않는다.
 */
export const STORAGE = {
  logRaw: false,
  logMasked: true,
  slotsSeparate: true,
  ttlDays: null,                         // ⏳ 미정 — 처리방침에 적어야 한다
};

/* ── 4. 🔴 챗봇이 조건·금액을 지어내면 그 자체가 청약 유인이다 ───
 *
 * 표시광고법 · 방문판매법 §30① 설명의무로 이어진다.
 * 그래서 답변에 나가는 숫자는 **상품 DB 에 있는 값만** 허용한다.
 * 다뿌려에서 쓰던 근거검증과 같은 방향이다 (ground.mjs 가 그 모듈을 그대로 쓴다).
 */
export const ANSWER = {
  groundNumbers: true,
  banned: ['무조건', '100%', '최저가', '보장', '누구나', '최고의', '완벽'],
  // 요금을 못 찾으면 지어내지 말고 이렇게 말한다
  fallback: '그 조건은 제가 확인해 드릴 수 없습니다. 상담사에게 남겨 드릴까요?',
};

/* ── 5. 발행 게이트 — 랜딩과 같은 방식 ─────────────────────────── */
export const GATE = {
  block: [
    { key: 'IDENTITY_STRUCTURE', label: '⑦ 명의구조 (개인정보처리자가 누구인가)', why: '고지 문구의 주체가 갈린다' },
    { key: 'RETENTION',          label: '개인정보 보유기간', why: '개인정보 보호법 §15②' },
    { key: 'LOG_TTL',            label: '대화 로그 보유기간', why: '처리방침에 적어야 한다' },
    { key: 'MODEL',              label: 'LLM 모델·리전 결정', why: '국외이전 여부가 갈린다 (§28조의8)' },
    { key: 'HANDOFF',            label: '상담원 전환 정책', why: '영업시간·대기·실패 시 행동' },
  ],
};

const isEmpty = v => v == null || String(v).trim() === '';

export function gate(values = {}) {
  const blockers = GATE.block.filter(g => isEmpty(values[g.key]));
  return { publishable: blockers.length === 0, blockers };
}

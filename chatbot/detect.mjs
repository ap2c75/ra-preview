/* 챗봇 — 개인정보 탐지·마스킹
 *
 * 🔴 이 파일은 「완벽한 마스킹」을 목표로 하지 않는다. 그건 불가능하다.
 *    한국어 이름·주소는 정규식으로 못 가른다 — "정수기입니다"와 "김철수입니다"는 같은 모양이다.
 *
 * 🔑 그래서 등급을 나눈다 (policy.mjs):
 *      강한 신호(전화·이메일·주민번호·카드·계좌) → **차단**. LLM 을 아예 안 부른다.
 *      약한 신호(이름·주소·나이)               → **마스킹** 후 보낸다.
 *    강한 신호는 형식이 분명해서 오탐이 거의 없고, 약한 신호는 오탐해도
 *    「LLM 이 문맥 한 조각을 잃는」 정도로 끝난다. 반대로 놓으면 개인정보가 나간다.
 */

import { LEVEL, PLACEHOLDER } from './policy.mjs';

/* ── 한국 성씨 (상위) ────────────────────────────────────────────
   전체를 담지 않는다. 못 잡는 이름이 있는 것을 전제로 등급을 MASK 로 둔 것이다. */
const SURNAME = '김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구';

/* 🔴 이름 정규식이 물어뜯는 단어들. 아래 「왜 좁혔나」와 함께 본다. */
const NOT_NAME = new Set([
  '정수기', '공기청정기', '비데', '에어컨', '냉장고', '안마의자', '건조기', '세탁기',
  '조건', '최고', '최저', '요금', '가격', '약정', '계약', '해지', '상담', '문의', '설치',
  '신청', '사용', '고장', '수리', '방문', '점검', '주문', '배송', '변경', '확인', '가입',
  '코웨이', '청호', '쿠쿠', '웅진', '교원', '렌탈', '할부', '보증', '서비스',
  '고객', '회원', '고민', '문제', '오해', '손해', '안심', '처음', '전액', '백만',
]);

/* ── 강한 신호 ─────────────────────────────────────────────────── */
const STRONG = [
  { kind: 'email',   re: /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g },
  { kind: 'rrn',     re: /\b\d{6}\s*[-–]\s*[1-4]\d{6}\b/g },
  { kind: 'card',    re: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b|\b\d{16}\b/g },
  { kind: 'phone',   re: /\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g },
  { kind: 'phone',   re: /\b0(?:2|[3-6]\d)[-.\s]\d{3,4}[-.\s]\d{4}\b/g },
  { kind: 'account', re: /\b\d{2,6}-\d{2,6}-\d{2,8}\b/g, guard: isAccountish },
];

/* 🔴 계좌 모양은 날짜와 겹친다 — "2026-09-08" 이 그대로 걸린다.
      숫자 총합이 10자리 미만이거나 날짜 모양이면 계좌로 보지 않는다. */
function isAccountish(s) {
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return false;
  return true;
}

/* ── 약한 신호 ─────────────────────────────────────────────────────
 *
 * 🔴 「이름 + 입니다/이에요」 는 방아쇠로 쓸 수 없다 — 실측으로 버렸다.
 *
 *    "고민이에요" → 고(성씨) + 민 + 이 → 「고민이」를 이름으로 잡았다.
 *    성씨로 쓰이는 글자(김이박최정강조윤장임한오서신문성주유남하고백전…)는
 *    한국어에서 가장 흔한 음절이기도 하다. 그래서 조건입니다·최고예요·손해예요·
 *    처음이에요 가 전부 이름이 된다. 사전으로 막는 건 끝이 없다.
 *
 * 🔑 그래서 **정밀도를 택했다** — 방아쇠는 둘뿐이다.
 *      ① 명시 문맥: 저는 / 제 이름은 / 성함은
 *      ② 호칭 붙음: 김철수님 / 이영희씨
 *
 * ⏳ 대신 자유 대화 속 맨 "김철수입니다" 는 못 잡는다. 그래도 되는 이유:
 *    이름·연락처는 **슬롯 단계에서 받고, 그 단계는 모델에 닿지 않는다**(1차 방어선).
 *    자유 질문에서 이름을 놓치는 것과, 모든 "~이에요" 문장을 망가뜨리는 것 중
 *    후자가 챗봇을 못 쓰게 만든다.
 */
const NAME_CTX_RE = new RegExp(
  `(?:저는|제\\s?이름은|이름은|성함은|성함이|성함을)\\s*([${SURNAME}][가-힣]{1,2})`, 'g');
const NAME_HON_RE = new RegExp(
  `(?:^|[\\s,.(])([${SURNAME}][가-힣]{1,2})(?=(?:님|씨)(?:[\\s,.?!]|$))`, 'g');

/* 🔑 저장용에서만 켜는 넓은 규칙 — 손익이 반대이기 때문이다.
      모델로 보낼 때 오탐 = 답변이 망가진다 → 정밀도가 중요하다.
      저장할 때  오탐 = 로그에 [이름] 이 하나 더 생긴다 → **재현율이 중요하다.**
      저장물은 남는다. 놓치면 계속 남는다. */
const NAME_COPULA_RE = new RegExp(
  `(?:^|[\\s,.(])([${SURNAME}][가-힣]{1,2})(?=(?:입니다|이에요|예요|이라고|라고|이고))`, 'g');

const ADDRESS_RE = /[가-힣]{2,10}(?:특별시|광역시|특별자치시|특별자치도|[시도])\s*[가-힣]{1,10}(?:시|군|구)(?:\s*[가-힣]{1,10}(?:동|읍|면|리|로|길))?(?:\s*\d+(?:-\d+)?)?/g;
/* 🔴 "활동 3개" 같은 것이 걸려서 하이픈·번지 형태만 남겼다 */
const ADDRESS2_RE = /[가-힣]{2,10}(?:동|읍|면)\s*\d{1,4}(?:-\d{1,4}|번지)/g;
const AGE_RE = /\b\d{2}년생\b|\b만\s?\d{1,3}세\b/g;

const WEAK = [
  { kind: 'name',    re: NAME_CTX_RE, group: 1, guard: notDomainWord },
  { kind: 'name',    re: NAME_HON_RE, group: 1, guard: notDomainWord },
  { kind: 'address', re: ADDRESS_RE },
  { kind: 'address', re: ADDRESS2_RE },
  { kind: 'age',     re: AGE_RE },
];

function notDomainWord(s) { return !NOT_NAME.has(s); }

/* ── 탐지 ──────────────────────────────────────────────────────── */
function scan(text, defs, level) {
  const hits = [];
  for (const d of defs) {
    d.re.lastIndex = 0;
    let m;
    while ((m = d.re.exec(text)) !== null) {
      const value = d.group ? m[d.group] : m[0];
      if (!value) continue;
      if (d.guard && !d.guard(value)) continue;
      const start = d.group ? m.index + m[0].indexOf(value) : m.index;
      hits.push({ level, kind: d.kind, value, start, end: start + value.length });
      if (m[0].length === 0) d.re.lastIndex++;   // 무한 루프 방지
    }
  }
  return hits;
}

/** 겹치는 탐지는 먼저 시작한 것·긴 것을 남긴다 */
function dedupe(hits) {
  const sorted = hits.slice().sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out = [];
  for (const h of sorted) if (!out.some(o => h.start < o.end && o.start < h.end)) out.push(h);
  return out;
}

/* 저장 프로파일에서만 더 얹는 규칙 */
/* 🔴 생년월일은 저장 프로파일에서만 잡는다.
      모델 경로에서 날짜를 전부 막으면 "2026-09-08 에 설치 가능한가요" 가 차단된다.
      그래서 **태어날 수 있는 해(1900~2019)** 로 좁히고, 저장할 때만 켠다. */
const BIRTH_RE = /\b(19\d{2}|20[01]\d)[-.]?(0[1-9]|1[0-2])[-.]?(0[1-9]|[12]\d|3[01])\b/g;

const WEAK_STORAGE = [
  { kind: 'birth', re: BIRTH_RE },{ kind: 'name', re: NAME_COPULA_RE, group: 1, guard: notDomainWord }];

export function detect(text, { profile = 'model' } = {}) {
  const s = String(text ?? '');
  const weak = profile === 'storage' ? [...WEAK, ...WEAK_STORAGE] : WEAK;
  return dedupe([...scan(s, STRONG, LEVEL.BLOCK), ...scan(s, weak, LEVEL.MASK)]);
}

/* ── 마스킹 ────────────────────────────────────────────────────── */
/**
 * 발화 한 건을 판정한다.
 *   blocked=true 면 **LLM 을 부르지 않는다.** masked 는 저장·표시용이다.
 * 🔴 부분 마스킹을 하지 않는다. 뒤 네 자리를 남기면 여전히 식별된다.
 */
export function mask(text, { profile = 'model', known = null } = {}) {
  /* 🔑 아는 값은 추측하지 않는다 — 슬롯에 이미 이름·연락처가 있으면 그 문자열을 그대로 지운다.
        정규식이 못 잡아도 이건 정확하다. */
  let s = String(text ?? '');
  const exact = [];
  for (const [kind, v] of Object.entries(known || {})) {
    const val = String(v ?? '').trim();
    if (val.length < 2) continue;
    const re = new RegExp(val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (re.test(s)) { s = s.replace(re, PLACEHOLDER[kind] || '[개인정보]'); exact.push(kind); }
  }

  const hits = detect(s, { profile });
  let out = '', cursor = 0;
  for (const h of hits) {
    out += s.slice(cursor, h.start) + (PLACEHOLDER[h.kind] || '[개인정보]');
    cursor = h.end;
  }
  out += s.slice(cursor);

  const blocked = hits.some(h => h.level === LEVEL.BLOCK);
  return {
    masked: out,
    hits,
    blocked,
    kinds: [...new Set([...exact, ...hits.map(h => h.kind)])],
    reason: blocked
      ? `강한 신호 감지 (${[...new Set(hits.filter(h => h.level === LEVEL.BLOCK).map(h => h.kind))].join(', ')}) — 모델에 보내지 않습니다`
      : null,
  };
}

/**
 * LLM 에 넘길 것을 만든다.
 * 🔴 이력도 마스킹본만 보낸다 — 한 발화씩은 안전해도 여러 발화를 합치면 재식별된다.
 *    반환값이 null 이면 부르지 말라는 뜻이다.
 */
export function forModel(turns) {
  const list = (turns || []).map(t => ({ role: t.role, ...mask(t.text) }));
  if (list.some(t => t.blocked)) {
    return { send: null, blocked: true, reason: list.find(t => t.blocked).reason };
  }
  return {
    send: list.map(t => ({ role: t.role, text: t.masked })),
    blocked: false,
    maskedKinds: [...new Set(list.flatMap(t => t.kinds))],
  };
}

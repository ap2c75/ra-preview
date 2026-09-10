/* 응대 표준 검사 — 원티드 방 표준을 우리 관문에 심는다
 *
 * 표준 정본 = 🔒 로컬 `D:/project/respondkit/standard/rules.json` (원티드 AI 챔피언십 방)
 * 여기 있는 `standard/rules.json` 은 **그 스냅샷**이다. version·updated 로 어긋남을 잡는다
 * (`standard-check.mjs` 가 정본과 대조한다).
 *
 * 🔴 방향을 지킨다 — 저쪽 CRO §2-t:
 *      「렌탈아지트 코드·고객 데이터는 출품작에 한 줄도 안 쓴다」
 *    반대로 **표준이 렌탈로 되먹임되는 것은 이득**이라고 같은 문서에 적혀 있다.
 *    그래서 우리는 저쪽 규칙을 **가져와 쓰기만** 한다.
 *
 * 🔴 왜 심었나 — 우리 관문이 표준보다 헐거웠다. 실측(2026-09-08):
 *      R3 "청호 슈퍼아이스트리를 추천드립니다"  → 그대로 나갔다
 *      R7 "설치는 보통 3일 안에 됩니다"        → 그대로 나갔다
 *      R4 "이게 가장 좋은 선택입니다"          → 그대로 나갔다 (금칙어 목록에 없었다)
 *    근거검증(숫자 대조)만으로는 **문장의 태도**를 못 막는다.
 */

import { RULES_DOC as DOC } from '/ra-preview/chatbot/standard/rules-data.mjs';

export const STANDARD_VERSION = { version: DOC.version, updated: DOC.updated };
export const RULES = DOC.rules;
const rule = id => RULES.find(r => r.id === id);

const MONEY = /\d[\d,]*\s*원|\d+\s*만\s*원/;
const TERM_MARKERS = rule('R2').term_markers;
/* 🔴 낱말만 보면 「주 3회에 월 290,000원」이 조건 없는 금액이 된다. **수량도 조건이다.**
      렌탈에도 그대로 걸린다 — 「방문관리 주 1회」가 조건인데 우리는 조건이 없다고 막았다. */
const TERM_PATTERNS = (rule('R2').term_patterns ?? []).map(p => new RegExp(p));
const PICK_PATTERNS = rule('R3').pick_patterns;
/* 🔴 같은 문장에 상담·담당자가 있으면 상품을 고른 게 아니라 **사람에게 넘긴 것**이다.
      넘기는 것은 우리가 바라는 행동이라 막으면 안 된다. */
const ESCALATION_WORDS = rule('R3').escalation_words ?? [];
const R4_GROUPS = rule('R4').groups;

/* 문장 단위로 본다 — 여러 문장을 한 덩어리로 세면 뒷문장의 조건을 못 본다 */
const sentences = t => String(t ?? '').split(/(?<=[.!?。])\s+|\n+/).map(s => s.trim()).filter(Boolean);

/* 🔴 부정이 뒤따르면 금지어가 아니다.
      「어느 과정이 가장 저렴한지 말씀드릴 수 없습니다」는 최상급을 쓴 게 아니라
      **못 쓴다고 거절한** 문장이다. 이걸 막으면 관문이 없느니만 못하다. */
const NEGATED = /없|않|못|어렵|아닙|아니|불가/;
function isNegated(text, word) {
  let from = 0;
  for (;;) {
    const at = text.indexOf(word, from);
    if (at < 0) return from > 0;   // 나온 자리가 전부 부정 안이면 위반이 아니다
    if (!NEGATED.test(text.slice(at + word.length, at + word.length + 25))) return false;
    from = at + word.length;
  }
}
/* 🔴 표준 목록에 「보통은」은 있는데 「보통」이 없다 —
      "설치는 보통 3일 안에 됩니다" 가 그대로 나갔다(2026-09-08 실측).
      우리 쪽에서 보태 쓰고, **원티드 방에 제안한다**(표준을 우리가 고치지는 않는다). */
const HEDGES_EXTRA = ['보통', '대개', '얼추', '통상', '대략', '어느 정도'];
export const HEDGES_ALL = [...rule('R7').hedge_words, ...HEDGES_EXTRA];
const HEDGES = HEDGES_ALL;

/** 원티드 방에 넘길 제안 — 표준 정본을 우리가 고치지 않는다 */
export const PROPOSED_TO_STANDARD = [
  { rule: 'R7', status: 'open', add: HEDGES_EXTRA,
    why: '「보통은」만 있고 「보통」이 없어 "설치는 보통 3일 안에 됩니다" 가 통과했다 (rentalagit 실측 2026-09-08)' },
  { rule: 'R4', status: 'adopted', adopted: '2026-09-09 재스냅샷에서 확인',
    issue: 'on_violation 이 고객용 문장이 아니라 만드는 사람용 지시문이다',
    was: '표현을 사실 범위로 바꾼다. 예) 최저가 → 저희가 안내드릴 수 있는 조건',
    why: '위반 시 그대로 내보내면 고객이 내부 지시를 읽는다. R8 도 같은 모양이었다.',
    suggest: 'on_violation(고객용) 과 how_to_fix(제작자용) 를 나눈다',
    /* ✅ 저쪽이 `reply`(손님용) / `remedy`(제작자용) 로 갈랐다. 저쪽 field_note 에
          같은 사고가 시험장 첫 실행에서 실제로 났다고 적혀 있다. */
    result: 'reply / remedy 로 분리됨' },
];
export const OPEN_PROPOSALS = PROPOSED_TO_STANDARD.filter(p => p.status === 'open');

/* 「모른다」로 넘긴 문장은 얼버무린 게 아니다 */
const HANDOFF = /상담사|담당자|확인해 드리|안내드립니다|어렵습니다|없어서|못\s/;

/**
 * 표준 위반을 찾는다. 반환 = [{ rule, name, severity, why }]
 * 🔑 severity 가 block 이면 그 문장은 내보내지 않는다. review 면 표시만 한다.
 */
export function checkStandard(text) {
  const t = String(text ?? '');
  const hits = [];

  const lines = sentences(t);

  /* R2 — 금액에 조건이 하나도 없으면 단정이다.
     🔴 여기만 저쪽과 **일부러 다르게** 본다. 저쪽은 문장 단위로 쪼갠다(줄바꿈 포함).
        우리 견적 화면은 금액과 조건이 **줄을 나눠** 붙는다 —
          「총 납입금액은 3,855,600원입니다 / 의무사용기간은 84개월입니다 / 중도 해지 시…」
        줄로 쪼개면 첫 줄만 보고 「조건 없는 금액」이라 막는다. 실제로 막았다(2026-09-09).
        R2 가 요구하는 것은 「금액 옆에 조건을 밝혀라」이고 이 블록은 그걸 지킨다.
        저쪽 문장 단위는 줄글 답변용이라 맞고, 우리 블록 답변에는 안 맞는다. */
  if (MONEY.test(t) && !TERM_MARKERS.some(m => t.includes(m)) && !TERM_PATTERNS.some(p => p.test(t))) {
    hits.push({ rule: 'R2', name: rule('R2').name, severity: 'block',
      why: '금액을 말하면서 기간·포함범위·변동조건을 하나도 안 붙였습니다' });
  }

  /* R3 — 여럿인데 하나를 지목했다. 넘기는 문장은 고른 게 아니다 */
  let pick = null;
  for (const s of lines) {
    if (ESCALATION_WORDS.some(w => s.includes(w))) continue;
    pick = PICK_PATTERNS.find(p => s.includes(p));
    if (pick) break;
  }
  if (pick) {
    hits.push({ rule: 'R3', name: rule('R3').name, severity: 'block',
      why: `"${pick}" 로 하나를 골랐습니다` });
  }

  /* R4 — 최상급·보장·절대어. 부정이 뒤따르면 쓴 게 아니라 거절한 것이다 */
  for (const g of R4_GROUPS) {
    const w = g.words.find(x => t.includes(x) && !isNegated(t, x));
    if (w) hits.push({ rule: 'R4', name: `${rule('R4').name} (${g.name})`, severity: g.severity,
      why: `"${w}"` });
  }

  /* R7 — 근거 없이 얼버무렸다. 상담사로 넘기는 문장은 얼버무림이 아니다 */
  const hedge = HEDGES.find(h => t.includes(h));
  if (hedge && !HANDOFF.test(t)) {
    hits.push({ rule: 'R7', name: rule('R7').name, severity: 'review',
      why: `"${hedge}" 로 넘어갔는데 확인해 준다는 말이 없습니다` });
  }

  return hits;
}

/** block 짜리가 하나라도 있으면 그 문장은 못 나간다 */
export const hasBlock = hits => hits.some(h => h.severity === 'block');

/* ✅ 우리가 낸 제안이 표준에 반영됐다 — `on_violation` 하나가 두 일을 하던 것을
      `reply`(손님에게 나갈 말) / `remedy`(우리가 할 일) 로 갈랐다.
      그래서 「지시문이면 우리 문장으로」 우회로가 필요 없어졌다. 남겨 둔 우리 문장은
      **저쪽에 reply 가 없을 때만** 쓰는 보험이다(구형 스냅샷으로 되돌릴 때). */
const LOOKS_LIKE_INSTRUCTION = /예\)|바꾼다|붙인다|넘긴다|표시한다/;
const OURS = {
  R4: '제가 확실히 말씀드릴 수 있는 범위를 넘는 표현이었습니다. 조건은 상담에서 정확히 확인해 드리겠습니다.',
  R8: '관련해서 안내드릴 사항이 있어 상담사가 함께 확인해 드리겠습니다.',
};

/** 위반 시 대신 내보낼 문장 */
export function replacementFor(hits) {
  const first = hits.find(h => h.severity === 'block');
  if (!first) return null;
  const r = rule(first.rule);
  /* reply 가 있으면 그게 정답이다 — 손님에게 나가라고 쓴 문장이다 */
  if (r.reply) return r.reply;
  const legacy = r.on_violation;
  if (!legacy || LOOKS_LIKE_INSTRUCTION.test(legacy)) return OURS[first.rule] ?? null;
  return legacy;
}

/**
 * 응대 표준 검사기.
 *
 * 🔴 이 파일은 모델을 한 번도 부르지 않는다. 전부 규칙이다 — 0초, 비용 0.
 *    「AI를 어디에 쓰느냐가 아니라 어디에 안 쓰느냐」가 이 파일의 존재 이유다.
 *
 * 두 갈래로 쓴다.
 *   screenUser(들어온 말)   → 모델을 불러도 되는지 먼저 판정한다. 개인정보가 보이면 안 부른다.
 *   checkAnswer(나갈 답변)  → 나가기 전에 규칙 위반을 잡는다. block 이면 대체 문구로 바꾼다.
 *
 * 표준(rules/intents/industries)은 인자로 받는다. Node·브라우저·워커 어디서든 같은 코드를 쓴다.
 */

const rx = (source, flags = "g") => new RegExp(source, flags);

/** 문장 단위로 자른다. 금액과 조건이 같은 문장 안에 있는지 보려면 문장이 필요하다. */
export function sentences(text) {
  return String(text ?? "")
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const findRule = (std, id) => std.rules.find((r) => r.id === id);

/* ────────────────────────── 들어온 말 ────────────────────────── */

/**
 * R5. 강한 신호가 보이면 모델을 부르지 않는다.
 * 마스킹이 1차 방어선이 아니다 — 아예 안 보내는 것이 1차다.
 */
export function screenUser(std, text) {
  const r5 = findRule(std, "R5");
  const hits = [];
  for (const [kind, pattern] of Object.entries(r5.strong_signals)) {
    if (rx(pattern).test(String(text ?? ""))) hits.push(kind);
  }
  return {
    blocked: hits.length > 0,
    hits,
    // 규칙이 직접 응대한다. 모델 호출 0회.
    reply: hits.length ? r5.reply : null,
  };
}

/** 약한 신호까지 가린 사본. 모델에 보낼 때는 반드시 이걸 보낸다. 이력도 마스킹본만. */
export function maskUser(std, text) {
  const r5 = findRule(std, "R5");
  let out = String(text ?? "");
  for (const [kind, pattern] of Object.entries(r5.strong_signals)) {
    out = out.replace(rx(pattern), `[${kind}]`);
  }
  return out;
}

/* ────────────────────────── 나갈 답변 ────────────────────────── */

const hit = (rule, severity, where, why, suggest) => ({
  rule: rule.id,
  name: rule.name,
  severity,
  where,
  why,
  suggest,
});

/** R2. 금액이 있는 문장에 조건어가 하나도 없으면 위반. */
function checkPrice(std, text) {
  const r = findRule(std, "R2");
  const out = [];
  for (const s of sentences(text)) {
    const hasMoney = r.money_patterns.some((p) => rx(p).test(s));
    if (!hasMoney) continue;
    // 🔴 낱말만 보면 「주 3회에 월 290,000원」이 조건 없는 금액이 된다. 수량도 조건이다.
    const hasTerm =
      r.term_markers.some((m) => s.includes(m)) || (r.term_patterns ?? []).some((p) => rx(p).test(s));
    if (!hasTerm) out.push(hit(r, r.severity, s, "금액만 있고 조건이 없다", r.reply));
  }
  return out;
}

/** R3. 후보가 둘 이상인데 하나를 지목하면 위반. */
function checkPick(std, text, candidateCount) {
  const r = findRule(std, "R3");
  if (!(candidateCount >= 2)) return [];
  const escalation = r.escalation_words ?? [];
  // 🔴 문장 단위로 본다. 같은 문장에 상담·담당자가 있으면 상품을 고른 게 아니라
  //    사람에게 넘긴 것이다. 「상담을 받으시는 걸 추천합니다」를 막으면
  //    우리가 바라는 행동을 막는 셈이 된다(실제 모델 대조군 실측).
  const found = [];
  for (const s of sentences(text)) {
    if (escalation.some((w) => s.includes(w))) continue;
    for (const p of r.pick_patterns) if (s.includes(p)) found.push(p);
  }
  return found.length
    ? [hit(r, r.severity, [...new Set(found)].join(", "), `근거 후보가 ${candidateCount}개인데 하나를 지목했다`, r.reply)]
    : [];
}

/**
 * 🔴 부정이 뒤따르면 금지어가 아니다.
 * 「어느 과정이 가장 저렴한지 말씀드릴 수 없습니다」는 최상급을 쓴 게 아니라
 * 못 쓴다고 거절한 문장이다. 이걸 막으면 게이트가 없느니만 못해진다(실제 모델 실측).
 */
const NEGATED = /없|않|못|어렵|아닙|아니|불가/;
const isNegated = (text, word) => {
  let from = 0;
  for (;;) {
    const at = text.indexOf(word, from);
    if (at < 0) return from > 0; // 나온 자리가 전부 부정 안이면 위반이 아니다
    if (!NEGATED.test(text.slice(at + word.length, at + word.length + 25))) return false;
    from = at + word.length;
  }
};

/** R4. 최상급·보장은 block, 절대어는 review. 좁게 잡는다. */
function checkDeny(std, text, industry) {
  const r = findRule(std, "R4");
  const out = [];
  const flag = (w) => text.includes(w) && !isNegated(text, w);
  for (const g of r.groups) {
    for (const w of g.words) {
      if (flag(w)) out.push(hit(r, g.severity, w, `${g.name} 표현`, r.reply));
    }
  }
  for (const w of industry?.extra_deny ?? []) {
    if (flag(w)) out.push(hit(r, "block", w, `${industry.name} 업종 금지 표현`, r.reply));
  }
  return out;
}

/** R5(답변 쪽). 봇이 개인정보를 되받아 적으면 그것도 사고다. */
function checkEcho(std, text) {
  const r = findRule(std, "R5");
  const { hits } = screenUser(std, text);
  return hits.length ? [hit(r, "block", hits.join(", "), "답변에 개인정보가 그대로 들어 있다", "가리고 내보낸다")] : [];
}

/** R6. 같은 걸 세 번 못 풀면 넘긴다. */
function checkTurn(std, turn) {
  const r = findRule(std, "R6");
  return turn > r.limit
    ? [hit(r, r.severity, `${turn}턴`, `${r.limit}턴을 넘겼다`, r.reply)]
    : [];
}

/** R7. 근거가 없는데 얼버무리면 표시한다. */
function checkHedge(std, text, evidence) {
  const r = findRule(std, "R7");
  if (evidence && evidence.trim()) return [];
  const found = r.hedge_words.filter((w) => text.includes(w));
  return found.length
    ? [hit(r, r.severity, found.join(", "), "근거 없이 얼버무렸다", r.reply)]
    : [];
}

/** R8. 취소·환불 유형이면 고지 블록이 붙어야 한다. */
function checkNotice(std, text, intent, industry) {
  const r = findRule(std, "R8");
  if (!r.applies_to.includes(intent)) return [];
  const notice = industry?.notice_on?.[intent] ?? industry?.notice_on?.["*"];
  if (!notice) {
    return [hit(r, "review", intent, "이 업종에 고지문이 설정돼 있지 않다", "업종 설정에 고지문을 넣는다")];
  }
  // 고지문 전체가 아니라 앞머리만 대조한다. 문구를 조금 다듬어도 통과해야 한다.
  const head = notice.slice(0, 12);
  return text.includes(head)
    ? []
    : [hit(r, r.severity, intent, "고지 블록이 빠졌다", notice)];
}

/**
 * R1. 근거 밖 침묵 — 기계로는 절반만 본다.
 * 답변에 나온 수치가 근거에 없으면 지어냈을 가능성이 크다.
 * 🔴 애매하면 판정하지 않는다. 한 자리 숫자·목록 번호는 세지 않는다.
 */
function checkGrounded(std, text, evidence) {
  const r = findRule(std, "R1");
  if (!evidence || !evidence.trim()) return [];
  // 🔴 「14:00~22:00, 토요일」에서 `00,` 을 숫자로 집어내고 있었다.
  //    근거에 그런 토막이 있을 리 없으니, 자료에 없다고 올바르게 거절한 답이
  //    되레 위반으로 잡혔다(실제 모델 대조군 실측에서 4건). 대조군 숫자가 그만큼 부풀어 있었다.
  //    세 자리 묶음이거나 두 자리 이상 연속된 숫자만 센다 — 꼬리에 쉼표를 달지 않는다.
  const nums = [...new Set(String(text).match(/\d{1,3}(?:,\d{3})+|\d{2,}/g) ?? [])];
  const ungrounded = nums.filter((n) => !evidence.includes(n));
  return ungrounded.length
    ? [hit(r, r.severity, ungrounded.join(", "), "근거 자료에 없는 수치다", r.reply)]
    : [];
}

/**
 * 나갈 답변을 검사한다.
 *
 * @param {object} std                표준 묶음 { rules, intents, industries }
 * @param {object} o
 * @param {string} o.text             봇이 하려는 말
 * @param {string} o.intent           문의 유형 id
 * @param {string} [o.industryId]     업종 id
 * @param {string} [o.evidence]       근거 색인에서 꺼낸 원문
 * @param {number} [o.turn]           같은 주제로 몇 번째 턴인가
 * @param {number} [o.candidateCount] 근거에서 찾은 후보 개수
 */
export function checkAnswer(std, { text, intent, industryId, evidence = "", turn = 1, candidateCount = 0 }) {
  const industry = std.industries?.find((i) => i.id === industryId) ?? null;
  const body = String(text ?? "");

  const violations = [
    ...checkPrice(std, body),
    ...checkPick(std, body, candidateCount),
    ...checkDeny(std, body, industry),
    ...checkEcho(std, body),
    ...checkTurn(std, turn),
    ...checkHedge(std, body, evidence),
    ...checkNotice(std, body, intent, industry),
    ...checkGrounded(std, body, evidence),
  ];

  const blocks = violations.filter((v) => v.severity === "block");
  return {
    pass: blocks.length === 0,
    blocked: blocks.length > 0,
    violations,
    blocks,
    reviews: violations.filter((v) => v.severity === "review"),
  };
}

/* ────────────────────────── 유형 분류 ────────────────────────── */

/**
 * 들어온 말이 어느 유형인지 규칙으로 먼저 본다. 모델을 부르기 전에 한다.
 * 🔴 확실하지 않으면 판정하지 않는다(null). 억지로 하나를 고르면 그게 틀린 규칙을 부른다.
 * @param {object} [industry] 업종. 주면 그 업종 어휘까지 신호로 쓴다.
 */
export function classify(std, text, industry = null) {
  const body = String(text ?? "");
  // 🔴 업종을 고르면 그 업종의 말이 들린다. 「수강료」는 표준 신호에 없다.
  const vocab = industry?.vocab ?? {};
  // 🔴 개수가 아니라 길이로 센다. 「수강료 조건까지 알려주세요」에서
  //    「수강료」(가격)와 「조건」(가능여부)이 똑같이 1표를 받아 동점이 됐고,
  //    동점이면 판정하지 않는 규칙 때문에 엉뚱한 유형으로 흘렀다(데모 실측).
  //    긴 낱말일수록 그 유형에만 쓰이는 말이다.
  const scored = std.intents
    .map((i) => {
      const matched = [...i.signals, ...(vocab[i.id] ?? [])].filter((s) => body.includes(s));
      return {
        id: i.id,
        name: i.name,
        score: matched.reduce((sum, s) => sum + s.length, 0),
        // 🔴 동점을 가르는 두 번째 잣대 — 한국어는 문장 끝에 핵심이 온다.
        //    「조건 말고 숫자만요. 얼마예요」에서 「조건」과 「얼마」가 2:2 로 묶여
        //    판정을 포기했다(시험장 실측). 정작 묻는 것은 끝에 있는 「얼마」다.
        last: matched.reduce((m, s) => Math.max(m, body.lastIndexOf(s)), -1),
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.last - a.last);

  if (!scored.length) return { intent: null, confident: false, ranked: [] };
  // 점수도 위치도 같으면 고르지 않는다. R3 의 정신을 분류에도 적용한다.
  const tied = scored.length > 1 && scored[0].score === scored[1].score && scored[0].last === scored[1].last;
  const confident = !tied;
  return { intent: confident ? scored[0].id : null, confident, ranked: scored };
}

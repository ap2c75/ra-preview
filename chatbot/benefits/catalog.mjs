/* 혜택표 → 챗봇 상품 목록
 *
 * 파서가 뽑은 6천 건은 「행」이지 「상품」이 아니다.
 * 같은 제품이 약정·관리방식·등급에 따라 여러 행으로 흩어져 있다.
 * 챗봇이 쓰려면 **제품 하나 → 약정 몇 개 → 그 약정의 선택지 몇 개**로 접어야 한다.
 *
 * 🔴 접으면서 요금을 하나로 고르지 않는다. 선택지가 여럿이면 여럿인 채로 남긴다.
 *    거기서 하나를 고르는 순간 그건 지어낸 조건이 된다(§청호 S/P/J 등급 미상).
 */

import { withBenefit } from './query.mjs';

const slug = s => String(s ?? '')
  .toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const displayName = s => String(s ?? '').replace(/^\s*\[[^\]]{1,12}\]\s*/, '').trim();

/**
 * 제품 단위로 접는다.
 *   [{ code, name, brand, category, terms: [{ m, options: [...] }] }]
 * options 안에는 요금과 혜택이 그대로 남는다 — 접는 것은 목록이지 값이 아니다.
 */
export function buildCatalog(offers, { onlyWithBenefit = true, limit = 12 } = {}) {
  const src = onlyWithBenefit ? withBenefit(offers) : offers;
  const byProduct = new Map();
  /* 표기 차이를 지우고 비교하기 위한 납작화 — 「CWM-AT1210B」와 「cwm at1210b」를 같게 본다 */
  const flat = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const o of src) {
    if (!o.product || o.monthlyFee == null || o.termMonths == null) continue;
    /* 🔴 제품명만으로 묶으면 너무 성기다 — 코웨이는 「스마트매트리스」 하나에 모델이 수십 개라
          한 약정에 선택지 30개가 나왔다. 모델명이 있으면 그것까지가 제품 정체다. */
    /* 🔑 유통사 표의 제조사를 이름 앞에 붙인다 — 「AI Q9000 에어컨」보다 「삼성전자 AI Q9000」이 낫다 */
    const raw = displayName(o.product);
    const base = o.maker && !raw.includes(o.maker) ? `${o.maker} ${raw}` : raw;
    /* 🔴 제품명 칸에 **모델명이 이미 들어 있는 시트가 있다**(쿠쿠). 그대로 붙이면
          「세탁기 CWM-AT1210B CWM-AT1210B」가 되어 고객 화면에 나간다(2026-09-09 실측).
          위 maker 와 같은 방식으로 막되, 표기 차이(`-`·공백·대소문자)를 지우고 비교한다. */
    const name = o.model && !flat(base).includes(flat(o.model)) ? `${base} ${o.model}` : base;
    const key = `${o.brand}|${name}`;
    if (!byProduct.has(key)) {
      byProduct.set(key, { code: slug(`${o.brand}-${name}`), name, brand: o.brand,
                           maker: o.maker ?? null, category: o.category ?? null, _terms: new Map() });
    }
    const p = byProduct.get(key);
    if (!p._terms.has(o.termMonths)) p._terms.set(o.termMonths, []);
    p._terms.get(o.termMonths).push({
      fee: o.monthlyFee,
      discountedFee: o.discountedFee ?? null,
      discountText: o.discountText ?? null,
      promo: o.promo ?? null,
      brandNotice: o.brandNotice ?? null,
      maker: o.maker ?? null,
      note: o.note ?? null,
      condition: o.condition ?? null,
      careType: o.careType ?? null,
      careCycle: o.careCycle ?? null,
      totalMonths: o.totalMonths ?? null,
      sourceRow: o.sourceRow,
    });
  }

  const out = [];
  for (const p of byProduct.values()) {
    const terms = [...p._terms.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([m, options]) => ({ m, options: dedupeOptions(options) }));
    delete p._terms;
    out.push({ ...p, terms });
  }

  /* 혜택이 많이 붙은 것부터 — 상담 첫 화면에 올릴 순서다 */
  out.sort((a, b) => countPromos(b) - countPromos(a) || a.name.localeCompare(b.name, 'ko'));
  return limit ? out.slice(0, limit) : out;
}

/* 같은 요금·같은 혜택이면 한 줄로 본다 (등급만 다른 중복 행) */
function dedupeOptions(list) {
  const seen = new Map();
  for (const o of list) {
    const k = `${o.fee}|${o.discountedFee}|${o.promo}|${o.careType}|${o.careCycle}`;
    if (!seen.has(k)) seen.set(k, o);
  }
  return [...seen.values()].sort((a, b) => (a.discountedFee ?? a.fee) - (b.discountedFee ?? b.fee));
}

const countPromos = p => p.terms.reduce((n, t) => n + t.options.filter(o => o.promo || o.discountedFee).length, 0);

/** 이 약정에서 실제로 낼 금액의 범위 */
export function feeRange(term) {
  const fees = term.options.map(o => o.discountedFee ?? o.fee);
  return { min: Math.min(...fees), max: Math.max(...fees), count: new Set(fees).size };
}

/** 이 약정에 실제로 붙는 혜택만. 🔴 사업자 월 공지는 여기 넣지 않는다. */
export function promosOf(term) {
  const set = new Set();
  for (const o of term.options) {
    if (o.promo) set.add(cleanPromo(o.promo));
    if (o.discountText && o.discountedFee != null) set.add(`${o.discountText} 할인`);
  }
  return [...set];
}

/** 사업자 월 공지 — 약정별 적용 여부가 다르므로 「혜택」이라 말하지 않는다 */
export function noticesOf(term) {
  return [...new Set(term.options.map(o => o.brandNotice).filter(Boolean).map(cleanPromo))];
}

/** 자유 기재란 — 혜택일 수도 제한일 수도 있어 「참고」로만 전한다 */
export function notesOf(term) {
  return [...new Set(term.options.map(o => o.note).filter(Boolean).map(cleanPromo))];
}

export function cleanPromo(s) {
  return String(s)
    .replace(/^[■●◆※▶\-\s]+/, '')
    .replace(/\s*\(\s*\d+\s*,\s*\d+\s*회차\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* 혜택 레코드 조회 — 순수 함수만
 *
 * 🔴 왜 갈랐나 — `parse.mjs` 는 파일을 읽으므로 Node 전용이다.
 *    챗봇 화면(브라우저)이 조회 함수를 쓰려고 파서를 불러오면
 *    "Failed to resolve module specifier fs" 로 죽는다. 실제로 죽었다.
 *    읽는 쪽(parse)과 고르는 쪽(query)을 갈라 둔다.
 */

const norm = s => String(s ?? '').replace(/\s+/g, '').toLowerCase();

/** 제품 이름·모델명으로 찾는다. 브랜드·약정으로 좁힐 수 있다. */
export function find(offers, { keyword, brand, termMonths } = {}) {
  const k = norm(keyword);
  return offers.filter(o =>
    (!brand || o.brand === brand) &&
    (!termMonths || o.termMonths === termMonths) &&
    (!k || norm(o.product).includes(k) || norm(o.model).includes(k) || norm(o.category).includes(k))
  );
}

/** 고객에게 실제로 이득이 되는 것이 붙어 있는 건만
 *  🔴 사업자 월 공지(brandNotice)는 혜택으로 세지 않는다 — 모든 행에 똑같이 붙어 있어
 *     그걸로 거르면 시트 전체가 「혜택 있음」이 된다. */
export function withBenefit(offers) {
  return offers.filter(o =>
    (o.discountedFee != null && o.discountedFee < o.monthlyFee) || o.promo || o.discountText);
}

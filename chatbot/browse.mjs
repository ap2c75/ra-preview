export const PAGE_SIZE = 3;
export const SORTS = Object.freeze({default:'기본 순서',priceAsc:'월요금 낮은 순',priceDesc:'월요금 높은 순',name:'제품명 순'});
export const validSort = sort => Object.hasOwn(SORTS,sort) ? sort : 'default';
// Take fee and its conditions from one eligible option, never from different plans.
export function minimumOption(card) {
  return card.plans.flatMap(plan=>plan.options.map(option=>({...option,months:plan.months})))
    .filter(option=>Number.isFinite(option.fee)&&option.fee>=0)
    .sort((a,b)=>a.fee-b.fee||a.months-b.months)[0];
}
export function orderedCards(all,state) {
  const sort=validSort(state.sort),byName=(a,b)=>a.name.localeCompare(b.name,'ko')||String(a.code).localeCompare(String(b.code));
  const cards=[...all].sort(byName);
  if(sort==='priceAsc'||sort==='priceDesc') {
    const fees=new Map(cards.map(card=>[card,minimumOption(card).fee]));
    return cards.sort((a,b)=>(fees.get(a)-fees.get(b))*(sort==='priceAsc'?1:-1)||byName(a,b));
  }
  if(sort==='default'&&state.filters.brands?.length) {
    const first=state.filters.brands.map(brand=>cards.find(card=>card.brand===brand)).filter(Boolean);
    return [...first,...cards.filter(card=>!first.includes(card))];
  }
  return cards;
}
export function pageData(all,state) {
  const cards=orderedCards(all,state),total=cards.length,pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const requested=Number.isFinite(state.offset)?Math.max(0,Math.floor(state.offset/PAGE_SIZE)):0;
  const index=Math.min(requested,pages-1),offset=index*PAGE_SIZE;
  state.offset=offset;
  return {cards:cards.slice(offset,offset+PAGE_SIZE),total,page:index+1,pages,start:total?offset+1:0,end:Math.min(total,offset+PAGE_SIZE),previous:index>0,more:index+1<pages};
}
export function orderDescription(state) {
  if(validSort(state.sort)==='priceAsc')return '현재 조건에 맞는 각 상품의 최저 월요금이 낮은 순으로 표시합니다.';
  if(validSort(state.sort)==='priceDesc')return '현재 조건에 맞는 각 상품의 최저 월요금이 높은 순으로 표시합니다.';
  if(validSort(state.sort)==='default'&&state.filters.brands?.length)return '선택한 브랜드별 상품을 먼저 하나씩 보여드린 뒤, 나머지는 제품명 순으로 표시합니다.';
  return '제품명 순으로 표시합니다.';
}
export function browseRequest(text) {
  const t=String(text).replace(/\s+/g,'').replace(/[.!?~]+$/,'');
  // Exact navigation phrases cannot swallow a support question or ownership transfer.
  if(/^(다음(상품|페이지)(도)?(보여줘|보여주세요|보기|볼게요|주세요)?|다른상품(보여줘|보여주세요))$/.test(t))return {action:'more'};
  if(/^이전(상품|페이지)(으?로)?(보여줘|보여주세요|보기|돌아가줘|돌아가기)?$/.test(t))return {action:'previous'};
  if(/^(첫|처음)(상품|페이지)(으?로)?(보여줘|보여주세요|보기|돌아가줘|돌아가기)?$/.test(t))return {action:'first'};
  // Non-monthly fees and benefit sizes must not be interpreted as monthly sorting.
  if(/설치비|등록비|사은품|지원금|위약금|총납입|총비용/.test(t))return {};
  const rules=[['priceAsc',/(?:저렴한|싼|낮은)(?:것부터|거부터|순)/g],['priceDesc',/(?:비싼|높은)순/g],['name',/(?:제품명|상품명|이름)순/g],['default',/기본(?:순서|순)/g]];
  const choices=[];
  for(const [sort,re] of rules)for(const m of t.matchAll(re))if(!/^(?:으로)?(?:말고|아니고|제외)/.test(t.slice(m.index+m[0].length)))choices.push(sort);
  const unique=[...new Set(choices)];
  return unique.length>1?{clarification:'월요금이 낮은 순, 높은 순, 제품명 순 중 어떤 순서로 볼까요?'}:unique.length?{sort:unique[0]}:{};
}

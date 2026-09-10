const TYPES=new Set(['cash_support','gift','rental_discount','fee_waiver','trade_in']);
export function validateBenefitFeed(data,now=Date.now(),{allowDraft=false}={}){
 if(!data||data.format!=='somun-public-benefits-v1'||typeof data.version!=='string'||!Array.isArray(data.entries))throw Error('INVALID_BENEFIT_FEED');
 if(data.status==='draft'&&allowDraft)return data;
 if(data.status!=='reviewed'||!Number.isFinite(Date.parse(data.validFrom))||!Number.isFinite(Date.parse(data.validUntil))||now<Date.parse(data.validFrom)||now>=Date.parse(data.validUntil)||!data.reviewedBy?.trim())throw Error('BENEFIT_FEED_NOT_ACTIVE');
 const keys=new Set();
 for(const entry of data.entries){
  if(!entry||typeof entry.productCode!=='string'||!entry.productCode.trim()||!TYPES.has(entry.type)||typeof entry.publicLabel!=='string'||!entry.publicLabel.trim()||entry.publicLabel.length>160||typeof entry.conditions!=='string'||!entry.conditions.trim()||typeof entry.sourceRef!=='string'||!entry.sourceRef.trim()||!Number.isFinite(Date.parse(entry.verifiedAt)))throw Error('INVALID_BENEFIT_ENTRY');
  if(entry.amountWon!=null&&(!Number.isInteger(entry.amountWon)||entry.amountWon<0))throw Error('INVALID_BENEFIT_AMOUNT');
  if(entry.commission!=null||entry.dealerFee!=null||/총판\s*수수료|판매\s*수수료/.test(entry.publicLabel+' '+entry.conditions))throw Error('PRIVATE_COMMISSION_BLOCKED');
  const key=entry.productCode+'|'+entry.type;if(keys.has(key))throw Error('DUPLICATE_BENEFIT');keys.add(key);
 }
 return data;
}
export function applyBenefitFeed(products,feed){
 const grouped=new Map();for(const entry of feed?.entries||[]){if(!grouped.has(entry.productCode))grouped.set(entry.productCode,[]);grouped.get(entry.productCode).push(entry);}
 return products.map(product=>{const benefits=grouped.get(product.code)||[];if(!benefits.length)return product;const supportAmount=Math.max(0,...benefits.map(v=>v.amountWon||0)),label=benefits.map(v=>v.publicLabel).join(' · ');return {...product,terms:product.terms.map(term=>({...term,options:(term.options||[{fee:term.fee}]).map(option=>({...option,publicBenefit:label,publicSupportAmount:supportAmount,benefitVersion:feed.version}))}))};});
}

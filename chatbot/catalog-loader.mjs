export function validateCatalog(data,now=Date.now()){
 if(!data||!['preview','test','reviewed'].includes(data.mode)||!Array.isArray(data.products))throw Error('invalid');
 if(data.mode==='reviewed'&&!data.validUntil)throw Error('invalid');
 if(data.validUntil&&(!Number.isFinite(Date.parse(data.validUntil))||now>=Date.parse(data.validUntil)))throw Error('expired');
 const codes=new Set();for(const p of data.products){
  if(!p||typeof p.code!=='string'||!p.code||codes.has(p.code)||typeof p.name!=='string'||typeof p.brand!=='string'||!Array.isArray(p.terms))throw Error('invalid');codes.add(p.code);
  for(const t of p.terms){if(!Number.isInteger(t.m)||t.m<1|| (t.options!==undefined&&!Array.isArray(t.options)))throw Error('invalid');for(const o of t.options||[{fee:t.fee}])if(!o||!Number.isFinite(o.fee)||o.fee<0||(o.discountedFee!=null&&(!Number.isFinite(o.discountedFee)||o.discountedFee<0)))throw Error('invalid');}
 }
 return data;
}
export function createCatalogLoader({fetcher=signal=>fetch('/ra-preview/chatbot/api/catalog.json',{cache:'default',signal}).then(r=>{if(!r.ok)throw Error('network');return r.json();}),now=Date.now,timeoutMs=10000,onChange=()=>{}}={}){
 let value={status:'idle',products:[],checkedAt:null},pending=null;
 const emit=next=>{value=next;onChange(value);return value;};
 function checkExpiry(){if(value.status==='ready'&&value.validUntil&&now()>=Date.parse(value.validUntil))emit({...value,status:'expired',products:[]});return value;}
 function refresh(){if(pending)return pending;emit({...value,status:'loading',products:[]});const controller=new AbortController();let timer;
 pending=(async()=>{try{const data=await Promise.race([fetcher(controller.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'));},timeoutMs);})]);validateCatalog(data,now());emit({...data,status:'ready',checkedAt:now()});}catch(e){emit({status:e.message==='expired'?'expired':'error',products:[],checkedAt:value.checkedAt});}finally{clearTimeout(timer);pending=null;}return value;})();return pending;}
 return {refresh,checkExpiry,get:()=>value};
}

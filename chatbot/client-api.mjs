const RUNTIME_URL='/ra-preview/chatbot/api/runtime.json';
const SESSION_KEY='somun-consultation-session-v1';

export function createClientApi({storage=sessionStorage,fetcher=fetch}={}){
 let runtimePromise=null;
 const runtime=()=>runtimePromise||(runtimePromise=fetcher(RUNTIME_URL,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null));
 const session=()=>storage.getItem(SESSION_KEY)||'';
 const setSession=value=>value?storage.setItem(SESSION_KEY,value):storage.removeItem(SESSION_KEY);
 async function request(path,{method='GET',body,auth=true}={}){
  const config=await runtime();
  if(!config?.configured||!/^https?:\/\//.test(config.apiBase||''))throw new Error('API_NOT_CONFIGURED');
  const headers={accept:'application/json'};
  if(body!==undefined)headers['content-type']='application/json';
  if(auth&&session())headers.authorization='Bearer '+session();
  const response=await fetcher(config.apiBase.replace(/\/$/,'')+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',mode:'cors'});
  const value=(response.headers.get('content-type')||'').includes('application/json')?await response.json():null;
  if(!response.ok)throw new Error(value?.error||'API_ERROR');
  if(value?.sessionToken)setSession(value.sessionToken);
  return value;
 }
 async function api(path,payload={}){
  if(path==='status')return request('/api/status',{auth:false});
  if(path==='resume')return request('/api/session');
  if(path==='cancel')return request('/api/session/cancel',{method:'POST',body:{}});
  if(path==='end-session'){const result=await request('/api/session',{method:'DELETE'});setSession('');return result;}
  if(path==='intake')return request('/api/intakes',{method:'POST',body:payload,auth:false});
  if(path==='receipt')return request('/api/intakes/'+encodeURIComponent(payload.id));
  if(path==='withdraw'){const result=await request('/api/intakes/'+encodeURIComponent(payload.id),{method:'DELETE'});setSession('');return result;}
  if(path==='recovery-code')return request('/api/intakes/'+encodeURIComponent(payload.id)+'/recovery-code',{method:'POST',body:{}});
  if(path==='recover')return request('/api/recover',{method:'POST',body:{code:payload.code},auth:false});
  if(path==='quality')return request('/api/quality',{method:'POST',body:payload,auth:false});
  if(path==='chat'){
   const config=await runtime(),base=config?.aiBase;
   if(!config?.aiConfigured||!/^https:\/\//.test(base||''))throw new Error('AI_NOT_CONFIGURED');
   const response=await fetcher(base.replace(/\/$/,'')+'/api/chat',{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store',mode:'cors'});
   const value=(response.headers.get('content-type')||'').includes('application/json')?await response.json():null;
   if(!response.ok)throw new Error(value?.error||'AI_UNAVAILABLE');
   return value;
  }
  if(path==='update-contact')return request('/api/intakes/'+encodeURIComponent(payload.id)+'/contact',{method:'PATCH',body:{phone:payload.phone}});
  throw new Error('UNKNOWN_API_PATH');
 }
 return {api,runtime,clearSession:()=>setSession('')};
}

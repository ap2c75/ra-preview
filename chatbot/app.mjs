const widgetMode=location.pathname.endsWith('/widget.html');if(widgetMode)document.body.classList.add('is-widget');
import {validSort,pageData,minimumOption,orderDescription} from '/ra-preview/chatbot/browse.mjs';
import {createCatalogLoader} from '/ra-preview/chatbot/catalog-loader.mjs';
import {bindPhoneInput} from '/ra-preview/chatbot/phone-input.mjs';
import {mountAddressPicker} from '/ra-preview/chatbot/address-picker.mjs';
import {activeEntries} from '/ra-preview/chatbot/knowledge.mjs';
import { initialState, respond, filterLabels, cardsFor } from '/ra-preview/chatbot/conversation.mjs?v=conversation-repair-20260910-2';

let siteData=null;
fetch('/ra-preview/chatbot/site-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(d.format==='somun-site-v1')siteData=d;}).catch(()=>{siteData=null;});
let knowledgeEntries=[],knowledgeRequest=0;
async function refreshKnowledge(){const request=++knowledgeRequest,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);try{const r=await fetch('/ra-preview/chatbot/api/knowledge.json',{cache:'no-store',signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();if(request===knowledgeRequest)knowledgeEntries=activeEntries(data.entries);}catch{if(request===knowledgeRequest)knowledgeEntries=[];}finally{clearTimeout(timer);}}

window.addEventListener('focus',refreshKnowledge);
setInterval(()=>{if(!document.hidden)refreshKnowledge();},5*60000);
let SAMPLE_PRODUCTS=[],catalogMetadata={status:'idle'};
const $ = q => document.querySelector(q);
const el = (tag, text, className) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
let state = initialState(), busy = false, dialogEpoch = 0, offer = null, receipt = null;
const money = n => Number(n).toLocaleString('ko-KR') + '원';
const emptyContent = $('#results').cloneNode(true);
let visibleCards = 0, recommendationView = false;

let entryMode = 'waiting', serviceMode='preview';
let nextCatalogRetry=0;
const catalogLoader=createCatalogLoader({onChange:catalogChanged});
function catalogReady(){return catalogLoader.checkExpiry().status==='ready';}
function showCatalogUnavailable(){
 visibleCards=0;$('#mobile-count').textContent='0';$('#result-count').textContent='확인 필요';$('#results-title').textContent='상품 자료 확인';
 const box=el('div',null,'empty-state');box.append(el('h3',catalogMetadata.status==='loading'?'상품 자료를 불러오고 있어요.':catalogMetadata.status==='expired'?'상품 자료의 적용기간이 지났어요.':'상품 자료를 불러오지 못했어요.'),el('p','상품이 없다는 뜻은 아닙니다. 연결을 확인하고 다시 불러와 주세요. 상담 접수·관리는 계속 이용할 수 있습니다.'));
 const retry=button('상품 자료 다시 불러오기',()=>catalogLoader.refresh(),'primary');retry.disabled=catalogMetadata.status==='loading';box.append(retry);$('#results').replaceChildren(box);renderBrowse();
}
function catalogChanged(value){
 if(['error','expired'].includes(value.status))nextCatalogRetry=Date.now()+30000;
 catalogMetadata=value;SAMPLE_PRODUCTS=value.products;$('#catalog-status').hidden=value.status==='ready';$('#catalog-state').textContent=value.status==='loading'?'상품 자료 확인 중':value.status==='expired'?'상품 자료 적용기간 만료':'상품 자료 연결 실패';$('#retry-catalog').disabled=value.status==='loading';
 if(entryMode==='waiting')return;
 if(value.status!=='ready'){showCatalogUnavailable();return;}
 const all=cardsFor(SAMPLE_PRODUCTS,state.filters),before=state.selected.length;state.selected=state.selected.filter(code=>all.some(c=>c.code===code));
 if(before!==state.selected.length)say('갱신된 자료에 없는 담은 상품을 목록에서 뺐어요.');
 if(!state.filters.category&&!state.filters.model){showEmpty();return;}
 const comparison=state.view==='compare'&&state.selected.length>=2;if(!comparison)state.view='list';
 const cards=comparison?state.selected.map(code=>all.find(c=>c.code===code)):pageData(all,state).cards;state.visibleCodes=cards.map(c=>c.code);renderCards(cards,comparison);renderBrowse();renderActions();
}

function applyServiceMode(status){serviceMode=status.mode||'preview';if(['internal','test'].includes(serviceMode)){$('.preview').textContent=serviceMode==='internal'?'내부 검증':'기능 테스트';}}
let receiptCheck={phase:'idle',checkedAt:null},receiptRequest=null,receiptGeneration=0;
function setReceipt(value){receipt=value;receiptGeneration++;receiptRequest=null;receiptCheck={phase:value?.status==='stored'?'fresh':'idle',checkedAt:value?.status==='stored'?Date.now():null};}
function receiptCheckText(){
 const time=receiptCheck.checkedAt?new Date(receiptCheck.checkedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):null;
 const last=time?'마지막 확인 '+time:'';
 return ({checking:'최신 상태 확인 중 · '+last,stale:'상태 갱신 실패 · '+last,unavailable:'접수 조회 불가 · 접속 만료 또는 접수 삭제·만료 여부를 확인해야 합니다.'})[receiptCheck.phase]||last;
}
function renderReceiptState(){
 const stored=receipt?.status==='stored';$('#receipt-status').hidden=!stored;
 const label=stored?({queued:'접수 완료 · 담당자 확인 대기',received:'담당자 접수 확인',consulting:'상담 진행 중',completed:'상담 완료'})[receipt.delivery]||'정보 저장 · 접수함 등록 대기':'';
 $('#receipt-state').textContent=receiptCheck.phase==='unavailable'?'접수 상태 확인 필요':(receiptCheck.phase==='stale'?'마지막 확인 상태: ':'')+label;
 $('#receipt-freshness').textContent=stored?receiptCheckText():'';
 $('#receipt-status').dataset.freshness=receiptCheck.phase;
 $('#retry-receipt').disabled=receiptCheck.phase==='checking';
 const detail=$('#receipt-detail-status');if(detail)detail.textContent=receiptCheck.phase==='unavailable'?receiptCheckText():receiptText(receipt?.delivery)+'\n'+receiptCheckText();
 const retry=$('#retry-receipt-detail');if(retry)retry.disabled=receiptCheck.phase==='checking';
}
async function refreshReceipt(){
 const id=receipt?.id,generation=receiptGeneration;if(!id)return;if(receiptRequest)return receiptRequest;
 receiptCheck.phase='checking';renderReceiptState();
 receiptRequest=(async()=>{try{
  const current=await api('receipt',{id});if(receipt?.id!==id||generation!==receiptGeneration)return;
  if(current?.status!=='stored'||current.id!==id){receiptCheck.phase='unavailable';return;}
  receipt=current;receiptCheck={phase:'fresh',checkedAt:Date.now()};
 }catch(e){if(receipt?.id===id&&generation===receiptGeneration)receiptCheck.phase=['NOT_FOUND','SESSION_REQUIRED'].includes(e.message)?'unavailable':'stale';}
 finally{if(generation===receiptGeneration){receiptRequest=null;renderReceiptState();}}})();return receiptRequest;
}
setInterval(()=>{if(!document.hidden)refreshReceipt();},30000);
window.addEventListener('focus',refreshReceipt);window.addEventListener('online',refreshReceipt);
const isLocalPreview = ['127.0.0.1','localhost'].includes(location.hostname);
function setEntryStep(step) {
  $('.workspace').dataset.entryStep = step;
  document.querySelectorAll('#entry-progress [data-step]').forEach(n => {
    n.classList.toggle('current', n.dataset.step === step);
    if (n.dataset.step === step) n.setAttribute('aria-current','step'); else n.removeAttribute('aria-current');
  });
}
function initializeEntry() {
  entryMode = 'waiting'; renderReceiptState(); state = initialState(); visibleCards = 0; renderBrowse(); $('#product-feedback').hidden=true;
  $('.workspace').dataset.entry = 'waiting';
  $('.page-heading h1').textContent = '고객정보 확인부터 시작하겠습니다.';
  $('.page-note').lastChild.textContent = ' 고지·동의 후 고객정보를 입력합니다';
  $('#query').value = ''; $('#query').disabled = true; $('#composer button').disabled = true;
  $('#messages').replaceChildren();
  $('#filters').textContent = '고객정보 확인 전';
  $('.discovery-heading .eyebrow').textContent='CONSULTATION GUIDE';
  $('#results-title').textContent = '상담 진행 안내'; $('#result-count').textContent = '고객정보 먼저';
  $('#mobile-count').textContent = '0';
  const overview=el('div',null,'entry-overview');
  overview.append(el('p','상담 시작 전','eyebrow'),el('h3','고객정보를 확인한 뒤\n상담을 이어가겠습니다.'),el('p','아래 순서로 진행해 주세요. 입력하신 개인정보는 대화창에 표시하지 않습니다.'));
  const list=el('ol',null,'entry-step-list');
  for(const [title,description] of [['개인정보 고지·동의','수집 항목과 이용 목적, 보유기간을 먼저 확인합니다.'],['고객정보 입력','동의한 항목만 입력하고 내용을 확인합니다.'],['렌탈 상담 시작','정보 접수 후 원하시는 상품과 조건을 상담합니다.']]) {
    const li=el('li');li.append(el('strong',title),el('p',description));list.append(li);
  }
  overview.append(list); $('#results').replaceChildren(overview);
  $('#actions').replaceChildren(button('고객정보 확인하기',openConsent,'primary'));
  $('.privacy-hint').textContent='개인정보 안내에 동의한 후 입력해 주세요.';
  setPanel('chat'); setEntryStep('consent');
  say('안녕하세요, 소문입니다.\n원활한 상담을 위해 고객님의 정보 확인부터 진행하겠습니다.\n\n먼저 개인정보 수집·이용 안내를 확인해 주세요.');
}
function finishEntry(mode, interest = null, resumed = false) {
  if(mode==='saved' && receipt?.status!=='stored') return;
  if(mode==='preview' && !isLocalPreview) return;
  entryMode=mode; renderReceiptState(); $('.workspace').dataset.entry=mode;
  ++dialogEpoch; offer=null; $('#consent-body').replaceChildren(); $('#consent-dialog').close();
  $('#query').disabled=false; $('#composer button').disabled=false;
  $('.page-heading h1').textContent=mode==='browse'?'상품 정보만 살펴보실 수 있어요.':'이제 렌탈 상담을 이어가겠습니다.';
  $('.page-note').lastChild.textContent=mode==='saved'?' 고객정보 입력 완료':mode==='preview'?' 예시 흐름 · 개인정보 미수집':' 개인정보 없이 일반 상품 안내';
  $('.privacy-hint').textContent=mode==='preview'?'예시 미리보기 · 실제 개인정보를 입력하거나 저장하지 않습니다.':'이름·연락처는 대화창에 다시 적지 않으셔도 됩니다.';
  $('.discovery-heading .eyebrow').textContent='FOR YOUR HOME';
  setEntryStep('consultation'); renderFilters(); showEmpty(); renderActions(); setPanel('chat');
  if(mode==='saved') say(resumed?'이 브라우저에서 접수한 상담을 확인했습니다.\n고객정보를 다시 입력하지 않고 상담을 이어가실 수 있습니다.':'상담에 필요한 정보를 접수했습니다.\n이제 원하시는 상품과 조건을 살펴보겠습니다.');
  else if(mode==='preview') say('여기부터는 고정된 예시로 보는 상담 화면입니다. 실제 고객정보는 입력받거나 저장하지 않았습니다.\n\n정보 입력이 완료되면 이 단계에서 상품 상담을 시작합니다.');
  else if(mode==='review'){say('고객정보 확인을 마쳤습니다. 이제 원하시는 상품과 조건을 알려주세요. 검토용 입력값은 서버에 저장하지 않고 입력 화면에서 지웠습니다.');$('.page-note').lastChild.textContent=' 고객정보 확인 완료 · 검토용';}
  else say('고객정보 입력 없이 일반 상품 정보만 살펴보실 수 있어요.');
  if(interest && interest!=='기타') run({text:interest});
  $('#query').focus();
}
function showInputPreview() {
  if(!isLocalPreview) return;
  setEntryStep('information'); $('#consent-title').textContent='고객정보 입력 화면 미리보기';
  const body=$('#consent-body');body.replaceChildren(el('p','운영 설정이 미정인 개발 화면입니다. 아래는 수정할 수 없는 예시이며, 개인정보를 입력받거나 저장하지 않습니다.','banner'));
  for(const [label,value] of [['이름','고객명 예시'],['연락처','010-0000-0000 (예시)'],['설치 주소','설치할 곳의 주소 (예시)']]) {
    const wrap=el('label',label,'form-field'),input=el('input'); input.disabled=true;input.value=value;wrap.append(input);body.append(wrap);
  }
  body.append(button('예시로 상담 화면까지 보기',()=>finishEntry('preview','정수기'),'primary'));
}
function receiptText(delivery) {
 return ({queued:serviceMode==='internal'?'내부 상담 접수함에 등록되었습니다. 담당자의 확인을 기다리고 있습니다.':'총판 접수함에 등록되었습니다. 담당자의 확인을 기다리고 있습니다.',received:'담당자가 접수 내용을 확인했습니다.',consulting:'담당자가 상담 중으로 표시했습니다.',completed:'담당자가 상담 완료로 표시했습니다.'})[delivery]||'상담 정보가 저장되어 있습니다. 총판 전달은 아직 처리되지 않았습니다.';
}
function showReceipt() {
  const dialog=$('#consent-dialog'),body=$('#consent-body'); $('#consent-title').textContent='접수정보 관리';
  const status=el('p',receiptText(receipt.delivery),'banner');status.id='receipt-detail-status';status.setAttribute('role','status');body.replaceChildren(status);
  const retry=button('최신 상태 다시 확인',refreshReceipt,'secondary');retry.id='retry-receipt-detail';body.append(retry);renderReceiptState();refreshReceipt();
  body.append(el('p','복구 코드는 접수 조회·삭제 권한을 복구하는 비밀 코드입니다. 발급 후 안전하게 보관하고 공유하지 마세요. 재발급하면 이전 코드는 무효가 됩니다.'));
  body.append(button('복구 코드 발급·재발급',async()=>{
   if(busy)return;busy=true;const epoch=dialogEpoch,id=receipt.id;
   try{const result=await api('recovery-code',{id});if(epoch!==dialogEpoch||receipt?.id!==id)return;
    body.querySelector('#recovery-secret')?.remove();const box=el('section');box.id='recovery-secret';
    box.append(el('p','이 코드를 가진 사람은 접수 상태 조회와 삭제 권한을 복구할 수 있습니다. 다른 사람에게 공유하지 말고 안전한 곳에 보관하세요. 재발급하면 이전 코드는 즉시 사용할 수 없습니다.'));
    const label=el('label','복구 코드','form-field'),input=el('input');input.type='password';input.readOnly=true;input.autocomplete='off';input.value=result.code;input.id='recovery-code-value';label.append(input);box.append(label);
    box.append(button('코드 표시',()=>{input.type=input.type==='password'?'text':'password';},'secondary'));
    box.append(button('코드 복사',async()=>{try{await navigator.clipboard.writeText(input.value);copyStatus.textContent='복사했습니다. 안전한 곳에 보관해 주세요.';}catch{input.type='text';input.select();copyStatus.textContent='코드를 선택했습니다. 직접 복사해 주세요.';}},'secondary'));
    const copyStatus=el('p');copyStatus.setAttribute('role','status');box.append(copyStatus,el('p','사용 기한: '+new Date(result.expiresAt).toLocaleString('ko-KR')+' · 접수 삭제 시 즉시 무효'));
    body.append(box);
   }catch{body.append(el('p','코드 발급을 확인하지 못했습니다. 접수 상태를 확인한 뒤 다시 발급해 주세요.','form-error'));}finally{busy=false;}
  },'secondary'));
  body.append(button('보관한 코드로 접수 복구',showRecovery,'secondary'));
  body.append(button('접수 정보 삭제', async()=>{
    if(busy)return;busy=true;let deleted=false,deletionConfirmed=false;
    try { const result=await api('withdraw',{id:receipt.id});deletionConfirmed=result.deletionConfirmed===true;setReceipt(null);deleted=true; }
    catch {body.append(el('p','삭제 요청을 처리하지 못했어요. 다시 시도해 주세요.','form-error'));}
    finally {busy=false;}
    if(deleted){closeConsent();initializeEntry();say(deletionConfirmed?'이 세션에서 접수한 정보를 삭제했습니다. 상담을 다시 신청하려면 고객정보 확인부터 진행해 주세요.':'이 접수의 삭제 여부를 확인할 수 없습니다. 이미 삭제·만료되었거나 접속 권한이 끝났을 수 있습니다. 개인정보 문의 창구로 확인해 주세요.');if(!deletionConfirmed)api('status').then(s=>{if(s.notice?.privacyContact)say('개인정보 문의: '+s.notice.privacyContact);}).catch(()=>{});}
  },'secondary'));
  body.append(el('p','이 브라우저의 접수 조회·삭제 권한은 최초 접속 후 30분 동안 유지됩니다. 이후에도 조회하려면 지금 복구 코드를 발급해 보관하세요. 시간이 지나도 접수 정보가 자동으로 삭제되는 것은 아닙니다.'));
    body.append(el('p','공용 기기에서는 접속을 종료해 주세요. 접수 정보는 삭제되지 않습니다.'));
  body.append(button('이 기기에서 접속 종료',async()=>{
   if(busy)return;busy=true;try{await api('end-session',{});setReceipt(null);++dialogEpoch;offer=null;body.replaceChildren();dialog.close();initializeEntry();say('이 기기의 접속을 종료했습니다. 상담 접수 정보는 보관기간 동안 유지됩니다.');}catch{body.append(el('p','접속 종료를 확인하지 못했습니다. 다시 시도해 주세요.','form-error'));}finally{busy=false;}
  },'secondary'));
  body.append(button('상담 계속하기',closeConsent,'primary'));
  if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
}

function showRecovery(){
 if(busy)return;const epoch=++dialogEpoch;offer=null;const dialog=$('#consent-dialog'),body=$('#consent-body');$('#consent-title').textContent='기존 접수 불러오기';body.replaceChildren(el('p','접수 관리에서 미리 발급·보관한 복구 코드를 입력해 주세요. 이름·전화번호는 입력하지 않습니다. 복구하면 이전 브라우저의 조회·삭제 권한은 종료됩니다.'));
 const form=el('form'),label=el('label','복구 코드','form-field'),input=el('input');input.type='password';input.name='recovery_code';input.autocomplete='off';input.required=true;input.maxLength=43;input.minLength=43;input.pattern='[-_A-Za-z0-9]{43}';label.append(input);const error=el('p',null,'form-error');error.setAttribute('role','alert');const submit=el('button','접수 불러오기','primary');submit.type='submit';form.append(label,error,submit);
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;submit.disabled=true;error.textContent='';try{const current=await api('recover',{code:input.value.trim()});if(epoch!==dialogEpoch)return;form.reset();setReceipt(current);$('#messages').replaceChildren();finishEntry('saved',null,true);say('접수를 복구했습니다. 다른 브라우저에서 다시 복구하려면 접수 관리에서 새 코드를 발급해 주세요.');}catch{error.textContent='접수를 복구하지 못했습니다. 코드가 틀렸거나 이미 사용·재발급·만료되었을 수 있습니다. 연결 오류라면 같은 브라우저에서 다시 시도해 주세요.';}finally{busy=false;submit.disabled=false;}});
 body.append(form,el('p','코드를 잃어버렸거나 미리 발급하지 않았다면 이 방법으로 복구할 수 없습니다. 현재 브라우저에서 조회가 가능할 때 발급해 보관해 주세요.'));if(!dialog.open)dialog.showModal();input.focus();
}

function setPanel(panel) {
  $('.workspace').dataset.panel = panel;
  if(panel==='chat')$('#messages').scrollTop=$('#messages').scrollHeight;
  document.querySelectorAll('.mobile-tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.panel === panel)));
}
function showEmpty() {
  if(!catalogReady()){showCatalogUnavailable();return;}
  $('#results').replaceChildren(...[...emptyContent.childNodes].map(n => n.cloneNode(true)));
  $('#result-count').textContent = '탐색 전';
  $('#results-title').textContent = '조건에 맞는 상품';
  $('#mobile-count').textContent = '0';
  visibleCards = 0; renderBrowse();
  if (filterLabels(state.filters).length) {
    $('#result-count').textContent = '0개';
    const box = $('#results');
    box.querySelector('h3').textContent = '조건에 맞는 상품이 없어요.';
    box.querySelector('.empty-state > p').textContent = '조건을 조금 넓혀서 다시 찾아볼까요?';
    const menu = box.querySelector('.category-menu'); menu.replaceChildren();
    for (const [label, query] of [['모든 브랜드 보기','모든 브랜드'],['약정 전체 보기','약정 상관없'],['조건 새로 고르기','조건 초기화']]) {
      const b = button(label + ' ↗', () => run({text:query})); menu.append(b);
    }
    box.querySelector('.empty-tip').textContent = '대화창에서도 조건을 변경할 수 있어요.';
  }
}
function button(label, action, className = '') {
  const b = el('button', label, className); b.type = 'button'; b.addEventListener('click', action); return b;
}
function say(text, speaker = 'assistant') {
  const log = $('#messages'), row = el('div', null, speaker === 'user' ? 'message user-message' : 'message');
  row.append(el('span', speaker === 'user' ? '나' : '소문 상담', 'message-meta'), el('div', text, 'message-text'));
  log.append(row);
  while (log.childElementCount > 24) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
}
function renderFilters() {
  const box = $('#filters'); box.replaceChildren();
  const labels = filterLabels(state.filters);
  if (!labels.length) box.textContent = '아직 고른 조건이 없어요';
  labels.forEach(v => box.append(el('span', v, 'chip')));
}
function renderBrowse() {
  if(!catalogReady()){$('#browse-toolbar').hidden=true;$('#product-pagination').hidden=true;$('#selection-tray').hidden=true;return;}
  const all=cardsFor(SAMPLE_PRODUCTS,state.filters),page=pageData(all,state),comparison=state.view==='compare';
  const active=entryMode!=='waiting'&&visibleCards>0;
  $('#browse-toolbar').hidden=!active||recommendationView;
  $('#product-sort').value=validSort(state.sort); $('#product-sort').disabled=comparison;
  $('#back-to-list').hidden=!comparison;
  $('#product-pagination').hidden=!active||comparison||recommendationView;
  $('#first-products').disabled=!page.previous; $('#previous-products').disabled=!page.previous; $('#next-products').disabled=!page.more;
  $('#product-page').textContent=page.page+' / '+page.pages;
  $('#product-page').setAttribute('aria-label',page.pages+'페이지 중 '+page.page+'페이지');
  if(active&&!comparison)$('#result-count').textContent=recommendationView?visibleCards+'개 추천':page.total+'개 중 '+page.start+'–'+page.end;
  const selected=state.selected.map(code=>all.find(card=>card.code===code)).filter(Boolean);
  $('#selection-tray').hidden=entryMode==='waiting'||!selected.length;
  $('#selection-summary').textContent='담은 상품 '+selected.length+' / 3';
  $('#continue-selection').hidden=!selected.length; $('#compare-selection').hidden=selected.length<2;
  const list=$('#selected-products'),focused=document.activeElement?.dataset?.removeCode;list.replaceChildren();
  for(const card of selected){const row=el('div',null,'selected-product'),name=el('span',card.name);name.title=card.name;
    const remove=button('빼기',()=>run({action:'select',code:card.code,selectionMode:'remove'}),'text-button');remove.dataset.removeCode=card.code;remove.setAttribute('aria-label',card.name+' 담은 상품에서 빼기');row.append(name,remove);list.append(row);}
  if(focused)($('#selected-products button')||$('#selection-summary')).focus();
}
function renderCards(cards, comparison = false) {
  const result = $('#results'); result.replaceChildren();
  if (!cards?.length) { showEmpty(); return; }
  visibleCards = cards.length;
  $('#result-count').textContent = comparison ? cards.length + '개 비교 중' : cards.length + '개 표시';
  $('#results-title').textContent = comparison ? '선택한 상품 비교' : '조건에 맞는 상품';
  $('#mobile-count').textContent = String(cards.length);
  const grid = el('div', null, comparison ? 'cards is-comparison' + (cards.length === 3 ? ' three' : '') : 'cards');
  for (const p of cards) {
    const card = el('article', null, 'product');
    const top = el('div', null, 'product-top');
    top.append(el('span', p.brand, 'brand'), el('span', String(cards.indexOf(p) + 1).padStart(2, '0'), 'product-number'));
    card.dataset.code=p.code;
    card.append(top, el('h3', p.name));
    if(validSort(state.sort).startsWith('price')){const basis=minimumOption(p);const note=el('p',null,'price-basis');note.append(el('small','정렬 기준 · 현재 조건 최저 월요금'),el('strong',money(basis.fee)),el('span',basis.months+'개월 약정 · '+basis.care),el('small','할인·적용 조건은 아래에서 확인해 주세요.'));card.append(note);}
    const plans = el('div', null, 'plans');
    for (const plan of p.plans.slice(0, 2)) {
      const row = el('div', null, 'plan');
      row.append(el('span', plan.months + '개월 약정'));
      row.append(el('span', plan.min === plan.max ? '월 ' + money(plan.min) : '월 ' + money(plan.min) + '~' + money(plan.max), 'price'));
      row.append(el('small', [...new Set(plan.options.map(o => o.care))].join(' · ')));
      plans.append(row);
    }
    card.append(plans);
    const details = el('details');
    details.append(el('summary', '전체 약정 · 적용 조건 보기'));
    for (const plan of p.plans) for (const o of plan.options) {
      const lines = [plan.months + '개월 약정 · 월 ' + money(o.fee), o.care, o.cycle,
        o.totalMonths && '계약기간 표기 ' + o.totalMonths + '개월',
        o.baseFee !== o.fee && Number.isFinite(o.baseFee) && '기본 월료 ' + money(o.baseFee),
        o.condition && '적용 조건: ' + o.condition, o.note, o.rawCare && o.rawCare !== o.care && '원자료 구분: ' + o.rawCare,
        o.promo && '등록 혜택: ' + o.promo, o.discount,
        o.sourceRow != null && '원자료 행 ' + o.sourceRow].filter(Boolean);
      details.append(el('div', lines.join('\n'), 'option'));
    }
    card.append(details);
    const chosen = state.selected.includes(p.code);
    const pick = button(chosen ? '상담 상품으로 담음 ✓' : '상담 상품으로 담기', () => run({action:'select', code:p.code}), 'pick');
    pick.setAttribute('aria-pressed', String(chosen)); pick.setAttribute('aria-label', p.name + ' 상담 상품 선택');
    card.append(pick); grid.append(card);
  }
  result.append(grid, el('p', (comparison ? '고른 순서대로 비교합니다. ' : orderDescription(state)+' ') + (catalogMetadata.mode==='reviewed'?'검토한 상품 자료입니다. 표시 요금의 약정·관리·혜택 조건을 함께 확인해 주세요.':catalogMetadata.mode==='test'?'기능 검증용 상품 자료입니다. 실제 판매 요금·혜택은 확인이 필요합니다.':'표본 자료입니다. 프로모션·제휴카드 적용 여부와 현재 유효성은 별도 확인이 필요합니다.'), 'result-note'));
}
function renderActions(out = {}) {
  const actions = $('#actions'); actions.replaceChildren();
  if(entryMode==='waiting'){actions.append(button('고객정보 확인하기',openConsent,'primary'));return;}

  if(out.handoff) {
    actions.append(button(receipt?.status==='stored'?'상담 접수 상태 확인':'외부 검토 안내',()=>say('현재 외부 검토 사이트에서는 실제 상담 접수가 지원되지 않습니다. 상품 질문과 주소 입력을 테스트해 주세요.'),'primary'));
    if(state.filters.category) actions.append(button('상품 상담 이어가기',()=>run({action:'resume'})));
    return;
  }
  const promptChoices = out.suggestions?.length ? out.suggestions : !state.filters.category ? ['정수기', '공기청정기', '비데'] : [];
  for (const name of promptChoices) {
    const choice = button(name, () => run({text:name}), state.filters.category === name ? 'choice-active' : '');
    choice.setAttribute('aria-pressed', String(state.filters.category === name)); actions.append(choice);
  }
  if(siteData&&!state.filters.category&&!out.siteSources){actions.append(button('인터넷·TV 요금 보기',()=>run({text:'인터넷 요금 알려줘'})),button('사이트 상품 찾기',()=>run({text:'사이트 상품 종류 알려줘'})));}
  if (visibleCards) actions.append(button('상품 ' + visibleCards + '개 보기', () => setPanel('products'), 'results-toggle'));
  if (out.resume) actions.append(button('앞서 고른 상품 다시 보기', () => run({action:'resume'})));
  if (out.previous) actions.append(button('이전 상품', () => run({action:'previous'})));
  if (out.more) actions.append(button('다음 상품', () => run({action:'more'})));
  if (state.filters.category && !state.preferences?.brandAny && !promptChoices.includes('브랜드 상관없어요')) actions.append(button('브랜드 전체', () => run({text:'모든 브랜드'})));
  if (state.filters.budget) actions.append(button('예산 해제', () => run({text:'예산 해제'})));
  if (state.selected.length) actions.append(button('담은 상품으로 상담 이어가기', () => {run({action:'consultSelection'});setPanel('chat');}, 'primary'));
  if (state.selected.length>=2) actions.append(button('선택한 ' + state.selected.length + '개 비교', () => run({action:'compare'})));
  // Receipt management lives in the status bar; do not repeat intake in every turn.
}
function run(input) {
  if(entryMode==='waiting'){openConsent();return;}
  const available=catalogReady();
  const out = respond(state, input, SAMPLE_PRODUCTS, {entryMode,catalogAvailable:available, internalOnly:serviceMode==='internal', knowledgeEntries, siteData, hasReceipt:receipt?.status==='stored',receiptFreshness:receiptCheck.phase,delivery:receipt?.delivery});
  // Echo the customer's words only in the current DOM; intent labels stay internal.
  if (typeof input.text==='string' && input.text.trim()) say(input.text, 'user');
  else if (out.requestSummary) say(out.requestSummary, 'user');
  state = out.state; renderFilters(); say(out.reply);
  if(out.siteSources?.length){const box=el('div',null,'answer-sources');for(const source of out.siteSources){const a=el('a',source.label);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';const row=el('p');row.append(a);box.append(row);}$('#messages').lastElementChild.append(box);}
  if(out.sources?.length){const box=el('details',null,'answer-sources');box.append(el('summary','확인한 안내 근거'));for(const source of out.sources){const row=el('p'),a=el('a',source.label);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';row.append(a,el('small',source.topic+' · '+source.scope+' · 적용 종료 '+new Date(source.validUntil).toLocaleDateString('ko-KR')));box.append(row);}$('#messages').lastElementChild.append(box);}
  // Customer messages remain in this page only, not storage, analytics or external/model APIs.
  if ('cards' in out) {const scroll=$('#results').scrollTop;recommendationView=!!out.recommendation;renderCards(out.cards, out.comparison);$('#results').scrollTop=input.action==='select'?scroll:0;}
  if(!available)showCatalogUnavailable();
  renderBrowse(); renderActions(out);
  $('#product-feedback').hidden=!out.selectionLimit;$('#product-feedback').textContent=out.selectionLimit?'상담할 상품은 최대 3개까지 담을 수 있어요. 상품 하나를 빼고 다시 선택해 주세요.':'';
  if (out.comparison || ['sort','previous','first','more'].includes(input.action)) setPanel('products');
  if (input.action === 'reset' || input.action === 'consultSelection') setPanel('chat');
  if (out.consent) openConsent();
}
async function api(path,body){
 if(path==='status')return {available:false,mode:'public-preview'};
 if(path==='resume')return {receipt:null};
 if(path==='cancel'||path==='end-session')return {status:'cancelled'};
 throw Error('PUBLIC_REVIEW_NO_INTAKE');
}
function appendPartnerDisclosure(body,n){
  const section=el('section',null,'partner-disclosure');
  const toggle=el('button','제휴 총판 내역 확인','partner-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','partner-list');
  const panel=el('div',null,'partner-list');panel.id='partner-list';panel.hidden=true;
  const companies=Array.isArray(n.partners)?n.partners:[];
  if(!companies.length)panel.append(el('p','제휴 총판 업체명을 등록 중입니다. 현재 접수정보는 외부 총판에 제공하지 않습니다.'));
  else{
    panel.append(el('p','등록된 제휴 총판 '+companies.length+'개사'));
    const list=el('ul');for(const company of companies){const item=el('li');item.append(el('strong',company.name));if(n.transfer?.recipient===company.name)item.append(el('span','이번 상담 제공 대상','partner-badge'));item.append(el('p','이용 목적: '+company.purpose),el('p','보유·이용기간: '+company.retention));list.append(item);}panel.append(list);
    panel.append(el('p',n.transfer?'이번 상담 제공 대상은 위 목록에 표시된 업체입니다. 목록을 열어보는 행위만으로 제공에 동의한 것으로 처리하지 않습니다.':'제휴사 목록 안내이며, 현재 접수의 외부 제공 동의가 아닙니다.'));
  }
  toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));toggle.textContent=panel.hidden?'제휴 총판 내역 확인':'제휴 총판 내역 닫기';};
  section.append(toggle,panel);body.append(section);
}
function appendNotice(body, n) {
  const dl = el('dl', null, 'notice');
  const items = [
    ['수집·이용 주체', n.controller],
    ['필수 수집 항목', n.requiredItems.join(' · ')],
    ['이용 목적', n.purpose],
    ['보유·이용기간', n.retention || '보유기간을 확정한 뒤 상담 신청을 열 예정입니다.'],
    ['동의 거부', n.refusal],
  ];
  if(n.useRestriction)items.push(['이용 범위',n.useRestriction]);
  if(n.processor)items.push(['위탁 업무',n.processor.purpose],['수탁자 이용 제한',n.processor.restriction]);
  if(n.addressHelp)items.push(['설치 주소 안내',n.addressHelp]);
  if (n.privacyContact) items.push(['개인정보 문의', n.privacyContact]);
  if (n.relationship === 'processor') items.push(['상담 업무 수탁자', n.recipient]);
  for (const [key, val] of items) dl.append(el('dt',key),el('dd',val));
  if(!n.transfer&&n.relationship!=='processor'){const recipient=el('dd','제휴 총판 — 현재 외부 제공 없음');appendPartnerDisclosure(recipient,n);dl.append(el('dt','제공받는 자'),recipient);}
  body.append(dl);
  if (n.transfer) {
    const tr = el('dl', null, 'notice');
    for (const [key,val] of [['제공받는 자','제휴 총판'],['제공 목적',n.transfer.purpose],['제공 항목',n.transfer.items.join(' · ')],['제공받는 자의 보유기간',n.transfer.retention],['제공 동의 거부',n.transfer.refusal]]) {const value=el('dd',val);if(key==='제공받는 자')appendPartnerDisclosure(value,n);tr.append(el('dt',key),value);}
    body.append(el('h3','개인정보 제3자 제공 안내'),tr);
  }
}
function checkbox(label, id) {
  const wrap = el('label', null, 'check'), input = el('input'); input.type = 'checkbox'; input.id = id;
  wrap.append(input, el('span',label)); return {wrap,input};
}
async function openConsent(){
 const body=$('#consent-body');body.replaceChildren();$('#consent-title').textContent='개인정보 수집·이용 안내';setEntryStep('consent');
 body.append(el('p','원활한 상담을 위해 고객님의 정보 확인부터 진행하겠습니다. 아래 안내를 확인해 주세요.'));
 body.append(el('p','고객사 검토용 사이트입니다. 입력 항목과 상담 흐름을 테스트하며, 실제 상담 접수·서버 저장·총판 전달은 하지 않습니다. 가상 이름과 테스트 연락처를 사용해 주세요.','banner'));
 const dl=el('dl',null,'notice');
 const controller=el('dd','브로씨앤씨 및 제휴총판');
 appendPartnerDisclosure(controller,{partners:[],relationship:'third_party'});
 dl.append(el('dt','수집·이용 주체'),controller);
 for(const [k,v] of [['입력 항목','이름, 연락처, 설치 주소 또는 설치 주소 미정'],['이용 목적','고객정보 확인 및 렌탈 상담 화면 흐름 검토'],['보관 및 전달','입력값은 현재 입력 화면에서만 처리합니다. 상담 시작·창 닫기·새로고침 시 지우며 서버 저장, 총판 제공, 광고 활용은 하지 않습니다.'],['주소 검색','주소 검색어는 카카오 우편번호 서비스로 전송됩니다. 공개된 건물 주소로 테스트해 주세요.'],['동의 거부','동의하지 않으면 고객정보 입력 단계로 진행하지 않습니다. 창을 닫을 수 있습니다.']])dl.append(el('dt',k),el('dd',v));
 body.append(dl);
 const agree=checkbox('[필수] 위 개인정보 입력·이용 안내를 확인하고 동의합니다.','agree-required'),age=checkbox('만 14세 이상입니다.','age-check');
 const next=button('동의하고 고객정보 입력',()=>{if(agree.input.checked&&age.input.checked)renderLead({required:true,over14:true});},'primary');next.disabled=true;
 const update=()=>{next.disabled=!agree.input.checked||!age.input.checked;};agree.input.addEventListener('change',update);age.input.addEventListener('change',update);
 body.append(agree.wrap,age.wrap,next);
 if(!$('#consent-dialog').open)$('#consent-dialog').showModal();
}
function closeConsent() {
  if (busy) return;
  ++dialogEpoch; offer = null;
  $('#consent-body').replaceChildren(); $('#consent-dialog').close();
  setEntryStep(entryMode==='waiting'?'consent':'consultation');
  api('cancel', {}).catch(() => {});
}
function renderLead(choices) {
  setEntryStep('information'); $('#consent-title').textContent='고객정보 확인';
  const body = $('#consent-body'); body.replaceChildren();
  const testing=offer?.testOnly===true;
  body.append(el('p','상담에 필요한 고객정보를 입력해 주세요. 입력 내용은 대화창에 표시하지 않으며, 정보 확인이 완료되면 상담을 시작합니다. 검토용 입력값은 서버에 저장하지 않습니다.'));
  const form = el('form'); form.autocomplete = 'off';
  const fields = [
    ['name','이름',null], ['phone','연락처',null],
    ['address','설치 주소',null],
  ];
  for (const [id,label,options] of fields) {
    const wrap = el('label',label,'form-field'), input = el(options ? 'select' : 'input'); input.name = id;
    input.required = true; input.maxLength = id === 'address' ? 200 : id === 'phone' ? 20 : 40;
    if(id==='address'){input.autocomplete='street-address';input.placeholder='도로명 또는 지번 주소, 상세 주소';}
    if (id === 'phone') { input.type = 'tel'; input.inputMode = 'tel'; input.placeholder='010-1234-5678'; bindPhoneInput(input); }
    if (options) for (const value of options) { const op = el('option',value || '입력하지 않음'); op.value = value; input.append(op); }
    wrap.append(input); form.append(wrap);
  }
  const addressPicker=mountAddressPicker(form,form.elements.address);
  if (state.selected.length || state.unresolved.length) body.append(el('p','고른 상품과 추가 확인 항목은 화면에 유지됩니다. 이번 접수에는 위에서 고지한 항목만 저장합니다.', 'banner'));
  const error = el('p',null,'form-error'); error.setAttribute('role','alert');
  const submit = el('button','정보 확인 후 상담 시작','primary'); submit.type = 'submit'; form.append(error, submit);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if(!choices.required||!choices.over14)return;
    const name=form.elements.name.value.trim(),phone=form.elements.phone.value.replace(/\D/g,'');
    if(name.length<2||!/^01[016789]\d{7,8}$/.test(phone)){error.textContent='이름을 두 글자 이상 입력하고 연락처를 확인해 주세요.';return;}
    if(!addressPicker.value()){error.textContent='주소를 검색하거나 설치 주소 미정을 선택해 주세요.';return;}
    form.reset();finishEntry('review');
  });
  if(testing){body.append(el('p','테스트고객A와 010-0000-0001 같은 가상 정보로 접수 기능을 시험해 주세요.','banner'));body.append(button('테스트 정보 채우기',()=>{form.elements.name.value='테스트고객A';form.elements.phone.value='010-0000-0001';form.elements.address.value='가상시 테스트로 123, 시험동 101호';},'secondary'));}
  body.append(form); form.querySelector('input').focus();
}
$('#product-sort').addEventListener('change',event=>run({action:'sort',sort:event.target.value}));
for(const [id,action]of [['first-products','first'],['previous-products','previous'],['next-products','more'],['back-to-list','resume'],['continue-selection','consultSelection'],['compare-selection','compare'],['clear-selection','clearSelection']])$("#"+id).addEventListener('click',()=>run({action}));
$('#manage-receipt').addEventListener('click',showReceipt);
$('#retry-receipt').addEventListener('click',refreshReceipt);
if(widgetMode){$('#close-widget').hidden=false;const closeWidget=()=>{if(window.parent!==window)window.parent.postMessage({type:'somun:close'},location.origin);};$('#close-widget').addEventListener('click',closeWidget);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#consent-dialog').open){event.preventDefault();closeWidget();}});}
api('status').then(applyServiceMode).catch(()=>{});
document.querySelectorAll('.mobile-tabs button').forEach(b => b.addEventListener('click', () => setPanel(b.dataset.panel)));
$('#results').addEventListener('click', event => {
  const target = event.target.closest('[data-query]');
  if (target) { run({text: target.dataset.query}); setPanel('products'); }
});
$('#composer').addEventListener('submit', event => {
  event.preventDefault(); const q = $('#query'); const text = q.value.trim(); q.value = ''; if (text) run({text});
});
$('#reset').addEventListener('click', () => {
  state=initialState(); $('#messages').replaceChildren();
  if(receipt?.status==='stored') finishEntry('saved'); else initializeEntry();
});
$('#close-consent').addEventListener('click', closeConsent);
$('#consent-dialog').addEventListener('cancel', event => { event.preventDefault(); closeConsent(); });
window.addEventListener('pagehide', () => { ++dialogEpoch; $('#consent-body').replaceChildren(); $('#query').value = ''; state = initialState(); offer = null; });
matchMedia('(min-width:761px)').addEventListener('change',()=>{$('#messages').scrollTop=$('#messages').scrollHeight;});
initializeEntry();
async function resumeSession(){const epoch=dialogEpoch;try{const data=await api('resume',{});if(epoch!==dialogEpoch||entryMode!=='waiting'||receipt)return;if(data.receipt?.status==='stored'){setReceipt(data.receipt);$('#messages').replaceChildren();finishEntry('saved',null,true);}}catch{/* Unknown or unavailable sessions keep the consent-first entry. */}}
resumeSession();
window.addEventListener('pageshow',event=>{if(event.persisted){setReceipt(null);initializeEntry();resumeSession();}});

$('#retry-catalog').addEventListener('click',()=>catalogLoader.refresh());
refreshKnowledge();catalogLoader.refresh();
function maybeRefreshCatalog(force=false){const value=catalogLoader.checkExpiry();if(value.status!=='loading'&&(value.status!=='ready'?(force||Date.now()>=nextCatalogRetry):Date.now()-value.checkedAt>=300000))catalogLoader.refresh();}
window.addEventListener('online',()=>maybeRefreshCatalog(true));window.addEventListener('focus',()=>maybeRefreshCatalog());document.addEventListener('visibilitychange',()=>{if(!document.hidden)maybeRefreshCatalog();});setInterval(()=>{catalogLoader.checkExpiry();if(!document.hidden)maybeRefreshCatalog();},1000);

export function mountAddressPicker(form,base){
 const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const block=make('div');block.className='address-picker';
 const label=make('label','설치 주소 미정'),unknown=make('input');unknown.type='checkbox';unknown.id='address-undecided';label.className='check';label.prepend(unknown);
 const search=make('button','주소 검색');search.type='button';
 const help=make('p','주소 검색창에서 주소를 선택하면 자동으로 입력됩니다.');help.setAttribute('role','status');
 const detailLabel=make('label','상세 주소 (동·호수 등)'),detail=make('input');detail.id='address-detail';detail.maxLength=100;detail.autocomplete='address-line2';detail.placeholder='동·호수 등 상세주소';detailLabel.className='form-field';detailLabel.append(detail);
 base.placeholder='주소 검색 버튼으로 선택해 주세요';base.readOnly=true;
 let selectedAddress='';
 let popup=null,nonce='',timer=null;
 const popupOrigin=location.protocol+'//'+location.host;
 const close=()=>{nonce='';if(timer)clearInterval(timer);timer=null;try{popup?.close();}catch{}popup=null;};
 search.onclick=()=>{
  close();nonce=crypto.randomUUID();
  popup=window.open(popupOrigin+'/ra-preview/chatbot/address-popup.html#'+nonce,'somun_address_'+nonce.replaceAll('-',''),'');
  if(!popup){nonce='';help.textContent='팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 주소 검색을 다시 눌러 주세요.';return;}
  help.textContent='검색창에서 주소를 선택해 주세요.';
  timer=setInterval(()=>{if(popup?.closed){close();help.textContent='주소 검색창을 닫았습니다. 주소 검색을 다시 누르면 열립니다.';}},500);
 };
 const receive=event=>{
  if(!popup||event.source!==popup||event.origin!==popupOrigin||event.data?.nonce!==nonce||unknown.checked||!form.isConnected)return;
  if(event.data.type==='postcode:selected'&&typeof event.data.address==='string'&&event.data.address.trim()&&event.data.address.length<=200){selectedAddress=event.data.address.trim();base.value=selectedAddress;detail.value='';base.dispatchEvent(new Event('input',{bubbles:true}));close();help.textContent='주소가 입력되었습니다. 상세 주소를 확인해 주세요.';detail.focus();}
 };
 window.addEventListener('message',receive);
 const observer=new MutationObserver(()=>{if(!form.isConnected){close();window.removeEventListener('message',receive);observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});
 unknown.onchange=()=>{close();base.disabled=detail.disabled=search.disabled=unknown.checked;base.required=!unknown.checked;help.textContent=unknown.checked?'설치 주소 미정으로 접수합니다. 상담 시 설치할 곳을 확인해 주세요.':'주소 검색창에서 주소를 선택하면 자동으로 입력됩니다.';};
 block.append(label,search,help,detailLabel);base.closest('label').after(block);
 form.addEventListener('submit',event=>{if(!unknown.checked&&!selectedAddress){event.preventDefault();event.stopImmediatePropagation();help.textContent='주소 검색에서 설치 주소를 선택하거나 설치 주소 미정을 선택해 주세요.';search.focus();}},true);
 return {value:()=>unknown.checked?'설치 주소 미정':[selectedAddress,detail.value.trim()].filter(Boolean).join(', ')};
}

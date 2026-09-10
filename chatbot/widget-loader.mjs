const root=new URL('.',import.meta.url);
if(!document.getElementById('somun-launcher')){
 const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('widget-shell.css',root);document.head.append(style);
 const launcher=document.createElement('button');launcher.id='somun-launcher';launcher.type='button';launcher.textContent='소문 상담';launcher.setAttribute('aria-label','소문 상담 열기');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls','somun-widget');
 const frame=document.createElement('iframe');frame.id='somun-widget';frame.title='소문 렌탈 상담';frame.hidden=true;frame.referrerPolicy='no-referrer';
 const open=()=>{if(!frame.hasAttribute('src'))frame.src=new URL('widget.html?v=entry-20260910-18',root);frame.hidden=false;launcher.setAttribute('aria-expanded','true');launcher.textContent='상담 닫기';launcher.setAttribute('aria-label','소문 상담 닫기');frame.focus();};
 const close=()=>{frame.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.textContent='소문 상담';launcher.setAttribute('aria-label','소문 상담 열기');launcher.focus();};
 launcher.addEventListener('click',()=>frame.hidden?open():close());
 document.addEventListener('click',e=>{if(e.target.closest?.('.open-chat'))open();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!frame.hidden){e.preventDefault();close();}});
 window.addEventListener('message',e=>{if(e.origin===root.origin&&e.source===frame.contentWindow&&e.data?.type==='somun:close')close();});
 document.body.append(frame,launcher);
}

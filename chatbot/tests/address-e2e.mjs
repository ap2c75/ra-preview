import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const playwrightPath=process.env.PLAYWRIGHT_CORE_PATH;
const loadedPlaywright=await import(playwrightPath?pathToFileURL(path.join(playwrightPath,'index.js')).href:'playwright-core');
const playwright=loadedPlaywright.chromium?loadedPlaywright:loadedPlaywright.default;
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};

const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(!pathname.startsWith('/ra-preview/'))throw new Error('NOT_FOUND');
    let relative=decodeURIComponent(pathname.slice('/ra-preview/'.length));
    if(!relative||relative.endsWith('/'))relative+='index.html';
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep))throw new Error('NOT_FOUND');
    const body=await fs.readFile(file);
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const {port}=server.address();

const fakePostcode=`
window.kakao={Postcode:class{
 constructor(options){this.options=options;}
 embed(target){
  const button=document.createElement('button');button.id='qa-address';button.textContent='테스트 주소 선택';
  button.onclick=()=>this.options.oncomplete({userSelectedType:'R',roadAddress:'서울특별시 테스트로 1',jibunAddress:'',zonecode:'00000'});
  target.replaceChildren(button);this.options.onresize?.({width:500,height:650});
 }
}};`;

let browser;
try{
  browser=await playwright.chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext();
  await context.route('https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:fakePostcode}));
  const page=await context.newPage();
  const requested=[];page.on('request',request=>requested.push(new URL(request.url()).pathname));
  await page.goto(`http://127.0.0.1:${port}/ra-preview/chatbot/`,{waitUntil:'domcontentloaded'});
  await page.locator('#somun-launcher').click();
  const widget=page.frameLocator('#somun-widget');
  await widget.getByRole('button',{name:'고객정보 확인하기'}).waitFor();
  assert.equal(requested.includes('/ra-preview/chatbot/api/catalog.json'),false);
  assert.equal(requested.includes('/ra-preview/chatbot/site-data-core.json'),false);
  const catalogResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/ra-preview/chatbot/api/catalog.json');
  const siteResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/ra-preview/chatbot/site-data-core.json');
  await widget.getByRole('button',{name:'고객정보 확인하기'}).click();
  await Promise.all([catalogResponse,siteResponse]);
  assert.equal(requested.includes('/ra-preview/chatbot/site-data.json'),false);
  await widget.locator('#agree-required').check();
  await widget.locator('#agree-third-party').check();
  await widget.locator('#age-check').check();
  await widget.getByRole('button',{name:'동의하고 고객정보 입력'}).click();

  const address=widget.locator('input[name="address"]');
  assert.equal(await address.getAttribute('readonly'),'');
  await widget.locator('input[name="name"]').fill('테스트고객');
  await widget.locator('input[name="phone"]').fill('01012345678');
  assert.equal(await widget.locator('input[name="phone"]').inputValue(),'010-1234-5678');

  const popupPromise=context.waitForEvent('page');
  await widget.getByRole('button',{name:'주소 검색'}).click();
  const popup=await popupPromise;
  await popup.locator('#qa-address').click();
  await assert.doesNotReject(()=>address.waitFor({state:'visible'}));
  await page.waitForFunction(()=>document.querySelector('#somun-widget')?.contentDocument?.querySelector('input[name="address"]')?.value==='서울특별시 테스트로 1');
  assert.equal(await address.inputValue(),'서울특별시 테스트로 1');
  await widget.locator('#address-detail').fill('101호');
  await widget.getByRole('button',{name:'정보 확인 후 상담 시작'}).click();
  await widget.locator('#query').waitFor({state:'visible'});
  assert.equal(await widget.locator('#query').isEnabled(),true);
  assert.match(await widget.locator('#messages').innerText(),/고객정보 확인을 마쳤습니다/);
  await widget.locator('#query').fill('정수기 추천해줘');
  await widget.locator('#composer button').click();
  await widget.locator('button[data-panel="products"]').click();
  await widget.locator('.pick').first().click();
  await widget.locator('#continue-selection').click();
  const contactPrompt=await widget.locator('#messages').innerText();
  assert.match(contactPrompt,/월 [\d,]+(?:~[\d,]+)?원/);
  assert.match(contactPrompt,/상담사 배정 후 저장해주신 연락처로 연락드려도 괜찮으실까요/);
  await widget.getByRole('button',{name:'네, 연락 주세요'}).click();
  assert.match(await widget.locator('#messages').innerText(),/연락 동의 단계까지 확인했습니다/);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#somun-launcher').click();
  const widget2=page.frameLocator('#somun-widget');
  await widget2.getByRole('button',{name:'고객정보 확인하기'}).click();
  await widget2.locator('#agree-required').check();await widget2.locator('#agree-third-party').check();await widget2.locator('#age-check').check();
  await widget2.getByRole('button',{name:'동의하고 고객정보 입력'}).click();
  await widget2.locator('#address-undecided').check();
  assert.equal(await widget2.getByRole('button',{name:'주소 검색'}).isDisabled(),true);
  assert.equal(await widget2.locator('input[name="address"]').isDisabled(),true);
  console.log('address e2e: popup selection, phone formatting and undecided path passed');
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}

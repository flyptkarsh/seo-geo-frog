const os=require('node:os');
const artifacts=require('node:fs').mkdtempSync(require('node:path').join(os.tmpdir(),'frog-test-'));
process.chdir(require('node:path').resolve(__dirname,'../..'));
const {chromium}=require('playwright');
const path=require('path'),fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const site=await browser.newPage();
  await site.route('https://audit-fixture.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><title>Original page title</title><meta name="description" content="Original description"></head><body><h1>Original heading</h1></body></html>'}));
  await site.goto('https://audit-fixture.test/');
  const panel=await browser.newPage({viewport:{width:390,height:800}});
  let fail=false,calls=0;
  await panel.exposeFunction('queryFixture',()=>[{id:1,windowId:1,url:site.url()}]);
  await panel.exposeFunction('executeFixture',async({source,args})=>{
   calls++;
   if(fail)throw Error('Test: page access temporarily unavailable');
   return [{result:await site.evaluate(({source,args})=>new Function('return ('+source+').apply(null, '+JSON.stringify(args)+')')(),{source,args})}];
  });
  await panel.addInitScript(()=>{window.chrome={tabs:{query:()=>window.queryFixture()},scripting:{executeScript:opts=>window.executeFixture({source:opts.func.toString(),args:opts.args||[]})}};});
  await panel.goto('file://'+path.resolve('popup.html'));
  await panel.locator('#results').waitFor({state:'visible'});
  await panel.locator('#tab-previews').click();
  assert.equal(await panel.locator('.search-title').innerText(),'Original page title');
  await site.evaluate(()=>{document.title='Updated page after interaction';document.querySelector('meta[name=description]').content='New description from the live page';document.querySelector('h1').textContent='Updated heading';});
  const before=calls;
  await panel.getByRole('button',{name:'Reaudit',exact:true}).click();
  await panel.waitForFunction(()=>document.querySelector('.search-title')?.textContent==='Updated page after interaction');
  assert.equal(await panel.locator('.search-description').innerText(),'New description from the live page');
  assert.ok(calls>before);
  assert.equal(await panel.locator('#rerun').isEnabled(),true);
  fail=true;
  await panel.locator('#rerun').click();
  await panel.waitForFunction(()=>document.querySelector('#message').textContent.includes('temporarily unavailable'));
  assert.equal(await panel.locator('#rerun').isEnabled(),true);
  fail=false;
  await panel.locator('#rerun').click();
  await panel.locator('#results').waitFor({state:'visible'});
  assert.equal(await panel.locator('.search-title').innerText(),'Updated page after interaction');
  await panel.screenshot({path:require('node:path').join(artifacts,'seo-geo-frog-reaudit-verified.png'),fullPage:true});
  console.log('PASS: real Chrome page title and description changed; Reaudit refreshed both, recovered after an injection error, and remained enabled for retries. Real audit functions, isolated Chrome API test bridge.');
 }finally{await browser.close();}
})();

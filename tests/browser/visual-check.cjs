const os=require('node:os');
const artifacts=require('node:fs').mkdtempSync(require('node:path').join(os.tmpdir(),'frog-test-'));
process.chdir(require('node:path').resolve(__dirname,'../..'));
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
(async()=>{
const browser=await chromium.launch({channel:'chromium',headless:true});
const page=await browser.newPage({viewport:{width:390,height:800},deviceScaleFactor:2});
await page.route('https://demo.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><title>Studio North — Design for the next chapter</title><meta name="description" content="Independent design studio building memorable digital experiences."><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="https://demo.test/"></head><body><main><h1>Design for the next chapter.</h1><p>A considered approach to building brands and digital products.</p><h3>Selected work</h3><img src="/broken.png"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Studio North"}</script></main></body></html>'}));
await page.goto('https://demo.test/');
await page.addScriptTag({content:fs.readFileSync('audit.js','utf8')});
await page.addScriptTag({content:fs.readFileSync('diagnostics.js','utf8')});
const report=await page.evaluate(()=>auditPage());
await page.evaluate(()=>collectDiagnostics());
await page.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'Cannot read properties of undefined (reading "map")',filename:'https://demo.test/assets/catalog.js',lineno:84,colno:17})));
const d=await page.evaluate(()=>collectDiagnostics(true));
if(d.errors.length!==1) throw Error('Runtime monitoring failed in Chrome');
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({report,d})=>{window.chrome={tabs:{query:async()=>[{id:1,url:report.url}]},scripting:{executeScript:async options=>[{result:options.world==='MAIN'?d:structuredClone(report)}]}};},{report,d});
await page.goto('file://'+path.resolve('popup.html'));
await page.locator('#results').waitFor({state:'visible'});
await page.screenshot({path:require('node:path').join(artifacts,'site-lens-preview.png'),fullPage:true});
await page.screenshot({path:require('node:path').join(artifacts,'site-lens-report-card.png')});
if(await page.locator('.frog-logo').evaluate(img=>!img.complete || img.naturalWidth===0))throw Error('Frog logo failed to load');
if(await page.locator('h1').innerText()!=='SEO/GEO Frog')throw Error('Brand name mismatch');
if(await page.locator('.grade-card').count()!==5)throw Error('Missing grade cards');
if(!await page.locator('#prompt').inputValue())throw Error('Prompt empty');
await page.locator('#tab-previews').click();
for(const platform of ['google','bing','facebook','linkedin','x']) {
 await page.locator('#social-tab-'+platform).click();
 if(!await page.locator('article.'+(['google','bing'].includes(platform)?'search-':'social-')+platform).isVisible())throw Error('Social preview missing');
}
await page.screenshot({path:require('node:path').join(artifacts,'seo-geo-frog-social-preview.png')});
await page.locator('#tab-javascript').click();
await page.locator('#status').selectOption('issue');
if(await page.locator('.check').count()<1)throw Error('Missing runtime issue');
await page.locator('#tab-fixes').click();
await page.locator('#copy-prompt').click();
await page.waitForFunction(()=>document.querySelector('#copy-status').textContent.length>0);
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Side panel overflows horizontally');
await page.screenshot({path:require('node:path').join(artifacts,'frog-side-panel-prompts.png')});
for(const width of [320,390,600]) {
 await page.setViewportSize({width,height:900});
 for(const key of ['overview','seo','previews','speed','javascript','fixes']) {
  await page.locator('#tab-'+key).click();
  if(!await page.locator('#panel-'+key).isVisible())throw Error('Tab visibility failed: '+key);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow: '+width+' '+key);
 }
}
await page.setViewportSize({width:390,height:900});
await page.locator('#tab-seo').click();
await page.locator('#status').selectOption('actionable');
await page.locator('.check summary').first().click();
if(!await page.locator('.check[open] .learn-link').first().isVisible())throw Error('Finding article link missing');
await page.locator('.concept-guide summary').click();
if(await page.locator('#concept-links a').count()<10)throw Error('Concept guide missing');
await page.locator('.check[open]').scrollIntoViewIfNeeded();
await page.screenshot({path:require('node:path').join(artifacts,'learning-links.png')});
console.log('Visual evidence: '+artifacts);
if(errors.length)throw Error(errors.join('\n'));
console.log('Chrome visual smoke test passed; real performance API and runtime capture passed.');
await browser.close();
})();

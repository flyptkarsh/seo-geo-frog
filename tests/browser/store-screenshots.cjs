const os=require('node:os');
const artifacts=require('node:path').resolve(__dirname,'../../docs/store/4.5.0');
process.chdir(require('node:path').resolve(__dirname,'../..'));
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
(async()=>{
const browser=await chromium.launch({channel:'chromium',headless:true});
const page=await browser.newPage({viewport:{width:560,height:800},deviceScaleFactor:1});
await page.route('https://demo.test/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="en"><head><title>Studio North — Design for the next chapter</title><meta name="description" content="Independent design studio building memorable digital experiences."><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="https://demo.test/"></head><body><main><h1>Design for the next chapter.</h1><p>A considered approach to building brands and digital products.</p><h3>Selected work</h3><img src="/broken.png"><script id="__NEXT_DATA__" type="application/json">{}</script><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Studio North"}</script></main></body></html>'}));
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
await page.route('https://demo.test/robots.txt',route=>route.fulfill({contentType:'text/plain',headers:{'access-control-allow-origin':'*'},body:'User-agent: *\nSitemap: https://demo.test/custom-map.xml'}));
await page.route('https://demo.test/llms.txt',route=>route.fulfill({contentType:'text/plain',headers:{'access-control-allow-origin':'*'},body:'# Demo documentation'}));
await page.route('https://demo.test/custom-map.xml',route=>route.fulfill({contentType:'application/xml',headers:{'access-control-allow-origin':'*'},body:'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://demo.test/</loc></url></urlset>'}));
await page.goto('file://'+path.resolve('popup.html'));
await page.locator('#results').waitFor({state:'visible'});

const shots=[
 ['overview','Your page,\nclearer.','SEO, GEO, AEO and JavaScript findings in one side panel.','Overall and category grades use a local diagnostic rubric.'],
 ['explore','Explore tags\nand libraries.','Search rendered metadata, detected libraries and script details.','Library matches include evidence; bundled dependencies may be hidden.'],
 ['seo','Check files.\nReview structure.','Inspect robots.txt, sitemaps, optional llms.txt and semantic HTML.','Bounded public-file checks and structural heuristics, with practical guidance.'],
 ['previews','Preview before\nyou share.','Compare approximate search results and social cards.','Google, Bing, Facebook, LinkedIn and X. Platforms may rewrite or cache tags.'],
 ['fixes','From evidence\nto a fix.','Copy a focused, editable prompt for your coding tool.','Works with Claude, Codex, Cursor and other tools. No automatic AI upload.']
];
const escape=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
for(const [key,title,subtitle,note] of shots) {
 await page.locator('#tab-'+key).click();
 if(key==='explore') {await page.locator('#explore-kind').selectOption('libraries');await page.locator('#explore-results summary').first().click();}
 if(key==='seo') await page.locator('#semantics-summary').locator('..').locator('summary').first().click();
 if(key==='fixes') await page.locator('#panel-fixes details').first().evaluate(node=>node.open=true);
 await page.evaluate(()=>scrollTo(0,0));
 const capture=await page.screenshot();
 const canvas=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 await canvas.setContent(`<!doctype html><html><head><style>
 *{box-sizing:border-box}body{margin:0;background:#f0f6f6;color:#203d4b;font-family:Arial,sans-serif}.copy{position:absolute;left:60px;top:64px;width:560px}.brand{display:flex;align-items:center;gap:14px;font-size:24px;font-weight:700}.brand img{width:52px;height:52px;border-radius:14px}h1{font-size:62px;line-height:1.06;letter-spacing:-2.6px;margin:78px 0 26px;white-space:pre-line;font-weight:650}p{font-size:25px;line-height:1.45;max-width:485px;color:#546f7a}.note{font-size:17px;line-height:1.6;max-width:480px;margin-top:38px}.footer{position:absolute;left:60px;bottom:40px;font-size:14px;color:#647b86}.ui{position:absolute;right:0;top:0;width:560px;height:800px;box-shadow:-14px 0 45px #23465d13;object-fit:contain}
 </style></head><body><div class="copy"><div class="brand"><img src="data:image/png;base64,${fs.readFileSync('icons/frog-128.png').toString('base64')}">SEO/GEO Frog <span style="font-size:13px;color:#627c87">4.5.0</span></div><h1>${escape(title)}</h1><p>${escape(subtitle)}</p><p class="note">${escape(note)}</p></div><div class="footer">Controlled example page · Actual extension UI · No citation or ranking guarantees</div><img class="ui" src="data:image/png;base64,${capture.toString('base64')}"></body></html>`);
 await canvas.screenshot({path:path.join(artifacts,'screenshot-'+key+'.png'),omitBackground:false});
 await canvas.close();
}
if(errors.length)throw Error(errors.join('\n'));
await browser.close();
console.log('Five 1280 × 800 screenshots saved in '+artifacts);
})();

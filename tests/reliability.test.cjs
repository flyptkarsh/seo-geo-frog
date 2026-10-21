const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
function fixture(title='First page',url='https://example.com/first') {
 const dom=new JSDOM(`<title>${title}</title><meta name="description" content="Search description"><meta property="og:title" content="Social title"><meta property="og:image" content="/image.png"><h1>Example</h1>`,{url,runScripts:'outside-only'});
 dom.window.eval(read('audit.js'));
 const result=dom.window.auditPage();dom.window.close();return result;
}
async function panel(t,execute) {
 const w=new JSDOM(read('popup.html'),{url:'https://extension.test',runScripts:'outside-only'}).window;
 t.after(()=>w.close());
 const state={tab:{id:1,windowId:1,url:'https://example.com/first'},result:fixture(),calls:0};
 state.badges=[];
 w.chrome={action:Object.fromEntries(['setBadgeText','setBadgeBackgroundColor','setBadgeTextColor','setTitle'].map(method=>[method,async details=>state.badges.push({method,...details})])),runtime:{getManifest:()=>JSON.parse(read('manifest.json'))},tabs:{query:async()=>[state.tab],onUpdated:{addListener:fn=>state.updated=fn}},scripting:{executeScript:async opts=>{
  if(opts.world==='MAIN')throw Error('Runtime unavailable in fixture');
  state.calls++;return execute?execute(state,opts):[{result:structuredClone(state.result)}];
 }}};
 for(const file of ['audit','diagnostics','grades','prompt','summary','icons','social','learn','popup'])w.eval(read(file+'.js'));
 await tick();return {w,state,$:id=>w.document.getElementById(id)};
}
test('late audit results cannot overwrite the page after navigation',async t=>{
 let resolveOld;
 const {w,state,$}=await panel(t,s=>s.calls===1?new Promise(resolve=>resolveOld=resolve):Promise.resolve([{result:structuredClone(s.result)}]));
 state.updated(1,{status:'loading'},{status:'loading'});
 state.tab.url='https://example.com/new';state.result=fixture('Newest title',state.tab.url);
 $('rerun').click();await tick();
 assert.equal($('page-url').textContent,state.tab.url);
 const stale=fixture('Stale title');stale.checks.push({status:'issue',title:'Stale issue'});
 resolveOld([{result:stale}]);await tick();
 assert.equal(state.badges.filter(b=>b.method==='setBadgeText').at(-1).text,require('../grades.js').gradeReport(state.result).overall.letter);
 $('tab-previews').click();
 assert.equal(w.document.querySelector('.search-title').textContent,'Newest title');
 assert.equal($('rerun').disabled,false);
});
test('injection failure and empty response both allow a successful retry',async t=>{
 const {state,$}=await panel(t,s=>{
  if(s.calls===1)throw Error('Access revoked');
  if(s.calls===2)return [];
  return [{result:structuredClone(s.result)}];
 });
 assert.match($('message').textContent,/Access revoked/);assert.equal($('rerun').disabled,false);
 $('rerun').click();await tick();assert.match($('message').textContent,/No page data/);assert.equal($('rerun').disabled,false);
 $('rerun').click();await tick();assert.equal($('results').hidden,false);assert.equal(state.calls,3);
});
test('all five preview tabs work with keyboard navigation and load images only on request',async t=>{
 const {w,$}=await panel(t);
 $('tab-previews').click();
 for(const platform of ['google','bing','facebook','linkedin','x']) {
  const button=$('social-tab-'+platform);button.click();
  assert.equal(button.getAttribute('aria-selected'),'true');
  assert.equal($('social-card').getAttribute('aria-labelledby'),button.id);
  assert.equal($('social-card').querySelector('img'),null);
  assert.match($('social-card').textContent,platform==='google'||platform==='bing'?/First page/:/Social title/);
 }
 $('social-tab-x').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 assert.equal($('social-tab-google').getAttribute('aria-selected'),'true');
 $('social-tab-facebook').click();$('social-card').querySelector('button').click();
 const img=$('social-card').querySelector('img');assert.equal(img.src,'https://example.com/image.png');assert.equal(img.referrerPolicy,'no-referrer');
 img.dispatchEvent(new w.Event('error'));assert.match($('social-card').textContent,/Image unavailable/);
});
test('clipboard rejection selects the edited prompt for manual copying',async t=>{
 const {w,$}=await panel(t);
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>{throw Error('Denied');}}});
 $('tab-fixes').click();$('prompt').value='My edited instructions';$('copy-prompt').click();await tick();
 assert.match($('copy-status').textContent,/Clipboard unavailable/);
 assert.equal(w.document.activeElement,$('prompt'));
 assert.equal($('prompt').selectionStart,0);assert.equal($('prompt').selectionEnd,$('prompt').value.length);
});
test('empty prompt scopes disable actions and unavailable diagnostics stay ungraded',async t=>{
 const {state,$}=await panel(t);
 state.result.checks=[];$('rerun').click();await tick();
 assert.equal($('copy-prompt').disabled,true);assert.equal($('download-prompt').disabled,true);
 assert.equal($('monitor').disabled,true);
 assert.equal($('metric-js').textContent,'—');
 assert.match($('monitor-status').textContent,/unavailable/);
});
test('export contains current metadata, rubric and the installed extension version',async t=>{
 const {w,$}=await panel(t);let blob,download;
 w.URL.createObjectURL=value=>{blob=value;return 'blob:fixture';};
 w.HTMLAnchorElement.prototype.click=function(){download=this.download;};
 $('export').click();
 const text=await new Promise((resolve,reject)=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsText(blob);});
 const data=JSON.parse(text);
 assert.equal(data.title,'First page');assert.ok(data.grades.categories.length);assert.ok(data.improvements.items.length);
 assert.equal(data.tool.version,JSON.parse(read('manifest.json')).version);
 assert.match(download,/^seo-geo-frog-example.com-.*\.json$/);
});
test('social previews reject executable, embedded and credential-bearing URLs',()=>{
 const w=new JSDOM('',{runScripts:'outside-only'}).window;
 try {
  w.eval(read('social.js'));
  for(const image of ['javascript:alert(1)','data:image/svg+xml,<svg/>','file:///etc/passwd','https://user:password@example.com/image.png']) {
   assert.equal(w.socialPreview({url:'https://example.com/',meta:[{name:'og:image',content:image}]},'facebook').imageUrl,'');
  }
 } finally {w.close();}
});
test('every emitted finding has curated HTTPS learning links',async t=>{
 const {articlesForCheck,learningArticles}=require('../learn.js');
 const r=fixture();
 const dom=new JSDOM('<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>',{url:r.url,runScripts:'outside-only'});t.after(()=>dom.window.close());
 dom.window.eval(read('audit.js'));dom.window.eval(read('diagnostics.js'));
 dom.window.performance.getEntriesByType=()=>[];
 const diagnostic=await dom.window.collectDiagnostics(true);
 for(const check of [...dom.window.auditPage().checks,...r.checks,...diagnostic.checks,{title:'Runtime diagnostics unavailable'}])assert.ok(articlesForCheck(check).length,check.title);
 for(const [title,publisher,url] of Object.values(learningArticles)) {
  assert.ok(title&&publisher);assert.equal(new URL(url).protocol,'https:');assert.equal(new URL(url).username,'');
 }
 assert.equal(articlesForCheck({title:'javascript:alert(1)'}).length,0);
});
test('learning links are safe external links and guides follow the selected tab',async t=>{
 const {w,$}=await panel(t);
 $('tab-seo').click();
 assert.ok(w.document.querySelectorAll('.finding-learning a').length>0);
 for(const a of w.document.querySelectorAll('.learn-link')) {
  assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer');
  assert.equal(new URL(a.href).protocol,'https:');
 }
 $('tab-speed').click();assert.match($('concept-links').textContent,/Time to first byte/);assert.doesNotMatch($('concept-links').textContent,/Canonical/);
 $('tab-fixes').click();assert.match($('concept-links').textContent,/fix prompts/);
});


test('overall badge matches report, refreshes and clears on navigation or failure',async t=>{
 const {state,$}=await panel(t);
 const last=method=>state.badges.filter(b=>b.method===method).at(-1);
 state.result.checks.forEach(c=>{if(c.status!=='info')c.status='pass';});
 $('rerun').click();await tick();
 assert.equal(last('setBadgeText').text,'A');assert.equal(last('setBadgeText').tabId,1);
 assert.equal(last('setBadgeBackgroundColor').color,'#15803D');assert.equal(last('setBadgeTextColor').color,'#FFFFFF');
 assert.match(last('setTitle').title,/Overall A/);assert.match($('overall-grade').textContent,/Overall A/);
 state.updated(1,{status:'loading'},{status:'loading'});assert.equal(last('setBadgeText').text,'');
 state.result.checks.forEach(c=>{if(c.status!=='info')c.status='issue';});
 $('rerun').click();await tick();assert.equal(last('setBadgeText').text,'F');assert.equal(last('setBadgeBackgroundColor').color,'#DC2626');
 state.result.checks=[];$('rerun').click();await tick();assert.equal(last('setBadgeText').text,'?');
 state.result=null;$('rerun').click();await tick();assert.equal(last('setBadgeText').text,'');
});
test('background clears badges on full and SPA navigation while panel is closed',async()=>{
 const vm=require('node:vm');let updated;const calls=[];
 vm.runInNewContext(read('background.js'),{chrome:{action:{onClicked:{addListener:()=>{}},setBadgeText:async d=>calls.push(d),setTitle:async()=>{}},tabs:{onUpdated:{addListener:fn=>updated=fn}}}});
 updated(3,{status:'loading'});updated(7,{url:'https://example.com/next'});updated(9,{title:'Changed title'});
 assert.equal(calls.length,2);assert.equal(calls[0].tabId,3);assert.equal(calls[1].tabId,7);assert.ok(calls.every(c=>c.text===''));
});

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(root,'audit.js'),'utf8');
function audit(html) {
  const dom = new JSDOM(html,{url:'https://example.com/article',runScripts:'outside-only'});
  dom.window.eval(source);
  return dom.window.auditPage();
}
test('flags conflicting metadata, restrictions, and malformed JSON-LD',()=>{
 const r=audit('<title>A</title><title>B</title><meta name="robots" content="noindex, nosnippet"><meta name="description" content="one"><meta name="description" content="two"><script type="application/ld+json">{bad}</script><h1>One</h1><h3>Skipped</h3><img src="x"><img alt="" src="y">');
 assert.equal(r.checks.find(c=>c.title==='Page title').status,'issue');
 assert.equal(r.checks.find(c=>c.title==='Robots meta directives').status,'review');
 assert.equal(r.checks.find(c=>c.title==='JSON-LD syntax').status,'issue');
 assert.match(r.checks.find(c=>c.title==='Image alternatives').evidence,/1 of 2/);
 assert.equal(r.checks.find(c=>c.title==='Heading hierarchy').status,'review');
 assert.match(r.checks.find(c=>c.title==='Repeated meta keys').evidence,/description/);
});
test('reads graph and nested schema types, resolves relative canonicals',()=>{
 const r=audit(`<html lang="en"><title>A useful article title for testing</title><link rel="canonical" href="/article"><script type="application/ld+json; charset=utf-8">{"@context":"https://schema.org","@graph":[{"@type":"Article","headline":"Title","author":{"@type":"Person","name":"Jane"},"datePublished":"2026-10-19"}]}</script><h1>A useful article</h1></html>`);
 assert.equal(r.canonical,'https://example.com/article');
 assert.ok(r.types.includes('Person'));
 assert.ok(r.types.includes('Article'));
 assert.equal(r.checks.find(c=>c.title==='Article details 1').status,'pass');
 assert.equal(r.checks.find(c=>c.title==='JSON-LD context').status,'pass');
});
test('handles empty and valid primitive JSON without treating syntax as schema validation',()=>{
 for (const raw of ['null','42','[]','{}']) {
  const r=audit(`<script type="application/ld+json">${raw}</script>`);
  assert.equal(r.jsonld[0].valid,true);
  assert.equal(r.checks.find(c=>c.title==='Typed schema entities').status,'review');
 }
 assert.equal(audit('').checks.find(c=>c.title==='JSON-LD syntax').status,'review');
});
test('popup renders untrusted page text safely and filters results',async()=>{
 const html=fs.readFileSync(path.join(root,'popup.html'),'utf8');
 const dom=new JSDOM(html,{url:'https://extension.test',runScripts:'outside-only'});
 const w=dom.window;
 const r=audit('<title>&lt;img src=x onerror=alert(1)&gt;</title><meta name="description" content="&lt;script&gt;evil&lt;/script&gt;"><h1>Test</h1>');
 w.chrome={tabs:{query:async()=>[{id:1,url:r.url}]},scripting:{executeScript:async opts=>[{result:opts.world==='MAIN'?{url:r.url,checks:[],metrics:{ttfb:900,fcp:1800,lcp:null,jsBytes:20000},errors:[],heavy:[],slow:[],active:true,startedAt:r.auditedAt}:r}]}};
 w.eval(source);
 w.eval(fs.readFileSync(path.join(root,'diagnostics.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'grades.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'prompt.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'summary.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'icons.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'social.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'popup.js'),'utf8'));
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(w.document.getElementById('results').hidden,false);
 assert.ok(w.document.querySelectorAll('.check').length>0);
 assert.equal(w.document.querySelectorAll('.check .badge.pass').length,0);
 assert.equal(w.document.querySelectorAll('.grade-card').length,5);
 w.document.getElementById('tab-speed').click();
 assert.equal(w.document.getElementById('panel-speed').hidden,false);
 assert.equal(w.document.getElementById('panel-overview').hidden,true);
 assert.equal(w.document.getElementById('findings-shell').parentElement.parentElement.id,'panel-speed');
 assert.equal(w.document.getElementById('tab-speed').getAttribute('aria-selected'),'true');
 w.document.getElementById('tab-speed').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 assert.equal(w.document.getElementById('tab-javascript').getAttribute('aria-selected'),'true');
 w.document.getElementById('tab-overview').click();
 assert.match(w.document.getElementById('prompt').value,/Review items only/);
 assert.equal(w.document.querySelectorAll('#meta script,#meta img,#checks img').length,0);
 const filter=w.document.getElementById('status');filter.value='issue';filter.dispatchEvent(new w.Event('change'));
 assert.equal(w.document.querySelectorAll('.check').length,r.checks.filter(c=>c.status==='issue').length);
 const scope=w.document.getElementById('prompt-scope');scope.value='all';scope.dispatchEvent(new w.Event('change'));
 assert.match(w.document.getElementById('prompt').value,/rubricVersion/);
 // Review cards generate a focused editable prompt with clipboard fallback.
 filter.value='review';filter.dispatchEvent(new w.Event('change'));
 const card=w.document.querySelector('.check');
 card.querySelector('.generate-fix').click();
 assert.equal(card.querySelector('.finding-prompt').hidden,false);
 const text=card.querySelector('textarea');assert.match(text.value,/Selected finding only \(1 finding\)/);
 let copied='';Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
 text.value+='\nUser edit';card.querySelector('.copy-finding').click();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(copied.endsWith('User edit'));
 assert.match(card.querySelector('[role="status"]').textContent,/Copied/);
});
test('popup explains unsupported pages',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,'popup.html'),'utf8'),{runScripts:'outside-only'});
 dom.window.chrome={tabs:{query:async()=>[{id:1,url:'chrome://extensions'}]}};
 dom.window.eval(fs.readFileSync(path.join(root,'social.js'),'utf8'));
 dom.window.eval(fs.readFileSync(path.join(root,'popup.js'),'utf8'));
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.match(dom.window.document.getElementById('message').textContent,/HTTP or HTTPS/);
 assert.equal(dom.window.document.getElementById('rerun').disabled,false);
});

test('diagnostics measures resource evidence and captures new runtime errors',async()=>{
 const dom=new JSDOM('<script src="/blocking.js"></script>',{url:'https://example.com',runScripts:'outside-only'});
 const w=dom.window;
 w.performance.getEntriesByType=type=>type==='navigation'?[{startTime:0,responseStart:950,loadEventEnd:3200}]:type==='paint'?[{name:'first-contentful-paint',startTime:2200}]:type==='resource'?[{name:'https://example.com/app.js',initiatorType:'script',transferSize:200000,decodedBodySize:700000,duration:1900,responseStatus:200},{name:'https://example.com/missing.js',initiatorType:'script',transferSize:300,decodedBodySize:50,duration:10,responseStatus:404}]:[];
 w.eval(fs.readFileSync(path.join(root,'diagnostics.js'),'utf8'));
 let d=await w.collectDiagnostics();
 assert.equal(d.metrics.ttfb,950);
 assert.equal(d.metrics.jsBytes,700050);
 assert.equal(d.checks.find(c=>c.title==='Exposed HTTP resource errors').status,'issue');
 w.dispatchEvent(new w.ErrorEvent('error',{message:'broken handler',filename:'https://example.com/app.js',lineno:12,colno:4}));
 d=await w.collectDiagnostics(true);
 assert.equal(d.errors[0].message,'broken handler');
 assert.equal(d.errors[0].line,12);
 assert.equal(d.active,false);
 w.dispatchEvent(new w.ErrorEvent('error',{message:'should not record'}));
 d=await w.collectDiagnostics();
 assert.equal(d.errors.length,1);
 d=await w.collectDiagnostics('start');
 assert.equal(d.active,true);
 assert.equal(d.errors.length,0);
 await w.collectDiagnostics(true);
});
test('Claude prompt contains concrete evidence, limitations, and verification requirements',()=>{
 const {buildFixPrompt}=require('../prompt.js');
 const r=audit('<title>Example</title><script type="application/ld+json">{broken}</script>');
 const prompt=buildFixPrompt(r);
 assert.match(prompt,/JSON-LD syntax/);
 assert.match(prompt,/untrusted evidence/);
 assert.match(prompt,/do not invent file names/);
 assert.match(prompt,/before\/after measurements/);
 assert.match(prompt,/BEGIN UNTRUSTED AUDIT EVIDENCE/);
});

test('grades exclude unknown measurements and require adequate coverage',()=>{
 const {gradeReport}=require('../grades.js');
 let grades=gradeReport({checks:[],types:[]});
 assert.ok(grades.categories.every(g=>g.letter===null && g.score===null));
 const r=audit('<title>Example article</title><h1>Example</h1>');
 grades=gradeReport(r);
 assert.equal(grades.categories.find(g=>g.key==='speed').letter,null);
 assert.equal(grades.categories.find(g=>g.key==='javascript').letter,null);
 assert.equal(grades.categories.find(g=>g.key==='schema').score,50);
});
test('grade deductions and A–F boundaries follow weighted observed checks',()=>{
 const {gradeReport}=require('../grades.js');
 const base={checks:[],types:[]};
 const definition=gradeReport(base).categories.find(g=>g.key==='seo');
 const r={checks:definition.items.map(i=>({title:i.title,status:'pass',evidence:'observed'})),types:[]};
 let g=gradeReport(r).categories.find(g=>g.key==='seo');
 assert.equal(g.letter,'A');assert.equal(g.score,100);
 r.checks.forEach(c=>c.status='issue');
 g=gradeReport(r).categories.find(g=>g.key==='seo');
 assert.equal(g.letter,'F');assert.equal(g.score,0);
 r.checks.forEach(c=>c.status='review');
 g=gradeReport(r).categories.find(g=>g.key==='seo');
 assert.equal(g.score,50);
 // These first six weights total 14/19; remaining failures yield C (74).
 r.checks.forEach((c,i)=>c.status=i<6?'pass':'issue');
 g=gradeReport(r).categories.find(g=>g.key==='seo');assert.equal(g.letter,'C');
 r.checks[6].status='pass';g=gradeReport(r).categories.find(g=>g.key==='seo');assert.equal(g.letter,'C');
 r.checks[7].status='pass';g=gradeReport(r).categories.find(g=>g.key==='seo');assert.equal(g.letter,'B');
 const lost=g.items.reduce((s,i)=>s+i.pointsLost,0);assert.ok(Math.abs(lost-(100-g.score))<1);
});
test('speed needs two measured timings even if image checks pass',()=>{
 const {gradeReport}=require('../grades.js');
 const checks=['Document TTFB','Slow recorded resources','Broken loaded images','Oversized image candidates'].map(title=>({title,status:'pass'}));
 assert.equal(gradeReport({checks}).categories.find(g=>g.key==='speed').letter,null);
 checks.push({title:'First contentful paint',status:'review'});
 assert.ok(gradeReport({checks}).categories.find(g=>g.key==='speed').letter);
});
test('GEO does not penalize article-only attribution on non-article pages',()=>{
 const {gradeReport}=require('../grades.js');
 assert.equal(gradeReport({checks:[]}).categories.find(g=>g.key==='geo').items.length,4);
 assert.equal(gradeReport({checks:[],types:['Article']}).categories.find(g=>g.key==='geo').items.length,6);
});

test('review and individual fix prompts contain only requested findings',()=>{
 const {buildFixPrompt}=require('../prompt.js');
 const r=audit('<title>Example</title><script type="application/ld+json">{broken}</script>');
 const evidence=prompt=>JSON.parse(prompt.split('--- BEGIN UNTRUSTED AUDIT EVIDENCE ---\n')[1].split('\n--- END UNTRUSTED AUDIT EVIDENCE ---')[0]);
 const review=evidence(buildFixPrompt(r,{scope:'review'}));
 assert.ok(review.findings.length>0);assert.ok(review.findings.every(c=>c.status==='review'));
 const issue=evidence(buildFixPrompt(r,{scope:'issue'}));
 assert.ok(issue.findings.every(c=>c.status==='issue'));
 const selected=r.checks.find(c=>c.status==='review');
 const one=evidence(buildFixPrompt(r,{findings:[selected]}));
 assert.equal(one.findings.length,1);assert.equal(one.findings[0].title,selected.title);
 assert.match(buildFixPrompt(r,{findings:[selected]}),/verify applicability first/);
 assert.match(buildFixPrompt({...r,checks:[]},{scope:'review'}),/There are no matching findings/);
});

test('side panel clears stale results after switching tabs or navigating',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,'popup.html'),'utf8'),{url:'https://extension.test',runScripts:'outside-only'});
 const w=dom.window;
 const r=audit('<title>First page</title><h1>First page</h1>');
 let activated,updated;
 w.chrome={tabs:{query:async()=>[{id:1,url:r.url,windowId:7}],onActivated:{addListener:fn=>activated=fn},onUpdated:{addListener:fn=>updated=fn}},scripting:{executeScript:async opts=>{if(opts.world==='MAIN')throw Error('No runtime in fixture');return [{result:structuredClone(r)}];}}};
 for(const file of ['audit.js','diagnostics.js','grades.js','prompt.js','summary.js','icons.js','social.js','popup.js']) w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(w.document.getElementById('results').hidden,false);
 activated({tabId:8,windowId:9});
 assert.equal(w.document.getElementById('results').hidden,false,'Other windows should not clear this panel');
 activated({tabId:2,windowId:7});
 assert.equal(w.document.getElementById('results').hidden,true);
 assert.match(w.document.getElementById('message').textContent,/Switched tabs/);
 w.document.getElementById('rerun').click();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(w.document.getElementById('results').hidden,false);
 updated(1,{status:'loading'});
 assert.equal(w.document.getElementById('results').hidden,true);
 assert.match(w.document.getElementById('message').textContent,/Page changed/);
});

test('toolbar action opens native side panel and requests a fresh audit',async()=>{
 const vm=require('node:vm');let clicked,opened,message;
 vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),{chrome:{action:{onClicked:{addListener:fn=>clicked=fn}},sidePanel:{open:async opts=>{opened=opts.windowId;}},runtime:{sendMessage:async data=>{message=data;}}},console});
 clicked({windowId:7});await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(opened,7);assert.equal(message.type,'frog-audit-active-tab');assert.equal(message.windowId,7);
});

test('improvement summary prioritizes real issues and handles a clean audit',()=>{
 const {buildImprovementSummary}=require('../summary.js');
 const checks=[{title:'og:image',group:'Social',status:'review',advice:'Add a sharing image.'},{title:'Captured runtime and load errors',group:'JavaScript',status:'issue'},{title:'Document TTFB',group:'Speed',status:'review'},{title:'Page title',status:'pass'}];
 const summary=buildImprovementSummary({checks},2);
 assert.equal(summary.total,3);assert.equal(summary.items.length,2);
 assert.equal(summary.items[0].title,'Captured runtime and load errors');
 assert.equal(summary.items[1].title,'Document TTFB');
 assert.equal(buildImprovementSummary({checks:[{status:'info'},{status:'pass'}]}).items.length,0);
 assert.match(buildImprovementSummary({checks:[{title:'JSON-LD syntax',status:'review'}]}).items[0].action,/Consider relevant structured data/);
});

test('individual finding grades communicate status without grading unknown data',()=>{
 const {gradeFinding,buildImprovementSummary}=require('../summary.js');
 assert.equal(gradeFinding({status:'pass'}).letter,'A');
 assert.equal(gradeFinding({status:'review'}).letter,'C');
 assert.equal(gradeFinding({status:'issue'}).letter,'F');
 assert.equal(gradeFinding({status:'info'}).letter,null);
 assert.equal(gradeFinding({}).letter,null);
 const summary=buildImprovementSummary({checks:[{title:'Page title',status:'issue'},{title:'Canonical URL',status:'review'}]});
 assert.deepEqual(summary.items.map(item=>item.grade.letter),['F','C']);
});

test('social previews use platform tags, safe image URLs and honest missing states',()=>{
 const w=new JSDOM('',{runScripts:'outside-only'}).window;
 w.eval(fs.readFileSync(path.join(root,'social.js'),'utf8'));
 const r={url:'https://example.com/post',meta:[{name:'og:title',content:'OG title'},{name:'twitter:title',content:'X title'},{name:'og:image',content:'/cover.png'},{name:'twitter:card',content:'summary_large_image'}]};
 assert.equal(w.socialPreview(r,'facebook').title.value,'OG title');
 assert.equal(w.socialPreview(r,'x').title.value,'X title');
 assert.equal(w.socialPreview(r,'x').imageUrl,'https://example.com/cover.png');
 assert.equal(w.socialPreview(r,'x').compact,false);
 assert.equal(w.socialPreview(r,'linkedin').description.source,'Missing');
 r.meta.push({name:'twitter:image',content:'javascript:alert(1)'});
 assert.equal(w.socialPreview(r,'x').imageUrl,'');
 w.close();
});

test('Reaudit refreshes content; navigation waits, SPA changes debounce, missing access recovers',async()=>{
 const w=new JSDOM(fs.readFileSync(path.join(root,'popup.html'),'utf8'),{url:'https://extension.test',runScripts:'outside-only'}).window;
 let url='https://example.com/start',calls=0,updated,activated,revision=0;
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 w.chrome={tabs:{query:async()=>[{id:1,windowId:8,url}],onUpdated:{addListener:fn=>updated=fn},onActivated:{addListener:fn=>activated=fn}},scripting:{executeScript:async opts=>{
  if(opts.world==='MAIN')return [{result:{url,checks:[],metrics:{},errors:[],heavy:[],slow:[],active:true,startedAt:new Date().toISOString()}}];
  calls++;const r=audit('<title>Revision '+revision+'</title><h1>Test</h1>');r.url=url;return [{result:r}];
 }}};
 for(const name of ['audit','diagnostics','grades','prompt','summary','icons','social','popup'])w.eval(fs.readFileSync(path.join(root,name+'.js'),'utf8'));
 await pause(40);assert.equal(calls,1);
 revision=2;w.document.getElementById('rerun').click();await pause(40);
 assert.equal(calls,2);assert.match(w.document.getElementById('meta').textContent || w.document.body.textContent,/./);
 url='https://example.com/next';updated(1,{status:'loading'}, {status:'loading'});
 assert.equal(w.document.getElementById('results').hidden,true);
 await pause(750);assert.equal(calls,2);
 updated(1,{status:'complete'},{status:'complete'});await pause(780);assert.equal(calls,3);
 url='https://example.com/route';updated(1,{url},{status:'complete'});updated(1,{url},{status:'complete'});
 await pause(780);assert.equal(calls,4);assert.match(w.document.getElementById('page-url').textContent,/route/);
 updated(99,{status:'complete'},{});await pause(750);assert.equal(calls,4);
 url=undefined;activated({tabId:1,windowId:8});await pause(780);
 assert.equal(w.document.getElementById('results').hidden,true);assert.match(w.document.getElementById('message').textContent,/toolbar icon/);
 assert.equal(w.document.getElementById('rerun').disabled,false);
 url='https://another.test/';w.document.getElementById('rerun').click();await pause(40);assert.equal(calls,5);
 w.close();
});

const $ = id => document.getElementById(id);
let report;
let activeSection='overview';
let socialPlatform='google';
let auditedTabId=null;
let panelWindowId=null;
let generation=0;
let auditRunning=false;
let autoAuditTimer;
function activeTabQuery() {
  return chrome.tabs.query(panelWindowId == null ? {active:true,currentWindow:true} : {active:true,windowId:panelWindowId});
}
function scheduleAudit() {
  clearTimeout(autoAuditTimer);
  autoAuditTimer=setTimeout(()=>run(),700);
}
const sectionGroups={seo:['Metadata','Crawl signals','Social','Content','Structured data','GEO signals'],speed:['Speed'],javascript:['JavaScript']};
function activateSection(key, focus=false) {
  activeSection=key;
  for(const tab of document.querySelectorAll('.tabbar [role="tab"]')) {
    const selected=tab.dataset.tab===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
    if(selected && focus) tab.focus();
  }
  for(const panel of document.querySelectorAll('[role="tabpanel"][id^="panel-"]')) panel.hidden=panel.id!==`panel-${key}`;
  const host=$(`panel-${key}`)?.querySelector('.finding-host');
  if(host) {host.append($('findings-shell'));$('findings-shell').hidden=false;}
  else $('findings-shell').hidden=true;
  $('category').value='all';
  for(const option of $('category').options) option.hidden=option.value!=='all' && !(sectionGroups[key] || []).includes(option.value);
  if(report) renderChecks();
}
function invalidateReport(message) {
  clearTimeout(autoAuditTimer);
  generation++;auditRunning=false;report=null;
  $('results').hidden=true;$('message').hidden=false;
  $('message').textContent=message;
  $('page-url').textContent='Page changed · audit needed';$('rerun').disabled=false;
}
const labels = {issue:'Issue',review:'Review',pass:'Pass',info:'Info'};
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function findingGradeBadge(check) {
  const grade=gradeFinding(check);
  const badge=el('span',grade.letter || '—','finding-grade grade-'+(grade.letter || 'none'));
  badge.title=grade.meaning;badge.setAttribute('aria-label',`${grade.letter?'Grade '+grade.letter:'Ungraded'}: ${grade.meaning}`);
  return badge;
}
function renderChecks() {
  const checks = report.checks.filter(c => (!sectionGroups[activeSection] || sectionGroups[activeSection].includes(c.group)) && ($('category').value === 'all' || c.group === $('category').value) && ($('status').value === 'all' || ($('status').value==='actionable' && ['review','issue'].includes(c.status)) || c.status === $('status').value)).sort((a,b)=>({issue:0,review:1,pass:2,info:3}[a.status]-{issue:0,review:1,pass:2,info:3}[b.status]));
  $('checks').replaceChildren();
  $('count').textContent = `${checks.length} of ${report.checks.length} checks shown · expand a finding for evidence and guidance`;
  for (const c of checks) {
    const card = el('details',undefined,'check');
    const summary = el('summary');
    summary.append(findingGradeBadge(c),el('span',labels[c.status],'badge '+c.status),el('span',c.title),el('span',c.group,'category'));
    const body = el('div',undefined,'detail');
    body.append(el('p',`${gradeFinding(c).letter || 'Ungraded'} · ${gradeFinding(c).meaning}. Finding grades describe status; category grades use weighted checks.`,'finding-grade-note'),el('div',c.evidence,'evidence'),el('p',c.advice,'advice'));
    if(c.status==='review' || c.status==='issue') {
      const generate=el('button','Generate fix prompt','generate-fix');
      generate.type='button';generate.prepend(iconNode('sparkles'));
      const panel=el('div',undefined,'finding-prompt');panel.hidden=true;
      const text=el('textarea');text.setAttribute('aria-label',`Fix prompt for ${c.title}`);text.spellcheck=false;
      const copy=el('button','Copy prompt','copy-finding');copy.type='button';copy.prepend(iconNode('copy'));
      const status=el('p',undefined,'muted');status.setAttribute('role','status');
      panel.append(el('p','Paste into your coding tool with the repository. Edit or remove private details before sharing.','muted'),text,copy,status);
      generate.addEventListener('click',()=>{
        text.value=buildFixPrompt(report,{findings:[c]});panel.hidden=false;generate.hidden=true;text.focus();
      });
      copy.addEventListener('click',()=>copyPrompt(text,status));
      body.append(generate,panel);
    }
    card.append(summary,body);
    $('checks').append(card);
  }
  if (!checks.length) $('checks').append(el('p','No findings match these filters.'));
}
function render() {
  $('page-url').textContent = report.url;
  $('page-url').title = report.url;
  const d=report.diagnostics;
  const ms=value=>value==null?'—':value>=1000?`${(value/1000).toFixed(2)} s`:`${Math.round(value)} ms`;
  $('metric-ttfb').textContent=ms(d?.metrics.ttfb);
  $('metric-fcp').textContent=ms(d?.metrics.fcp);
  $('metric-lcp').textContent=ms(d?.metrics.lcp);
  $('metric-js').textContent=d?`${(d.metrics.jsBytes/1024).toFixed(0)} KiB`:'—';
  $('monitor').disabled=!d;
  $('monitor').replaceChildren(iconNode(d?.active?'pause':'play'),document.createTextNode(d?.active?'Stop monitoring':'Start monitoring'));
  $('monitor-status').textContent=d ? `${d.active?'Monitoring':'Stopped'} since ${new Date(d.startedAt).toLocaleTimeString()} · ${d.errors.length} captured error(s). Interact, then Reaudit to refresh. Resets on navigation.` : 'Runtime diagnostics unavailable. SEO audit remains available.';
  $('resources').replaceChildren();
  for(const r of d?.heavy || []) {
    const row=el('div',undefined,'resource');
    row.append(el('strong',`${(r.decodedBytes/1024).toFixed(1)} KiB decoded · ${(r.transferBytes/1024).toFixed(1)} KiB transfer · ${r.durationMs} ms`),el('span',r.url));
    $('resources').append(row);
  }
  if(!d?.heavy.length) $('resources').textContent='No exposed resource sizes available.';
  report.checks.forEach(check=>{check.grade=gradeFinding(check);});
  report.grades=gradeReport(report);
  report.improvements=buildImprovementSummary(report);
  $('improvements').replaceChildren();
  $('improvement-count').textContent=report.improvements.total?`${report.improvements.items.length} of ${report.improvements.total} items`:'';
  for(const item of report.improvements.items) {
    const bullet=el('li');
    const heading=el('div',undefined,'improvement-heading');
    heading.append(findingGradeBadge(item),el('strong',item.title));
    bullet.append(heading,el('span',item.action));
    $('improvements').append(bullet);
  }
  if(!report.improvements.items.length) $('improvements').append(el('li','No actionable findings in the checks available for this page.','summary-empty'));
  $('grades').replaceChildren();
  $('grade-breakdown').replaceChildren();
  $('grade-method').textContent=report.grades.method;
  for(const g of report.grades.categories) {
    const card=el('button',undefined,'grade-card grade-card-'+(g.letter || 'none'));
    card.type='button';
    card.addEventListener('click',()=>activateSection(({schema:'seo',geo:'seo'}[g.key] || g.key),true));
    const letter=el('strong',g.letter || '—','grade-letter grade-'+(g.letter || 'none'));
    letter.setAttribute('aria-label',g.letter?`Grade ${g.letter}`:'Insufficient data');
    card.append(el('span',({schema:'Schema',geo:'GEO',javascript:'JS'}[g.key] || g.name),'grade-name'),letter,el('span',g.score===null?'Insufficient data':`${g.score} / 100`,'grade-score'),el('span',`${g.coverage}% checked`,'grade-coverage'));
    const meter=el('span',undefined,'grade-meter');meter.setAttribute('aria-hidden','true');
    const fill=el('span');fill.style.width=`${g.score || 0}%`;meter.append(fill);card.append(meter);
    card.title=`${g.name}: ${g.score===null?'Insufficient data':g.letter+' · '+g.score+'/100'}. ${g.coverage}% measurement coverage. ${g.note}`;
    $('grades').append(card);
    const section=el('details');section.append(el('summary',`${g.name} · ${g.letter || 'Insufficient data'}${g.score===null?'':` (${g.score}/100)`}`),el('p',g.note),el('p',g.reason));
    const list=el('ul');
    for(const item of g.items) {
      const deduction=item.status==='unavailable'?'Unmeasured':g.score===null?labels[item.status]:item.pointsLost?`−${item.pointsLost} points`:'Full credit';
      const row=el('li');row.append(el('strong',`${item.title}: ${deduction}`),el('p',`${item.evidence}${item.lostWeight?' '+item.advice:''}`));list.append(row);
    }
    section.append(list);$('grade-breakdown').append(section);
  }
  updatePrompt();
  renderSocial();
  for (const [id,status] of [['issues','issue'],['reviews','review'],['passes','pass'],['observations','info']]) $(''+id).textContent = report.checks.filter(c=>c.status===status).length;
  const attention=report.checks.filter(c=>['issue','review'].includes(c.status)).length;
  $('attention-title').textContent=attention?`${attention} item${attention===1?'':'s'} need${attention===1?'s':''} attention`:'No actionable findings';
  $('attention-description').textContent=attention?'Get an evidence-backed prompt to tackle the next fix.':'Explore the observations and measurement coverage.';
  $('category').replaceChildren(el('option','All categories'));
  $('category').firstChild.value='all';
  for (const group of new Set(report.checks.map(c=>c.group))) { const option = el('option',group);option.value=group;$('category').append(option); }
  $('status').value='actionable';
  $('meta-count').textContent=`(${report.meta.length})`;
  $('meta').replaceChildren();
  for (const m of report.meta) { const row=el('div',undefined,'meta-row');row.append(el('strong',m.name || '(unnamed)'),el('span',m.content));$('meta').append(row); }
  $('headings').replaceChildren();
  for (const h of report.headings) {const row=el('div',`H${h.level} · ${h.text || '(empty)'}`,'outline');row.style.marginLeft=`${(h.level-1)*14}px`;$('headings').append(row);}
  if (!report.headings.length) $('headings').textContent='No headings found.';
  $('schema-count').textContent=`(${report.jsonld.length})`;
  $('jsonld').replaceChildren();
  for (const block of report.jsonld) {const box=el('details');box.append(el('summary',`Block ${block.index} · ${block.valid ? 'Valid JSON' : 'Parse error'}`),el('pre',block.valid ? JSON.stringify(block.data,null,2) : `${block.error}\n\n${block.raw}`));$('jsonld').append(box);}
  if (!report.jsonld.length) $('jsonld').textContent='No JSON-LD found.';
  $('limits').replaceChildren(...report.limitations.map(l=>el('li',l)));
  $('timestamp').textContent=`Snapshot: ${new Date(report.auditedAt).toLocaleString()} · Auto-reaudit on page navigation · Reaudit to refresh interactions.`;
  activateSection(activeSection);
}
async function run(monitorAction = false) {
  clearTimeout(autoAuditTimer);
  if(auditRunning) return;
  auditRunning=true;
  const current=++generation;
  $('rerun').disabled=true;
  $('results').hidden=true;
  $('message').hidden=false;
  $('message').textContent='Inspecting the rendered page…';
  try {
    const [tab] = await activeTabQuery();
    if(current!==generation) return;
    if (tab?.id) {auditedTabId=tab.id;panelWindowId=tab.windowId;}
    if (!tab?.url) throw new Error('Click the frog toolbar icon to allow auditing this site. Automatic reauditing resumes after access is granted.');
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || '')) throw new Error('Open a regular HTTP or HTTPS website, then click SEO/GEO Frog. Chrome internal pages, the Chrome Web Store, PDFs, and other protected pages cannot be audited.');
    auditedTabId=tab.id;panelWindowId=tab.windowId;
    const [result] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:auditPage});
    if (!result?.result) throw new Error('No page data returned. Reload the website and try again.');
    if(current!==generation) return;
    report=result.result;
    try {
      const [runtime]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:collectDiagnostics,args:[monitorAction]});
      if(current!==generation) return;
      const d=runtime?.result;
      if (!d || d.url !== report.url || !Array.isArray(d.checks)) throw new Error('Page changed or diagnostics unavailable. Reaudit.');
      report.diagnostics=d;
      report.checks.push(...d.checks);
    } catch(error) {
      if(current!==generation) return;
      report.checks.push({group:'JavaScript',status:'info',title:'Runtime diagnostics unavailable',evidence:String(error.message || error),advice:'Reload a regular website and retry. SEO checks are still included.'});
    }
    if(current!==generation) return;
    const [latest]=await activeTabQuery();
    if(current!==generation) return;
    if(latest?.id!==tab.id || (latest.url && latest.url!==report.url)) {invalidateReport('The page changed during the audit. Click the frog toolbar icon on the page you want to inspect.');return;}
    report.version=4;
    report.tool={name:'SEO/GEO Frog',version:'4.3.2'};
    report.limitations=report.limitations.filter(l=>!l.includes('field Core Web Vitals'));
    report.limitations.push('Speed metrics reflect one local navigation and available browser buffers, not field Core Web Vitals. Cross-origin restrictions can hide sizes/statuses; zero bytes does not prove zero cost.', 'Runtime errors are captured only after monitoring starts in the top-level page. Earlier console history, console.error calls, caught errors, and cross-origin iframe errors are not captured. Monitoring resets on navigation.', 'No site crawl, HTTP header inspection, robots.txt, sitemap, index verification, or link-destination health checks are performed.');
    render();
    $('message').hidden=true;
    $('results').hidden=false;
  } catch(error) {
    if(current!==generation) return;
    $('page-url').textContent='This page could not be audited';
    $('message').textContent=error.message || String(error);
  } finally { if(current===generation) {auditRunning=false;$('rerun').disabled=false;} }
}
$('rerun').addEventListener('click',()=>run());
$('category').addEventListener('change',renderChecks);
$('status').addEventListener('change',renderChecks);
$('export').addEventListener('click',()=>{
  if (!report) return;
  const blob = new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=el('a');link.href=url;link.download=`seo-geo-frog-${new URL(report.url).hostname}-${report.auditedAt.slice(0,10)}.json`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
run();

$('monitor').addEventListener('click',()=>run(report?.diagnostics?.active ? true : 'start'));
function updatePrompt() {
  if(!report) return;
  const scope=$('prompt-scope').value;
  const count=report.checks.filter(c=>scope==='review'?c.status==='review':scope==='issue'?c.status==='issue':c.status==='issue' || c.status==='review').length;
  $('prompt').value=buildFixPrompt(report,{scope});
  $('prompt-scope-count').textContent=`${count} finding${count===1?'':'s'} included · review items are verified before changes are made.`;
  $('copy-status').textContent='';
  $('copy-prompt').disabled=count===0;
  $('download-prompt').disabled=count===0;
}
async function copyPrompt(text,status) {
  try {
    await navigator.clipboard.writeText(text.value);
    status.textContent='Copied. Paste into Claude or another coding tool with your repository.';
  } catch {
    const details=text.closest('details');if(details) details.open=true;
    text.focus();text.select();
    status.textContent='Clipboard unavailable. The prompt is selected; press Ctrl+C or ⌘C to copy.';
  }
}
$('prompt-scope').addEventListener('change',updatePrompt);
$('copy-prompt').addEventListener('click',()=>copyPrompt($('prompt'),$('copy-status')));
$('download-prompt').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([$('prompt').value],{type:'text/markdown'}));
  const a=el('a');a.href=url;a.download=`seo-geo-frog-${$('prompt-scope').value}-fixes.md`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
});

for(const tab of document.querySelectorAll('.tabbar [role="tab"]')) {
  tab.addEventListener('click',()=>activateSection(tab.dataset.tab));
  tab.addEventListener('keydown',event=>{
    const tabs=[...document.querySelectorAll('.tabbar [role="tab"]')];const index=tabs.indexOf(tab);
    let next;
    if(event.key==='ArrowRight') next=(index+1)%tabs.length;
    if(event.key==='ArrowLeft') next=(index+tabs.length-1)%tabs.length;
    if(event.key==='Home') next=0;
    if(event.key==='End') next=tabs.length-1;
    if(next!==undefined){event.preventDefault();activateSection(tabs[next].dataset.tab,true);}
  });
}
for(const button of document.querySelectorAll('[data-go]')) button.addEventListener('click',()=>activateSection(button.dataset.go,true));
chrome.runtime?.onMessage?.addListener(message=>{if(message.type==='frog-audit-active-tab' && (panelWindowId===null || message.windowId===panelWindowId)) run();});
chrome.tabs.onActivated?.addListener(info=>{if(panelWindowId==null || info.windowId===panelWindowId) {auditedTabId=info.tabId;invalidateReport('Switched tabs · checking page access…');scheduleAudit();}});
chrome.tabs.onUpdated?.addListener((tabId,change,tab)=>{
  if(tabId!==auditedTabId) return;
  if(change.status==='loading' || change.url) {
    invalidateReport('Page changed · waiting to reaudit…');
    // Full navigations wait for completion; History API and hash routes debounce.
    if(change.status!=='loading' && tab?.status!=='loading') scheduleAudit();
  }
  if(change.status==='complete') scheduleAudit();
});

function renderSocial() {
  if(!report) return;
  const platform=socialPlatform;
  if(['google','bing'].includes(platform)) {
    const description=report.meta.find(m=>m.name.toLowerCase()==='description' && m.content.trim())?.content.trim() || '';
    const url=new URL(report.url);
    const card=el('article',undefined,'search-card search-'+platform);
    card.append(el('div',url.hostname,'search-site'),el('div',url.origin+url.pathname,'search-url'),el('strong',report.title || 'Missing page title','search-title'),el('p',description || 'No meta description. The search engine may generate a snippet from page content.','search-description'));
    $('social-card').replaceChildren(card);
    $('social-sources').textContent='Title: <title> · Snippet: '+(description?'meta description':'not provided')+' · URL: current page. Display length varies by device and query.';
    return;
  }
  const data=socialPreview(report,platform);
  const card=el('article',undefined,'social-card social-'+platform+(data.compact?' social-compact':''));
  const media=el('div',undefined,'social-media');
  if(data.imageUrl) {
    const load=el('button','Load image');
    load.type='button';
    load.addEventListener('click',()=>{
      const img=el('img');img.alt='Social preview image';img.referrerPolicy='no-referrer';
      img.addEventListener('error',()=>media.replaceChildren(el('span','Image unavailable · blocked or failed to load')));
      media.replaceChildren(img);img.src=data.imageUrl;
    });
    media.append(load);
  } else media.append(el('span',data.image.value?'Invalid image URL':'No social image tag'));
  const body=el('div',undefined,'social-body');
  body.append(el('span',data.domain,'social-domain'),el('strong',data.title.value || 'Missing social title','social-title'),el('p',data.description.value || 'Missing social description','social-description'));
  card.append(media,body);$('social-card').replaceChildren(card);
  $('social-sources').textContent='Title: '+data.title.source+' · Description: '+data.description.source+' · Image: '+data.image.source+(platform==='x'?' · Card: '+(data.card || 'not declared'):'');
  if(platform==='x' && !['summary','summary_large_image'].includes(data.card)) $('social-sources').textContent+=' · Summary mockup only; this card type is missing or unsupported.';
}
for(const button of document.querySelectorAll('[data-social]')) {
  button.addEventListener('click',()=>{
    socialPlatform=button.dataset.social;
    for(const tab of document.querySelectorAll('[data-social]')) {
      const selected=tab===button;
      tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
    }
    $('social-card').setAttribute('aria-labelledby',button.id);
    renderSocial();
  });
  button.addEventListener('keydown',event=>{
    const tabs=[...document.querySelectorAll('[data-social]')];
    const index=tabs.indexOf(button);
    const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
    if(next!==null){event.preventDefault();tabs[next].click();tabs[next].focus();}
  });
}

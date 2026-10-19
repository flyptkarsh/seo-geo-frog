/* Runs only after a toolbar click. State lasts until navigation or Stop monitoring. */
async function collectDiagnostics(stop = false) {
  const key = '__siteLensDiagnosticsV2';
  let state = window[key];
  if (stop === "start" && state && !state.active) { delete window[key]; state = null; }
  if (!state) {
    state = {startedAt: new Date().toISOString(), errors: [], observers: [], lcp: null, cls: 0, longTasks: [], supported: [], active: true};
    const record = entry => { if (state.errors.length < 100) state.errors.push(entry); };
    state.onError = e => {
      if (e.target && e.target !== window) {
        record({kind: 'Resource load error', message: e.target.tagName || 'resource', source: e.target.src || e.target.href || '', at: new Date().toISOString()});
      } else record({kind:'JavaScript error',message:String(e.message || 'Opaque script error'),source:e.filename || '',line:e.lineno || null,column:e.colno || null,stack:String(e.error?.stack || '').slice(0,4000),at:new Date().toISOString()});
    };
    state.onRejection = e => {
      let message;
      try { message = String(e.reason?.message || e.reason); } catch { message = 'Unreadable rejection reason'; }
      record({kind:'Unhandled promise rejection',message:message.slice(0,4000),stack:String(e.reason?.stack || '').slice(0,4000),at:new Date().toISOString()});
    };
    window.addEventListener('error',state.onError,true);
    window.addEventListener('unhandledrejection',state.onRejection);
    const supported = typeof PerformanceObserver === 'undefined' ? [] : PerformanceObserver.supportedEntryTypes || [];
    for (const type of ['largest-contentful-paint','layout-shift','longtask']) {
      if (!supported.includes(type)) continue;
      try {
        const observer = new PerformanceObserver(list => {
          for (const e of list.getEntries()) {
            if (type === 'largest-contentful-paint') state.lcp = {value:e.startTime,element:e.element?.tagName || null,url:e.url || null};
            if (type === 'layout-shift' && !e.hadRecentInput) state.cls += e.value;
            if (type === 'longtask' && state.longTasks.length < 500) state.longTasks.push({startTime:e.startTime,duration:e.duration});
          }
        });
        observer.observe({type,buffered:true});
        state.observers.push(observer);state.supported.push(type);
      } catch { /* unsupported or restricted entry type remains unavailable */ }
    }
    window[key] = state;
  }
  await new Promise(resolve => setTimeout(resolve,120));
  if (stop === true && state.active) {
    window.removeEventListener('error',state.onError,true);
    window.removeEventListener('unhandledrejection',state.onRejection);
    state.observers.forEach(o=>o.disconnect());state.active=false;
  }
  const nav = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');
  const round = n => Math.round(n * 10) / 10;
  const measured = resources.filter(r=>r.transferSize > 0 || r.decodedBodySize > 0);
  const js = resources.filter(r=>r.initiatorType === 'script');
  const scripts = [...document.scripts];
  const blocking = scripts.filter(s=>s.src && !s.async && !s.defer && !['module','application/ld+json'].includes(s.type) && (!s.type || /javascript|ecmascript/i.test(s.type)));
  const heavy = [...measured].sort((a,b)=>b.decodedBodySize-a.decodedBodySize).slice(0,12).map(r=>({url:r.name,type:r.initiatorType,transferBytes:r.transferSize,decodedBytes:r.decodedBodySize,durationMs:round(r.duration)}));
  const slow = [...resources].filter(r=>r.duration>1000).sort((a,b)=>b.duration-a.duration).slice(0,10).map(r=>({url:r.name,type:r.initiatorType,durationMs:round(r.duration)}));
  const failed = resources.filter(r=>r.responseStatus >= 400).map(r=>({url:r.name,status:r.responseStatus}));
  const images=[...document.images];
  const broken=images.filter(i=>i.complete && i.currentSrc && i.naturalWidth===0).map(i=>i.currentSrc);
  const oversized=images.filter(i=>i.naturalWidth>0 && i.clientWidth>0 && i.naturalWidth>i.clientWidth*(window.devicePixelRatio || 1)*2).map(i=>({url:i.currentSrc,naturalWidth:i.naturalWidth,displayWidth:i.clientWidth})).slice(0,10);
  const checks=[];
  const add=(group,status,title,evidence,advice)=>checks.push({group,status,title,evidence,advice});
  const ttfb=nav && nav.responseStart>0 ? round(nav.responseStart-nav.startTime) : null;
  const fcp=performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint')?.startTime ?? null;
  const load=nav?.loadEventEnd>0 ? round(nav.loadEventEnd-nav.startTime) : null;
  add('Speed',ttfb===null?'info':ttfb>800?'review':'pass','Document TTFB',ttfb===null?'Unavailable':`${ttfb} ms from navigation start to first response byte (includes redirects and connection setup).`,'If consistently slow, inspect redirects, cache hits, server work, and CDN configuration. Repeat under comparable conditions.');
  add('Speed',fcp===null?'info':fcp>1800?'review':'pass','First contentful paint',fcp===null?'Not available in this page timeline.':`${round(fcp)} ms in this navigation.`,'Investigate render-blocking CSS/JS, fonts, and server response time. A single local measurement is not field performance.');
  add('Speed',state.lcp===null?'info':state.lcp.value>2500?'review':'pass','Observed LCP candidate',state.lcp ? `${round(state.lcp.value)} ms; element ${state.lcp.element || 'unavailable'}; ${state.lcp.url || 'text or unavailable URL'}`:'No buffered LCP candidate available. Opening the extension after interaction can limit visibility.','Confirm with a fresh navigation recording. Optimize the actual LCP resource; avoid lazy-loading an above-the-fold hero. This candidate is not a finalized field metric.');
  add('Speed','info','Observed layout movement',state.supported.includes('layout-shift') ? `${state.cls.toFixed(3)} cumulative shift value excluding recent input; simple observed sum, not session-window CLS.`:'Layout-shift observation unavailable.','Reserve image/embed space and stabilize late content. Use DevTools or web-vitals for session-window CLS.');
  const blockingTime=state.longTasks.reduce((sum,t)=>sum+Math.max(0,t.duration-50),0);
  add('JavaScript',!state.supported.includes('longtask')?'info':state.longTasks.length?'review':'info','Main-thread long tasks',state.supported.includes('longtask') ? `${state.longTasks.length} observed tasks >50 ms; ${round(blockingTime)} ms total excess beyond 50 ms. Buffer/cap may omit tasks. This is not Lighthouse TBT.`:'Long-task entries unavailable.','Profile the main thread, split expensive work, defer nonessential code, and inspect third-party execution. Long tasks are not necessarily caused by JavaScript.');
  add('JavaScript',blocking.length?'review':'pass','Potentially parser-blocking scripts',blocking.length ? blocking.slice(0,15).map(s=>s.src).join('\n'):'No external classic scripts lacking async/defer detected.','Check how these scripts are loaded. Add defer where execution order allows; the DOM cannot prove a script blocked parsing or was parser-inserted.');
  const jsBytes=js.reduce((s,r)=>s+r.decodedBodySize,0);
  add('JavaScript',jsBytes>500000?'review':'info','Observed JavaScript payload',`${js.length} script-initiated requests; ${(jsBytes/1024).toFixed(1)} KiB exposed decoded body size. Cross-origin size restrictions and timing-buffer limits can undercount.`,'Use a bundle analyzer and coverage recording to find unused modules, duplicate dependencies, and route-specific code that can be split. Decoded bytes are not wire bytes.');
  add('Speed','info','Resource budget',`${resources.length} recorded requests; ${(measured.reduce((s,r)=>s+r.transferSize,0)/1024).toFixed(1)} KiB exposed transfer size; ${resources.length-measured.length} entries have unavailable/zero size data. Load event: ${load===null?'pending/unavailable':load+' ms'}.`,'Inspect the heaviest and slowest resources below. Zero size can mean cache or restricted timing, not a free resource.');
  add('Speed',slow.length?'review':'pass','Slow recorded resources',slow.length ? slow.map(r=>`${r.durationMs} ms · ${r.type} · ${r.url}`).join('\n'):'No resource taking >1000 ms in the available timing buffer.','Inspect the request waterfall and initiator chain. Slow downloads may be intentional streaming requests; do not delete them based only on duration.');
  add('JavaScript',failed.length?'issue':'info','Exposed HTTP resource errors',failed.length ? failed.map(r=>`${r.status} · ${r.url}`).join('\n'):'No HTTP errors exposed by available Resource Timing entries; this does not prove all requests succeeded.','Reproduce failures in DevTools Network; verify asset paths, deployments, CORS, and response status.');
  add('Speed',broken.length?'issue':'pass','Broken loaded images',broken.length ? broken.slice(0,15).join('\n'):'No completed images with a source and zero natural width detected.','Fix the source or response format and confirm the image loads.');
  add('Speed',oversized.length?'review':'pass','Oversized image candidates',oversized.length ? oversized.map(i=>`${i.naturalWidth}px source / ${i.displayWidth}px displayed · ${i.url}`).join('\n'):'No obvious candidates at the current viewport.','Use responsive srcset/sizes and efficient formats; account for device pixel ratio and zoom before changing assets.');
  add('JavaScript',state.errors.length?'issue':'info','Captured runtime and load errors',state.errors.length ? state.errors.map(e=>`${e.kind}: ${e.message}\n${e.source || ''}${e.line?':'+e.line+':'+e.column:''}\n${e.stack || ''}`).join('\n\n'):`No errors captured since ${state.startedAt}. Earlier console history is unavailable.`,'Interact with the page, then click Reaudit to collect new errors. Reproduce each error and trace the source with source maps. No console.log/error interception is performed.');
  return {coverage:{longTasks:state.supported.includes('longtask'),jsSizeEntries:js.filter(r=>r.decodedBodySize>0 || r.transferSize>0).length},url:location.href,startedAt:state.startedAt,active:state.active,errors:state.errors.map(e=>({...e})),metrics:{ttfb,fcp:fcp===null?null:round(fcp),lcp:state.lcp?round(state.lcp.value):null,load,jsBytes,resourceCount:resources.length,longTasks:state.longTasks.length},heavy,slow,checks};
}
if (typeof module !== 'undefined') module.exports={collectDiagnostics};

/* Product rubric v1: local diagnostic grades, not search-engine or Lighthouse scores. */
function gradeReport(report) {
  const find=title=>report.checks.find(c=>c.title===title);
  const rule=(title,weight)=>({title,weight});
  const definitions=[
    {name:'SEO',key:'seo',rules:[rule('Page title',3),rule('Meta description',2),rule('Canonical URL',2),rule('Robots meta directives',3),rule('HTTPS',2),rule('Primary heading',2),rule('Document language',1),rule('Viewport',1),rule('Heading hierarchy',1),rule('Image alternatives',1),rule('Link labels',1)],note:'On-page foundations only; intentional crawl restrictions still need review.'},
    {name:'Structured data',key:'schema',rules:[rule('JSON-LD syntax',4),rule('Typed schema entities',2),rule('JSON-LD context',2)],note:'Markup hygiene only. Missing optional markup lowers this diagnostic grade, not a predicted ranking.'},
    {name:'GEO signals',key:'geo',rules:[rule('Readable page text',3),rule('Primary heading',2),rule('Heading hierarchy',1),rule('Robots meta directives',2)],note:'Readability and discoverability proxies; not a prediction of AI inclusion or citations.'},
    {name:'AEO',key:'aeo',rules:[rule('Answer snippet restrictions',2),rule('Primary heading',1),rule('Heading hierarchy',1),rule('Answers after question headings',2),rule('Q&A markup completeness',2)],note:'Local answer-readiness heuristics only; optional questions and Q&A markup are excluded when absent. Not an AI citation or ranking score.'},
    {name:'Speed',key:'speed',rules:[rule('Document TTFB',3),rule('First contentful paint',3),rule('Observed LCP candidate',4),rule('Slow recorded resources',1),rule('Broken loaded images',1),rule('Oversized image candidates',1)],note:'One local navigation; not a Lighthouse score or field Core Web Vitals.'},
    {name:'JavaScript',key:'javascript',rules:[rule('Captured runtime and load errors',4),rule('Main-thread long tasks',3),rule('Potentially parser-blocking scripts',1),rule('Observed JavaScript payload',2),rule('Exposed HTTP resource errors',2)],note:'Provisional: only errors after monitoring began are visible. A clean observation does not prove bug-free code.'}
  ];
  // Attribution/freshness are scored only for detected article content.
  if ((report.types || []).some(t=>/(^|\/)(Article|NewsArticle|BlogPosting|TechArticle)$/.test(t))) {
    definitions[2].rules.push(rule('Author attribution signal',2),rule('Dates and freshness signals',1));
  }
  for(const c of report.checks.filter(c=>/^Article details \d+$/.test(c.title))) definitions[1].rules.push(rule(c.title,1));
  const d=report.diagnostics;
  const categories=definitions.map(def=>{
    const items=def.rules.map(r=>{
      const c=find(r.title);
      let status=c?.status;
      // Explicitly distinguish observed clean windows from missing measurements.
      if (status==='info' && d) {
        if(r.title==='Captured runtime and load errors' && Array.isArray(d.errors)) status=d.errors.length?'issue':'pass';
        if(r.title==='Main-thread long tasks' && d.coverage?.longTasks) status=d.metrics.longTasks?'review':'pass';
        if(r.title==='Observed JavaScript payload' && d.coverage?.jsSizeEntries>0) status=d.metrics.jsBytes>500000?'review':'pass';
      }
      const measured=['pass','review','issue'].includes(status);
      const lost=measured?r.weight*(status==='pass'?0:status==='review'?0.5:1):0;
      return {title:r.title,weight:r.weight,status:measured?status:'unavailable',lostWeight:lost,evidence:c?.evidence || 'Not available in this snapshot.',advice:c?.advice || ''};
    });
    const possible=items.reduce((s,i)=>s+i.weight,0);
    const observed=items.filter(i=>i.status!=='unavailable').reduce((s,i)=>s+i.weight,0);
    const timingCount=items.filter(i=>['Document TTFB','First contentful paint','Observed LCP candidate'].includes(i.title) && i.status!=='unavailable').length;
    const eligible=observed/possible>=0.5 && (def.key!=='speed' || timingCount>=2);
    const lost=items.reduce((s,i)=>s+i.lostWeight,0);
    const score=eligible?Math.round(100*(observed-lost)/observed):null;
    const letter=score===null?null:score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F';
    return {key:def.key,name:def.name,letter,score,coverage:Math.round(100*observed/possible),note:def.note,reason:eligible?'Weighted observed checks.':'Insufficient data: need at least 50% weighted coverage'+(def.key==='speed'?' and two of TTFB, FCP, and LCP.':'.'),items:items.map(i=>({...i,pointsLost:eligible?Math.round(i.lostWeight/observed*1000)/10:null}))};
  });
  const overall=overallGrade(categories);
  return {overall,rubricVersion:2,scope:'Current page only',method:'Pass earns full weight; review earns half; issue earns zero. Unavailable/informational checks are excluded. At least 50% weighted coverage is required. Speed also requires two primary timings. A 90–100, B 80–89, C 70–79, D 60–69, F below 60. Scores are rounded before assigning a letter. JavaScript clean-window observations are provisional.',categories};
}
function overallGrade(categories) {
  const measured=categories.filter(c=>Number.isFinite(c.score));
  const score=measured.length>=3?Math.round(measured.reduce((sum,c)=>sum+c.score,0)/measured.length):null;
  return {score,letter:score===null?null:score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F',measured:measured.length,total:categories.length,
    method:'Equal average of available category scores, rounded before grading. Requires at least three graded categories. Unavailable categories are excluded; partial coverage is provisional. A local diagnostic, not a search-engine score.'};
}
if(typeof module!=='undefined') module.exports={gradeReport,overallGrade};

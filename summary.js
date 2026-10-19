// Finding letters describe observed status; category scores use their separate weighted rubric.
function gradeFinding(check) {
  const grades={pass:{letter:'A',meaning:'Passed this check'},review:{letter:'C',meaning:'Needs contextual review'},issue:{letter:'F',meaning:'Issue detected'},info:{letter:null,meaning:'Observation only; not graded'}};
  return {...(grades[check.status] || {letter:null,meaning:'Insufficient data'})};
}
function buildImprovementSummary(report, limit=4) {
  const guidance={
    'Captured runtime and load errors':[100,'Reproduce the captured errors and repair the failing code or resource.'],
    'Exposed HTTP resource errors':[95,'Check the failed requests and correct their URLs or server responses.'],
    'JSON-LD syntax':[90,'Validate the structured data and fix any JSON parse errors.'],
    'Robots meta directives':[88,'Confirm that indexing and snippet restrictions are intentional.'],
    'Page title':[85,'Use one nonempty, descriptive page title.'],
    'Broken loaded images':[85,'Repair the image sources that failed to load.'],
    'Observed LCP candidate':[80,'Investigate the main content’s paint time with a fresh load recording.'],
    'Document TTFB':[78,'Check server response time, redirects, and caching.'],
    'First contentful paint':[76,'Check whether styles, scripts, or fonts delay the first visible content.'],
    'Main-thread long tasks':[74,'Profile the long tasks and split or defer expensive work where possible.'],
    'Potentially parser-blocking scripts':[72,'Review script loading; defer nonessential code where execution order allows.'],
    'Observed JavaScript payload':[70,'Inspect bundle size and remove or split code the page does not need.'],
    'Canonical URL':[68,'Review the canonical URL and confirm the intended primary page.'],
    'Meta description':[65,'Provide one useful, accurate summary for the page.'],
    'Primary heading':[62,'Make the page’s main topic clear in its primary heading.'],
    'Image alternatives':[60,'Add useful alt text to meaningful images; mark decorative images appropriately.'],
    'Slow recorded resources':[59,'Inspect slow requests to find downloads that delay useful content.'],
    'Oversized image candidates':[58,'Check responsive image sizing against the current display dimensions.'],
    'Heading hierarchy':[55,'Organize headings into a clear, logical outline.'],
    'Readable page text':[48,'Check that the visible content adequately answers the page’s intended question.'],
    'Author attribution signal':[35,'Add accurate author attribution where it helps readers assess the content.'],
    'Dates and freshness signals':[30,'Add visible, accurate dates where freshness matters.']
  };
  const actionable=report.checks.filter(c=>c.status==='issue' || c.status==='review');
  const ranked=actionable.map((c,index)=>({c,index,priority:(c.status==='issue'?1000:0)+(guidance[c.title]?.[0] || (c.group==='Social'?10:40))})).sort((a,b)=>b.priority-a.priority || a.index-b.index);
  const items=ranked.slice(0,limit).map(({c})=>({title:c.title,group:c.group,status:c.status,grade:gradeFinding(c),action:c.title==='JSON-LD syntax' && c.status==='review'?'Consider relevant structured data if it accurately describes the page.':guidance[c.title]?.[1] || c.advice, evidence:c.evidence}));
  return {total:actionable.length,items};
}
if(typeof module!=='undefined') module.exports={buildImprovementSummary,gradeFinding};

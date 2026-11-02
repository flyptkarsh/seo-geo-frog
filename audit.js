/* Self-contained: executed in the isolated world of the current top-level page. */
function auditPage() {

  function collectPageInventory() {
    const attributes = node => Object.fromEntries([...node.attributes].map(a => [a.name, a.value]));
    const tags = [...document.querySelectorAll('meta')].map(node => ({attributes: attributes(node), html: node.outerHTML}));
    const scripts = [...document.scripts].map((node, index) => ({index: index + 1, src: node.getAttribute('src') ? node.src : '', type: node.type || 'classic', async: node.async, defer: node.defer, attributes: attributes(node), characters: node.textContent.length}));
    const rules = [
      ['jQuery', /(?:^|[/@])jquery(?:[.@/-]|$)/i], ['React', /(?:^|[/@])react(?:-dom)?(?:[.@/-]|$)/i],
      ['Vue', /(?:^|[/@])vue(?:[.@/-]|$)/i], ['Angular', /(?:^|[/@])(?:angular|@angular)(?:[.@/-]|$)/i],
      ['Next.js', /\/_next\//i], ['Nuxt', /\/_nuxt\//i], ['Svelte', /(?:^|[/@])svelte(?:[.@/-]|$)/i],
      ['Alpine.js', /(?:^|[/@])alpinejs(?:[.@/-]|$)/i], ['Bootstrap', /(?:^|[/@])bootstrap(?:[.@/-]|$)/i],
      ['Lodash', /(?:^|[/@])lodash(?:[.@/-]|$)/i], ['D3', /(?:^|[/@])d3(?:[.@/-]|$)/i],
      ['Three.js', /(?:^|[/@])three(?:[.@/-]|$)/i], ['GSAP', /(?:^|[/@])gsap(?:[.@/-]|$)/i],
      ['HTMX', /(?:^|[/@])htmx(?:[.@/-]|$)/i], ['Chart.js', /(?:^|[/@])chart(?:\.js|js)(?:[.@/-]|$)/i]
    ];
    const libraries = rules.flatMap(([name, pattern]) => {
      const evidence = scripts.filter(s => {try {const u = new URL(s.src); return s.src && pattern.test(u.hostname + u.pathname);} catch {return false;}}).map(s => s.src);
      return evidence.length ? [{name, evidence, signal: 'Script URL match'}] : [];
    });
    for (const [name, selector] of [['Next.js', 'script#__NEXT_DATA__'], ['Nuxt', '#__nuxt'], ['Angular', '[ng-version]']]) {
      if (document.querySelector(selector)) {
        const match = libraries.find(l => l.name === name);
        if (match) match.evidence.push(selector); else libraries.push({name, evidence: [selector], signal: 'DOM marker'});
      }
    }
    return {tags, scripts, libraries};
  }
  const all = (s) => [...document.querySelectorAll(s)];
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const meta = all('meta').map(e => ({name: e.getAttribute('name') || e.getAttribute('property') || e.getAttribute('http-equiv') || (e.hasAttribute('charset') ? 'charset' : ''), content: e.getAttribute('content') || e.getAttribute('charset') || ''}));
  const values = name => meta.filter(m => m.name.toLowerCase() === name).map(m => m.content);
  const checks = [];
  const add = (group, status, title, evidence, advice) => checks.push({group, status, title, evidence, advice});
  const presence = (group, title, value, advice) => add(group, value ? 'pass' : 'review', title, value || 'Not found in the rendered document.', advice);
  const titles = all('title');
  const title = clean(document.title);
  add('Metadata', titles.length === 1 && title ? 'pass' : 'issue', 'Page title', `${titles.length} title element(s); ${title.length} characters: ${title || '(empty)'}`, 'Use one descriptive, unique title.');
  if (title) add('Metadata', title.length < 20 || title.length > 65 ? 'review' : 'pass', 'Title length heuristic', `${title.length} characters. Search snippets vary by device and pixel width.`, 'Review whether the title communicates the topic concisely; these are guidelines, not ranking thresholds.');
  const descriptions = values('description');
  add('Metadata', descriptions.length === 1 && clean(descriptions[0]) ? 'pass' : 'review', 'Meta description', descriptions.join(' | ') || 'Missing', 'Write one useful page summary. Search engines may choose a different snippet.');
  if (descriptions[0]) add('Metadata', descriptions[0].length < 70 || descriptions[0].length > 170 ? 'review' : 'pass', 'Description length heuristic', `${descriptions[0].length} characters`, 'Check for a concise, informative summary; length alone does not determine quality.');
  const canonicals = all('link[rel~="canonical"]');
  let canonical = canonicals[0]?.href || '';
  let canonicalValid = false;
  try { canonicalValid = /^https?:$/.test(new URL(canonical).protocol); } catch {}
  add('Crawl signals', canonicals.length === 1 && canonicalValid ? 'pass' : 'review', 'Canonical URL', canonicals.map(e => e.href).join(' | ') || 'Missing', 'Use one valid canonical when appropriate. This audit cannot verify the destination or Google-selected canonical.');
  const robots = meta.filter(m => /^(robots|googlebot|bingbot|gptbot|chatgpt-user|oai-searchbot)$/i.test(m.name));
  const restricted = robots.some(m => /\b(noindex|none|nosnippet)\b/i.test(m.content));
  add('Crawl signals', restricted ? 'review' : 'pass', 'Robots meta directives', robots.map(m => `${m.name}: ${m.content}`).join('\n') || 'No supported robots meta directives found.', 'Confirm restrictions are intentional. robots.txt policy, HTTP X-Robots-Tag, and crawler-specific interpretation are not evaluated by this DOM check.');
  presence('Metadata', 'Document language', document.documentElement.lang, 'Set an appropriate lang attribute for accessibility and language context.');
  presence('Metadata', 'Viewport', values('viewport').join(' | '), 'Use a mobile-friendly viewport and verify the page on mobile.');
  for (const name of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) presence('Social', name, values(name).join(' | '), 'Provide relevant social preview metadata; this is not a ranking requirement.');
  const dupes = [...new Set(meta.map(m => m.name.toLowerCase()).filter(Boolean))].filter(n => values(n).length > 1 && !['og:image','og:video','og:audio'].includes(n));
  add('Metadata', dupes.length ? 'review' : 'pass', 'Repeated meta keys', dupes.join(', ') || 'No repeated singleton-style keys found.', 'Review repeated keys for conflicts; some metadata legitimately supports multiple values.');
  const headings = all('h1,h2,h3,h4,h5,h6').map(e => ({level: Number(e.tagName[1]), text: clean(e.innerText || e.textContent)}));
  const h1s = headings.filter(h => h.level === 1);
  add('Content', h1s.length === 1 && h1s[0].text ? 'pass' : 'review', 'Primary heading', `${h1s.length} H1 heading(s): ${h1s.map(h=>h.text).join(' | ')}`, 'Prefer a clear primary topic heading. Multiple H1s are not automatically an SEO error.');
  const skipped = headings.filter((h,i) => i && h.level > headings[i-1].level+1);
  add('Content', skipped.length ? 'review' : 'pass', 'Heading hierarchy', skipped.length ? skipped.map(h=>`H${h.level}: ${h.text}`).slice(0,10).join('\n') : 'No skipped heading levels detected.', 'Use headings to organize content logically.');
  const images = all('img');
  const missingAlt = images.filter(e => !e.hasAttribute('alt'));
  add('Content', missingAlt.length ? 'review' : 'pass', 'Image alternatives', `${missingAlt.length} of ${images.length} images lack alt attributes.\n${missingAlt.slice(0,8).map(e=>e.currentSrc || e.src).join('\n')}`, 'Add descriptive alt text to meaningful images; use alt="" for decorative images. Empty alt is not treated as missing.');
  const links = all('a[href]');
  const emptyLinks = links.filter(e => !clean(e.innerText || e.textContent) && !e.getAttribute('aria-label') && !e.getAttribute('title') && !e.querySelector('img[alt]:not([alt=""])'));
  add('Content', emptyLinks.length ? 'review' : 'pass', 'Link labels', `${emptyLinks.length} of ${links.length} links have no obvious accessible label.`, 'Use descriptive link text. This is a lightweight check, not a full accessible-name computation.');
  const main = document.querySelector('main,article') || document.body;
  const text = clean(main?.innerText);
  const words = text ? text.split(/\s+/).length : 0;
  add('Content', words < 100 ? 'review' : 'pass', 'Readable page text', `Approximately ${words} whitespace-separated words in ${main?.tagName.toLowerCase() || 'body'}.`, 'Ensure the page answers its intended question. Word count is a diagnostic, not a ranking target; segmentation varies by language.');
  const jsonld = all('script[type]').filter(e => e.type.toLowerCase().split(';')[0].trim() === 'application/ld+json').map((e,i) => {
    const raw = e.textContent;
    try { return {index:i+1, valid:true, data:JSON.parse(raw), raw}; }
    catch(error) { return {index:i+1, valid:false, error:error.message, raw}; }
  });
  const nodes = [];
  function walk(value, depth=0) {
    if (!value || typeof value !== 'object' || depth > 80) return;
    if (Array.isArray(value)) { value.forEach(v=>walk(v,depth+1)); return; }
    if (value['@type']) nodes.push(value);
    Object.values(value).forEach(v=>walk(v,depth+1));
  }
  jsonld.filter(b=>b.valid).forEach(b=>walk(b.data));
  const types = [...new Set(nodes.flatMap(n=>[n['@type']].flat()).map(String))];
  add('Structured data', !jsonld.length ? 'review' : jsonld.some(b=>!b.valid) ? 'issue' : 'pass', 'JSON-LD syntax', jsonld.length ? jsonld.map(b=>`Block ${b.index}: ${b.valid ? 'valid JSON' : b.error}`).join('\n') : 'No JSON-LD blocks found.', 'Fix JSON parse errors. Valid JSON is not schema validation or confirmation of rich-result eligibility.');
  presence('Structured data', 'Typed schema entities', types.join(', '), 'Use relevant schema.org types where they accurately describe visible content. Schema is not required for AI inclusion.');
  const noContext = jsonld.filter(b=> b.valid && !(Array.isArray(b.data) ? b.data.length > 0 && b.data.every(n=>n && n['@context']) : b.data && b.data['@context']));
  if (jsonld.some(b=>b.valid)) add('Structured data', noContext.length ? 'review' : 'pass', 'JSON-LD context', noContext.length ? `Review @context in block(s): ${noContext.map(b=>b.index).join(', ')}` : 'Top-level context found.', 'A schema.org context normally belongs at the document or graph root. Contexts are not remotely resolved by this audit.');
  const articleNodes = nodes.filter(n => [n['@type']].flat().some(t => /(^|\/)(Article|NewsArticle|BlogPosting|TechArticle)$/.test(String(t))));
  articleNodes.forEach((n,i) => {
    const missing = ['headline','author','datePublished'].filter(k=>!n[k]);
    add('Structured data', missing.length ? 'review' : 'pass', `Article details ${i+1}`, missing.length ? `Not found: ${missing.join(', ')}` : 'Headline, author, and publication date found.', 'Review type-specific requirements in Google Rich Results Test; verify facts against visible content.');
  });
  presence('GEO signals', 'Author attribution signal', values('author').join(', ') || (nodes.some(n=>n.author) ? 'Author property in structured data' : ''), 'For content that benefits from attribution, show who created it and their relevant expertise. Presence does not establish trust.');
  presence('GEO signals', 'Dates and freshness signals', all('time[datetime]').map(e=>e.dateTime).join(', ') || (nodes.some(n=>n.datePublished || n.dateModified) ? 'Dates in structured data' : ''), 'Use accurate visible dates where relevant. Freshness is topic-dependent.');
  const external = links.filter(e => {try {return /^https?:$/.test(new URL(e.href).protocol) && new URL(e.href).hostname !== location.hostname;}catch{return false;}});
  add('GEO signals', 'info', 'References and outbound links', `${external.length} external HTTP(S) links found. Their credibility and relevance were not assessed.`, 'Support factual claims with relevant primary sources where useful. Link count is not a quality score.');
  add('GEO signals', 'info', 'Content structure', `${all('main').length} main region(s), ${all('article').length} article(s), ${all('ul,ol').length} lists, ${all('table').length} tables.`, 'Make information easy to understand and quote. Semantic elements do not guarantee AI citations.');
  // AEO checks inspect local signals, never predict answer-engine selection.
  const readable = e => {
    if (!e || e.closest('script,style,template,[hidden],[aria-hidden="true"]')) return '';
    for (let parent=e; parent; parent=parent.parentElement) {
      const style=getComputedStyle(parent);
      if (style.display==='none' || style.visibility==='hidden') return '';
    }
    return clean(e.innerText ?? e.textContent);
  };
  // Lightweight DOM semantics checks; this is not an accessibility conformance audit.
  const exposed=e=>{
    if(e.closest('[hidden],[aria-hidden="true"],[inert],template')) return false;
    for(let node=e;node;node=node.parentElement) {
      const style=getComputedStyle(node);
      if(style.display==='none' || style.visibility==='hidden' || style.visibility==='collapse') return false;
    }
    return true;
  };
  const mains=all('main:not([role]),[role="main"],main[role="main"]').filter(exposed);
  add('Content',mains.length===1?'pass':'review','Semantic main landmark',
    `${mains.length} exposed main landmark(s) detected. Hidden, inert, and aria-hidden regions are excluded; complex ARIA role fallback and shadow DOM are not evaluated.`,
    'Identify the primary page content with one exposed main element, or a valid role="main" equivalent. Keep repeated navigation outside it. Hide inactive alternative layouts. Review nested documents and dialogs before changing landmarks; article and section are not substitutes for the main landmark.');
  const navigation=all('nav:not([role]),[role="navigation"]').filter(exposed);
  const regionName=node=>{
    const ids=clean(node.getAttribute('aria-labelledby')).split(' ').filter(Boolean);
    const labelled=ids.map(id=>clean(document.getElementById(id)?.textContent)).filter(Boolean).join(' ');
    return labelled || clean(node.getAttribute('aria-label'));
  };
  const unnamedNav=navigation.filter(node=>!regionName(node));
  add('Content',navigation.length>1 && unnamedNav.length?'review':navigation.length?'pass':'info','Semantic navigation labels',
    `${navigation.length} exposed navigation landmark(s); ${unnamedNav.length} without a detected aria-label or resolved aria-labelledby text. Label uniqueness and equivalent navigation content need manual review.`,
    'Use nav for major navigation blocks, not every link group. When multiple navigation landmarks exist, label their purpose, such as Primary or Footer. Identical navigation can share a label; different navigation should have distinct names. A single navigation landmark does not require an explicit label. Do not add navigation where the page does not need it.');
  const customClicks=all('div[onclick],span[onclick]').filter(exposed);
  add('Content',customClicks.length?'review':'info','Native interactive elements',
    `${customClicks.length} exposed div/span element(s) with inline onclick handlers. Delegated event listeners, custom elements, keyboard behavior, and accessible names are not fully inspected.`,
    'Check what each control does before editing. Prefer button for actions and a with href for navigation; preserve styling, focus, keyboard behavior, and form semantics. Custom controls can be valid when their roles, names, states, and keyboard support are implemented correctly. Do not mechanically replace layout containers or treat this heuristic as proof of a WCAG failure.');
  const semanticTags=['header','nav','main','article','section','aside','footer','search','figure','figcaption','time','dl','ul','ol','table'];
  add('Content','info','Semantic HTML inventory',
    semanticTags.map(tag=>`${tag}: ${all(tag).filter(exposed).length}`).join(' · '),
    'Use elements for their meaning: article for self-contained content, section for a thematic group, aside for complementary content, lists for related items, and tables for tabular data. Header and footer inside sections are not necessarily page landmarks. Generic div/span containers remain appropriate for layout. Presence or tag count does not prove correct semantics, accessibility, or improved search rankings. Inspect the accessibility tree and test keyboard and assistive-technology navigation.');
  const questionHeadings = [...(main?.querySelectorAll('h1,h2,h3,h4,h5,h6') || [])].filter(e=>/[?？]$/.test(readable(e)));
  const unanswered = questionHeadings.filter(heading=>{
    // Walk in document order so wrapped answer paragraphs are supported; stop at the next heading.
    const walker=document.createTreeWalker(main,NodeFilter.SHOW_ELEMENT);
    walker.currentNode=heading;
    let next;
    while ((next=walker.nextNode())) {
      if (/^H[1-6]$/.test(next.tagName)) break;
      if (next.matches('p,li,dd,td,blockquote') && readable(next)) return false;
    }
    return true;
  });
  add('AEO signals', questionHeadings.length ? unanswered.length ? 'review' : 'pass' : 'info', 'Answers after question headings',
    questionHeadings.length ? `${unanswered.length} of ${questionHeadings.length} question headings have no detected answer paragraph, list item, definition, table cell, or quote before the next heading.\n${unanswered.slice(0,8).map(readable).join('\n')}` : 'No headings ending in a question mark found. Question headings are optional; other languages and layouts may not be recognized.',
    'Where a heading asks a question, follow it with a direct, useful answer, then supporting detail. Verify relevance manually: text presence does not prove it answers the question. Do not add artificial FAQs to pages that do not need them.');
  const snippetMeta=meta.filter(m=>/^(robots|googlebot)$/i.test(m.name) && /(?:\b(?:noindex|none|nosnippet)\b|\bmax-snippet\s*:\s*0(?:\s|,|;|$))/i.test(m.content));
  const excluded=[...(main?.querySelectorAll('[data-nosnippet]') || [])];
  if(main?.hasAttribute('data-nosnippet')) excluded.push(main);
  const unsupportedExclusions=excluded.filter(e=>!e.matches('span,div,section'));
  add('AEO signals',snippetMeta.length || excluded.length ? 'review' : 'pass','Answer snippet restrictions',
    `${snippetMeta.map(m=>`${m.name}: ${m.content}`).join(' | ') || 'No restricting Google/general robots meta found.'} ${excluded.length} data-nosnippet region(s) in main content; ${unsupportedExclusions.length} on unsupported elements (Google supports span, div, and section). HTTP headers, robots.txt, and Search Console controls are not checked.`,
    'Confirm the publisher wants this content indexed or excerpted before changing controls. Keep intentional restrictions. If data-nosnippet is needed, use span, div, or section; its value is ignored, including false. Check HTTP X-Robots-Tag, robots.txt, CDN access, and Search Console separately. These Google controls do not establish access or inclusion for other answer engines.');
  const typed=(node,type)=>node && typeof node==='object' && [node['@type']].flat().some(t=>new RegExp('(^|/)'+type+'$').test(String(t)));
  const qaPages=nodes.filter(n=>typed(n,'FAQPage') || typed(n,'QAPage'));
  const qaProblems=[];
  const qaNotes=[];
  const hasText=v=>typeof v==='string' && clean(v);
  const reference=v=>v && typeof v==='object' && v['@id'] && !v['@type'];
  qaPages.forEach((page,i)=>{
    const label=`Q&A entity ${i+1}`;
    const isQA=typed(page,'QAPage');
    const questions=[page.mainEntity].flat().filter(Boolean);
    if(!questions.length) qaProblems.push(`${label}: missing mainEntity.`);
    if(isQA && questions.length>1) qaProblems.push(`${label}: QAPage should focus on one question, not an FAQ list.`);
    questions.forEach(q=>{
      if(reference(q)) {qaNotes.push(`${label}: Question reference needs manual resolution.`);return;}
      if(!typed(q,'Question') || !hasText(q.name)) qaProblems.push(`${label}: missing Question type or question name.`);
      const answers=(isQA ? [q.acceptedAnswer,q.suggestedAnswer] : [q.acceptedAnswer]).flat().filter(Boolean);
      if(isQA && q.answerCount===0 && !answers.length) {
        qaNotes.push(`${label}: unanswered question (answerCount: 0); do not invent an answer. Not eligible for a Google Q&A rich result.`);
        return;
      }
      if(isQA && (!Number.isInteger(q.answerCount) || q.answerCount<0)) qaProblems.push(`${label}: verify a nonnegative integer answerCount against the actual total answers.`);
      if(!answers.length) qaProblems.push(`${label}: missing ${isQA?'acceptedAnswer or suggestedAnswer':'acceptedAnswer'} text.`);
      for(const answer of answers) {
        if(reference(answer)) qaNotes.push(`${label}: Answer reference needs manual resolution.`);
        else if(!typed(answer,'Answer') || !hasText(answer.text)) qaProblems.push(`${label}: incomplete Answer type or text.`);
      }
    });
  });
  add('AEO signals',qaPages.length ? qaProblems.length ? 'review' : qaNotes.length ? 'info' : 'pass' : 'info','Q&A markup completeness',
    qaPages.length ? [...qaProblems,...qaNotes].join('\n') || `${qaPages.length} Q&A entities contain named questions and answer text. This is a basic shape check, not full validation or confirmation that content matches the page.` : 'No FAQPage or QAPage markup found. These are optional and are not required for AEO.',
    'Only repair markup that fits the actual page and matches reader-accessible content, including answers in expandable sections. FAQPage describes publisher-authored FAQs; Google has retired FAQ rich results. For Google QAPage, use one question where users can submit answers, subject to its documented exceptions; verify answerCount and required properties. An unanswered question may truthfully use answerCount: 0. Resolve references and validate with Schema.org and the current Google type guide where applicable. Never fabricate answers, authors, or eligibility; missing optional markup is not a fix request.');
  add('AEO signals','info','AEO writing tips',
    `${questionHeadings.length} question headings; ${main?.querySelectorAll('dl').length || 0} definition lists. Structure alone does not establish answer quality.`,
    'Answer the reader’s main question early. Define unfamiliar terms on first use. Use numbered steps for procedures and tables for meaningful comparisons. Support factual claims with primary sources and show relevant authorship. Keep dates accurate where freshness matters. These are editorial suggestions, not ranking requirements: use them only when they help the reader. No fixed answer length, keyword density, question-heading format, FAQ section, or special AI schema is required. Do not mass-produce repetitive answers or change dates without substantive updates; manually verify accuracy and usefulness.');
  add('Crawl signals', location.protocol === 'https:' ? 'pass' : 'review', 'HTTPS', location.protocol, 'Serve public pages over HTTPS.');
  const hreflang = all('link[rel~="alternate"][hreflang]').map(e=>({language:e.hreflang,url:e.href}));
  add('Metadata','info','Language alternatives', hreflang.length ? hreflang.map(e=>`${e.language}: ${e.url}`).join('\n') : 'No hreflang links found (optional for single-language pages).', 'For localized sites, verify valid language codes and reciprocal links separately.');
  return {inventory: collectPageInventory(), version:1, url:location.href, title, auditedAt:new Date().toISOString(), checks, meta, headings, jsonld, types, canonical, stats:{words, images:images.length, links:links.length, externalLinks:external.length}, limitations:['Rendered top-level DOM only; page scripts may add or change content after this snapshot.','DOM-only audit: public site-file retrieval is reported separately by the panel. No full site crawl, robots policy evaluation, link destination checks, field Core Web Vitals, or search index verification.','JSON-LD is parsed locally; schema.org vocabulary, rich-result requirements, and visible-content consistency need separate validation.','AEO and GEO observations are heuristics, not predictions of rankings, citations, or AI inclusion. No special AI schema or llms.txt is required by this audit.']};
}
if (typeof module !== 'undefined') module.exports = {auditPage};

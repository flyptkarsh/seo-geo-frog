/* Self-contained: executed in the isolated world of the current top-level page. */
function auditPage() {
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
  add('Crawl signals', restricted ? 'review' : 'pass', 'Robots meta directives', robots.map(m => `${m.name}: ${m.content}`).join('\n') || 'No supported robots meta directives found.', 'Confirm restrictions are intentional. robots.txt, HTTP X-Robots-Tag, and crawler-specific interpretation are not checked.');
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
  add('AEO signals',snippetMeta.length || excluded.length ? 'review' : 'pass','Answer snippet restrictions',
    `${snippetMeta.map(m=>`${m.name}: ${m.content}`).join(' | ') || 'No restricting Google/general robots meta found.'} ${excluded.length} data-nosnippet region(s) in main content. HTTP headers and robots.txt are not checked.`,
    'Review whether restrictions intentionally limit indexing or snippet use. Preserve privacy and publishing choices. Passing this local check does not establish crawler access or AI visibility.');
  const typed=(node,type)=>node && typeof node==='object' && [node['@type']].flat().some(t=>new RegExp('(^|/)'+type+'$').test(String(t)));
  const qaPages=nodes.filter(n=>typed(n,'FAQPage') || typed(n,'QAPage'));
  const qaProblems=[];
  qaPages.forEach((page,i)=>{
    const questions=[page.mainEntity].flat().filter(Boolean);
    if(!questions.length) qaProblems.push(`Q&A entity ${i+1}: missing mainEntity.`);
    questions.forEach(q=>{
      const answers=[q.acceptedAnswer,q.suggestedAnswer].flat().filter(Boolean);
      const hasText=v=>typeof v==='string' && clean(v);
      if(!typed(q,'Question') || !hasText(q.name) || !answers.some(a=>typed(a,'Answer') && hasText(a.text))) qaProblems.push(`Q&A entity ${i+1}: incomplete Question name or Answer text (references are not resolved).`);
    });
  });
  add('AEO signals',qaPages.length ? qaProblems.length ? 'review' : 'pass' : 'info','Q&A markup completeness',
    qaPages.length ? qaProblems.join('\n') || `${qaPages.length} Q&A entities contain named questions and answer text. Visible-content accuracy still needs manual review.` : 'No FAQPage or QAPage markup found. These are optional and are not required for AEO.',
    'If Q&A markup is appropriate, use truthful Question and Answer entities that match content readers can access. Check references and type-specific rules separately. Never invent questions, answers, authors, or claim rich-result eligibility.');
  add('AEO signals','info','AEO writing tips',
    `${questionHeadings.length} question headings; ${main?.querySelectorAll('dl').length || 0} definition lists. Structure alone does not establish answer quality.`,
    'Answer the reader’s main question early. Define unfamiliar terms on first use. Use numbered steps for procedures and tables for meaningful comparisons. Support factual claims with primary sources and show relevant authorship. Keep dates accurate where freshness matters. No fixed answer length or special AI schema is required; manually check accuracy and usefulness.');
  add('Crawl signals', location.protocol === 'https:' ? 'pass' : 'review', 'HTTPS', location.protocol, 'Serve public pages over HTTPS.');
  const hreflang = all('link[rel~="alternate"][hreflang]').map(e=>({language:e.hreflang,url:e.href}));
  add('Metadata','info','Language alternatives', hreflang.length ? hreflang.map(e=>`${e.language}: ${e.url}`).join('\n') : 'No hreflang links found (optional for single-language pages).', 'For localized sites, verify valid language codes and reciprocal links separately.');
  return {version:1, url:location.href, title, auditedAt:new Date().toISOString(), checks, meta, headings, jsonld, types, canonical, stats:{words, images:images.length, links:links.length, externalLinks:external.length}, limitations:['Rendered top-level DOM only; page scripts may add or change content after this snapshot.','No site crawl, HTTP status/header checks, robots.txt evaluation, sitemap checks, link destination checks, field Core Web Vitals, or search index verification.','JSON-LD is parsed locally; schema.org vocabulary, rich-result requirements, and visible-content consistency need separate validation.','AEO and GEO observations are heuristics, not predictions of rankings, citations, or AI inclusion. No special AI schema or llms.txt is required by this audit.']};
}
if (typeof module !== 'undefined') module.exports = {auditPage};

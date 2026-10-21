// Curated documentation only. URLs never come from the audited page.
const learningArticles = {
 title:['Titles in search results','Google Search Central','https://developers.google.com/search/docs/appearance/title-link'],
 description:['Meta descriptions and snippets','Google Search Central','https://developers.google.com/search/docs/appearance/snippet'],
 canonical:['Canonical URLs','Google Search Central','https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls'],
 robots:['Robots meta directives','Google Search Central','https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag'],
 language:['Document language','MDN','https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang'],
 viewport:['Mobile viewport','MDN','https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport'],
 meta:['Metadata and social cards','MDN','https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Webpage_metadata'],
 og:['Open Graph social previews','Open Graph','https://ogp.me/'],
 headings:['Headings and document structure','MDN','https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/Heading_Elements'],
 alt:['Image alternative text','W3C WAI','https://www.w3.org/WAI/tutorials/images/'],
 links:['Link text and crawlable links','Google Search Central','https://developers.google.com/search/docs/crawling-indexing/links-crawlable'],
 content:['Helpful content and attribution','Google Search Central','https://developers.google.com/search/docs/fundamentals/creating-helpful-content'],
 schema:['Structured data and JSON-LD','Google Search Central','https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data'],
 context:['JSON-LD contexts','W3C','https://www.w3.org/TR/json-ld11/#the-context'],
 article:['Article structured data','Google Search Central','https://developers.google.com/search/docs/appearance/structured-data/article'],
 dates:['Publication and update dates','Google Search Central','https://developers.google.com/search/docs/appearance/publication-dates'],
 geo:['AI search features and your website','Google Search Central','https://developers.google.com/search/docs/appearance/ai-features'],
 https:['HTTPS and TLS','MDN','https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security'],
 hreflang:['Language alternatives and hreflang','Google Search Central','https://developers.google.com/search/docs/specialty/international/localized-versions'],
 ttfb:['Time to first byte (TTFB)','web.dev','https://web.dev/articles/ttfb'],
 fcp:['First contentful paint (FCP)','web.dev','https://web.dev/articles/fcp'],
 lcp:['Largest contentful paint (LCP)','web.dev','https://web.dev/articles/lcp'],
 cls:['Layout shifts and CLS','web.dev','https://web.dev/articles/cls'],
 tasks:['Long tasks and main-thread work','web.dev','https://web.dev/articles/optimize-long-tasks'],
 scripts:['Script loading, async and defer','MDN','https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script'],
 resources:['Resource timing and byte sizes','MDN','https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming'],
 network:['Debug slow or failed requests','Chrome DevTools','https://developer.chrome.com/docs/devtools/network/'],
 images:['Responsive images and sizes','web.dev','https://web.dev/learn/images/responsive-images'],
 errors:['Debug JavaScript errors','Chrome DevTools','https://developer.chrome.com/docs/devtools/javascript/'],
 grades:['How Frog grades work','Project guide','https://github.com/flyptkarsh/seo-geo-frog/blob/main/docs/AUDIT-DETAILS.md#category-report-card-version-3'],
 prompts:['Using evidence-based fix prompts','Project guide','https://github.com/flyptkarsh/seo-geo-frog/blob/main/docs/AUDIT-DETAILS.md#finding-level-fix-prompts-version-32']
};
const learningCheckKeys = {
 'Answers after question headings':['content','headings'],'Answer snippet restrictions':['robots','geo'],'Q&A markup completeness':['schema','geo'],'AEO writing tips':['content','geo'],
 'Page title':['title'],'Title length heuristic':['title'],'Meta description':['description'],'Description length heuristic':['description'],
 'Canonical URL':['canonical'],'Robots meta directives':['robots'],'Document language':['language'],'Viewport':['viewport'],
 'og:title':['og'],'og:description':['og'],'og:image':['og'],'og:url':['og'],'twitter:card':['meta'],
 'Repeated meta keys':['meta'],'Primary heading':['headings'],'Heading hierarchy':['headings'],'Image alternatives':['alt'],
 'Link labels':['links'],'Readable page text':['content'],'JSON-LD syntax':['schema'],'Typed schema entities':['schema'],'JSON-LD context':['context'],
 'Author attribution signal':['content','geo'],'Dates and freshness signals':['dates'],'References and outbound links':['links','content'],
 'Content structure':['headings','geo'],'HTTPS':['https'],'Language alternatives':['hreflang'],
 'Document TTFB':['ttfb'],'First contentful paint':['fcp'],'Observed LCP candidate':['lcp'],'Observed layout movement':['cls'],
 'Main-thread long tasks':['tasks'],'Potentially parser-blocking scripts':['scripts'],'Observed JavaScript payload':['resources','tasks'],
 'Resource budget':['resources'],'Slow recorded resources':['network'],'Exposed HTTP resource errors':['network'],
 'Broken loaded images':['network'],'Oversized image candidates':['images'],'Captured runtime and load errors':['errors'],
 'Runtime diagnostics unavailable':['errors']
};
function articlesForCheck(check) {
 return (learningCheckKeys[check.title] || (/^Article details \d+$/.test(check.title)?['article']:[])).map(key=>learningArticles[key]);
}
function articlesForSection(section) {
 const keys={overview:['grades','geo','schema','ttfb','errors'],seo:['title','description','canonical','robots','headings','alt','schema','context','article','geo','content','dates','language','hreflang','viewport','links','https','meta','og'],previews:['title','description','og','meta'],speed:['ttfb','fcp','lcp','cls','resources','network','images'],javascript:['errors','tasks','scripts','resources','network'],fixes:['prompts']}[section] || [];
 return keys.map(key=>learningArticles[key]);
}
if(typeof module!=='undefined')module.exports={learningArticles,learningCheckKeys,articlesForCheck,articlesForSection};

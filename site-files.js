/* Fetch only public files on the audited origin using the temporary activeTab grant. */
async function checkSiteFiles(pageUrl) {
  const origin=new URL(pageUrl).origin;
  const limit=256*1024;
  async function read(path) {
    const url=new URL(path,origin);
    if(url.origin!==origin || !/^https?:$/.test(url.protocol) || url.username || url.password) return {url:url.href,state:'Not fetched (outside audited origin)'};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),4000);
    let reader;
    try {
      const response=await fetch(url.href,{signal:controller.signal,credentials:'omit',redirect:'manual',referrerPolicy:'no-referrer'});
      if(response.type==='opaqueredirect' || response.status>=300 && response.status<400) return {url:url.href,state:'Redirect not followed; verify destination manually'};
      if(!response.ok) return {url:url.href,status:response.status,state:response.status===404 || response.status===410?'Not found at this URL':`Unavailable (HTTP ${response.status})`};
      if(!response.body) return {url:url.href,status:response.status,state:'Retrieved',text:''};
      reader=response.body.getReader();
      const decoder=new TextDecoder();let size=0,text='';
      while(true) {
        const part=await reader.read();if(part.done) break;
        size+=part.value.byteLength;
        if(size>limit) return {url:url.href,status:response.status,state:'Too large for this check (256 KiB limit); verify manually'};
        text+=decoder.decode(part.value,{stream:true});
      }
      text+=decoder.decode();
      if(/^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(text) || /text\/html/i.test(response.headers.get('content-type') || '')) return {url:url.href,status:response.status,state:'HTML response instead of the requested file'};
      return {url:url.href,status:response.status,state:'Retrieved',text};
    } catch {return {url:url.href,state:'Could not verify (network, permission, or timeout)'};}
    finally {clearTimeout(timer);if(reader) await reader.cancel().catch(()=>{});}
  }
  const [robots,llms]=await Promise.all([read('/robots.txt'),read('/llms.txt')]);
  const declarations=robots.text?.split(/\r?\n/).map(line=>line.replace(/#.*$/,'').match(/^\s*sitemap\s*:\s*(\S+)\s*$/i)?.[1]).filter(Boolean) || [];
  const candidates=[];
  for(const value of [...declarations,'/sitemap.xml','/sitemap_index.xml']) {
    try {const url=new URL(value,origin);if(!candidates.includes(url.href))candidates.push(url.href);}catch{/* invalid directive is retained in robots evidence */}
  }
  const sitemaps=await Promise.all(candidates.slice(0,3).map(read));
  for(const file of sitemaps) {
    if(!file.text) continue;
    const xml=new DOMParser().parseFromString(file.text,'application/xml');
    const root=xml.documentElement;
    const xmlMatch=!xml.querySelector('parsererror') && ['urlset','sitemapindex','rss','feed'].includes(root?.localName);
    const lines=file.text.trim().split(/\r?\n/).filter(Boolean);
    const textMatch=lines.length>0 && lines.every(line=>{try {return /^https?:$/.test(new URL(line.trim()).protocol);}catch{return false;}});
    file.recognized=xmlMatch || textMatch;
    file.state=file.recognized?'Recognized sitemap format (not fully validated)':'Unrecognized or malformed sitemap content; verify manually';
  }
  const robotsRecognized=robots.text!==undefined && (!robots.text.trim() || /^\s*(?:user-agent|sitemap)\s*:/im.test(robots.text));
  const describe=file=>`${file.url}\n${file.status ? `HTTP ${file.status} · `:''}${file.state}`;
  const checks=[
    {group:'Crawl signals',status:robotsRecognized?'pass':'info',title:'robots.txt availability',evidence:describe(robots)+(robots.text!==undefined?`\n${robots.text.slice(0,3000)}${robots.text.length>3000?'\n[Preview truncated]':''}`:''),advice:'Review crawler-specific groups and intended Allow/Disallow rules. Retrieval is not a robots policy evaluation or proof the page can be crawled. Missing robots.txt does not itself block crawling. Preserve intentional restrictions.'},
    {group:'Crawl signals',status:sitemaps.some(f=>f.recognized)?'pass':'info',title:'Sitemap discovery',evidence:sitemaps.map(describe).join('\n\n')+`\nrobots.txt declares ${declarations.length} sitemap URL(s). Checked up to 3 candidates; other locations, gzip files, and child sitemap indexes are not crawled.`,advice:'If a sitemap is useful for this site, publish canonical, indexable URLs and declare its absolute URL in robots.txt or submit it in Search Console. Missing default paths does not prove no sitemap exists. A sitemap is a discovery hint, not a guarantee of indexing; validate contents separately.'},
    {group:'Crawl signals',status:'info',title:'llms.txt availability',evidence:describe(llms)+(llms.text!==undefined?`\n${/^#\s+\S/m.test(llms.text)?'Markdown title found; proposal format is not fully validated.':'No Markdown H1 found; review the proposed format.'}\n${llms.text.slice(0,3000)}${llms.text.length>3000?'\n[Preview truncated]':''}`:''),advice:'llms.txt is an optional proposal for agent-friendly site guidance, not an access-control file or a Google Search requirement. Keep it accurate if you use it. Its presence does not guarantee crawling, ranking, or AI citations. Only the root path is checked; scoped files may exist elsewhere.'}
  ];
  return {checks,files:{robots,llms,sitemaps}};
}
if(typeof module!=='undefined')module.exports={checkSiteFiles};

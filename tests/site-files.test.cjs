const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
async function check(t,files) {
 const w=new JSDOM('',{runScripts:'outside-only'}).window;t.after(()=>w.close());
 const calls=[];
 w.fetch=async (url,options)=>{calls.push({url,options});const value=files[new URL(url).pathname];if(value instanceof Error)throw value;return new Response(value?.body??'',{status:value?.status??(value?200:404),headers:{'content-type':value?.type??'text/plain'}});};
 w.AbortController=AbortController;w.TextDecoder=TextDecoder;
 w.eval(fs.readFileSync(require('node:path').join(__dirname,'../site-files.js'),'utf8'));
 return {result:await w.checkSiteFiles('https://example.com/article'),calls};
}
test('site files discover declared sitemaps and retrieve optional llms without credentials',async t=>{
 const {result,calls}=await check(t,{'/robots.txt':{body:'User-agent: *\nDisallow: /private\nSitemap: https://example.com/custom.xml\nSitemap: https://outside.test/map.xml'},'/llms.txt':{body:'# Example\nDocumentation'},'/custom.xml':{body:'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/child.xml</loc></sitemap></sitemapindex>',type:'application/xml'}});
 assert.equal(result.checks[0].status,'pass');assert.equal(result.checks[1].status,'pass');assert.equal(result.checks[2].status,'info');
 assert.ok(result.files.sitemaps.some(file=>file.state.includes('outside audited origin')));
 assert.ok(!calls.some(call=>call.url.includes('outside.test') || call.url.includes('child.xml')));
 assert.ok(calls.every(call=>call.options.credentials==='omit' && call.options.redirect==='manual'));
 const {articlesForCheck}=require('../learn.js');for(const finding of result.checks)assert.ok(articlesForCheck(finding).length);
});
test('missing and blocked files are inconclusive and HTML fallback is not a sitemap',async t=>{
 const {result}=await check(t,{'/robots.txt':{status:403},'/sitemap.xml':{body:'<!doctype html><title>SPA</title>',type:'text/html'},'/sitemap_index.xml':{body:'<urlset><url></urlset>',type:'application/xml'}});
 assert.ok(result.checks.every(c=>c.status==='info'));
 assert.match(result.checks[0].evidence,/403/);assert.match(result.checks[1].evidence,/HTML response/);assert.match(result.checks[2].evidence,/Not found/);
});
test('file checks cap large bodies and handle network errors without failing the audit',async t=>{
 const {result}=await check(t,{'/robots.txt':new Error('blocked'),'/llms.txt':{body:'x'.repeat(300000)},'/sitemap.xml':{body:'https://example.com/a\nhttps://example.com/b'}});
 assert.match(result.checks[0].evidence,/Could not verify/);assert.match(result.checks[2].evidence,/Too large/);assert.equal(result.checks[1].status,'pass');
});

// Approximate share cards derived from the rendered metadata; never a crawler verdict.
function socialPreview(report, platform) {
  const get = name => report.meta.find(m=>m.name.toLowerCase()===name && m.content.trim())?.content.trim() || '';
  const pick = names => {for(const name of names) {const value=get(name);if(value) return {value,source:name};}return {value:'',source:'Missing'};};
  const x=platform==='x';
  const title=pick(x?['twitter:title','og:title']:['og:title']);
  const description=pick(x?['twitter:description','og:description']:['og:description']);
  const image=pick(x?['twitter:image','og:image']:['og:image']);
  let imageUrl='';
  try {const url=new URL(image.value,report.url);if(image.value && /^https?:$/.test(url.protocol) && !url.username && !url.password) imageUrl=url.href;} catch {}
  return {title,description,image,imageUrl,domain:new URL(report.url).hostname,card:get('twitter:card'),compact:x && get('twitter:card')!=='summary_large_image'};
}

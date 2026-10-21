const os=require('node:os');
const artifacts=require('node:fs').mkdtempSync(require('node:path').join(os.tmpdir(),'frog-test-'));
process.chdir(require('node:path').resolve(__dirname,'../..'));
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
const extension=path.resolve('.');
const context=await chromium.launchPersistentContext(require('node:path').join(artifacts,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try {
const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
const id=new URL(worker.url()).hostname;
const config=await worker.evaluate(async()=>({manifest:chrome.runtime.getManifest(),options:await chrome.sidePanel.getOptions({})}));
if(config.manifest.action.default_popup || config.options.path!=='popup.html')throw Error('Invalid side-panel wiring');
const page=await context.newPage();
await page.goto(`chrome-extension://${id}/popup.html`);
await page.evaluate(()=>{
const button=document.createElement('button');button.id='native-open-test';button.textContent='Open native panel';
button.onclick=async()=>{try{const w=await chrome.windows.getCurrent();await chrome.sidePanel.open({windowId:w.id});button.dataset.result='opened';}catch(e){button.dataset.result=e.message;}};
document.body.append(button);
});
await page.locator('#native-open-test').click();
await page.waitForFunction(()=>document.querySelector('#native-open-test').dataset.result);
const result=await page.locator('#native-open-test').getAttribute('data-result');
if(result!=='opened')throw Error(result);
const badgeTab=await page.evaluate(async()=>{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 updateGradeBadge(tab.id,{letter:'F',score:40,measured:4,total:6});return tab.id;
});
await page.waitForFunction(async id=>(await chrome.action.getBadgeText({tabId:id}))==='F',badgeTab);
const badge=await worker.evaluate(async tabId=>({text:await chrome.action.getBadgeText({tabId}),color:await chrome.action.getBadgeBackgroundColor({tabId}),title:await chrome.action.getTitle({tabId})}),badgeTab);
if(badge.text!=='F' || badge.color.join(',')!=='220,38,38,255' || !badge.title.includes('Overall F (40/100)'))throw Error('Native badge failed');
await page.goto('about:blank');
for(let attempt=0;attempt<20;attempt++) {
 if(await worker.evaluate(tabId=>chrome.action.getBadgeText({tabId}),badgeTab)==='')break;
 await new Promise(resolve=>setTimeout(resolve,50));
}
if(await worker.evaluate(tabId=>chrome.action.getBadgeText({tabId}),badgeTab)!=='')throw Error('Navigation left stale badge');
console.log('Native overall grade badge, color, tooltip and navigation reset passed.');
console.log('Native unpacked-extension check passed: service worker loaded, native side panel configured, sidePanel.open succeeded on a real click.');
} finally{await context.close();}
})();

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
console.log('Native unpacked-extension check passed: service worker loaded, native side panel configured, sidePanel.open succeeded on a real click.');
} finally{await context.close();}
})();

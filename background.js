// A toolbar click grants activeTab access and opens the native Chrome side panel.
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({windowId:tab.windowId}).then(()=>{
    chrome.runtime.sendMessage({type:'frog-audit-active-tab',windowId:tab.windowId}).catch(()=>{});
  }).catch(error=>console.error('Unable to open SEO/GEO Frog side panel',error));
});

// Clear tab-specific counts on navigation even when the side panel is closed.
chrome.tabs?.onUpdated?.addListener((tabId,change)=>{
  if(change.status!=='loading' && !change.url) return;
  chrome.action.setBadgeText({tabId,text:''}).catch(()=>{});
  chrome.action.setTitle({tabId,title:'SEO/GEO Frog · Audit this page'}).catch(()=>{});
});

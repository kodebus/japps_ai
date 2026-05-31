chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPageInfo') {
    let componentName = '';
    
    const selectors = [
      '.omnistudio-designer-header .slds-page-header__title',
      '.forcePageBlockSectionRow .slds-form-element__label',
      'h1.slds-page-header__title',
      '.slds-page-header__title',
      'title'
    ];

    for (let selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim() !== '') {
        componentName = el.innerText.trim();
        break;
      }
    }

    if (!componentName) {
      componentName = document.title || 'Unknown Component';
    }

    componentName = componentName.replace(' | Salesforce', '').trim();

    sendResponse({ componentName });
  }
  return true;
});
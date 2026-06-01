chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPageInfo') {
    let componentName = '';
    let stepName = '';
    let storyNumber = '';
    let selectedText = '';

    // Grab selected/highlighted text
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      selectedText = selection.toString().trim();
    }

    // Grab OmniScript header details
    const omniHeader = document.querySelector('builder_omnistudio_omniscript-omni-designer-canvas-header');
    if (omniHeader) {
      const cols = omniHeader.querySelectorAll('.slds-col');
      const parts = [];
      cols.forEach(col => {
        const valueEl = col.querySelector('.slds-truncate:not(.slds-text-title)');
        if (
          valueEl &&
          valueEl.title &&
          valueEl.title.trim() !== '' &&
          valueEl.title.trim().toLowerCase() !== 'false' &&
          valueEl.title.trim().toLowerCase() !== 'true'
        ) {
          parts.push(valueEl.title.trim());
        }
      });
      if (parts.length > 0) {
        componentName = parts.join(' / ');
      }

      const storyMatch = componentName.match(/([A-Z]+-\d+|\d{4,})/);
      if (storyMatch) {
        storyNumber = storyMatch[0];
      }
    }

    // Try to get current step name
    const stepSelectors = [
      '.slds-page-header__title span',
      '.slds-page-header__title',
      'h1.slds-page-header__title',
    ];

    for (let selector of stepSelectors) {
      const elements = document.querySelectorAll(selector);
      for (let el of elements) {
        const text = el.innerText || el.textContent;
        if (text && text.trim() !== '' && text.trim().length > 1) {
          stepName = text.trim().split('\n')[0];
          break;
        }
      }
      if (stepName) break;
    }

    if (componentName && stepName) {
      componentName = `${componentName} — Step: ${stepName}`;
    } else if (!componentName) {
      componentName = document.title
        .replace(' | Salesforce', '')
        .replace(' ~ Salesforce', '')
        .trim() || 'Unknown Component';
    }

    sendResponse({ componentName, storyNumber, selectedText });
  }
  return true;
});
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPageInfo') {
    let componentName = '';
    let stepName = '';
    let storyNumber = '';
    let selectedText = '';
    let description = '';

    // Grab selected/highlighted text
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      selectedText = selection.toString().trim();
    }

    // 1. Try OmniScript header
    const omniHeader = document.querySelector('builder_omnistudio_omniscript-omni-designer-canvas-header');
    if (omniHeader) {
      const cols = omniHeader.querySelectorAll('.slds-col');
      const parts = [];
      cols.forEach(col => {
        const labelEl = col.querySelector('.slds-text-title.slds-truncate');
        const valueEl = col.querySelector('.slds-truncate:not(.slds-text-title)');
        if (labelEl && valueEl && valueEl.title && valueEl.title.trim() !== '') {
          const label = labelEl.title || labelEl.textContent.trim();
          const value = valueEl.title.trim();
          if (value.toLowerCase() !== 'false' && value.toLowerCase() !== 'true') {
            if (label === 'Description') {
              description = value;
            } else {
              parts.push(value);
            }
          }
        }
      });
      if (parts.length > 0) {
        componentName = `OmniScript: ${parts.join(' / ')}`;
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
      if (stepName) componentName += ` — Step: ${stepName}`;
    }

    // 2. Try DataMapper header
    if (!componentName) {
      const dmHeader = document.querySelector('builder_omnistudio_dataraptor-dataraptor-header h1.slds-p-left_small');
      if (dmHeader && dmHeader.textContent.trim()) {
        componentName = `DataMapper: ${dmHeader.textContent.trim()}`;
        // Grab description from Settings modal if open
        const dmDesc = document.querySelector('lightning-modal-body lightning-textarea.description textarea');
        if (dmDesc && dmDesc.value.trim()) {
          description = dmDesc.value.trim();
        }
      }
    }

    // 3. Try FlexCard header
    if (!componentName) {
      const fcHeader = document.querySelector('builder_omnistudio_common-header button[aria-label]');
      if (fcHeader) {
        const label = fcHeader.getAttribute('aria-label');
        if (label && label.trim()) {
          componentName = `FlexCard: ${label.trim()}`;
          // Try to get FlexCard description
          const fcDesc = document.querySelector('runtime_omnistudio_common-textarea.cardDescription textarea');
          if (fcDesc && fcDesc.value.trim()) {
            description = fcDesc.value.trim();
          }
        }
      }
    }

    // 4. Try Integration Procedure header
    if (!componentName) {
      const ipHeader = document.querySelector('builder_industries_interaction_rule-rule-builder-header h2 span');
      if (ipHeader && ipHeader.textContent.trim()) {
        componentName = `Integration Procedure: ${ipHeader.textContent.trim()}`;
        // Try to get IP description from properties panel if open
        const ipDesc = document.querySelector('lightning-textarea[data-name="description"] textarea');
        if (ipDesc && ipDesc.value.trim()) {
          description = ipDesc.value.trim();
        }
      }
    }

    // 5. Fallback to page title
    if (!componentName) {
      componentName = document.title
        .replace(' | Salesforce', '')
        .replace(' ~ Salesforce', '')
        .trim() || 'Unknown Component';
    }

    // Extract story number
    const storyMatch = componentName.match(/([A-Z]+-\d+|\d{4,})/);
    if (storyMatch) {
      storyNumber = storyMatch[0];
    }

    sendResponse({ componentName, storyNumber, selectedText, description });
  }
  return true;
});
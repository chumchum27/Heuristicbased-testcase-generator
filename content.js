/**
 * TestCraft AI – Content Script
 * Extracts interactive elements, metadata, and page structure from the DOM.
 */

(function () {
  'use strict';

  /**
   * Safely get text from an element or its label
   */
  function getLabel(el) {
    // Check aria-label
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    // Check aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }
    // Check associated <label>
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent.trim();
    }
    // Check parent label
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    // Check placeholder
    if (el.placeholder) return el.placeholder.trim();
    // Check name attribute
    if (el.name) return el.name.trim();
    // Check value for buttons
    if (el.value && el.tagName !== 'INPUT') return el.value.trim();
    // Check textContent
    if (el.textContent) return el.textContent.trim().substring(0, 80);
    return '';
  }

  /**
   * Get visible text content of element
   */
  function getVisibleText(el) {
    return (el.textContent || el.innerText || '').trim().replace(/\s+/g, ' ').substring(0, 120);
  }

  /**
   * Check if element is visible
   */
  function isVisible(el) {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return true;
    }
  }

  /**
   * Determine validation rules from input attributes
   */
  function getValidationRules(el) {
    const rules = [];
    if (el.required) rules.push('required');
    if (el.minLength > 0) rules.push(`minLength:${el.minLength}`);
    if (el.maxLength > 0 && el.maxLength < 524288) rules.push(`maxLength:${el.maxLength}`);
    if (el.min) rules.push(`min:${el.min}`);
    if (el.max) rules.push(`max:${el.max}`);
    if (el.pattern) rules.push(`pattern:${el.pattern}`);
    if (el.type === 'email') rules.push('email-format');
    if (el.type === 'tel') rules.push('phone-format');
    if (el.type === 'url') rules.push('url-format');
    if (el.type === 'number') rules.push('numeric-only');
    return rules;
  }

  /**
   * Resolve a human-readable name for a form from multiple DOM sources.
   * Priority: aria-label → fieldset legend → nearest preceding heading
   * → submit button text → page-type heuristic
   */
  function resolveFormName(form, pageType) {
    // 1. Explicit aria-label on the form itself
    const aria = form.getAttribute('aria-label') || form.getAttribute('aria-labelledby');
    if (aria) {
      const ref = document.getElementById(aria);
      return (ref ? ref.textContent : aria).trim();
    }
    // 2. <legend> inside a <fieldset> that wraps the form
    const legend = form.querySelector('fieldset > legend');
    if (legend && legend.textContent.trim()) return legend.textContent.trim() + ' Form';

    // 3. Nearest preceding heading (h1–h3) in the same section/container
    const headingCandidates = ['h1', 'h2', 'h3'];
    let node = form.previousElementSibling;
    while (node) {
      if (headingCandidates.includes(node.tagName.toLowerCase()) && node.textContent.trim()) {
        return node.textContent.trim() + ' Form';
      }
      node = node.previousElementSibling;
    }
    // Walk up to parent and look for a heading inside it (but not inside form)
    const parent = form.parentElement;
    if (parent) {
      for (const tag of headingCandidates) {
        const h = parent.querySelector(tag);
        if (h && !form.contains(h) && h.textContent.trim()) {
          return h.textContent.trim() + ' Form';
        }
      }
    }

    // 4. Submit button text (e.g. "Sign In", "Create Account")
    const submit = form.querySelector('[type="submit"], button:not([type="button"]):not([type="reset"])');
    if (submit) {
      const btnText = submit.textContent.trim().replace(/\s+/g, ' ');
      if (btnText && btnText.length < 40) return btnText + ' Form';
    }

    // 5. Page-type heuristic (already detected)
    if (pageType && pageType !== 'General') return pageType + ' Form';

    // 6. Final fallback: form id/name attribute prettified
    if (form.id) return form.id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' Form';
    if (form.name) return form.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' Form';

    return `Form ${idx + 1}`;
  }

  /**
   * Extract all forms and their fields
   */
  function extractForms() {
    const pageType = detectPageType(
      window.location.href,
      document.title || '',
      (document.querySelector('h1') || {}).textContent || ''
    );
    const forms = [];
    document.querySelectorAll('form').forEach((form, idx) => {
      const formData = {
        id: form.id || `form-${idx + 1}`,
        name: resolveFormName(form, pageType),
        action: form.action || '',
        method: form.method || 'get',
        fields: [],
        submitButton: null
      };

      // Extract fields
      form.querySelectorAll('input, select, textarea').forEach(field => {
        if (['submit', 'reset', 'button', 'hidden', 'image'].includes(field.type)) return;
        formData.fields.push({
          tagName: field.tagName.toLowerCase(),
          type: field.type || field.tagName.toLowerCase(),
          id: field.id || '',
          name: field.name || '',
          label: getLabel(field),
          placeholder: field.placeholder || '',
          required: field.required || false,
          disabled: field.disabled || false,
          readOnly: field.readOnly || false,
          value: field.defaultValue || '',
          options: field.tagName === 'SELECT' ? Array.from(field.options).map(o => o.text).filter(Boolean) : [],
          validationRules: getValidationRules(field),
          visible: isVisible(field)
        });
      });

      // Extract submit button
      const submit = form.querySelector('[type="submit"], button:not([type="button"]):not([type="reset"])');
      if (submit) {
        formData.submitButton = {
          text: getVisibleText(submit),
          type: submit.type || 'submit'
        };
      }

      forms.push(formData);
    });
    return forms;
  }

  /**
   * Find the nearest section/card heading above or around an element.
   */
  function getNearestSectionHeading(el) {
    const sectionAncestors = ['section', 'article', 'aside', '.card', '.panel', '.widget', '.modal', '[role="dialog"]', '[role="region"]'];
    for (const sel of sectionAncestors) {
      const ancestor = el.closest(sel);
      if (ancestor) {
        const heading = ancestor.querySelector('h1,h2,h3,h4,h5,h6');
        if (heading && heading.textContent.trim()) return heading.textContent.trim();
        const ariaLabel = ancestor.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.trim();
      }
    }
    let node = el.parentElement;
    for (let d = 0; d < 5 && node; d++) {
      const h = node.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > h4');
      if (h && h.textContent.trim()) return h.textContent.trim();
      node = node.parentElement;
    }
    return '';
  }

  /**
   * Find the subject entity a button acts on (e.g. patient name in the same row/card).
   */
  function getSubjectEntity(el) {
    const rowSelectors = ['tr', 'li', '[role="row"]', '[role="listitem"]', '.card', '.item', '.row', '.entry', '.record'];
    for (const sel of rowSelectors) {
      const row = el.closest(sel);
      if (!row) continue;
      const nameEl = row.querySelector('strong, b, [class*="name"], [class*="title"], h3, h4, h5');
      if (nameEl && nameEl.textContent.trim() && !nameEl.contains(el)) {
        return nameEl.textContent.trim().substring(0, 60);
      }
      const firstCell = row.querySelector('td, .col, [class*="cell"]');
      if (firstCell && firstCell.textContent.trim() && !firstCell.contains(el)) {
        return firstCell.textContent.trim().substring(0, 60);
      }
    }
    return '';
  }

  /**
   * Collect data-* attributes as a plain object.
   */
  function getDataAttributes(el) {
    const result = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-')) result[attr.name] = attr.value;
    }
    return result;
  }

  /**
   * Extract standalone interactive elements outside forms — with rich context.
   */
  function extractInteractiveElements() {
    const elements = [];
    const selectors = [
      'button:not(form button)',
      'a[href]:not(nav a)',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="checkbox"]',
      '[role="switch"]',
      '[onclick]',
      'input:not(form input)',
      'select:not(form select)',
      'textarea:not(form textarea)'
    ];

    const seen = new Set();
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        if (!isVisible(el)) return;

        const describedById = el.getAttribute('aria-describedby');
        const describedByEl = describedById ? document.getElementById(describedById) : null;

        elements.push({
          tagName:        el.tagName.toLowerCase(),
          type:           el.type || el.getAttribute('role') || el.tagName.toLowerCase(),
          label:          getLabel(el),
          text:           getVisibleText(el),
          href:           el.href || '',
          id:             el.id || '',
          disabled:       el.disabled || el.getAttribute('aria-disabled') === 'true',
          required:       el.required || false,
          placeholder:    el.placeholder || '',
          sectionHeading: getNearestSectionHeading(el),
          subjectEntity:  getSubjectEntity(el),
          dataAttrs:      getDataAttributes(el),
          title:          el.getAttribute('title') || '',
          ariaDescription: describedByEl ? describedByEl.textContent.trim() : ''
        });
      });
    });

    return elements.slice(0, 100);
  }

  /**
   * Extract navigation structure
   */
  function extractNavigation() {
    const navItems = [];
    document.querySelectorAll('nav, [role="navigation"]').forEach(nav => {
      nav.querySelectorAll('a, button, [role="menuitem"]').forEach(item => {
        if (!isVisible(item)) return;
        navItems.push({
          text: getVisibleText(item),
          href: item.href || '',
          type: item.tagName.toLowerCase()
        });
      });
    });
    return navItems.slice(0, 30);
  }

  /**
   * Extract modal/dialog info
   */
  function extractModals() {
    const modals = [];
    document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal, .dialog, [aria-modal="true"]').forEach((modal, idx) => {
      modals.push({
        id: modal.id || `modal-${idx + 1}`,
        label: modal.getAttribute('aria-label') || modal.getAttribute('aria-labelledby') || `Modal ${idx + 1}`,
        visible: isVisible(modal)
      });
    });
    return modals;
  }

  /**
   * Extract tables for data-driven test scenarios
   */
  function extractTables() {
    const tables = [];
    document.querySelectorAll('table').forEach((table, idx) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      tables.push({
        id: table.id || `table-${idx + 1}`,
        caption: table.caption ? table.caption.textContent.trim() : '',
        headers,
        rowCount: table.querySelectorAll('tbody tr').length
      });
    });
    return tables;
  }

  /**
   * Detect the page type/module from URL and content
   */
  function detectPageModule() {
    const url = window.location.href;
    const title = document.title || '';
    const h1 = document.querySelector('h1');
    const h1Text = h1 ? h1.textContent.trim() : '';

    const urlSegments = window.location.pathname.split('/').filter(Boolean);
    const lastSegment = urlSegments[urlSegments.length - 1] || 'home';

    return {
      url,
      title,
      h1: h1Text,
      domain: window.location.hostname,
      path: window.location.pathname,
      module: lastSegment.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
      pageType: detectPageType(url, title, h1Text)
    };
  }

  /**
   * Heuristic page type detection
   */
  function detectPageType(url, title, h1) {
    const combined = `${url} ${title} ${h1}`.toLowerCase();
    if (/login|sign.?in|auth/.test(combined)) return 'Login';
    if (/register|sign.?up|create.account/.test(combined)) return 'Registration';
    if (/dashboard|home|overview/.test(combined)) return 'Dashboard';
    if (/profile|account|settings|preferences/.test(combined)) return 'Profile/Settings';
    if (/checkout|payment|cart|order/.test(combined)) return 'Checkout/Payment';
    if (/search|results|filter/.test(combined)) return 'Search/Filter';
    if (/contact|support|help/.test(combined)) return 'Contact/Support';
    if (/product|item|listing/.test(combined)) return 'Product/Listing';
    if (/report|analytics|stat/.test(combined)) return 'Reports/Analytics';
    if (/admin|manage/.test(combined)) return 'Admin';
    return 'General';
  }

  /**
   * Main extraction function
   */
  function extractPageData() {
    return {
      pageInfo: detectPageModule(),
      forms: extractForms(),
      interactiveElements: extractInteractiveElements(),
      navigation: extractNavigation(),
      modals: extractModals(),
      tables: extractTables(),
      timestamp: new Date().toISOString()
    };
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_PAGE_DATA') {
      try {
        const data = extractPageData();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true; // keep channel open for async
  });
})();

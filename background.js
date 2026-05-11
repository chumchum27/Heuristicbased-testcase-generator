/**
 * TestCraft AI – Background Service Worker
 * Generates a concise, beginner-readable set of test cases.
 * Categories: Functionality | UI | Negative | API Failure
 * All titles start with "Verify".
 * Steps are written in plain English for a manual tester with no prior experience.
 */

'use strict';

// ── Counter ──────────────────────────────────────────────────────────
let caseCounter = 1;
function nextId() {
  return `TC-${String(caseCounter++).padStart(4, '0')}`;
}

const ALL_DEVICES = 'Desktop (Chrome, Firefox), Mobile (Android Chrome, iOS Safari)';

// ── Field helpers ────────────────────────────────────────────────────

function fieldName(field) {
  return (field.label || field.placeholder || field.name || field.type || 'Field')
    .replace(/[*:]+$/, '').trim();
}

function validSample(field) {
  const l = (field.label || '').toLowerCase();
  const n = (field.name  || '').toLowerCase();
  const t = (field.type  || '').toLowerCase();
  if (t === 'email' || l.includes('email') || n.includes('email')) return 'testuser@example.com';
  if (t === 'password' || l.includes('password') || n.includes('pass')) return 'Test@1234';
  if (t === 'tel' || l.includes('phone') || n.includes('phone')) return '+1-555-123-4567';
  if (t === 'url' || n.includes('url') || n.includes('website')) return 'https://example.com';
  if (t === 'number') return '25';
  if (t === 'date') return '2024-06-15';
  if (l.includes('name') || n.includes('name')) return 'John Doe';
  if (l.includes('username') || n.includes('user')) return 'john_doe99';
  if (l.includes('message') || n.includes('message')) return 'Hello, this is a test message.';
  if (field.options && field.options.length > 1) return field.options[1] || field.options[0];
  return 'TestValue123';
}

// =====================================================================
// NEGATIVE TEST CASES  (max 4 per form)
// Input attacks, boundary values, wrong credentials, wrong types
// =====================================================================

function buildNegativeTests(form, pageInfo) {
  const tests = [];
  const submit  = form.submitButton?.text?.trim() || 'Submit';
  const mod     = `${pageInfo.pageType} / ${form.name}`;
  const url     = pageInfo.url;
  const pre     = `The user is on the page: ${url}. The form is visible and empty.`;

  const emailField    = (form.fields || []).find(f => (f.type === 'email' || (f.label || '').toLowerCase().includes('email')));
  const passwordField = (form.fields || []).find(f => (f.type === 'password' || (f.label || '').toLowerCase().includes('password')));
  const anyTextField  = (form.fields || []).find(f => ['text', 'email', 'search'].includes(f.type) || f.type === '');
  const sampleValid   = (form.fields || []).slice(0, 4).map(f => `${fieldName(f)}: "${validSample(f)}"`).join(', ');

  // ── N1: Wrong credentials / unregistered account ─────────────────
  // (only meaningful when both email + password exist, i.e. a login form)
  if (emailField && passwordField) {
    tests.push({
      'Module/ Sub Module': mod,
      'Test Type': 'Negative',
      'Case ID': nextId(),
      'Title': `Verify ${form.name} shows an error when wrong credentials are entered`,
      'Instructions': `Enter an email that is NOT registered and a random password, then click "${submit}"`,
      'Test Data': `Email: "wrong.user@notreal.com" | Password: "WrongPass99!"`,
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': pre,
      'Steps':
        `1. Open the page: ${url}\n` +
        `2. In the "${fieldName(emailField)}" field, type: "wrong.user@notreal.com"\n` +
        `3. In the "${fieldName(passwordField)}" field, type: "WrongPass99!"\n` +
        `4. Click the "${submit}" button\n` +
        `5. Wait for the page to respond`,
      'Expected Result': `An error message appears saying something like "Invalid email or password" or "Account not found". The user is NOT logged in. The form stays on the same page.`,
      'Post Conditions': 'No session is created. The user remains on the login page.'
    });
  }

  // ── N2: Boundary overflow – too many characters ───────────────────
  const overflowTarget = anyTextField || emailField;
  if (overflowTarget) {
    const fn = fieldName(overflowTarget);
    const longStr = 'A'.repeat(300);
    tests.push({
      'Module/ Sub Module': mod,
      'Test Type': 'Negative',
      'Case ID': nextId(),
      'Title': `Verify ${form.name} does not accept an extremely long value in the "${fn}" field`,
      'Instructions': `Paste 300 characters into the "${fn}" field and try to submit`,
      'Test Data': `${fn}: 300 × "A" ("${'A'.repeat(30)}…")`,
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': pre,
      'Steps':
        `1. Open the page: ${url}\n` +
        `2. Click on the "${fn}" field\n` +
        `3. Copy and paste this 300-character text into the field:\n   "${longStr.substring(0, 50)}..." (300 A's)\n` +
        `4. Fill the remaining fields with valid data\n` +
        `5. Click the "${submit}" button`,
      'Expected Result': `Either the field stops accepting characters after the limit, OR an error message appears (e.g. "Maximum 100 characters allowed"). The form does NOT submit with the oversized value.`,
      'Post Conditions': 'No data saved. Field is reset or shows truncated value.'
    });
  }

  // ── N3: SQL injection attempt ─────────────────────────────────────
  const sqlTarget = anyTextField || emailField;
  if (sqlTarget) {
    const fn = fieldName(sqlTarget);
    tests.push({
      'Module/ Sub Module': mod,
      'Test Type': 'Negative',
      'Case ID': nextId(),
      'Title': `Verify ${form.name} does not break or expose data when a SQL injection is entered in "${fn}"`,
      'Instructions': `Type a common SQL injection string into "${fn}" and submit`,
      'Test Data': `${fn}: "' OR '1'='1" (SQL injection attempt)`,
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': pre,
      'Steps':
        `1. Open the page: ${url}\n` +
        `2. Click on the "${fn}" field\n` +
        `3. Type exactly: ' OR '1'='1\n` +
        `4. Fill the remaining fields with valid data\n` +
        `5. Click the "${submit}" button\n` +
        `6. Observe the response`,
      'Expected Result': `The app does NOT allow the injection to succeed. Either a validation error appears ("Invalid characters in field") or the form rejects the input. The database is NOT exposed — no unexpected data dump or bypass of the form appears.`,
      'Post Conditions': 'No unauthorised access granted. Error is logged silently on the server.'
    });
  }

  // ── N4: XSS (script injection) attempt ───────────────────────────
  const xssTarget = anyTextField || emailField;
  if (xssTarget) {
    const fn = fieldName(xssTarget);
    tests.push({
      'Module/ Sub Module': mod,
      'Test Type': 'Negative',
      'Case ID': nextId(),
      'Title': `Verify ${form.name} does not execute a script entered in the "${fn}" field`,
      'Instructions': `Type a script tag into "${fn}" and submit. Verify no popup or script runs.`,
      'Test Data': `${fn}: "<script>alert('XSS')</script>"`,
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': pre,
      'Steps':
        `1. Open the page: ${url}\n` +
        `2. Click on the "${fn}" field\n` +
        `3. Type: <script>alert('XSS')</script>\n` +
        `4. Click the "${submit}" button\n` +
        `5. Watch the page carefully — does a popup/alert box appear?`,
      'Expected Result': `No browser alert or popup appears. The script is treated as plain text or rejected. If the value is displayed back on the page, it should appear as text like "<script>alert('XSS')</script>" — NOT run as code.`,
      'Post Conditions': 'No scripts are executed. Page remains safe and stable.'
    });
  }

  return tests;
}

// =====================================================================
// FORM TEST CASES  (max 7 per form)
// =====================================================================


function buildFormTests(form, pageInfo) {
  const tests = [];
  const submit = form.submitButton?.text?.trim() || 'Submit';
  const mod    = `${pageInfo.pageType} / ${form.name}`;
  const url    = pageInfo.url;

  // Build a sample data string from first 3 fields
  const sampleList = (form.fields || []).slice(0, 4)
    .map(f => `${fieldName(f)}: "${validSample(f)}"`)
    .join(', ');

  // ── TC1: Valid submission ─────────────────────────────────────────
  tests.push({
    'Module/ Sub Module': mod,
    'Test Type': 'Functionality',
    'Case ID': nextId(),
    'Title': `Verify ${form.name} submits successfully with valid data`,
    'Instructions': `Fill all fields with correct data and click "${submit}"`,
    'Test Data': sampleList || 'All fields with valid data',
    'Testing Device': ALL_DEVICES,
    'Pre-Condition': `The user is on the page: ${url}. The form is visible.`,
    'Steps':
      `1. Open the page: ${url}\n` +
      `2. Fill in the form:\n   ${sampleList || 'Enter valid data in all fields'}\n` +
      `3. Click the "${submit}" button\n` +
      `4. Wait for the page to respond`,
    'Expected Result': `A success message appears OR the page navigates to the next step. No error is shown.`,
    'Post Conditions': 'The data has been saved. User sees a confirmation.'
  });

  // ── TC2: Empty form submission ────────────────────────────────────
  const hasRequired = (form.fields || []).some(f => f.required);
  if (hasRequired) {
    const reqList = (form.fields || [])
      .filter(f => f.required)
      .map(f => `"${fieldName(f)}"`)
      .join(', ');

    tests.push({
      'Module/ Sub Module': mod,
      'Test Type': 'Functionality',
      'Case ID': nextId(),
      'Title': `Verify ${form.name} shows errors when required fields are left empty`,
      'Instructions': `Leave all fields blank and click "${submit}"`,
      'Test Data': 'All fields: empty (nothing typed)',
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': `The user is on the page: ${url}. No data has been entered.`,
      'Steps':
        `1. Open the page: ${url}\n` +
        `2. Do not type anything in any field\n` +
        `3. Click the "${submit}" button\n` +
        `4. Look at each required field: ${reqList}`,
      'Expected Result': `A red error message appears below each required field (e.g. "This field is required"). The form does NOT submit — you stay on the same page.`,
      'Post Conditions': 'No data is saved. The form stays open for correction.'
    });
  }

  // ── TC3: Invalid format in first typed field ──────────────────────
  const typedField = (form.fields || []).find(f =>
    ['email', 'tel', 'url', 'number'].includes(f.type) || f.type === 'text'
  );
  if (typedField) {
    const fn = fieldName(typedField);
    const badVal = typedField.type === 'email' ? 'notanemail'
                 : typedField.type === 'tel'   ? 'abc!!!'
                 : typedField.type === 'url'   ? 'just-text-no-protocol'
                 : typedField.type === 'number' ? 'abcdef'
                 : '!@#$%^&*()';

    tests.push({
      'Module/ Sub Module': mod,
      'Test Type': 'Functionality',
      'Case ID': nextId(),
      'Title': `Verify ${form.name} rejects an invalid value in the "${fn}" field`,
      'Instructions': `Type an invalid value in "${fn}" and click "${submit}"`,
      'Test Data': `${fn}: "${badVal}"`,
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': `The user is on the page: ${url}.`,
      'Steps':
        `1. Open the page: ${url}\n` +
        `2. Click the "${fn}" field\n` +
        `3. Type: "${badVal}"\n` +
        `4. Fill the remaining fields with valid data\n` +
        `5. Click the "${submit}" button`,
      'Expected Result': `An error message appears on the "${fn}" field (e.g. "Please enter a valid ${typedField.type}"). The form does NOT submit.`,
      'Post Conditions': 'No data is saved. The invalid value is still shown so the user can fix it.'
    });
  }

  // ── TC4: API failure – server error ──────────────────────────────
  tests.push({
    'Module/ Sub Module': mod,
    'Test Type': 'Functionality',
    'Case ID': nextId(),
    'Title': `Verify ${form.name} shows an error message when the server fails to respond`,
    'Instructions': `Simulate a server/network error and submit the form to verify the error state`,
    'Test Data': sampleList || 'All fields with valid data',
    'Testing Device': ALL_DEVICES,
    'Pre-Condition': `The user is on the page: ${url}. To simulate a server error: ask the developer to temporarily return a 500 error, OR turn off the internet before clicking Submit.`,
    'Steps':
      `1. Open the page: ${url}\n` +
      `2. Fill all fields with valid data\n` +
      `3. Turn off the internet connection OR ask a developer to simulate a 500 server error\n` +
      `4. Click the "${submit}" button\n` +
      `5. Wait for 5–10 seconds`,
    'Expected Result': `A clear, friendly error message appears on the page (e.g. "Something went wrong. Please try again." or "Unable to connect. Check your internet."). The form does NOT freeze or show a blank screen.`,
    'Post Conditions': 'The form stays open. Data entered is still visible so the user can retry.'
  });

  // ── TC5: Double click / duplicate submission ──────────────────────
  tests.push({
    'Module/ Sub Module': mod,
    'Test Type': 'Functionality',
    'Case ID': nextId(),
    'Title': `Verify ${form.name} prevents duplicate submission when "${submit}" is clicked twice quickly`,
    'Instructions': `Fill the form and double-click "${submit}" rapidly. Confirm only one request is sent.`,
    'Test Data': sampleList || 'All fields with valid data',
    'Testing Device': ALL_DEVICES,
    'Pre-Condition': `The user is on the page: ${url}.`,
    'Steps':
      `1. Open the page: ${url}\n` +
      `2. Fill all fields with valid data\n` +
      `3. Double-click the "${submit}" button as fast as possible\n` +
      `4. Watch if the button becomes disabled or shows a loading spinner`,
    'Expected Result': `Only one submission is sent. The "${submit}" button is either disabled or shows a loading state after the first click, preventing a second request.`,
    'Post Conditions': 'A single record is created. No duplicate data is saved.'
  });

  // ── TC6: UI visual check ──────────────────────────────────────────
  const fNames = (form.fields || []).slice(0, 4).map(f => `"${fieldName(f)}"`).join(', ');
  tests.push({
    'Module/ Sub Module': mod,
    'Test Type': 'UI',
    'Case ID': nextId(),
    'Title': `Verify all fields in ${form.name} are visible and correctly labeled`,
    'Instructions': `Look at the form and check that every field has a clear label and proper styling`,
    'Test Data': `Fields to check: ${fNames || 'all form fields'}`,
    'Testing Device': ALL_DEVICES,
    'Pre-Condition': `The user is on the page: ${url}. The form is fully loaded.`,
    'Steps':
      `1. Open the page: ${url}\n` +
      `2. Look at the form — check that a label (text above or beside the field) is shown for each field: ${fNames || 'all fields'}\n` +
      `3. Click the "${submit}" button without filling anything — check that error messages appear near the correct fields (not somewhere random)\n` +
      `4. Open the page on a mobile phone — check that the form is not cut off and all fields are touchable`,
    'Expected Result': `Every field has a visible label. Error messages appear directly under the relevant field. On mobile, all fields fit the screen without horizontal scrolling.`,
    'Post Conditions': 'No data submitted. Page state unchanged.'
  });

  // ── TC7: UI – submit button state during loading ──────────────────
  tests.push({
    'Module/ Sub Module': mod,
    'Test Type': 'UI',
    'Case ID': nextId(),
    'Title': `Verify the "${submit}" button shows a loading state while the form is being submitted`,
    'Instructions': `Submit the form with valid data and observe the button while the page is loading`,
    'Test Data': sampleList || 'All fields with valid data',
    'Testing Device': ALL_DEVICES,
    'Pre-Condition': `The user is on the page: ${url}.`,
    'Steps':
      `1. Open the page: ${url}\n` +
      `2. Fill all fields with valid data\n` +
      `3. Click the "${submit}" button\n` +
      `4. Immediately look at the button before the page finishes loading`,
    'Expected Result': `While waiting for a response, the "${submit}" button shows a spinner, changes its text to something like "Loading…" or "Please wait…", or becomes greyed out/disabled. It does NOT stay fully clickable.`,
    'Post Conditions': 'After the response arrives, the button returns to normal or the page navigates.'
  });

  return tests;
}

// =====================================================================
// BUTTON / LINK TEST CASES  — action-aware expected results
// =====================================================================

/**
 * Infer what should happen after clicking a button from its label.
 * Returns { action, destination, expectedResult, postCondition, negExpected }
 */
function inferButtonAction(label, el) {
  const l = label.toLowerCase().trim();
  const section  = (el.sectionHeading || '').trim();
  const subject  = (el.subjectEntity  || '').trim();
  const entity   = subject || 'the item';
  const screen   = section || 'the relevant screen';

  // ── "Add to X" / "Add X" ──────────────────────────────────────────
  const addToMatch = l.match(/^add\s+to\s+(.+)$/);
  const addMatch   = l.match(/^add\s+(.+)$/);
  const destAdd    = addToMatch ? titleCase(addToMatch[1]) : (addMatch ? titleCase(addMatch[1]) : null);
  if (destAdd) {
    return {
      action:         `"${label}" is clicked`,
      destination:    destAdd,
      expectedResult: `${entity} is successfully added. Navigate to the "${destAdd}" screen/list — the ${subject ? `"${subject}"` : 'item'} should now appear there with the correct details.`,
      postCondition:  `The "${destAdd}" screen shows the newly added ${subject ? `"${subject}"` : 'entry'}.`,
      negExpected:    `Clicking "${label}" again on the same ${subject ? `"${subject}"` : 'item'} either shows a message like "Already in ${destAdd}" or is disabled — it should NOT add a duplicate.`
    };
  }

  // ── "Remove from X" / "Remove X" ─────────────────────────────────
  const removeFromMatch = l.match(/^remove\s+from\s+(.+)$/);
  const removeMatch     = l.match(/^remove\s+(.+)$/);
  const destRemove      = removeFromMatch ? titleCase(removeFromMatch[1]) : (removeMatch ? titleCase(removeMatch[1]) : null);
  if (destRemove) {
    return {
      action:         `"${label}" is clicked`,
      destination:    destRemove,
      expectedResult: `${entity} is removed. Navigate to the "${destRemove}" screen/list — the ${subject ? `"${subject}"` : 'item'} should NO LONGER appear there.`,
      postCondition:  `The "${destRemove}" screen does not contain ${subject ? `"${subject}"` : 'the removed entry'}.`,
      negExpected:    `If "${label}" is clicked when item is NOT in ${destRemove}, a message like "Item not found" or "Already removed" appears — no crash.`
    };
  }

  // ── "Delete" ──────────────────────────────────────────────────────
  if (/^delete|^remove$|^discard/.test(l)) {
    return {
      action:         `"${label}" is clicked`,
      destination:    screen,
      expectedResult: `A confirmation dialog appears asking "Are you sure you want to delete ${subject ? `"${subject}"` : 'this item'}?". After confirming, ${subject ? `"${subject}"` : 'the item'} is deleted and no longer visible on ${screen}.`,
      postCondition:  `${subject ? `"${subject}"` : 'The item'} does not appear anywhere in the list on ${screen}.`,
      negExpected:    `Clicking Cancel on the confirmation dialog does NOT delete anything — ${subject ? `"${subject}"` : 'the item'} remains on ${screen}.`
    };
  }

  // ── "Save" / "Update" / "Edit" ────────────────────────────────────
  if (/^save|^update|^edit|^apply|^confirm/.test(l)) {
    return {
      action:         `"${label}" is clicked`,
      destination:    screen,
      expectedResult: `Changes are saved successfully. A success message appears (e.g. "Saved successfully" or "Changes applied"). The updated data is visible on ${screen} when the page is refreshed.`,
      postCondition:  `The updated values are persisted. Refreshing the page still shows the saved changes.`,
      negExpected:    `Clicking "${label}" without making any changes either does nothing or shows "No changes to save". It does NOT create a duplicate record.`
    };
  }

  // ── "Export" / "Download" ─────────────────────────────────────────
  if (/^export|^download/.test(l)) {
    const format = l.includes('csv') ? 'CSV' : l.includes('pdf') ? 'PDF' : l.includes('excel') ? 'Excel' : 'file';
    return {
      action:         `"${label}" is clicked`,
      destination:    'Downloads folder',
      expectedResult: `A ${format} file is downloaded to the browser's downloads folder. The file opens correctly and contains the expected data from ${section || 'the current view'}.`,
      postCondition:  `The ${format} file contains all the visible records with the correct column headers and values.`,
      negExpected:    `If there is no data to export, clicking "${label}" shows a message like "No data available to export" instead of downloading an empty file.`
    };
  }

  // ── "Approve" / "Reject" / "Submit" ──────────────────────────────
  if (/^approve|^accept|^reject|^decline|^submit/.test(l)) {
    const outcome = /approve|accept/.test(l) ? 'approved' : /reject|decline/.test(l) ? 'rejected' : 'submitted';
    return {
      action:         `"${label}" is clicked`,
      destination:    screen,
      expectedResult: `${subject ? `"${subject}"` : 'The item'} status changes to "${outcome}". A success notification appears. On ${screen}, the status badge/label reflects the new state ("${outcome}").`,
      postCondition:  `Status is updated. Further actions that require a different status (e.g. re-approving) are blocked or hidden.`,
      negExpected:    `Clicking "${label}" on an already-${outcome} item shows "Already ${outcome}" or disables the button — it does NOT change the status again.`
    };
  }

  // ── "View" / "Open" / "Details" / "Preview" ──────────────────────
  if (/^view|^open|^detail|^preview|^show/.test(l)) {
    return {
      action:         `"${label}" is clicked`,
      destination:    `${subject ? `"${subject}" details` : 'details'} screen`,
      expectedResult: `A details panel, modal, or new page opens showing the full information for ${subject ? `"${subject}"` : 'the selected item'}. All fields display correct, up-to-date data.`,
      postCondition:  `The user can see all details. A "Back" or "Close" option returns them to ${screen}.`,
      negExpected:    `If the item has been deleted before clicking "${label}", an error like "Record not found" appears instead of crashing.`
    };
  }

  // ── "Search" / "Filter" / "Apply" ────────────────────────────────
  if (/^search|^filter|^find|^look/.test(l)) {
    return {
      action:         `"${label}" is clicked`,
      destination:    screen,
      expectedResult: `The list/table on ${screen} filters to show only matching results. If no results match, a "No results found" message is displayed — the page does NOT show a blank screen.`,
      postCondition:  `The filter state is visually indicated (active filter chip/badge). Clearing the filter restores the full list.`,
      negExpected:    `Searching for a term that does not exist shows "No results found" — NOT an error page or empty broken layout.`
    };
  }

  // ── Link ──────────────────────────────────────────────────────────
  if (el.href && !el.href.startsWith('javascript')) {
    const dest = el.href.length > 80 ? el.href.substring(0, 80) + '…' : el.href;
    return {
      action:         `"${label}" link is clicked`,
      destination:    dest,
      expectedResult: `The browser navigates to: ${dest}. The destination page loads fully with no "404 Not Found" error.`,
      postCondition:  `Pressing the browser Back button returns the user to the original page.`,
      negExpected:    null
    };
  }

  // ── Generic fallback ──────────────────────────────────────────────
  return {
    action:         `"${label}" is clicked`,
    destination:    screen || 'the next screen',
    expectedResult: `Clicking "${label}" produces a visible result — ${section ? `on the "${section}" screen` : 'on the page'}: a confirmation message, data update, or navigation occurs. No error message or blank screen appears.`,
    postCondition:  `The page reflects the outcome of the action correctly.`,
    negExpected:    null
  };
}

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function buildButtonTests(el, pageInfo) {
  const label = (el.label || el.text || '').trim().substring(0, 80);
  if (!label || label.length < 2) return [];

  const mod  = `${pageInfo.pageType} / ${el.sectionHeading || 'Controls'}`;
  const url  = pageInfo.url;
  const pre  = `The user is on the page: ${url}. The "${label}" button is visible${el.subjectEntity ? ` next to "${el.subjectEntity}"` : ''}.`;
  const info = inferButtonAction(label, el);
  const tests = [];

  // ── Primary action (Functionality) ───────────────────────────────
  tests.push({
    'Module/ Sub Module': mod,
    'Test Type': 'Functionality',
    'Case ID': nextId(),
    'Title': `Verify ${info.action} and produces the correct outcome`,
    'Instructions': `Click the "${label}" button and verify the expected result on ${info.destination}`,
    'Test Data': el.subjectEntity ? `Acting on: "${el.subjectEntity}"` : 'N/A',
    'Testing Device': ALL_DEVICES,
    'Pre-Condition': pre,
    'Steps':
      `1. Open the page: ${url}\n` +
      (el.subjectEntity ? `2. Find the row or card for "${el.subjectEntity}"\n` : `2. Find the "${label}" button on the page\n`) +
      `3. Click the "${label}" button\n` +
      `4. ${info.destination && info.destination !== 'the relevant screen'
          ? `Navigate to the "${info.destination}" screen/section`
          : 'Observe the result on the current page'}`,
    'Expected Result': info.expectedResult,
    'Post Conditions': info.postCondition
  });

  // ── Negative: duplicate action or missing data (if applicable) ───
  if (info.negExpected) {
    tests.push({
      'Module/ Sub Module': mod,
      'Test Type': 'Negative',
      'Case ID': nextId(),
      'Title': `Verify "${label}" handles an invalid or repeated action gracefully`,
      'Instructions': `Perform the "${label}" action when it should NOT be valid (e.g. already done, no selection) and verify a proper error is shown`,
      'Test Data': el.subjectEntity ? `Acting on: "${el.subjectEntity}" (already actioned)` : 'State: action already performed',
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': `${pre} The action has already been performed once (or no valid selection exists).`,
      'Steps':
        `1. Open the page: ${url}\n` +
        (el.subjectEntity
          ? `2. Find "${el.subjectEntity}" and perform the primary "${label}" action first\n`
          : `2. Perform the "${label}" action once successfully\n`) +
        `3. Try to click "${label}" again (or with no valid context)\n` +
        `4. Observe the message or behaviour`,
      'Expected Result': info.negExpected,
      'Post Conditions': 'No duplicate or corrupted data is created. The UI reflects the correct state.'
    });
  }

  return tests;
}



// =====================================================================
// PAGE-LEVEL TESTS  (navigation, API 404, layout)
// =====================================================================

function buildPageTests(pageInfo) {
  const url = pageInfo.url;
  const mod = `${pageInfo.pageType} / Page`;

  return [
    // Navigation links all work
    {
      'Module/ Sub Module': mod,
      'Test Type': 'Functionality',
      'Case ID': nextId(),
      'Title': `Verify all navigation menu links on the page open the correct pages`,
      'Instructions': `Click each link in the navigation bar one by one and verify each page loads`,
      'Test Data': 'N/A — check every visible navigation item',
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': `The user is on the page: ${url}. The navigation bar is visible.`,
      'Steps':
        `1. Open the page: ${url}\n` +
        `2. Look at the navigation menu at the top of the page\n` +
        `3. Click the first navigation link\n` +
        `4. Check the page loads correctly (no blank screen or "Page not found")\n` +
        `5. Click the browser Back button\n` +
        `6. Repeat steps 3–5 for each navigation link`,
      'Expected Result': `Every navigation link opens a working, fully-loaded page. No "404 Not Found" or blank pages appear.`,
      'Post Conditions': 'User returns to the starting page after pressing Back each time.'
    },

    // API 404 – broken resource
    {
      'Module/ Sub Module': mod,
      'Test Type': 'Functionality',
      'Case ID': nextId(),
      'Title': `Verify the page displays a friendly message when a required resource cannot be found (404)`,
      'Instructions': `Navigate to a page that does not exist and verify an appropriate error page appears`,
      'Test Data': `URL to test: ${url.replace(/\/$/, '')}/this-page-does-not-exist`,
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': 'The user has a working internet connection.',
      'Steps':
        `1. In the browser address bar, type: ${url.replace(/\/$/, '')}/this-page-does-not-exist\n` +
        `2. Press Enter\n` +
        `3. Look at what the page shows`,
      'Expected Result': `A user-friendly "Page not found" or "404" message is shown. It is NOT a blank screen or a raw error like "Cannot GET /this-page-does-not-exist". Ideally, a link to go back to the home page is shown.`,
      'Post Conditions': 'User can navigate back to the app using the provided link or the browser Back button.'
    },

    // UI responsive check
    {
      'Module/ Sub Module': mod,
      'Test Type': 'UI',
      'Case ID': nextId(),
      'Title': `Verify the page layout looks correct on both desktop and mobile screen sizes`,
      'Instructions': `View the page on a desktop and a mobile phone and check that nothing is cut off or broken`,
      'Test Data': 'Desktop (1440×900), Mobile (375×812 - iPhone size)',
      'Testing Device': ALL_DEVICES,
      'Pre-Condition': `The user is on the page: ${url}.`,
      'Steps':
        `1. Open the page: ${url} on a desktop browser\n` +
        `2. Check: text is readable, buttons are not overlapping, images load correctly\n` +
        `3. Open the same page on a mobile phone (or shrink the browser window to a narrow size)\n` +
        `4. Scroll through the entire page on mobile\n` +
        `5. Check: no content is cut off on the sides, buttons are large enough to tap, the menu works`,
      'Expected Result': `On desktop: the page looks clean and organized. On mobile: everything fits the screen without left-right scrolling and all buttons are tappable.`,
      'Post Conditions': 'No data changed. Page state is the same as when it was loaded.'
    }
  ];
}

// =====================================================================
// MAIN GENERATOR
// =====================================================================

function generateTestCases(pageData) {
  caseCounter = 1;
  const { pageInfo, forms, interactiveElements } = pageData;
  const all = [];

  // Form: Functionality + UI + Negative cases
  (forms || []).forEach(form => {
    all.push(...buildFormTests(form, pageInfo));
    all.push(...buildNegativeTests(form, pageInfo));
  });

  // Button / link test cases — limit to 6 unique, skip trivial labels
  const SKIP = new Set(['ok', 'cancel', 'close', 'dismiss', 'accept', 'no', 'yes', 'cookie']);
  const seenLabels = new Set();

  (interactiveElements || [])
    .filter(el => {
      const lbl = (el.label || el.text || '').toLowerCase().trim();
      if (!lbl || lbl.length < 3) return false;
      if (SKIP.has(lbl)) return false;
      if (seenLabels.has(lbl)) return false;
      seenLabels.add(lbl);
      return true;
    })
    .slice(0, 6)
    .forEach(el => all.push(...buildButtonTests(el, pageInfo)));

  // Page-level navigation + 404 + responsive
  all.push(...buildPageTests(pageInfo));

  return all;
}

// =====================================================================
// MESSAGE HANDLER
// =====================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GENERATE_TEST_CASES') {
    try {
      const testCases = generateTestCases(message.data);
      sendResponse({ success: true, testCases });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }
});

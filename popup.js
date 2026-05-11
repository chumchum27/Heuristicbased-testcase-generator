/**
 * TestCraft AI – Popup Script
 * Orchestrates scanning, generation, preview, and CSV export.
 */

'use strict';

// =====================================================================
// STATE
// =====================================================================
let generatedTestCases = [];
let pageData = null;

// =====================================================================
// DOM REFS
// =====================================================================
const metaDot        = document.getElementById('metaDot');
const metaUrl        = document.getElementById('metaUrl');
const statForms      = document.getElementById('statForms');
const statInputs     = document.getElementById('statInputs');
const statButtons    = document.getElementById('statButtons');
const statusArea     = document.getElementById('statusArea');
const statusIcon     = document.getElementById('statusIcon');
const statusTitle    = document.getElementById('statusTitle');
const statusDetail   = document.getElementById('statusDetail');
const progressWrap   = document.getElementById('progressWrap');
const progressBar    = document.getElementById('progressBar');
const breakdown      = document.getElementById('breakdown');
const countFunc      = document.getElementById('countFunc');
const countUi        = document.getElementById('countUi');
const countBoth      = document.getElementById('countBoth');
const countNeg       = document.getElementById('countNeg');
const previewWrap    = document.getElementById('previewWrap');
const previewBody    = document.getElementById('previewBody');
const btnGenerate    = document.getElementById('btnGenerate');
const btnDownload    = document.getElementById('btnDownload');
const btnClear       = document.getElementById('btnClear');
const genSpinner     = document.getElementById('genSpinner');
const btnGenerateIcon= document.getElementById('btnGenerateIcon');
const btnGenerateText= document.getElementById('btnGenerateText');
const totalCount     = document.getElementById('totalCount');

// Scope checkboxes
const scopeFunc   = document.getElementById('scope-func');
const scopeUi     = document.getElementById('scope-ui');
const scopeAccess = document.getElementById('scope-access');
const scopePerf   = document.getElementById('scope-perf');

// =====================================================================
// HELPERS
// =====================================================================

function setStatus(state, title, detail) {
  statusArea.classList.add('visible');
  statusTitle.textContent = title;
  statusDetail.textContent = detail;
  statusIcon.className = `status-icon ${state}`;
  const icons = { scanning: '⚡', success: '✅', error: '❌', idle: '💡' };
  statusIcon.textContent = icons[state] || '💡';
}

function setProgress(pct) {
  progressWrap.style.display = pct >= 0 ? 'block' : 'none';
  progressBar.style.width = `${pct}%`;
}

function setBtnLoading(loading) {
  btnGenerate.disabled = loading;
  genSpinner.style.display = loading ? 'inline-block' : 'none';
  btnGenerateIcon.style.display = loading ? 'none' : 'inline';
  btnGenerateText.textContent = loading ? 'Analyzing Page…' : 'Generate Test Cases';
}

function truncate(str, n = 55) {
  if (!str) return '–';
  return str.length > n ? str.substring(0, n) + '…' : str;
}

function getTypeBadge(type) {
  if (!type) return `<span class="badge-type func">Functionality</span>`;
  const t = type.toLowerCase();
  if (t.includes('/')) return `<span class="badge-type both">Func/UI</span>`;
  if (t === 'ui') return `<span class="badge-type ui">UI</span>`;
  if (t === 'negative') return `<span class="badge-type neg">Negative</span>`;
  if (t === 'api failure') return `<span class="badge-type api">API Fail</span>`;
  return `<span class="badge-type func">Functionality</span>`;
}

// =====================================================================
// INIT: Load page info on popup open
// =====================================================================

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Show page info
    metaDot.classList.add('active');
    metaUrl.textContent = tab.url || 'Unknown page';
    
    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    // Extract initial stats
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_PAGE_DATA' });
    if (response && response.success) {
      pageData = response.data;
      updateStats(pageData);
    }
  } catch (e) {
    metaUrl.textContent = 'Could not read page. Try reloading.';
  }
}

function updateStats(data) {
  if (!data) return;
  const totalFields = (data.forms || []).reduce((a, f) => a + (f.fields || []).length, 0);
  const buttons = (data.interactiveElements || []).filter(e => 
    ['button','a','submit'].includes(e.tagName) || e.type === 'button'
  ).length;

  statForms.textContent  = (data.forms || []).length;
  statInputs.textContent = totalFields;
  statButtons.textContent = buttons;
}

// =====================================================================
// GENERATE
// =====================================================================

async function generate() {
  try {
    setBtnLoading(true);
    setStatus('scanning', 'Scanning page…', 'Extracting DOM elements and metadata');
    setProgress(10);
    breakdown.classList.remove('visible');
    previewWrap.classList.remove('visible');
    btnDownload.disabled = true;
    btnClear.disabled = true;
    generatedTestCases = [];

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found.');

    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    setProgress(30);
    setStatus('scanning', 'Extracting elements…', tab.url);

    // Extract page data
    const extractResp = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_PAGE_DATA' });
    if (!extractResp || !extractResp.success) throw new Error(extractResp?.error || 'Extraction failed');

    pageData = extractResp.data;
    updateStats(pageData);
    setProgress(55);
    setStatus('scanning', 'Generating test cases…', 'Building comprehensive test matrix');

    // Generate test cases via background
    const genResp = await chrome.runtime.sendMessage({
      action: 'GENERATE_TEST_CASES',
      data: pageData
    });

    if (!genResp || !genResp.success) throw new Error(genResp?.error || 'Generation failed');

    let tests = genResp.testCases;

    // Apply scope filters
    tests = filterByScope(tests);

    generatedTestCases = tests;
    setProgress(90);

    // Update UI
    renderBreakdown(tests);
    renderPreview(tests);

    setProgress(100);
    setStatus('success', `${tests.length} test cases generated!`, `Scope: ${getScopeLabel()} | Page: ${pageData.pageInfo.pageType}`);

    totalCount.textContent = `Total: ${tests.length} cases`;
    btnDownload.disabled = false;
    btnClear.disabled = false;

    setTimeout(() => setProgress(-1), 1200);

  } catch (err) {
    setStatus('error', 'Error occurred', err.message || 'Unknown error');
    setProgress(-1);
    console.error('[TestCraft AI]', err);
  } finally {
    setBtnLoading(false);
  }
}

function filterByScope(tests) {
  const includeFunc   = scopeFunc.checked;
  const includeUi     = scopeUi.checked;
  const includeAccess = scopeAccess.checked;
  const includePerf   = scopePerf.checked;

  return tests.filter(t => {
    const type = (t['Test Type'] || '').toLowerCase();
    const mod  = (t['Module/ Sub Module'] || '').toLowerCase();

    if (mod.includes('accessibility') && !includeAccess) return false;
    if (mod.includes('performance') && !includePerf) return false;

    if (type === 'functionality' && !includeFunc) return false;
    if (type === 'ui' && !includeUi) return false;
    if (type === 'functionality/ui' && !includeFunc && !includeUi) return false;

    return true;
  });
}

function getScopeLabel() {
  const parts = [];
  if (scopeFunc.checked) parts.push('Func');
  if (scopeUi.checked) parts.push('UI');
  if (scopeAccess.checked) parts.push('A11y');
  if (scopePerf.checked) parts.push('Perf');
  return parts.join('+') || 'None';
}

// =====================================================================
// BREAKDOWN
// =====================================================================

function renderBreakdown(tests) {
  const func = tests.filter(t => t['Test Type'] === 'Functionality').length;
  const ui   = tests.filter(t => t['Test Type'] === 'UI').length;
  const both = tests.filter(t => t['Test Type'] === 'Functionality/UI').length;
  const neg  = tests.filter(t => t['Test Type'] === 'Negative').length;

  countFunc.textContent = func;
  countUi.textContent   = ui;
  countBoth.textContent = both;
  if (countNeg) countNeg.textContent = neg;

  breakdown.classList.add('visible');
  breakdown.classList.add('animate-in');
}

// =====================================================================
// PREVIEW TABLE
// =====================================================================

function renderPreview(tests) {
  previewBody.innerHTML = '';
  const preview = tests.slice(0, 5);

  preview.forEach(tc => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td title="${tc['Case ID']}">${tc['Case ID']}</td>
      <td>${getTypeBadge(tc['Test Type'])}</td>
      <td title="${tc['Title']}">${truncate(tc['Title'], 45)}</td>
      <td title="${tc['Module/ Sub Module']}">${truncate(tc['Module/ Sub Module'], 30)}</td>
    `;
    previewBody.appendChild(tr);
  });

  previewWrap.classList.add('visible');
  previewWrap.classList.add('animate-in');
}

// =====================================================================
// CSV EXPORT
// =====================================================================

const CSV_HEADERS = [
  'Module/ Sub Module',
  'Test Type',
  'Case ID',
  'Title',
  'Instructions',
  'Test Data',
  'Testing Device',
  'Pre-Condition',
  'Steps',
  'Expected Result',
  'Post Conditions'
];

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' | ');
  return `"${str}"`;
}

function downloadCSV() {
  if (generatedTestCases.length === 0) return;

  const rows = [CSV_HEADERS.join(',')];

  generatedTestCases.forEach(tc => {
    const row = CSV_HEADERS.map(h => escapeCSV(tc[h] || '')).join(',');
    rows.push(row);
  });

  const csvContent = rows.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const domain = pageData?.pageInfo?.domain || 'page';
  const pageType = pageData?.pageInfo?.pageType?.replace(/\//g, '-') || 'tests';
  const date = new Date().toISOString().split('T')[0];
  const filename = `TestCraft_${domain}_${pageType}_${date}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Visual feedback
  btnDownload.textContent = '✅ Downloaded!';
  setTimeout(() => { btnDownload.innerHTML = '⬇ Download CSV'; }, 2000);
}

// =====================================================================
// CLEAR
// =====================================================================

function clearResults() {
  generatedTestCases = [];
  pageData = null;
  breakdown.classList.remove('visible');
  previewWrap.classList.remove('visible');
  previewBody.innerHTML = '';
  statusArea.classList.remove('visible');
  btnDownload.disabled = true;
  btnClear.disabled = true;
  totalCount.textContent = '';
  statForms.textContent = '0';
  statInputs.textContent = '0';
  statButtons.textContent = '0';
  metaDot.classList.remove('active');
  metaUrl.textContent = 'Cleared. Click Generate to re-scan.';
}

// =====================================================================
// EVENT LISTENERS
// =====================================================================

btnGenerate.addEventListener('click', generate);
btnDownload.addEventListener('click', downloadCSV);
btnClear.addEventListener('click', clearResults);

// =====================================================================
// BOOT
// =====================================================================

document.addEventListener('DOMContentLoaded', init);

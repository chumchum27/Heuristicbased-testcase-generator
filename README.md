TestCraft AI – Chrome Extension Walkthrough
A Manifest V3 Chrome Extension that scans any live webpage and auto-generates a comprehensive, export-ready QA test case matrix.

🚀 How to Install
Open Chrome and go to chrome://extensions
Enable Developer Mode (toggle, top-right)
Click Load unpacked
Select the folder: c:\Users\ramsh\OneDrive\Desktop\test
The TestCraft AI icon appears in your toolbar
⚙️ How It Works
1. content.js — DOM Extractor
Injected into every page. Listens for EXTRACT_PAGE_DATA messages and returns:

Data	Details
Forms	All <form> elements with fields, labels, types, validation rules, submit buttons
Inputs	Standalone inputs outside forms (type, placeholder, required, aria attributes)
Buttons / Links	<button>, <a>, [role="button"], onclick elements
Navigation	<nav> items with href and text
Modals	[role="dialog"], .modal elements
Tables	Column headers and row counts
Page Info	URL, title, <h1>, domain, heuristic page type (Login, Dashboard, Checkout, etc.)
2. background.js — Generation Engine
Receives extracted page data and produces test cases across 6 categories:

Category	Test Types Generated
Form Fields	Happy path, required validation, type format, boundary/max-length
Form Level	Full submission, empty submission, loading state, navigation-away reset
Buttons/Links	Click action, hover/active UI state, href destination verification
Navigation	All links functional, responsive mobile menu
Accessibility	Keyboard navigation, WCAG 2.1 AA color contrast
Performance	FCP/LCP/TTI/CLS targets via Lighthouse
Cross-Browser	Chrome, Firefox, Edge, Safari rendering
3. popup.js — UI Controller
Scope filters: Toggle Functionality, UI, Accessibility, Performance independently
Stats panel: Shows detected form/input/button counts before generation
Live progress bar: Tracks scan → extract → generate phases
Breakdown chart: Count by test type (Functionality / UI / Functionality+UI)
Preview table: Shows first 5 generated cases inline
CSV export: BOM-prefixed UTF-8 CSV, filename auto-derived from domain_pageType_date.csv

📊 CSV Output Columns
Column	Description
Module/ Sub Module	Page type + form/section name
Test Type	Functionality | UI | Functionality/UI
Case ID	Auto-incremented TC-0001, TC-0002…
Title	Human-readable test title
Instructions	High-level what to do
Test Data	Concrete values (valid, invalid, boundary)
Testing Device	Desktop browsers + Mobile platforms
Pre-Condition	State before test starts
Steps	Numbered step-by-step instructions
Expected Result	Pass criterion
Post Conditions	State after test completes

🔒 Permissions Used
Permission	Reason
activeTab	Read the current tab's URL and inject scripts
scripting	Inject content.js into live pages
storage	Reserved for future settings persistence
host_permissions: <all_urls>	Allow scanning on any site

🗂️ Example Generated Test Cases
For a Login page with email + password fields:
Case ID	Type	Title
TC-0001	Functionality	Verify "Email" accepts valid input
TC-0002	Functionality	Verify "Email" shows error when left empty


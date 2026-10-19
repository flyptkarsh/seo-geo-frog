# Audit details and scoring

For current installation and contribution instructions, see the [project README](../README.md). These notes describe the audit behavior and feature history.

A dependency-free Chrome Manifest V3 extension. Click its toolbar button to open a native Chrome side panel and audit the current page. Chrome 116 or newer is required. GEO means generative engine optimization here.

## Install in Chrome

1. Extract `seo-geo-frog.zip`, or use the supplied `seo-geo-frog` folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. Open a website, click the extensions puzzle icon, and choose **SEO/GEO Frog**. Its audit opens alongside the page in Chrome’s side panel. Pin the frog icon for easier access.

After editing the extension, click its reload button on `chrome://extensions`.

## Individual finding grades (version 4.3)

Each improvement bullet and finding now displays a letter grade with a description. The available check outcomes map to **A = passed**, **C = needs contextual review**, and **F = issue detected**. Informational or missing results remain ungraded. B and D are not assigned to individual checks because these checks do not measure that level of distinction. Category A–F scores retain their existing weighted rubric. Finding grades are included in the report and in fix-prompt evidence.

## Glass appearance, icons, and improvement summary (version 4.2)

The side panel uses translucent glass surfaces, blurred backdrops, soft mint/blue/lilac gradients, rounded controls, and clear content layers. Reduced-transparency preferences and browsers without backdrop blur receive more opaque surfaces.

Interface icons come from **Lucide v1.59.0** and are bundled locally with the license in `../icons/lucide/LICENSE`. No network request is needed to load them. Your frog logo is retained.

The Overview includes **Top improvements**: up to four concise bullet points drawn from actual review items and issues. Concrete errors appear before review suggestions, then the list prioritizes likely crawl, rendering, and code concerns. It displays the number shown out of all actionable findings and is included in JSON exports. When no actionable checks exist, it says so without inventing recommendations.

## Visual refresh (version 4.1)

The compact panel now has a forest-green brand header, icon tabs, clearer finding cards, and a unified palette. Grade cards open their corresponding audit tab. The Overview highlights the number of actionable findings and links directly to the fix-prompt workflow. Scoring and audit behavior are unchanged.

## Compact side panel and tabs (version 4)

The frog toolbar button opens Chrome's native side panel alongside the website. It stays open while you interact with the page; Chrome controls the side and panel width through its side-panel settings/resize handle.

- **Overview**: compact A–F report card, finding totals, grade explanations, report export, and scope.
- **SEO / GEO**: relevant findings, meta tags, heading outline, and JSON-LD inspector.
- **Speed**: timing cards, speed findings, and heaviest recorded resources.
- **JS**: JavaScript findings and monitoring controls.
- **Fix prompts**: combined review/issue prompts with preview, copy, and download.

Findings default to **Needs attention**, showing only issues and review items. Choose **All statuses** to inspect passes and observations. Individual fix prompts stay inside the relevant findings. Tab controls support Left/Right arrows and Home/End for keyboard navigation.

Click **Reaudit** after interacting to refresh captured errors. Switching browser tabs or navigating clears the old report. Click the frog toolbar icon on a new site to grant temporary access before auditing. While the panel is open, navigation, reloads, and URL changes automatically reaudit the active page after loading. History API and hash changes are debounced for 700 ms. Switching tabs also attempts a fresh audit. New origins still require a toolbar click to grant access. The panel does not crawl background tabs. No broad site-access permission is added. The new `sidePanel` permission enables Chrome's native panel; `background.js` handles the toolbar click.

## Finding-level fix prompts (version 3.2)

Expand any **Review** or **Issue** finding and click **Generate fix prompt**. Review or edit the generated text, then click **Copy prompt** and paste it into Claude, Codex, Cursor, or another coding tool with your repository. The prompt names that finding, supplies its audit evidence and suggested action, includes relevant page context, and asks the tool to verify applicability, make a targeted fix, and test the result. Review items are not assumed to be confirmed bugs.

The main prompt panel defaults to **Review items**. Its selector can instead include **Issues** or **All actionable findings**. Preview/edit, copy, or download the chosen scope. Empty scopes disable copy/download. Individual prompts contain only the chosen finding; other metadata and diagnostics are explicitly context rather than requests for extra changes. Clipboard failures select the text for manual copying. Nothing is sent to a coding tool automatically.

## Category report card (version 3)

Five A–F cards grade **SEO**, **Structured data**, **GEO signals**, **Speed**, and **JavaScript** for the current page. Expand **How grades work & what lowered them** for every scored check, weight, deduction, and missing observation. Grades and breakdowns are included in JSON export and the Claude fix prompt.

Rubric v1 uses weighted checks: pass earns full credit, review half, issue zero. Unavailable and informational checks are excluded. The observed weight must cover at least 50% of the category's rubric; speed additionally requires two of TTFB, FCP, and LCP. Otherwise the card says **Insufficient data**. The rounded percentage maps to A 90–100, B 80–89, C 70–79, D 60–69, and F below 60.

SEO covers titles, description, canonical, crawl directives, HTTPS, headings, language, viewport, alternatives, and link labels. Structured data grades syntax/context/type hygiene; optional missing schema can lower that category without implying a ranking penalty. GEO uses readable text, topic heading, hierarchy, and crawl signals; author/date checks contribute only when article schema is detected. Speed grades observed timing and resource/image checks. JavaScript grades the available runtime window, observed long tasks, script-loading candidates, payload, and exposed HTTP failures. A window with no captured errors earns provisional runtime credit, not proof of a bug-free page.

These are this extension's diagnostic grades, not Google rankings, AI citation predictions, Lighthouse scores, or whole-site crawl results. Accessibility scoring is deferred.

## Performance and Claude fix brief (version 2)

A redesigned interface adds a local performance snapshot, prioritized findings, resource details, and an editable **Claude fix prompt**. The prompt includes observed issues, raw metadata/JSON-LD, runtime error locations/stacks when exposed, resource evidence, and instructions to verify root causes and test fixes in your repository. Copy it or download it as Markdown, then paste into Claude with your project. This extension does not send data to Claude or require an API key.

### Speed diagnostics

- Navigation TTFB, first contentful paint, and buffered LCP candidate where available.
- Recorded requests, exposed transfer/decoded sizes, heaviest resources, and slow requests.
- Potential parser-blocking scripts, script-initiated payload, and observed long tasks.
- Observed layout-shift sum, broken images, and oversized image candidates.
- HTTP resource errors where Resource Timing exposes status codes.

Measurements reflect the current local navigation and available browser buffers. They are not Lighthouse scores or field Core Web Vitals. The layout-shift sum is not session-window CLS; long-task excess is not Lighthouse TBT. Hidden sizes can undercount payloads. LCP may be unavailable after interaction. There is no finalized INP measurement.

### Runtime error monitoring

The first audit installs top-level page listeners for new JavaScript errors, unhandled promise rejections, and resource load failures. Leave the panel open, interact with the page, and click Reaudit to collect the results. Use **Stop JS monitoring** to remove listeners/observers. **Start JS monitoring** starts a new session and clears previous captured errors. Navigation also resets the session. At most 100 errors and 500 long tasks are retained in page memory.

Errors before activation, caught errors, console.error calls, and cross-origin iframe errors are not captured. Cross-origin script errors may expose only an opaque message. Monitoring executes in the page's main world; a page can tamper with its own diagnostics, so do not treat it as security evidence. No debugger attachment, console interception, or broad host permission is used.

## What it checks

- Title presence, duplicate titles, and title length heuristic.
- Description presence, duplicates, and length heuristic.
- Canonical URLs, robots meta directives, HTTPS, language, viewport, and hreflang inventory.
- Open Graph and Twitter card metadata, plus an inspector for all meta tags.
- H1s, heading hierarchy and full heading outline, readable text estimate, image alt attributes, and link labels.
- Every JSON-LD block: JSON parsing, context presence, nested entities and graphs, schema types, and basic Article attribution/date fields. Expand each block to inspect its contents.
- GEO observations: author attribution, publication/update dates, external references, and semantic content structure.

Filter by category or severity. Expand findings for evidence and suggested action. Export the complete snapshot as JSON. Audit again after navigating or changing the page.

**Issue** means a concrete problem detected by a narrow check, such as invalid JSON. **Review** means missing, unusual, restricted, or context-dependent information. **Pass** means that individual check passed. **Info** is an observation. These counts are not a ranking score.

## Scope and privacy

All analysis runs locally on the rendered top-level document and browser performance timeline. Runtime listeners remain active in that page until stopped or navigation. No API key, server, account, analytics, persistent storage, background crawler, or remotely loaded code is used. The service worker only opens the panel and requests a new audit. `activeTab` gives temporary access after a click; `scripting` runs the audit. Exported reports contain page URLs, metadata, headings, and raw structured data, so review them before sharing.

This audits one page, not an entire site. It does not inspect HTTP response headers/statuses, robots.txt, sitemaps, index coverage, server HTML versus rendered HTML, shadow DOM, cross-origin frames, link destination health, or field performance. It does not validate the full schema.org vocabulary, Google rich-result requirements, or whether structured data matches visible content. Use the linked official validators for deeper validation.

GEO findings are lightweight observations, not predictions of AI visibility or citations. Attribution and dates may not be relevant to every page. There is no universal special AI schema requirement. `llms.txt` is not scored.

Chrome blocks extension access to certain surfaces, including internal pages and the Chrome Web Store. Open a normal website and click the frog toolbar icon to audit it.

## Development and tests

The extension has no build step. Source files are `audit.js`, `diagnostics.js`, `grades.js`, `prompt.js`, `popup.js`, `popup.html`, `popup.css`, and `background.js`.

Tests use Node.js and jsdom. From the repository root:

```sh
npm ci
npm test
```

Tests cover audit edge cases, popup interactions, runtime monitoring lifecycle, resource evidence, and prompt generation using a simulated DOM and mocked Chrome APIs. They do not replace loading the extension in Chrome to verify browser integration.

## References

- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Google structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

- [MDN Resource Timing limitations](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)
- [MDN buffered performance observers](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/observe)

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

Social previews use local Simple Icons brand SVGs (CC0) for Facebook, LinkedIn and X. Cards approximate the rendered metadata; platform caches and crawler rendering may differ. Clicking Load image requests the page-specified image with no referrer. No audit is uploaded.

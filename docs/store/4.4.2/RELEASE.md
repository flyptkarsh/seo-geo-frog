# SEO/GEO Frog 4.4.2

This release adds AEO checks and practical writing tips, plus an overall page grade in the toolbar badge and overview. Badge colors follow the grade, and counts from the earlier implementation have been replaced by the overall letter. Navigation and failed audits clear stale grades.

The implementation is already on main in commits f7e80e3, 558bfa1, and 51b67d6. This release PR refreshes the store screenshots and repository overview image; it does not reintroduce those code changes.

## Store screenshots

All five 1280 × 800 images use the current extension UI with a controlled example page. Runtime errors are intentionally generated in the fixture; displayed performance values are local observations, not production benchmarks.

1. screenshot-overview.png — overall score and all six category grades.
2. screenshot-seo.png — AEO tips and unanswered-question finding.
3. screenshot-previews.png — search and social preview tools.
4. screenshot-speed.png — local performance measurements.
5. screenshot-fixes.png — evidence-based coding prompts.

## Validation

- 33 automated tests passed.
- Native Chromium verified badge letter, color, tooltip, and reset after navigation.
- Browser checks passed for Reaudit, retry recovery, all tabs, and layout at 320, 390, and 600 pixels.
- Upload ZIP files were compared byte-for-byte with runtime source files.
- Existing permissions remain activeTab, scripting, and sidePanel.

Automatic publication after Google approval is intended. Upload and review status must be verified in the Chrome Web Store dashboard; these notes do not claim approval.

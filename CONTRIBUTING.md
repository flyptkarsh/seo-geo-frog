# Contributing to SEO/GEO Frog

Pull requests are welcome from everyone. You can help with audit accuracy, bug fixes, documentation, preview rendering, and interface improvements.

## Workflow

1. Fork the repository and create a descriptive branch from `main`.
2. Run `npm ci` using Node.js 24.15+ (24.x LTS or 26+).
3. Make a focused change. Add regression coverage when changing audit or interaction behavior.
4. Run `npm test`.
5. Load the repository through **Load unpacked** on `chrome://extensions` and verify the affected behavior in Chrome.
6. Open a pull request describing the problem, solution, and verification. Include screenshots for visible UI changes and link any related issue.

Discuss substantial features or new permissions in an issue before implementing them. Accessibility auditing is a future feature; proposals should clearly define the supported checks and their limits.

## Design and privacy expectations

- Keep analysis local and permissions narrow. Do not add analytics, remote code, or automatic AI uploads.
- Treat inspected page content as untrusted. Render it as text and validate URLs before using them.
- Separate confirmed issues from contextual review suggestions. Do not claim ranking or AI-citation guarantees.
- Explain grading changes and keep insufficient-data states honest.
- Keep the panel compact, keyboard usable, and readable at narrow widths.
- Preserve third-party license notices.
- Use synthetic or public fixtures; do not commit credentials, private audit exports, or browsing histories.

For navigation or reaudit changes, check manual refresh after DOM changes, full-page navigation, SPA URL changes, switching tabs, a new origin requiring toolbar permission, and recovery after a failed audit. Automated tests use mocked APIs and cannot fully verify Chrome integration.

Contributions are submitted under the project's MIT license. Be constructive and respectful in issues and reviews.

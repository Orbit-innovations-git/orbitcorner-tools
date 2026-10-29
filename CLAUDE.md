# OrbitCorner Tools: project rules

WordPress plugin with free browser tools for orbitcorner.com (WordPress + Kadence theme + LiteSpeed Cache + All in One SEO). Tools are placed with `[orbit_tool name="…"]`. README.md explains every tool, the formulas and the five steps to add a tool; read it first.

## How to work

- Big jobs come as a brief with numbered phases. Do them in order, commit after each phase with a clear message, and stop to report (what was made, how it was tested, sizes, screenshots) unless told to continue.
- Never break an existing tool: its shortcode output, settings page, data and tests must keep working. `node tests/run-all.js` runs every test.
- Bump the plugin version in both the header and `OC_TOOLS_VERSION`. Never commit secrets.

## Code rules

- Plain PHP + vanilla JavaScript + CSS. No build step, npm, frameworks, jQuery, libraries, web fonts or CDN. The folder must work as-is when zipped.
- Everything runs in the visitor's browser: no network requests from a tool, no cookies, and no tracking beyond the shared `tool_used` event (below).
- PHP: `ABSPATH` check in every file; escape all output (`esc_html`, `esc_attr`, `esc_url`); sanitize and whitelist all input; prefix everything `oc_tools_` / `oc-`.
- JavaScript: ES5 syntax (no `let`/`const`/arrows/template literals) plus `Intl`, `URLSearchParams`, `Blob`, `navigator.clipboard`, `navigator.share` with fallbacks; an IIFE with `'use strict'`; no `eval`; no `console.log`; escape anything that goes into `innerHTML` (prefer `textContent`).
- CSS: everything scoped under `.oc-app`, one section per tool in `assets/oc-tools.css`. The only rules allowed outside `.oc-app` are print rules that hide the theme on a tool's page.
- Match the surrounding style: 2-space JS/CSS, tabs in PHP, plain short comments.

## Folder structure

```
orbitcorner-tools.php      registry, shortcode, related tools, JSON-LD, settings page
uninstall.php
data/rates.json            take-home data (only sent to tools with 'rates' => true)
assets/oc-tools.css        all styles
assets/oc-tools.js         shared script on every tool page: the tool_used analytics event
tools/<name>/              one folder per tool
includes/page-generator.php  Tools → OrbitCorner Pages: generated search pages for the countdown
tests/                     Node and PHP tests, run-all.js, wp-stand-ins.php, previews (not shipped in the zip)
```

## The per-tool pattern (copy tools/time-card)

| File | Job |
|---|---|
| `tools/<name>/<name>-calc.js` | Pure math, no DOM. `window.OC…Calc` in the browser, `module.exports` in Node. Never returns NaN. |
| `tools/<name>/<name>.php` | `options` (whitelist shortcode attributes) and `render` (prints the full tool and its default result as real HTML, with `data-…` hooks). |
| `tools/<name>/app.js` | Enhances the printed HTML in place: reads inputs, calls the calc module, updates text. Never rebuilds the DOM on load. |
| `tests/<name>.test.js` | Plain Node `assert` tests for the calc module, picked up by `tests/run-all.js`. PHP logic gets `tests/<name>.test.php` (run too when PHP is installed). |
| `php tests/build-preview.php <name> [attr=value…]` → `tests/preview-<name>.html` | The real shortcode output with the WordPress stand-ins in `tests/wp-stand-ins.php`, so the preview opens as a file. |

Register the tool in `oc_tools_registry()` (`title`, `description`, `folder`, `scripts`, `render`, `options`, `min_height`), add it to `oc_tools_related_map()` when its page is live. Related links use the real page slugs (`/tools/take-home-pay/`, `/tools/time-card-calculator/`, `/tools/countdown/`), and `oc_tools_related_html()` skips any whose page isn't published, so the list never links to a 404.

## Analytics event (tool_used)

- Lives only in `assets/oc-tools.js`, enqueued by the shortcode for every tool. Tools never call analytics themselves.
- The first `input` or `change` event (trusted, capture phase) inside a `[data-oc-tool]` container sends `gtag('event', 'tool_used', { tool_name })` if `window.gtag` is a function, else `window.dataLayer.push({ event: 'tool_used', tool_name })` if `dataLayer` exists, else nothing. Then the listeners are removed: one event per page view.
- `tool_name` is the shortcode name (checked against `^[a-z0-9_-]{1,40}$`), the only value ever sent: never what was typed, no IDs. Nothing at all when `navigator.doNotTrack === '1'`. Everything inside try/catch.
- Don't add parameters or events without the owner asking. `tests/tool-used.test.js` runs the real file in a sandbox; README explains the GA4 / Tag Manager setup.

## Countdown & Date Tool and the page generator

- `tools/countdown/`: four modes (time, date, from, between) in one tool; attributes `mode`, `target`, `holiday`, `label`, `days`, `tabs` (README has the table). `tabs="0"` is a focused page: one mode, a computed paragraph, "More date tools" links, no related-tools list.
- The server renders in `America/New_York` and labels it; the browser redoes it in the visitor's zone. Never read the clock inside `countdown-calc.js`: every function takes `now`. Calendar dates are Dates at 12:00 local.
- The holiday list exists twice, in `countdown-calc.js` and `countdown.php`; change both and keep `tests/page-generator.test.php` passing.
- **Fake clock:** test any moment with `tests/preview-countdown.html?ocnow=2026-12-31T23:59:50` (the Fake now field). It sets `data-oc-now` on the container; `app.js` offsets its clock by it and keeps ticking. The shortcode never prints it. Run edge cases in headless Chrome with `Emulation.setTimezoneOverride` (America/New_York for DST nights).
- One `setInterval` per page for all live counters, stopped on `visibilitychange`; values always come from the clock. The live region says only the headline, when it changes (once a minute) or after typing stops.
- Generator: sets in `oc_tools_page_sets()` (filterable), drafts in batches of 50 under hub pages, pages marked with `_oc_tools_page_set` / `_oc_tools_page_key` / `_oc_tools_page_label` meta. Static parts go in `post_content` as core blocks; anything that depends on today comes from the shortcode. All-digit slugs are kept (`pre_wp_unique_post_slug`) and routed (`request`). Admin actions: `manage_options` + nonce via `admin-post.php`.

## Budgets (hard limits)

- A tool's calc + app JavaScript together ≤ 25 KB unminified; loaded only on pages with its shortcode, in the footer.
- A tool's CSS ≤ 12 KB.
- No images; inline SVG icons ≤ 1 KB each.
- No layout shift: the shortcode prints the full tool, and `min_height` (phone and desktop) is set a little under the heights measured in the preview.

Check with `wc -c tools/<name>/*.js`, and measure layout shift and heights in headless Chrome (`/usr/bin/google-chrome`).

Known exception: the countdown's JavaScript is 30.9 KB (10.1 KB gzipped), over the 25 KB limit (its brief asked for 22 KB). It is four tools plus the holiday engine; getting under means dropping features, which is the owner's call. Don't let it grow.

## UI and accessibility rules

- Goals in order: simple on a phone, fast, accurate, accessible, good for search. A useful answer must show within seconds, from defaults.
- Instant recalculation, no Calculate button. Plain US language and formats: 3:30 PM, $1,234.50, 42.50 hours (42 h 30 m).
- Inline errors under the field that say how to fix it, with `aria-invalid` and `aria-describedby`; keep the last good result visible, dimmed.
- WCAG 2.2 AA: a visible label or `aria-label` on every input; logical Tab order; 3px `:focus-visible` ring; one `aria-live="polite"` region announcing only the headline, debounced; text 4.5:1, borders and icons 3:1; meaning never by color alone; targets ≥ 44×44px with 8px gaps; works at 320px and 200% zoom without sideways scrolling; no motion under `prefers-reduced-motion`; borders and focus visible in `forced-colors`.

## Design system

| Token | Value |
|---|---|
| Primary / hover | `#5B5BF6` / `#4338CA` |
| Headings / body / muted | `#0F172A` / `#475569` / `#64748B` |
| Borders (decorative) / page / card | `#E2E8F0` / `#F8FAFC` / `#FFFFFF` |
| Form borders (3:1) | `#8291A6` |
| Positive / positive text | `#14B8A6` / `#0F766E` |
| Notices | `#F59E0B` with `#92400E` text |
| Error text and borders | `#B91C1C` |

Font inherited from the theme (Inter). Cards 16px radius; inputs and buttons 12px radius, 48–52px tall, 16–18px text; the result number 40px / 800 (32px on phones); `font-variant-numeric: tabular-nums` on numbers; 8px spacing grid; only 150ms hover/focus transitions. The tool is a size container (`container: oc-app`): use container queries for layout so it adapts to the content width.

## Release

```bash
node tests/run-all.js && php -l orbitcorner-tools.php
git archive --format=zip --prefix=orbitcorner-tools/ -o ../orbitcorner-tools.zip HEAD -- . ':(exclude)tests' ':(exclude).gitignore' ':(exclude)README.md' ':(exclude)CLAUDE.md' ':(exclude).DS_Store'
```

Then in WordPress: Plugins → Add New → Upload Plugin → Replace current with uploaded, and purge LiteSpeed Cache.

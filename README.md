# OrbitCorner Tools

A WordPress plugin that adds free, interactive tools to [orbitcorner.com](https://orbitcorner.com/tools/). You place a tool on any page or post with a shortcode.

| Tool | Shortcode | For |
|---|---|---|
| [Time Card Calculator](#time-card-calculator) | `[orbit_tool name="time-card"]` | US hourly workers, shift workers and managers: weekly hours, breaks, overtime and gross pay |
| [Freelancer Take-Home Calculator](#freelancer-take-home-calculator) | `[orbit_tool name="take-home"]` | Freelancers in Pakistan: what reaches the bank after fees, exchange rates and tax |

Everything runs in the visitor's browser. The tools send no data anywhere, set no cookies and load nothing from other websites. Results are estimates, and the tools say so.

---

## Install

1. Get the zip: use `orbitcorner-tools.zip` (see [Build the zip](#build-the-zip)). The folder inside the zip must be called `orbitcorner-tools`.
2. In WordPress, go to **Plugins → Add New Plugin → Upload Plugin**.
3. Choose the zip, click **Install Now**, then **Activate**.

## Update

1. Build a new zip.
2. Go to **Plugins → Add New Plugin → Upload Plugin** and upload it.
3. Choose **Replace current with uploaded**.
4. Clear LiteSpeed Cache (**LiteSpeed Cache → Toolbox → Purge All**).

Your saved rates and fees are kept when you update. They live in the database, not in the plugin files.

## Use

Add a **Shortcode** block to any page or post and paste a shortcode from the table above.

- The plugin's CSS and JavaScript load only on pages that use the shortcode, and the scripts load in the footer.
- **Settings → OrbitCorner Tools** lists every tool's shortcode.
- In Kadence, use the normal content width for tool pages, not "Narrow".

---

## Time Card Calculator

Answers "How many hours did I work this week, and what's my pay?" A visitor sees a typical week (Monday–Friday, 9:00 AM–5:00 PM, 30-minute breaks = **37.50 hours**) as soon as the page loads, then changes the times.

- A week table, Monday to Sunday: start, end, break and hours for each day. On phones each day becomes a card.
- Up to 2 shifts a day (**+ Add shift**). Night shifts: when End is before Start, "Ends the next day" appears, already ticked.
- Settings: hourly rate (optional), overtime rule, overtime pay (1.5× by default), rounding, and whether breaks are deducted.
- Results: total hours (as 42.50 and 42 h 30 m), regular, overtime and double-time hours, and pay if a rate is entered. Lines that are zero are hidden.
- Inline errors under the field that needs fixing. While a field has an error, the last good result stays visible, dimmed.
- **Copy** (plain-text summary), **Share** (a link that restores the week), **Print** (a one-page time sheet with optional Name and Week of) and **Download CSV**.

The shortcode prints the whole form and the default result as real HTML, so search engines and visitors without JavaScript see a complete time card. The JavaScript then takes over the same elements; nothing moves when it loads (layout shift 0).

### Shortcode options

All are optional. Invalid values are ignored.

| Attribute | Values | Default | Example |
|---|---|---|---|
| `rate` | Hourly rate in dollars, above 0 | empty (hours only) | `rate="18.50"` |
| `ot` | `weekly`, `daily`, `california`, `none` | `weekly` | `ot="california"` |
| `rounding` | `0`, `5`, `6`, `15` (minutes) | `0` | `rounding="15"` |

```
[orbit_tool name="time-card" rate="20" ot="california" rounding="15"]
```

A page made for California workers can start with California overtime this way. Visitors can still change every setting.

### How the hours are worked out

For each shift:

1. **Shift length** = End − Start. If "Ends the next day" is ticked, 24 hours are added (10:00 PM–6:00 AM = 8 h).
2. **Break**: if "Deduct breaks" is on, the break is taken off. A break longer than the shift is an error.
3. **Rounding** (optional): the shift's total, after the break, is rounded to the nearest 5, 6 or 15 minutes. Exactly half rounds up (15-minute rounding: 7 min → 0, 8 min → 15).

A day's hours are the sum of its shifts. Then the overtime rule splits the week:

| Rule | Regular | Overtime (× overtime pay) | Double time (× 2) |
|---|---|---|---|
| **Weekly** (US federal) | up to 40 h a week | over 40 h a week | none |
| **Daily** | up to 8 h a day | over 8 h a day | none |
| **California** | up to 8 h a day, and up to 40 h a week | 8–12 h a day, plus regular hours over 40 a week | over 12 h a day |
| **No overtime** | all hours | none | none |

In California, hours already paid as daily overtime don't count again toward the weekly 40, so nothing is paid twice.

**Pay** (only with a rate): regular hours × rate, overtime hours × rate × overtime pay, double-time hours × rate × 2. Each line is rounded to the cent and gross pay is their sum. Hours show with 2 decimals (minutes ÷ 60).

**Warnings**: a shift over 16 hours shows "Monday has a shift over 16 hours. Check the times."

**Not included**: taxes and deductions, meal and rest break penalties, California's seventh-consecutive-day rule, state rules other than California, and rounding of clock-in and clock-out times (the tool rounds each shift's total). The result card says results are estimates.

**Sources**

- US federal overtime: Fair Labor Standards Act, 29 U.S.C. § 207(a): at least 1.5 times the regular rate for hours over 40 in a workweek. [US Department of Labor: Overtime Pay](https://www.dol.gov/agencies/whd/overtime)
- California: Labor Code § 510: 1.5 times for hours over 8 in a day or 40 in a week, 2 times for hours over 12 in a day. [California DIR: Overtime FAQ](https://www.dir.ca.gov/dlse/faq_overtime.htm)
- Rounding to 5, 6 or 15 minutes: 29 CFR 785.48(b). [eCFR § 785.48](https://www.ecfr.gov/current/title-29/section-785.48)

### Share links

Every change is saved in the page URL with `history.replaceState`, so the **Share** link (or just the address bar) restores the same week. Invalid values in a link are ignored.

| Key | Meaning | Example |
|---|---|---|
| `mon` … `sun` | That day's shifts: `HHMM-HHMM-break`, a second shift after a `.` | `mon=0900-1700-30`, `fri=0600-1000.1400-1800` |
| `rate` | Hourly rate | `rate=20` |
| `ot` | Overtime rule | `ot=california` |
| `otx` | Overtime pay | `otx=2` |
| `rd` | Rounding in minutes | `rd=15` |
| `br` | `0` = breaks not deducted | `br=0` |
| `wk` | Week of (for printing) | `wk=2026-10-26` |

If any day key is in the URL, the whole week comes from the link (missing days are empty). Settings are only written when they differ from the page's defaults. The **Name** field is never put in the URL, so a shared link doesn't carry anyone's name.

### Download CSV

`time-card-YYYY-MM-DD.csv` (the "Week of" date, or today): the name and week, then one row per shift (Day, Shift, Start, End, Ends next day, Break, Hours), then the totals, pay and settings. It has a UTF-8 byte order mark so Excel reads it correctly, and text that starts with `=`, `+`, `-` or `@` is prefixed with `'` so it can't run as a formula.

### Search engines

The shortcode prints one `SoftwareApplication` JSON-LD block per page (name, description, `UtilitiesApplication`, `Web`, price 0). If All in One SEO also adds a SoftwareApplication schema to the page, remove one of them. Under the tool, a **Related tools** list links to other tools (see `oc_tools_related_map()` in `orbitcorner-tools.php`).

### The calculation module

`tools/time-card/time-card-calc.js` is `window.OCTimeCardCalc` in the browser and a Node module in the tests.

```js
OCTimeCardCalc.compute({
  days: [{ name: 'Mon', shifts: [{ in: '09:00', out: '17:00', nextDay: false, breakMin: 30 }] }, /* … 7 days */],
  rate: 20,              // or null
  otRule: 'weekly',      // 'weekly' | 'daily' | 'california' | 'none'
  otMultiplier: 1.5,     // 1 to 3
  rounding: 0,           // 0 | 5 | 6 | 15
  deductBreaks: true
});
// → {
//   days: [{ name, minutes, shifts: [{ minutes, rawMinutes, error, field }], error }],
//   totalMinutes, regularMinutes, overtimeMinutes, doubleMinutes, daysWorked,
//   otRule, otMultiplier, rate, pay: null | { regular, overtime, double, gross },
//   warnings: ['Monday has a shift over 16 hours. Check the times.'], hasErrors
// }
```

Times are 24-hour `"HH:MM"` strings, as `<input type="time">` gives them. A shift with an empty start or end is ignored. An invalid shift counts as 0, with `error` set to the message and `field` set to the input it belongs under (`in`, `out` or `breakMin`). The result never contains NaN. The module also has the parsers and US formatters the interface uses (`parseBreak`, `parseRate`, `formatHours`, `formatHM`, `formatMoney`, `formatTime`) and `encodeDay` / `decodeDay` for share links.

---

## Freelancer Take-Home Calculator

A freelancer in Pakistan enters what the client pays, and the calculator shows how many rupees reach their bank after:

- the platform fee (Upwork, Fiverr, or none for a direct client)
- withdrawal and transfer fees
- the weaker exchange rate that payment companies give
- the final tax on IT export income (PSEB-registered or not)

It ranks every withdrawal route from best to worst and shows a breakdown for each one. Visitors can share a result with **Copy link to this result**, for example `?amount=1000&platform=upwork&fee=10&pseb=0`.

### Update rates and fees

Go to **Settings → OrbitCorner Tools** (or click **Rates & fees** under the plugin on the Plugins screen).

- **Quick update:** change the USD → PKR market rate and the "Last checked" date. These two fields win over the same values in the JSON below them.
- **Advanced:** edit the full JSON to change platform fees, tax rates and withdrawal routes.
- Click **Save changes**. If the JSON has a mistake, nothing is saved. You get a message saying what's wrong, and your edit stays in the box for 5 minutes so you can fix it.
- **Reset to defaults** deletes your saved numbers and goes back to `data/rates.json` from the plugin.

After saving, clear LiteSpeed Cache if a page still shows the old numbers.

#### What the JSON contains

| Section | What it controls |
|---|---|
| `market_rate` | The USD → PKR rate shown by default, when you last checked it, and where to check it. |
| `tax` | Final tax rates: `pseb_rate_pct` (registered) and `non_pseb_rate_pct` (not registered). |
| `platforms` | Each platform's label and fee. Only platforms with `"fee_editable": true` (Upwork) let the visitor change the fee. |
| `routes` | Each way of getting money to a Pakistani bank or wallet. |

Each route has:

- `platforms`: which platforms it applies to.
- `flat_fee_usd` and `fee_pct`: the withdrawal or transfer fee in dollars and in percent.
- `fx_markup_pct`: how far below the market rate the route converts.
- `speed` and `note`: text shown to visitors.
- `verify`: your own reminder that the numbers still need checking.

`flat_fee_usd_by_platform` and `fee_pct_by_platform` override a route's fee for one platform. For example, JazzCash costs an extra $1 when the money comes from Fiverr.

#### Data to verify before launch

Every route in `rates.json` is marked `"verify": true`. Before you launch:

- [ ] **Payoneer:** fee and exchange-rate markup when withdrawing USD to a Pakistani bank in PKR (payoneer.com).
- [ ] **Payoneer:** fee for receiving a payment from a direct client (currently 1%).
- [ ] **Upwork:** withdrawal fee and exchange rate for direct-to-local-bank in Pakistan (support.upwork.com).
- [ ] **Fiverr:** withdrawal fees for Pakistan, both to Payoneer and to a local bank (fiverr.com).
- [ ] **JazzCash:** fee for Payoneer → JazzCash transfers, and JazzCash's exchange rate (jazzcash.com.pk).
- [ ] **Wise:** whether Wise can receive payments for a Pakistani account, and its fee (wise.com).
- [ ] **Tax:** 2026-27 final tax rates for PSEB-registered and non-registered IT/ITES exporters (fbr.gov.pk, pseb.org.pk).

For each route, check the numbers on the official site and fix any that changed, either in **Settings → OrbitCorner Tools** or in `data/rates.json` for the defaults. Then set its `verify` to `false`, and update the `last_checked` dates under `market_rate` and `tax`.

---

## Add a new tool in five steps

The time card is the pattern to copy.

1. **The math.** Create `tools/<name>/<name>-calc.js`: pure functions, no page access, `window.OC…Calc` in the browser and `module.exports` in Node. Write `tests/<name>.test.js` next to the others and run `node tests/run-all.js`.
2. **The HTML.** Create `tools/<name>/<name>.php` (with the `ABSPATH` check) with an `options` function that cleans the tool's shortcode attributes and a `render` function that prints the whole tool with its default result, escaping everything. Give elements `data-…` hooks for the script. `require_once` it at the top of `orbitcorner-tools.php`.
3. **The interface.** Create `tools/<name>/app.js`: find the printed elements, read the inputs, call the calc module and update text in place. Don't rebuild the HTML.
4. **Register it.** Add an entry to `oc_tools_registry()` in `orbitcorner-tools.php`:

   ```php
   'my-tool' => array(
       'title'       => 'My Tool',
       'description' => 'One or two sentences for search engines.',
       'folder'      => 'my-tool',
       'scripts'     => array( 'my-tool-calc.js', 'app.js' ), // Load order matters.
       'render'      => 'oc_tools_my_tool_render',
       'options'     => 'oc_tools_my_tool_options',
       'min_height'  => array( 'phone' => 0, 'desktop' => 0 ), // Fill in after step 5.
   ),
   ```

   If the tool takes new shortcode attributes, add them to the `shortcode_atts()` list in `oc_tools_shortcode()`. Add its page to `oc_tools_related_map()` once it's live.
5. **Style, preview and measure.** Add styles to `assets/oc-tools.css` under `.oc-app` in the tool's own section. Make a preview builder like `tests/build-preview.php`, open the preview at phone and desktop widths, and set `min_height` a little under the measured heights. Check the budgets (below), then build the zip.

Tools without a `render` function also work: the container shows "Loading…" and the script builds everything, like the take-home tool. Only tools with `'rates' => true` get `window.OCToolData`.

---

## Development

No build step and no npm packages. The folder works as-is.

```bash
# All tests (plain Node, no test framework)
node tests/run-all.js

# Time card preview: rebuild it from the real shortcode output, then open the file in a browser (no server needed)
php tests/build-preview.php
php tests/build-preview.php rate=20 ot=california   # with shortcode attributes

# Take-home preview (it fetches rates.json, so it needs a server)
python3 -m http.server 8000
# then open http://localhost:8000/tests/preview.html
```

**Budgets for each tool:** its two scripts together ≤ 25 KB unminified, its CSS ≤ 12 KB, no images (inline SVG icons ≤ 1 KB each), no layout shift on load. The time card is at 24.4 KB of JavaScript (8.0 KB gzipped) and 11.7 KB of CSS.

### Build the zip

From the plugin folder, after committing your changes:

```bash
git archive --format=zip --prefix=orbitcorner-tools/ -o ../orbitcorner-tools.zip HEAD -- . ':(exclude)tests' ':(exclude).gitignore' ':(exclude)README.md' ':(exclude)CLAUDE.md' ':(exclude).DS_Store'
```

This makes `../orbitcorner-tools.zip` with a single `orbitcorner-tools/` folder inside. It contains only committed files, without the tests, `.gitignore`, this README or `CLAUDE.md`.

### Files

```
orbitcorner-tools.php              plugin core: registry, shortcode, related tools, JSON-LD, settings page
uninstall.php                      deletes the saved settings when the plugin is deleted
data/rates.json                    take-home: default fees, tax rates and routes
assets/oc-tools.css                shared styles for all tools (one section per tool)
tools/take-home/calc.js            take-home: the calculation (no page access, tested in Node)
tools/take-home/app.js             take-home: builds the form and results
tools/time-card/time-card.php      time card: shortcode options and the HTML the shortcode prints
tools/time-card/time-card-calc.js  time card: the calculation (no page access, tested in Node)
tools/time-card/app.js             time card: enhances the printed form
tests/run-all.js                   runs every tests/*.test.js
tests/take-home.test.js            Node tests for the take-home calculation
tests/time-card.test.js            Node tests for the time card calculation
tests/preview.html                 take-home local preview
tests/build-preview.php            writes tests/preview-time-card.html from the real shortcode output
tests/preview-time-card.html       time card local preview (generated)
```

## Uninstall

Deactivating the plugin keeps your saved rates. Deleting it from the Plugins screen also deletes the saved rates.

## License

GPL-2.0-or-later

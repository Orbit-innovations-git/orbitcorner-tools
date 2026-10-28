# OrbitCorner Tools

A WordPress plugin that adds free, interactive tools to [orbitcorner.com](https://orbitcorner.com/tools/). You place a tool on any page or post with a shortcode.

The first tool is the **Freelancer Take-Home Calculator for Pakistan**. A freelancer enters what the client pays, and the calculator shows how many rupees reach their bank after:

- the platform fee (Upwork, Fiverr, or none for a direct client)
- withdrawal and transfer fees
- the weaker exchange rate that payment companies give
- the final tax on IT export income (PSEB-registered or not)

It ranks every withdrawal route from best to worst and shows a breakdown for each one.

Everything runs in the visitor's browser. The tool sends no data anywhere, sets no cookies and loads nothing from other websites. Results are estimates, and the tool says so.

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

Add a **Shortcode** block to any page or post and paste:

```
[orbit_tool name="take-home"]
```

Tips:

- The calculator uses two columns when it has at least about 820px of space, and one column otherwise. In Kadence, use the normal content width for the page, not "Narrow".
- You can put more than one calculator on a page.
- The plugin's CSS and JavaScript load only on pages that use the shortcode.
- Visitors can share a result with the **Copy link to this result** button. The link opens the calculator with the same inputs, for example `?amount=1000&platform=upwork&fee=10&pseb=0`.

## Update rates and fees

Go to **Settings → OrbitCorner Tools** (or click **Rates & fees** under the plugin on the Plugins screen).

- **Quick update:** change the USD → PKR market rate and the "Last checked" date. These two fields win over the same values in the JSON below them.
- **Advanced:** edit the full JSON to change platform fees, tax rates and withdrawal routes.
- Click **Save changes**. If the JSON has a mistake, nothing is saved. You get a message saying what's wrong, and your edit stays in the box for 5 minutes so you can fix it.
- **Reset to defaults** deletes your saved numbers and goes back to `data/rates.json` from the plugin.

After saving, clear LiteSpeed Cache if a page still shows the old numbers.

### What the JSON contains

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

## Data to verify before launch

Every route in `rates.json` is marked `"verify": true`. Before you launch:

- [ ] **Payoneer:** fee and exchange-rate markup when withdrawing USD to a Pakistani bank in PKR (payoneer.com).
- [ ] **Payoneer:** fee for receiving a payment from a direct client (currently 1%).
- [ ] **Upwork:** withdrawal fee and exchange rate for direct-to-local-bank in Pakistan (support.upwork.com).
- [ ] **Fiverr:** withdrawal fees for Pakistan, both to Payoneer and to a local bank (fiverr.com).
- [ ] **JazzCash:** fee for Payoneer → JazzCash transfers, and JazzCash's exchange rate (jazzcash.com.pk).
- [ ] **Wise:** whether Wise can receive payments for a Pakistani account, and its fee (wise.com).
- [ ] **Tax:** 2026-27 final tax rates for PSEB-registered and non-registered IT/ITES exporters (fbr.gov.pk, pseb.org.pk).

For each route, check the numbers on the official site and fix any that changed, either in **Settings → OrbitCorner Tools** or in `data/rates.json` for the defaults. Then set its `verify` to `false`, and update the `last_checked` dates under `market_rate` and `tax`.

## Add a new tool

1. Create a folder `tools/<name>/` with the tool's JavaScript. Look at `tools/take-home/` for the pattern: `calc.js` holds the math with no page access, and `app.js` builds the interface inside every `[data-oc-tool="<name>"]` element.
2. Add one entry to `oc_tools_registry()` in `orbitcorner-tools.php`:

   ```php
   'my-tool' => array(
       'title'   => 'My Tool',
       'folder'  => 'my-tool',
       'scripts' => array( 'calc.js', 'app.js' ), // Load order matters.
   ),
   ```

3. Put any styles in `assets/oc-tools.css`, under `.oc-app`.
4. Use `[orbit_tool name="my-tool"]` on a page.

The data from `rates.json` (or the saved settings) is available to every tool as `window.OCToolData`. Escape every string before putting it in `innerHTML`; `app.js` has an `esc()` helper.

## Development

No build step and no npm packages. The folder works as-is.

```bash
# Tests for the calculation (plain Node, no test framework)
node tests/take-home.test.js

# Preview the calculator without WordPress
python3 -m http.server 8000
# then open http://localhost:8000/tests/preview.html
```

### Build the zip

From the plugin folder, after committing your changes:

```bash
git archive --format=zip --prefix=orbitcorner-tools/ -o ../orbitcorner-tools.zip HEAD -- . ':(exclude)tests' ':(exclude).gitignore' ':(exclude)README.md'
```

This makes `../orbitcorner-tools.zip` with a single `orbitcorner-tools/` folder inside. It contains only committed files, without the tests, `.gitignore` or this README.

### Files

```
orbitcorner-tools.php      plugin core: shortcode, loading files, settings page
uninstall.php              deletes the saved settings when the plugin is deleted
data/rates.json            default fees, tax rates and routes
assets/oc-tools.css        shared styles for all tools
tools/take-home/calc.js    the calculation (no page access, tested in Node)
tools/take-home/app.js     the calculator's form and results
tests/take-home.test.js    Node tests for calc.js
tests/preview.html         local preview page
```

## Uninstall

Deactivating the plugin keeps your saved rates. Deleting it from the Plugins screen also deletes the saved rates.

## License

GPL-2.0-or-later

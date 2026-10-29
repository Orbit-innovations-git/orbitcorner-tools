# OrbitCorner Tools

A WordPress plugin that adds free, interactive tools to [orbitcorner.com](https://orbitcorner.com/tools/). You place a tool on any page or post with a shortcode.

| Tool | Shortcode | For |
|---|---|---|
| [Time Card Calculator](#time-card-calculator) | `[orbit_tool name="time-card"]` | US hourly workers, shift workers and managers: weekly hours, breaks, overtime and gross pay |
| [Countdown & Date Tool](#countdown--date-tool) | `[orbit_tool name="countdown"]` | Anyone in the US: how long until a time or date, days until holidays, days from today, days between dates. Powers the [generated search pages](#page-generator) |
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

1. **Rounding** (optional): each clock-in and clock-out time is rounded to the nearest 5, 6 or 15 minutes. Exactly half rounds up. With 15 minutes, 9:07 → 9:00 and 9:08 → 9:15, so 9:08 AM–5:07 PM counts as 9:15 AM–5:00 PM = 7.75 h, and 8:53 AM–5:08 PM as 9:00 AM–5:15 PM = 8.25 h.
2. **Shift length** = End − Start, after rounding. If "Ends the next day" is ticked, 24 hours are added (10:00 PM–6:00 AM = 8 h).
3. **Break**: if "Deduct breaks" is on, the break is taken off. A break longer than the shift as entered is an error. If rounding makes the shift shorter than the break, the shift counts as 0.

A day's hours are the sum of its shifts. Then the overtime rule splits the week:

| Rule | Regular | Overtime (× overtime pay) | Double time (× 2) |
|---|---|---|---|
| **Weekly** (US federal) | up to 40 h a week | over 40 h a week | none |
| **Daily** | up to 8 h a day | over 8 h a day | none |
| **California**, days 1–6 | up to 8 h a day, and up to 40 h a week | 8–12 h a day, plus regular hours over 40 a week | over 12 h a day |
| **California**, 7th day | none | the first 8 h | over 8 h |
| **No overtime** | all hours | none | none |

**California seventh day**: the 7th-day row applies only when all seven days, Monday to Sunday, have hours. Sunday is then the seventh day. A day whose only shift is invalid or adds up to 0 doesn't count as worked. Seven 8-hour days = 40 regular + 16 overtime (Sunday's 8, plus 8 of the 48 regular hours over the weekly 40). With a 10-hour Sunday, that day gives 8 overtime + 2 double time. With six days or fewer, every day uses the days 1–6 row.

In California, hours already paid as daily or seventh-day overtime don't count again toward the weekly 40, so nothing is paid twice.

**Pay** (only with a rate): regular hours × rate, overtime hours × rate × overtime pay, double-time hours × rate × 2. Each line is rounded to the cent and gross pay is their sum. Hours show with 2 decimals (minutes ÷ 60).

**Warnings**: a shift over 16 hours shows "Monday has a shift over 16 hours. Check the times."

**Not included**: taxes and deductions, meal and rest break penalties, state rules other than California, workweeks that don't start on Monday, and rounding of break times (breaks are entered in minutes). The result card says results are estimates.

**Sources**

- US federal overtime: Fair Labor Standards Act, 29 U.S.C. § 207(a): at least 1.5 times the regular rate for hours over 40 in a workweek. [US Department of Labor: Overtime Pay](https://www.dol.gov/agencies/whd/overtime)
- California: Labor Code § 510(a): 1.5 times for hours over 8 in a day, over 40 in a week and the first 8 hours on the seventh day of work in a workweek; 2 times for hours over 12 in a day and over 8 on the seventh day. [California DIR: Overtime FAQ](https://www.dir.ca.gov/dlse/faq_overtime.htm)
- Seventh day means the seventh day of one workweek, not seven days in a row across two weeks: *Mendoza v. Nordstrom, Inc.* (2017) 2 Cal.5th 1074.
- Rounding clock-in and clock-out times to the nearest 5 minutes, tenth or quarter of an hour: 29 CFR 785.48(b). [eCFR § 785.48](https://www.ecfr.gov/current/title-29/section-785.48)

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

Times are 24-hour `"HH:MM"` strings, as `<input type="time">` gives them. A shift with an empty start or end is ignored. A shift's `rawMinutes` are as entered; its `minutes` are after rounding and the break. An invalid shift counts as 0, with `error` set to the message and `field` set to the input it belongs under (`in`, `out` or `breakMin`). The result never contains NaN. The module also has the parsers and US formatters the interface uses (`parseBreak`, `parseRate`, `formatHours`, `formatHM`, `formatMoney`, `formatTime`) and `encodeDay` / `decodeDay` for share links.

---

## Countdown & Date Tool

Answers four everyday questions, each with an answer on screen as soon as the page loads:

| Tab | Question | Default answer |
|---|---|---|
| **Time** | "How long until 3:30 PM?" | A live countdown to the next 3:30 PM, with quick picks (9:00 AM … 10:00 PM) and how much of today is done. At zero it shows "It's 3:30 PM!" for 5 seconds, then counts to tomorrow's. |
| **Date** | "How many days until Christmas?" | A live countdown (days, hours, minutes, seconds) to the start of the date, the calendar days and weeks left, and the day of the year. Pick one of 26 holidays or any date, and give it a name. A past date shows "that was 12 days ago" and a **Count to … 2027** button. |
| **From today** | "What date is 75 days from today?" | The date that many days (or business days) after a start date, the date that many days before, the week number and day of the year. |
| **Between** | "How many days between two dates?" | Days, weeks, months, hours and the share of a year. If the end is before the start it counts backwards and says so. |

Every result has **Copy** and **Share**. Share puts the current tab's inputs in the page address and opens the phone's share sheet, or copies the link on a computer. Errors appear under the field ("Enter a time, like 3:30 PM", "Enter a date", "Enter a number up to 10,000") while the last good answer stays visible, dimmed.

The live counter's digits are hidden from screen readers. One polite live sentence ("2 hours and 14 minutes until 3:30 PM") is updated once a minute and after you stop typing. All countdowns on a page share one 1-second timer, which stops while the tab is hidden; every value comes from the clock, so it is right again the moment the tab comes back.

### Shortcode options

All are optional. Invalid values are ignored.

| Attribute | Values | Default | Example |
|---|---|---|---|
| `mode` | `time`, `date`, `from`, `between`: the tab that opens | `time` | `mode="from"` |
| `target` | For `time`: a time (`15:30`, `3:30 pm`). For `date`: `YYYY-MM-DD` | `15:30`; Christmas | `target="2027-06-12"` |
| `holiday` | A holiday key (table below), for `date`. Wins over `target` and moves to next year by itself | `christmas` | `holiday="halloween"` |
| `label` | A short name for the headline, for `date` (up to 40 characters) | the holiday's name | `label="Mom's birthday"` |
| `days` | Whole number from -10000 to 10000, for `from` | `30` | `days="75"` |
| `tabs` | `1` shows the four tabs. `0` shows only the chosen mode, plus a computed paragraph and "More date tools" links instead of the related-tools list | `1` | `tabs="0"` |

```
[orbit_tool name="countdown"]
[orbit_tool name="countdown" mode="date" holiday="4th-of-july" tabs="0"]
[orbit_tool name="countdown" mode="date" target="2027-06-12" label="Our wedding"]
[orbit_tool name="countdown" mode="from" days="90" tabs="0"]
```

A link like `/tools/countdown/?mode=between` opens that tab straight away (the page prints it already open).

### Time zones

- **Server:** the shortcode prints a real answer worked out in **Eastern Time** (`America/New_York`), with the line "Shown in Eastern Time until your browser loads". Search engines and visitors without JavaScript see it.
- **Browser:** the script redoes everything in the visitor's own time zone and replaces that line with "Times are in your time zone (America/Chicago)." Nothing moves on the page when it does (layout shift 0).
- **LiteSpeed Cache:** pages with the tool ask LiteSpeed to keep them only until the next midnight Eastern, so the printed "today" is never a day old.
- **Daylight saving:** countdowns count real time. At 1:00 AM on the night clocks spring forward, 3:00 AM is one hour away. A time that doesn't exist that night (2:30 AM) counts to when it would have been and says "That's at 3:30 AM today". Calendar dates never shift.
- **Midnight:** a From or Start date still on the default "today" moves to the new day at midnight, and holiday countdowns move on to next year once the day is over.

### How it counts

- **Days until a date** are calendar days: from Thursday to Friday is 1 day, whatever the time. The live counter counts to 12:00 AM at the start of the date.
- **Days from today:** day 1 is tomorrow. **Business days** skip Saturdays and Sundays only; holidays are not skipped (the tool says so).
- **Between:** the start date isn't counted unless you tick "Include the end date", which counts both ends (Jan 1 to Dec 31 = 364 days, or 365 with the end). Months and years are counted the way people count birthdays (the rule Java's `Period.between` uses): a month is complete when the day of the month reaches the start's, and leftover days count from the start moved on by the whole months, using the last day of a shorter month. So Jan 31 to Feb 28 = 0 months 28 days, Jan 31 to Mar 1 = 1 month 1 day (from Feb 28), and Feb 29, 2024 to Feb 28, 2026 = 1 year 11 months 30 days. Share of a year = days ÷ 365.
- **Week number** is the ISO 8601 week (weeks start on Monday; week 1 holds the year's first Thursday), so Jan 1, 2027 is in week 53.

### Holidays

| Key | Holiday | Rule |
|---|---|---|
| `new-years` | New Year's Day | Jan 1 |
| `mlk-day` | Martin Luther King Jr. Day | 3rd Monday of January |
| `super-bowl` | Super Bowl Sunday | 2nd Sunday of February (the NFL's pattern since 2022) |
| `valentines-day` | Valentine's Day | Feb 14 |
| `presidents-day` | Presidents' Day | 3rd Monday of February |
| `daylight-saving-starts` | Daylight Saving Time Starts | 2nd Sunday of March |
| `st-patricks-day` | St. Patrick's Day | Mar 17 |
| `spring` | First Day of Spring | Mar 20 (approximately) |
| `easter` | Easter | Western Easter, Anonymous Gregorian algorithm |
| `tax-day` | Tax Day | Apr 15 (not moved when it falls on a weekend) |
| `mothers-day` | Mother's Day | 2nd Sunday of May |
| `memorial-day` | Memorial Day | Last Monday of May |
| `juneteenth` | Juneteenth | Jun 19 |
| `fathers-day` | Father's Day | 3rd Sunday of June |
| `summer` | First Day of Summer | Jun 21 (approximately) |
| `4th-of-july` | 4th of July | Jul 4 |
| `labor-day` | Labor Day | 1st Monday of September |
| `fall` | First Day of Fall | Sep 22 (approximately) |
| `halloween` | Halloween | Oct 31 |
| `daylight-saving-ends` | Daylight Saving Time Ends | 1st Sunday of November |
| `thanksgiving` | Thanksgiving | 4th Thursday of November |
| `black-friday` | Black Friday | The day after Thanksgiving |
| `winter` | First Day of Winter | Dec 21 (approximately) |
| `christmas-eve` | Christmas Eve | Dec 24 |
| `christmas` | Christmas | Dec 25 |
| `new-years-eve` | New Year's Eve | Dec 31 |

Federal holidays are shown on their actual date, not the weekday they are observed on. A holiday counts as "today" all day, then moves to next year's date. The list is in `countdown-calc.js` (browser) and `countdown.php` (server); keep both the same. `tests/page-generator.test.php` checks a sample of server dates, and the two lists have been compared for every year from 1900 to 2199.

### Share links

| Key | Tab | Meaning | Example |
|---|---|---|---|
| `mode` | all | The open tab | `mode=date` |
| `t` | Time | Time, 24-hour | `t=15:30` |
| `h` | Date | Holiday key (its date is worked out on load, so the link stays current) | `h=thanksgiving` |
| `d` | Date | Date, when it isn't a holiday | `d=2027-06-12` |
| `l` | Date | Name, if it isn't the holiday's own | `l=Our%20wedding` |
| `n` | From today | Days | `n=75` |
| `biz` | From today | `1` = business days only | `biz=1` |
| `from` | From today | Start date (left out when it is today) | `from=2026-11-02` |
| `start`, `end` | Between | Dates (start left out when it is today) | `end=2026-12-31` |
| `inc` | Between | `1` = include the end date | `inc=1` |

### Testing with a fake clock

`php tests/build-preview.php countdown` writes `tests/preview-countdown.html`. Its **Fake now** field reloads the page with `?ocnow=2026-12-31T23:59:50`, which sets `data-oc-now` on the tool; the app then runs from that moment and the clock keeps ticking. The shortcode never prints `data-oc-now`, so it has no effect on the live site. Add shortcode attributes after the tool name, e.g. `php tests/build-preview.php countdown mode=from days=75 tabs=0`.

### The calculation module

`tools/countdown/countdown-calc.js` is `window.OCCountdownCalc` in the browser and a Node module in `tests/countdown.test.js`. It never reads the clock: every function takes `now`. It works in the local time zone, and calendar dates are Dates at 12:00 so adding days never trips over a daylight saving change.

`parseTime`, `formatTime`, `nextOccurrence(now, h, m)` → `{ target, isTomorrow }`, `diff(now, target)` → `{ totalMs, days, hours, minutes, seconds, isPast }`, `dayProgress`, `describe(parts[, spoken])`, `addDays(date, n, { businessDays })`, `addMonths`, `between(a, b, { includeEnd })` → `{ days, weeks, remDays, months, remMonthsDays, years, yearMonths, remYearsDays, backwards }`, `daysBetween`, `weekNumber`, `dayOfYear`, `daysLeftInYear`, `easter`, `holidays(year)` → `[{ key, name, date, approx }]`, `nextHoliday(now, key)`, and the US formats `formatDate(date, 'long' | 'medium' | 'short')`, `formatNumber`, `weeksDays`, `plural`, `iso`, `parseDate`.

---

## Page generator

**Tools → OrbitCorner Pages** creates search pages that use the countdown tool, as **drafts**, 50 at a time, under three hub pages. Only administrators see it, and every button is protected by a nonce.

| Set | Pages | Address | Title |
|---|---|---|---|
| How Long Until | 96: every 15 minutes from 12:00 AM to 11:45 PM (whole hours, then half hours, then quarter hours are generated first) | `/how-long-until/3-30-pm/` | How Long Until 3:30 PM? Live Countdown |
| Days From Today | 60: 1–30, 45, 60, 75, 90, 100, 120, 150, 180, 200, 250, 270, 300, 365, 500, 1000, then 35, 40, 50, 70, 80, 110, 130, 140, 160, 170, 190, 210, 240, 280, 320 | `/days-from-today/75/` | What Is 75 Days From Today? (Date Calculator) |
| Days Until | 26: one per holiday above | `/days-until/christmas/` | How Many Days Until Christmas 2026? |

**What a page contains.** The tool with `tabs="0"` (one mode), then core blocks you can edit: a sentence about the time (time pages), a note on how days are counted (days-from-today) or a short factual note about the holiday (days-until), a list of nearby pages (±15 and ±30 minutes; ±5, 10 and 15 days; the next 6 holidays), and a **Related** list (the hub, the Countdown & Date Calculator, the Time Card Calculator, and the Hours Calculator once a page exists at `/tools/hours-calculator/`). The sentences that depend on today ("75 days from today is January 12, 2027 (a Tuesday)…", "Christmas is on Friday, December 25, 2026. That's 57 days from today…") are printed by the shortcode on every page load, not saved in the page, and the browser refreshes them in the visitor's time zone.

**Buttons, per set:**

- **Hub page:** pick one, or leave "Create … automatically". The hub is created as a draft with a short intro and `[orbit_hub_list]`, which shows its published pages as a grid of links. **Create missing hub pages** at the top creates all three.
- **Generate next 50:** creates up to 50 missing pages as drafts. Addresses already used by another page are skipped and listed in the log.
- **Publish all drafts in this set:** asks first, then publishes every draft of the set, and the hub if it is still a draft.
- **Regenerate content:** asks first, then rewrites the content of every page of the set from the current template. Slugs, titles and status stay; edits to those pages' content are replaced.
- **Copy layout from** (top of the screen): new pages get that page's template and Kadence page settings, for example your tool page with the normal content width.

**Details:**

- WordPress normally renames an all-digit page slug like `75` to `75-2`; generated pages keep theirs, and `/days-from-today/75/` opens the page instead of "page 75 of the hub".
- Links in a page's lists to pages that aren't published yet are hidden until they are, so there are no broken links between batches.
- Days-until titles are saved without a year ("How Many Days Until Christmas?"); the year of the next occurrence is added when the title is shown, in the page and in the browser tab. Write a year into a title yourself and it is left alone.
- With All in One SEO active, generated pages get an SEO title ("… | OrbitCorner") and a description with today's answer ("75 days from today is Tuesday, January 12, 2027…"), unless you set your own in AIOSEO for that page. Without AIOSEO, the plugin prints `BreadcrumbList` JSON-LD (Home › Hub › Page); AIOSEO adds its own breadcrumbs, so it is not duplicated.
- Deleting the plugin removes the generator's settings but leaves the pages: they are your content. Add a set in code with the `oc_tools_page_sets` filter (see `includes/page-generator.php`).

### Launch checklist

1. Tools → OrbitCorner Pages: pick the layout page and save, then **Create missing hub pages**.
2. **Generate next 50** for one set (start with How Long Until). Open 5 drafts and check them.
3. **Publish all drafts in this set**, then purge LiteSpeed Cache (**LiteSpeed Cache → Toolbox → Purge All**).
4. Open 3 published pages in a private window.
5. Wait 14 days. In Search Console, check **Pages** (are they indexed?) and **Performance** (impressions, queries).
6. If they are being indexed, generate and publish the next 50 (or the next set). Repeat.

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
# All tests (plain Node, no test framework; also runs tests/*.test.php when PHP is installed)
node tests/run-all.js

# Previews: rebuild one from the real shortcode output, then open the file in a browser (no server needed)
php tests/build-preview.php                          # time card -> tests/preview-time-card.html
php tests/build-preview.php rate=20 ot=california    # with shortcode attributes
php tests/build-preview.php countdown                # countdown -> tests/preview-countdown.html (has a Fake now field)

# Take-home preview (it fetches rates.json, so it needs a server)
python3 -m http.server 8000
# then open http://localhost:8000/tests/preview.html
```

**Budgets for each tool:** its two scripts together ≤ 25 KB unminified, its CSS ≤ 12 KB, no images (inline SVG icons ≤ 1 KB each), no layout shift on load. The time card is at 24.6 KB of JavaScript (8.2 KB gzipped) and 11.7 KB of CSS. The countdown is at 30.9 KB of JavaScript (10.1 KB gzipped), over the budget: it is four tools and a 26-holiday engine in one (see the note in `CLAUDE.md`). Its CSS, with the hub grid, is 7.8 KB.

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
tools/countdown/countdown.php      countdown: shortcode options, server date math (Eastern Time) and the HTML it prints
tools/countdown/countdown-calc.js  countdown: the date math and holidays (no page access, tested in Node)
tools/countdown/app.js             countdown: enhances the printed tool, live counter, tabs, share links
includes/page-generator.php        Tools -> OrbitCorner Pages, [orbit_hub_list], titles, SEO and slug handling for generated pages
tests/run-all.js                   runs every tests/*.test.js (and *.test.php with PHP)
tests/countdown.test.js            Node tests for the countdown calculation
tests/page-generator.test.php      PHP tests for the generator's pages and the server's date math
tests/wp-stand-ins.php             stand-ins for WordPress functions, used by the preview builder and PHP tests
tests/take-home.test.js            Node tests for the take-home calculation
tests/time-card.test.js            Node tests for the time card calculation
tests/preview.html                 take-home local preview
tests/build-preview.php            writes tests/preview-<tool>.html from the real shortcode output
tests/preview-time-card.html       time card local preview (generated)
tests/preview-countdown.html       countdown local preview with a Fake now field (generated)
```

## Uninstall

Deactivating the plugin keeps your saved rates. Deleting it from the Plugins screen also deletes the saved rates and the page generator's settings. Pages the generator created stay.

## License

GPL-2.0-or-later

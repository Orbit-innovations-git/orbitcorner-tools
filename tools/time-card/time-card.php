<?php
/**
 * Time Card Calculator: shortcode options and the HTML the shortcode prints.
 *
 * The whole form, the default week and its result are printed here, so search engines and
 * visitors without JavaScript see a complete time card. app.js then enhances these same
 * elements in place (it finds them by their data-tc attributes); it never rebuilds them.
 *
 * @package OrbitCorner_Tools
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The shortcode attributes this tool accepts: rate, ot and rounding. Invalid values are dropped.
 *
 * @param array $atts Shortcode attributes.
 * @return array
 */
function oc_tools_time_card_options( $atts ) {
	$options = array();

	$rate = isset( $atts['rate'] ) ? ltrim( str_replace( ',', '', trim( (string) $atts['rate'] ) ), '$' ) : '';
	if ( preg_match( '/^\d+(\.\d+)?$/', $rate ) && (float) $rate > 0 && (float) $rate <= 1000000 ) {
		$options['rate'] = round( (float) $rate, 2 );
	}

	$ot = isset( $atts['ot'] ) ? sanitize_key( $atts['ot'] ) : '';
	if ( in_array( $ot, array( 'weekly', 'daily', 'california', 'none' ), true ) ) {
		$options['ot'] = $ot;
	}

	$rounding = isset( $atts['rounding'] ) ? trim( (string) $atts['rounding'] ) : '';
	if ( in_array( $rounding, array( '0', '5', '6', '15' ), true ) ) {
		$options['rounding'] = (int) $rounding;
	}

	return $options;
}

/**
 * The week shown before the visitor changes anything: Monday–Friday, 9:00 AM–5:00 PM, 30-minute breaks.
 *
 * @return array Seven days, each a list of shifts with 'in', 'out' and 'break'.
 */
function oc_tools_time_card_default_week() {
	$week = array();
	for ( $d = 0; $d < 7; $d++ ) {
		$week[] = $d < 5 ? array( array( 'in' => '09:00', 'out' => '17:00', 'break' => '30' ) ) : array();
	}
	return $week;
}

/**
 * Minutes worked on one day of the default week.
 *
 * Only needs to handle the default week: no night shifts, no overtime under any rule
 * (7.5 h a day, 37.5 h a week), and 450 minutes is a whole number of 5-, 6- and
 * 15-minute steps, so rounding changes nothing. time-card-calc.js does the real math.
 *
 * @param array $shifts The day's shifts.
 * @return int
 */
function oc_tools_time_card_day_minutes( $shifts ) {
	$minutes = 0;
	foreach ( $shifts as $shift ) {
		list( $in_h, $in_m )   = array_map( 'intval', explode( ':', $shift['in'] ) );
		list( $out_h, $out_m ) = array_map( 'intval', explode( ':', $shift['out'] ) );
		$minutes              += max( 0, ( $out_h * 60 + $out_m ) - ( $in_h * 60 + $in_m ) - (int) $shift['break'] );
	}
	return $minutes;
}

/**
 * "37.50"
 *
 * @param int $minutes Minutes.
 * @return string
 */
function oc_tools_time_card_hours( $minutes ) {
	return number_format( $minutes / 60, 2 );
}

/**
 * "7 h 30 m", "8 h", "45 m" (same as formatHM() in time-card-calc.js).
 *
 * @param int $minutes Minutes.
 * @return string
 */
function oc_tools_time_card_hm( $minutes ) {
	$h = intdiv( $minutes, 60 );
	$m = $minutes % 60;
	if ( $m && ! $h ) {
		return $m . ' m';
	}
	return $h . ' h' . ( $m ? ' ' . $m . ' m' : '' );
}

/**
 * "$20" or "$18.50" for the rate box and the settings summary.
 *
 * @param float $rate Hourly rate.
 * @return string Without the dollar sign.
 */
function oc_tools_time_card_rate_text( $rate ) {
	return preg_replace( '/\.00$/', '', number_format( $rate, 2, '.', ',' ) );
}

/**
 * Overtime rules as the settings summary names them.
 *
 * @return array
 */
function oc_tools_time_card_ot_summaries() {
	return array(
		'weekly'     => 'Weekly overtime over 40 h',
		'daily'      => 'Daily overtime over 8 h',
		'california' => 'California overtime',
		'none'       => 'No overtime',
	);
}

/**
 * The one-line settings summary, e.g. "Weekly overtime over 40 h · No rounding · $20/h".
 * app.js builds the same line in the browser.
 *
 * @param array $options Cleaned shortcode options.
 * @return string
 */
function oc_tools_time_card_summary( $options ) {
	$ot_text  = oc_tools_time_card_ot_summaries();
	$ot       = isset( $options['ot'] ) ? $options['ot'] : 'weekly';
	$rounding = isset( $options['rounding'] ) ? $options['rounding'] : 0;
	$parts    = array(
		$ot_text[ $ot ],
		$rounding ? $rounding . '-min rounding' : 'No rounding',
		isset( $options['rate'] ) ? '$' . oc_tools_time_card_rate_text( $options['rate'] ) . '/h' : 'No hourly rate',
	);
	return implode( ' · ', $parts );
}

/**
 * Inline SVG icon for the action buttons.
 *
 * @param string $name copy, share, print or download.
 * @return string Trusted markup.
 */
function oc_tools_time_card_icon( $name ) {
	$paths = array(
		'copy'     => '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
		'share'    => '<path d="M12 15V3M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
		'print'    => '<path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
		'download' => '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
	);
	return '<svg class="oc-tc-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . $paths[ $name ] . '</svg>';
}

/**
 * The tool's HTML: settings, the week table and the result card for the default week.
 *
 * @param string $uid     The container's id; every id inside starts with it.
 * @param array  $options Cleaned shortcode options (see oc_tools_time_card_options()).
 * @return string
 */
function oc_tools_time_card_render( $uid, $options ) {
	$days      = array( 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' );
	$week      = oc_tools_time_card_default_week();
	$minutes   = array_map( 'oc_tools_time_card_day_minutes', $week );
	$total     = array_sum( $minutes );
	$worked    = count( array_filter( $minutes ) );
	$rate      = isset( $options['rate'] ) ? $options['rate'] : null;
	$pay       = null !== $rate ? '$' . number_format( round( $total / 60 * $rate, 2 ), 2 ) : '';
	$ot        = isset( $options['ot'] ) ? $options['ot'] : 'weekly';
	$rounding  = isset( $options['rounding'] ) ? $options['rounding'] : 0;
	$site      = wp_parse_url( home_url(), PHP_URL_HOST );
	$ot_short  = oc_tools_time_card_ot_summaries();
	$ot_labels = array(
		'weekly'     => 'Weekly: over 40 hours (US federal)',
		'daily'      => 'Daily: over 8 hours',
		'california' => 'California: daily over 8, double over 12, weekly over 40',
		'none'       => 'No overtime',
	);
	$rd_labels = array(
		0  => 'No rounding',
		5  => '5 minutes',
		6  => '6 minutes',
		15 => '15 minutes',
	);
	$actions   = array(
		'copy'     => 'Copy',
		'share'    => 'Share',
		'print'    => 'Print',
		'download' => 'Download CSV',
	);

	ob_start();
	?>
<div class="oc-tc">
	<details class="oc-card oc-tc-set" data-tc="set">
		<summary><span class="oc-tc-set-title">Settings</span><span class="oc-tc-set-sum" data-tc="sum"><?php echo esc_html( oc_tools_time_card_summary( $options ) ); ?></span></summary>
		<div class="oc-tc-set-body">
			<div class="oc-tc-field">
				<label class="oc-label" for="<?php echo esc_attr( $uid . '-rate' ); ?>">Hourly rate ($)</label>
				<div class="oc-input-wrap"><span class="oc-affix" aria-hidden="true">$</span><input class="oc-input" type="text" inputmode="decimal" id="<?php echo esc_attr( $uid . '-rate' ); ?>" data-tc="rate" placeholder="optional" autocomplete="off" value="<?php echo esc_attr( null !== $rate ? oc_tools_time_card_rate_text( $rate ) : '' ); ?>" aria-describedby="<?php echo esc_attr( $uid . '-rate-hint' ); ?>"></div>
				<p class="oc-hint" id="<?php echo esc_attr( $uid . '-rate-hint' ); ?>">Add it to see your gross pay.</p>
				<p class="oc-tc-err" id="<?php echo esc_attr( $uid . '-rate-err' ); ?>" hidden></p>
			</div>
			<div class="oc-tc-field oc-tc-field-wide">
				<label class="oc-label" for="<?php echo esc_attr( $uid . '-ot' ); ?>">Overtime</label>
				<div class="oc-tc-select"><select id="<?php echo esc_attr( $uid . '-ot' ); ?>" data-tc="ot">
					<?php foreach ( $ot_labels as $value => $label ) : ?>
						<option value="<?php echo esc_attr( $value ); ?>" data-short="<?php echo esc_attr( $ot_short[ $value ] ); ?>"<?php selected( $ot, $value ); ?>><?php echo esc_html( $label ); ?></option>
					<?php endforeach; ?>
				</select></div>
			</div>
			<div class="oc-tc-field oc-tc-field-small">
				<label class="oc-label" for="<?php echo esc_attr( $uid . '-otx' ); ?>">Overtime pay</label>
				<div class="oc-input-wrap"><input class="oc-input" type="number" inputmode="decimal" id="<?php echo esc_attr( $uid . '-otx' ); ?>" data-tc="otx" value="1.5" min="1" max="3" step="0.25" autocomplete="off"><span class="oc-affix" aria-hidden="true">×</span></div>
				<p class="oc-tc-err" id="<?php echo esc_attr( $uid . '-otx-err' ); ?>" hidden></p>
			</div>
			<div class="oc-tc-field">
				<label class="oc-label" for="<?php echo esc_attr( $uid . '-rd' ); ?>">Round each shift to</label>
				<div class="oc-tc-select"><select id="<?php echo esc_attr( $uid . '-rd' ); ?>" data-tc="rd">
					<?php foreach ( $rd_labels as $value => $label ) : ?>
						<option value="<?php echo esc_attr( $value ); ?>"<?php selected( $rounding, $value ); ?>><?php echo esc_html( $label ); ?></option>
					<?php endforeach; ?>
				</select></div>
			</div>
			<div class="oc-tc-field oc-tc-field-check">
				<label class="oc-tc-check"><input type="checkbox" data-tc="br" checked> Deduct breaks</label>
			</div>
		</div>
	</details>

	<div class="oc-card oc-tc-main">
		<fieldset class="oc-tc-print">
			<legend class="oc-label">For printing (optional)</legend>
			<div class="oc-tc-print-fields">
				<div>
					<label class="oc-label" for="<?php echo esc_attr( $uid . '-name' ); ?>">Name</label>
					<input class="oc-tc-in" type="text" id="<?php echo esc_attr( $uid . '-name' ); ?>" data-tc="name" autocomplete="name">
				</div>
				<div>
					<label class="oc-label" for="<?php echo esc_attr( $uid . '-week' ); ?>">Week of</label>
					<input class="oc-tc-in" type="date" id="<?php echo esc_attr( $uid . '-week' ); ?>" data-tc="wk">
				</div>
			</div>
		</fieldset>

		<table class="oc-tc-table">
			<caption>This week's hours</caption>
			<thead>
				<tr><th scope="col">Day</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Break (min)</th><th scope="col">Hours</th></tr>
			</thead>
			<?php foreach ( $days as $d => $day ) : ?>
				<tbody class="oc-tc-day" data-tc-day="<?php echo esc_attr( $d ); ?>">
					<?php
					for ( $s = 0; $s < 2; $s++ ) :
						$shift  = isset( $week[ $d ][ $s ] ) ? $week[ $d ][ $s ] : array(
							'in'    => '',
							'out'   => '',
							'break' => '',
						);
						$p      = $uid . '-' . $d . '-' . $s;
						$prefix = $day . ( $s ? ' 2nd shift' : '' );
						?>
						<tr class="oc-tc-shift"<?php echo $s ? ' hidden' : ''; ?>>
							<th scope="row"><?php echo $s ? '<span class="oc-sr-only">' . esc_html( $day ) . ' </span>2nd shift' : esc_html( $day ); ?></th>
							<td data-label="Start">
								<input class="oc-tc-in" type="time" id="<?php echo esc_attr( $p . '-in' ); ?>" data-tc-f="in" value="<?php echo esc_attr( $shift['in'] ); ?>" aria-label="<?php echo esc_attr( $prefix . ' start time' ); ?>">
								<p class="oc-tc-err" id="<?php echo esc_attr( $p . '-in-err' ); ?>" hidden></p>
							</td>
							<td data-label="End">
								<input class="oc-tc-in" type="time" id="<?php echo esc_attr( $p . '-out' ); ?>" data-tc-f="out" value="<?php echo esc_attr( $shift['out'] ); ?>" aria-label="<?php echo esc_attr( $prefix . ' end time' ); ?>">
								<label class="oc-tc-check oc-tc-next" data-tc-f="wrap" hidden><input type="checkbox" data-tc-f="next" aria-describedby="<?php echo esc_attr( $p . '-next' ); ?>"> Ends the next day</label>
								<p class="oc-hint" id="<?php echo esc_attr( $p . '-next' ); ?>" data-tc-f="hint" hidden>Night shift: counted to the next day</p>
								<p class="oc-tc-err" id="<?php echo esc_attr( $p . '-out-err' ); ?>" hidden></p>
							</td>
							<td data-label="Break (min)">
								<input class="oc-tc-in" type="text" inputmode="numeric" autocomplete="off" id="<?php echo esc_attr( $p . '-brk' ); ?>" data-tc-f="breakMin" value="<?php echo esc_attr( $shift['break'] ); ?>" aria-label="<?php echo esc_attr( $prefix . ' break in minutes' ); ?>">
								<p class="oc-tc-err" id="<?php echo esc_attr( $p . '-brk-err' ); ?>" hidden></p>
							</td>
							<?php if ( $s ) : ?>
								<td class="oc-tc-hours"></td>
							<?php else : ?>
								<td class="oc-tc-hours" data-label="Hours"<?php echo $minutes[ $d ] ? ' title="' . esc_attr( oc_tools_time_card_hm( $minutes[ $d ] ) ) . '"' : ''; ?>><span data-tc-f="dec"><?php echo esc_html( $minutes[ $d ] ? oc_tools_time_card_hours( $minutes[ $d ] ) : '—' ); ?></span> <span class="oc-tc-hm" data-tc-f="hm"><?php echo esc_html( $minutes[ $d ] ? oc_tools_time_card_hm( $minutes[ $d ] ) : '' ); ?></span></td>
							<?php endif; ?>
						</tr>
					<?php endfor; ?>
					<tr class="oc-tc-tools">
						<td colspan="5">
							<button type="button" class="oc-tc-link" data-tc-act="add"><span data-tc-f="add">+ Add shift</span><span data-tc-f="remove" hidden>Remove 2nd shift</span><span class="oc-sr-only"> on <?php echo esc_html( $day ); ?></span></button>
							<button type="button" class="oc-tc-link" data-tc-act="clear">Clear<span class="oc-sr-only"> <?php echo esc_html( $day ); ?></span></button>
						</td>
					</tr>
				</tbody>
			<?php endforeach; ?>
		</table>

		<div class="oc-tc-below">
			<button type="button" class="oc-btn-outline" data-tc-act="clear-all">Clear all</button>
			<p class="oc-hint">Times are in your local 12-hour format.</p>
		</div>
		<noscript><p class="oc-app-error">Turn on JavaScript to add up your own hours. The example shows a typical week.</p></noscript>
		<p class="oc-tc-bar" aria-hidden="true">Total this week: <strong data-tc="bar"><?php echo esc_html( oc_tools_time_card_hours( $total ) ); ?> hours</strong></p>
	</div>

	<section class="oc-card oc-tc-result" aria-labelledby="<?php echo esc_attr( $uid . '-result' ); ?>" data-tc="result">
		<h2 class="oc-eyebrow" id="<?php echo esc_attr( $uid . '-result' ); ?>">Total this week</h2>
		<p class="oc-big"><span data-tc="total"><?php echo esc_html( oc_tools_time_card_hours( $total ) ); ?></span> hours</p>
		<p class="oc-tc-sub" data-tc="sub"><?php echo esc_html( oc_tools_time_card_hm( $total ) . ' across ' . $worked . ' days' ); ?></p>
		<p class="oc-tc-stale" data-tc="stale" hidden>Fix the highlighted field to update.</p>

		<table class="oc-breakdown">
			<caption class="oc-sr-only">Breakdown</caption>
			<tbody>
				<tr data-tc-line="reg"><th scope="row">Regular hours</th><td><?php echo esc_html( oc_tools_time_card_hours( $total ) ); ?></td></tr>
				<tr data-tc-line="ot" hidden><th scope="row">Overtime hours (×<span data-tc="xlabel">1.5</span>)</th><td></td></tr>
				<tr data-tc-line="dbl" hidden><th scope="row">Double-time hours (×2)</th><td></td></tr>
				<tr data-tc-line="regPay"<?php echo $pay ? '' : ' hidden'; ?>><th scope="row">Regular pay</th><td><?php echo esc_html( $pay ); ?></td></tr>
				<tr data-tc-line="otPay" hidden><th scope="row">Overtime pay</th><td></td></tr>
				<tr data-tc-line="dblPay" hidden><th scope="row">Double-time pay</th><td></td></tr>
				<tr data-tc-line="gross" class="oc-total oc-tc-gross"<?php echo $pay ? '' : ' hidden'; ?>><th scope="row">Gross pay</th><td><?php echo esc_html( $pay ); ?></td></tr>
			</tbody>
		</table>

		<ul class="oc-tc-mini" aria-label="Hours by day">
			<?php foreach ( $days as $d => $day ) : ?>
				<li data-tc-mini="<?php echo esc_attr( $d ); ?>"<?php echo $minutes[ $d ] ? '' : ' hidden'; ?>><?php echo esc_html( substr( $day, 0, 3 ) ); ?> <strong><?php echo esc_html( oc_tools_time_card_hours( $minutes[ $d ] ) ); ?></strong></li>
			<?php endforeach; ?>
		</ul>

		<div class="oc-tc-warn" data-tc="warn" hidden></div>
		<p class="oc-note" data-tc="note">Estimates only. Overtime depends on your employer's policy and state law. Taxes and deductions are not included.</p>

		<div class="oc-tc-actions">
			<?php foreach ( $actions as $act => $label ) : ?>
				<button type="button" class="oc-btn-outline" data-tc-act="<?php echo esc_attr( $act ); ?>"><?php echo oc_tools_time_card_icon( $act ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Fixed SVG markup. ?><?php echo esc_html( $label ); ?></button>
			<?php endforeach; ?>
			<p class="oc-copy-status" role="status" data-tc="status"></p>
			<div class="oc-copy-fallback" data-tc="fallback" hidden>
				<label class="oc-label" for="<?php echo esc_attr( $uid . '-copy' ); ?>">Copy this:</label>
				<textarea class="oc-tc-in" id="<?php echo esc_attr( $uid . '-copy' ); ?>" rows="4" readonly data-tc="copy"></textarea>
			</div>
		</div>
		<p class="oc-sr-only" aria-live="polite" data-tc="live"></p>
		<p class="oc-tc-gen">Generated<span data-tc="gen"></span> at <?php echo esc_html( $site ? $site : 'orbitcorner.com' ); ?></p>
	</section>
</div>
	<?php
	return ob_get_clean();
}

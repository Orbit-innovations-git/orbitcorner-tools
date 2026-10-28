<?php
/**
 * Countdown & Date Tool: shortcode options, the server's date math and the HTML the shortcode prints.
 *
 * The whole tool is printed with a real answer worked out in Eastern Time (most visitors are in
 * the US), so search engines and visitors without JavaScript see one. app.js then recalculates
 * in the visitor's own time zone and updates these same elements (found by data-cd attributes).
 *
 * @package OrbitCorner_Tools
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The time zone of the server-rendered answer.
 *
 * @return DateTimeZone
 */
function oc_tools_countdown_zone() {
	return new DateTimeZone( 'America/New_York' );
}

/**
 * Path of the main tool page, linked from focused pages and other tools.
 *
 * @return string
 */
function oc_tools_countdown_page_path() {
	return '/tools/countdown/';
}

/**
 * The holiday list, in calendar order. Same keys, names and rules as HOLIDAYS in countdown-calc.js.
 *
 * Each entry: array( name, month, day ) for a fixed date, or array( name, 'third monday of january' )
 * for a PHP relative date. Easter and Black Friday are worked out in oc_tools_countdown_holiday_date().
 *
 * @return array Key => entry.
 */
function oc_tools_countdown_holidays() {
	return array(
		'new-years'              => array( 'New Year\'s Day', 1, 1 ),
		'mlk-day'                => array( 'Martin Luther King Jr. Day', 'third monday of january' ),
		'super-bowl'             => array( 'Super Bowl Sunday', 'second sunday of february' ),
		'valentines-day'         => array( 'Valentine\'s Day', 2, 14 ),
		'presidents-day'         => array( 'Presidents\' Day', 'third monday of february' ),
		'daylight-saving-starts' => array( 'Daylight Saving Time Starts', 'second sunday of march' ),
		'st-patricks-day'        => array( 'St. Patrick\'s Day', 3, 17 ),
		'spring'                 => array( 'First Day of Spring', 3, 20 ),
		'easter'                 => array( 'Easter', 0, 0 ),
		'tax-day'                => array( 'Tax Day', 4, 15 ),
		'mothers-day'            => array( 'Mother\'s Day', 'second sunday of may' ),
		'memorial-day'           => array( 'Memorial Day', 'last monday of may' ),
		'juneteenth'             => array( 'Juneteenth', 6, 19 ),
		'fathers-day'            => array( 'Father\'s Day', 'third sunday of june' ),
		'summer'                 => array( 'First Day of Summer', 6, 21 ),
		'4th-of-july'            => array( '4th of July', 7, 4 ),
		'labor-day'              => array( 'Labor Day', 'first monday of september' ),
		'fall'                   => array( 'First Day of Fall', 9, 22 ),
		'halloween'              => array( 'Halloween', 10, 31 ),
		'daylight-saving-ends'   => array( 'Daylight Saving Time Ends', 'first sunday of november' ),
		'thanksgiving'           => array( 'Thanksgiving', 'fourth thursday of november' ),
		'black-friday'           => array( 'Black Friday', 0, 0 ),
		'winter'                 => array( 'First Day of Winter', 12, 21 ),
		'christmas-eve'          => array( 'Christmas Eve', 12, 24 ),
		'christmas'              => array( 'Christmas', 12, 25 ),
		'new-years-eve'          => array( 'New Year\'s Eve', 12, 31 ),
	);
}

/**
 * Season dates move by a day from year to year, so they are shown as approximate.
 *
 * @param string $key Holiday key.
 * @return bool
 */
function oc_tools_countdown_is_approx( $key ) {
	return in_array( $key, array( 'spring', 'summer', 'fall', 'winter' ), true );
}

/**
 * A holiday's date in one year, at 12:00 in the given zone.
 *
 * @param string       $key  Holiday key.
 * @param int          $year Year.
 * @param DateTimeZone $tz   Time zone.
 * @return DateTimeImmutable|null Null for an unknown key.
 */
function oc_tools_countdown_holiday_date( $key, $year, $tz ) {
	$list = oc_tools_countdown_holidays();
	if ( ! isset( $list[ $key ] ) ) {
		return null;
	}
	$rule = $list[ $key ];
	$base = new DateTimeImmutable( 'now', $tz );

	if ( 'easter' === $key ) {
		// Anonymous Gregorian algorithm, as in countdown-calc.js.
		$a    = $year % 19;
		$b    = intdiv( $year, 100 );
		$c    = $year % 100;
		$h    = ( 19 * $a + $b - intdiv( $b, 4 ) - intdiv( $b - intdiv( $b + 8, 25 ) + 1, 3 ) + 15 ) % 30;
		$l    = ( 32 + 2 * ( $b % 4 ) + 2 * intdiv( $c, 4 ) - $h - $c % 4 ) % 7;
		$m    = intdiv( $a + 11 * $h + 22 * $l, 451 );
		$n    = $h + $l - 7 * $m + 114;
		$date = $base->setDate( $year, intdiv( $n, 31 ), $n % 31 + 1 );
	} elseif ( 'black-friday' === $key ) {
		$date = new DateTimeImmutable( 'fourth thursday of november ' . $year, $tz );
		$date = $date->modify( '+1 day' );
	} elseif ( is_string( $rule[1] ) ) {
		$date = new DateTimeImmutable( $rule[1] . ' ' . $year, $tz );
	} else {
		$date = $base->setDate( $year, $rule[1], $rule[2] );
	}
	return $date->setTime( 12, 0 );
}

/**
 * A holiday's date this year if it is today or still ahead, otherwise next year's.
 *
 * @param string            $key Holiday key.
 * @param DateTimeImmutable $now Current time.
 * @return DateTimeImmutable|null
 */
function oc_tools_countdown_next_holiday( $key, $now ) {
	$year = (int) $now->format( 'Y' );
	$date = oc_tools_countdown_holiday_date( $key, $year, $now->getTimezone() );
	if ( $date && oc_tools_countdown_days( $now, $date ) < 0 ) {
		$date = oc_tools_countdown_holiday_date( $key, $year + 1, $now->getTimezone() );
	}
	return $date;
}

/**
 * Whole calendar days from $a to $b (negative if $b is earlier); time of day is ignored.
 *
 * @param DateTimeInterface $a From.
 * @param DateTimeInterface $b To.
 * @return int
 */
function oc_tools_countdown_days( $a, $b ) {
	$utc = new DateTimeZone( 'UTC' );
	$x   = new DateTimeImmutable( $a->format( 'Y-m-d' ), $utc );
	$y   = new DateTimeImmutable( $b->format( 'Y-m-d' ), $utc );
	return (int) round( ( $y->getTimestamp() - $x->getTimestamp() ) / 86400 );
}

/**
 * $n days after $date (negative = before), at 12:00. Business days skip Saturdays and Sundays only.
 *
 * @param DateTimeImmutable $date     Start.
 * @param int               $n        Days.
 * @param bool              $business Count business days only.
 * @return DateTimeImmutable
 */
function oc_tools_countdown_add_days( $date, $n, $business = false ) {
	$date = $date->setTime( 12, 0 );
	if ( ! $business ) {
		return $date->modify( ( $n < 0 ? '-' : '+' ) . abs( $n ) . ' days' );
	}
	$step = $n < 0 ? '-1 day' : '+1 day';
	for ( $left = abs( $n ); $left > 0; ) {
		$date = $date->modify( $step );
		if ( (int) $date->format( 'N' ) < 6 ) {
			--$left;
		}
	}
	return $date;
}

/**
 * $date moved $n months forward; a day the month doesn't have becomes its last day.
 *
 * @param DateTimeImmutable $date Start.
 * @param int               $n    Months, 0 or more.
 * @return DateTimeImmutable
 */
function oc_tools_countdown_add_months( $date, $n ) {
	$months = (int) $date->format( 'n' ) - 1 + $n;
	$year   = (int) $date->format( 'Y' ) + intdiv( $months, 12 );
	$month  = $months % 12 + 1;
	$last   = (int) $date->setDate( $year, $month, 1 )->format( 't' );
	return $date->setDate( $year, $month, min( (int) $date->format( 'j' ), $last ) );
}

/**
 * Days and months between two dates, counted the same way as between() in countdown-calc.js
 * (months like birthdays: Jan 31 to Mar 1 = 1 month 1 day). PHP's own diff() counts differently.
 *
 * @param DateTimeImmutable $a           Start.
 * @param DateTimeImmutable $b           End.
 * @param bool              $include_end Count the end date too.
 * @return array { days, months, rem (days after the whole months), back (end before start) }
 */
function oc_tools_countdown_between( $a, $b, $include_end ) {
	$back = oc_tools_countdown_days( $a, $b ) < 0;
	$s    = $back ? $b : $a;
	$e    = $back ? $a : $b;
	if ( $include_end ) {
		$e = $e->modify( '+1 day' );
	}
	$months = ( (int) $e->format( 'Y' ) - (int) $s->format( 'Y' ) ) * 12 + (int) $e->format( 'n' ) - (int) $s->format( 'n' );
	if ( (int) $e->format( 'j' ) < (int) $s->format( 'j' ) ) {
		--$months;
	}
	return array(
		'days'   => oc_tools_countdown_days( $s, $e ),
		'months' => $months,
		'rem'    => oc_tools_countdown_days( oc_tools_countdown_add_months( $s, $months ), $e ),
		'back'   => $back,
	);
}

/**
 * "1 day", "1,234 days"
 *
 * @param int|float $n    Number.
 * @param string    $word Singular word.
 * @return string
 */
function oc_tools_countdown_plural( $n, $word ) {
	return number_format( $n, is_float( $n ) && floor( $n ) !== $n ? 1 : 0 ) . ' ' . $word . ( 1.0 === (float) $n ? '' : 's' );
}

/**
 * "a, b and c"
 *
 * @param array $list Phrases.
 * @return string
 */
function oc_tools_countdown_join( $list ) {
	$last = array_pop( $list );
	return $list ? implode( ', ', $list ) . ' and ' . $last : (string) $last;
}

/**
 * 57 -> "8 weeks and 1 day", 63 -> "9 weeks", 6 -> "6 days"
 *
 * @param int $days Days.
 * @return string
 */
function oc_tools_countdown_weeks( $days ) {
	$w    = intdiv( $days, 7 );
	$d    = $days % 7;
	$list = $w ? array( oc_tools_countdown_plural( $w, 'week' ) ) : array();
	if ( $d || ! $w ) {
		$list[] = oc_tools_countdown_plural( $d, 'day' );
	}
	return oc_tools_countdown_join( $list );
}

/**
 * Hours, minutes and seconds as words: "2 hours and 14 minutes", "less than a minute".
 *
 * @param int $seconds Seconds.
 * @return string
 */
function oc_tools_countdown_spoken( $seconds ) {
	$list = array();
	foreach ( array( 'day' => 86400, 'hour' => 3600, 'minute' => 60 ) as $word => $size ) {
		$n = intdiv( $seconds, $size );
		if ( $n ) {
			$list[] = oc_tools_countdown_plural( $n, $word );
		}
		$seconds -= $n * $size;
	}
	return $list ? oc_tools_countdown_join( $list ) : 'less than a minute';
}

/**
 * "15:30", "3:30 pm", "1530", "3 pm", "noon" -> array( 15, 30 ); null if not a time. Same as parseTime() in JS.
 *
 * @param string $text Time.
 * @return array|null
 */
function oc_tools_countdown_parse_time( $text ) {
	$t = str_replace( '.', '', strtolower( trim( (string) $text ) ) );
	if ( 'noon' === $t || 'midnight' === $t ) {
		return array( 'noon' === $t ? 12 : 0, 0 );
	}
	if ( ! preg_match( '/^(\d{1,2})(?::?(\d\d))?(?::\d\d)?\s*([ap])?m?$/', $t, $m ) || ( 'm' === substr( $t, -1 ) && empty( $m[3] ) ) ) {
		return null;
	}
	$h   = (int) $m[1];
	$min = isset( $m[2] ) && '' !== $m[2] ? (int) $m[2] : 0;
	if ( ! empty( $m[3] ) ) {
		if ( $h < 1 || $h > 12 ) {
			return null;
		}
		$h = $h % 12 + ( 'p' === $m[3] ? 12 : 0 );
	}
	return $h < 24 && $min < 60 ? array( $h, $min ) : null;
}

/**
 * "2026-12-25" -> that date at 12:00 in $tz; null unless a real date.
 *
 * @param string       $text Date.
 * @param DateTimeZone $tz   Time zone.
 * @return DateTimeImmutable|null
 */
function oc_tools_countdown_parse_date( $text, $tz ) {
	if ( ! preg_match( '/^(\d{4})-(\d\d)-(\d\d)$/', trim( (string) $text ), $m ) || (int) $m[1] < 1000 || ! checkdate( (int) $m[2], (int) $m[3], (int) $m[1] ) ) {
		return null;
	}
	return ( new DateTimeImmutable( 'now', $tz ) )->setDate( (int) $m[1], (int) $m[2], (int) $m[3] )->setTime( 12, 0 );
}

/**
 * The shortcode attributes this tool accepts. Invalid values are dropped.
 *
 * @param array $atts Shortcode attributes.
 * @return array mode, target, holiday, label, days, tabs (only those that were valid).
 */
function oc_tools_countdown_options( $atts ) {
	$options = array();
	$mode    = isset( $atts['mode'] ) ? sanitize_key( $atts['mode'] ) : '';
	$mode    = in_array( $mode, array( 'time', 'date', 'from', 'between' ), true ) ? $mode : 'time';
	if ( ! empty( $atts['mode'] ) ) {
		$options['mode'] = $mode;
	}

	$target = isset( $atts['target'] ) ? (string) $atts['target'] : '';
	if ( 'time' === $mode && oc_tools_countdown_parse_time( $target ) ) {
		$options['target'] = vsprintf( '%02d:%02d', oc_tools_countdown_parse_time( $target ) );
	} elseif ( 'date' === $mode && oc_tools_countdown_parse_date( $target, oc_tools_countdown_zone() ) ) {
		$options['target'] = trim( $target );
	}

	$holiday = isset( $atts['holiday'] ) ? sanitize_key( $atts['holiday'] ) : '';
	if ( array_key_exists( $holiday, oc_tools_countdown_holidays() ) ) {
		$options['holiday'] = $holiday;
	}

	$label = isset( $atts['label'] ) ? trim( sanitize_text_field( $atts['label'] ) ) : '';
	if ( '' !== $label ) {
		$options['label'] = function_exists( 'mb_substr' ) ? mb_substr( $label, 0, 40 ) : substr( $label, 0, 40 );
	}

	$days = isset( $atts['days'] ) ? trim( (string) $atts['days'] ) : '';
	if ( preg_match( '/^-?\d{1,5}$/', $days ) && abs( (int) $days ) <= 10000 ) {
		$options['days'] = (int) $days;
	}

	$tabs = isset( $atts['tabs'] ) ? trim( (string) $atts['tabs'] ) : '';
	if ( '0' === $tabs || '1' === $tabs ) {
		$options['tabs'] = (int) $tabs;
	}
	return $options;
}

/**
 * The paragraph under a focused "days from today" page's tool. app.js refills the spans in local time.
 *
 * @param int               $n   Days, above 0.
 * @param DateTimeImmutable $now Current time.
 * @return string HTML.
 */
function oc_tools_countdown_from_intro( $n, $now ) {
	$days  = esc_html( oc_tools_countdown_plural( $n, 'day' ) );
	$ahead = oc_tools_countdown_add_days( $now, $n );
	$spans = array(
		'f' => $ahead->format( 'F j, Y' ),
		'w' => $ahead->format( 'l' ),
		'b' => oc_tools_countdown_add_days( $now, -$n )->format( 'F j, Y' ),
		'z' => oc_tools_countdown_add_days( $now, $n, true )->format( 'F j, Y' ),
	);
	foreach ( $spans as $key => $text ) {
		$spans[ $key ] = '<span data-cd-i="' . $key . '">' . esc_html( $text ) . '</span>';
	}
	return $days . ' from today is ' . $spans['f'] . ' (a ' . $spans['w'] . '). ' . $days . ' ago was ' . $spans['b'] . '. Counting only business days, it\'s ' . $spans['z'] . '.';
}

/**
 * The paragraph under a focused date countdown page's tool. app.js refills the spans in local time.
 *
 * @param string            $name Event name.
 * @param DateTimeImmutable $date Event date.
 * @param DateTimeImmutable $now  Current time.
 * @return string HTML.
 */
function oc_tools_countdown_date_intro( $name, $date, $now ) {
	$days = oc_tools_countdown_days( $now, $date );
	$when = $days ? oc_tools_countdown_plural( abs( $days ), 'day' ) . ( $days > 0 ? ' from today' : ' ago' ) : 'today';
	$weeks = $days >= 14 ? ', or about ' . oc_tools_countdown_plural( (int) round( $days / 7 ), 'week' ) : '';
	return esc_html( $name ) . ' is on <span data-cd-i="d">' . esc_html( $date->format( 'l, F j, Y' ) ) . '</span>. That\'s <span data-cd-i="n">' . esc_html( $when ) . '</span><span data-cd-i="w">' . esc_html( $weeks ) . '</span>.';
}

/**
 * The live counter's boxes. Hidden from screen readers: the live sentence says the same.
 *
 * @param int  $seconds   Seconds left.
 * @param bool $show_days Show the days box even at 0 days.
 * @return string
 */
function oc_tools_countdown_counter( $seconds, $show_days ) {
	$values = array(
		'd' => intdiv( $seconds, 86400 ),
		'h' => intdiv( $seconds, 3600 ) % 24,
		'm' => intdiv( $seconds, 60 ) % 60,
		's' => $seconds % 60,
	);
	$units  = array(
		'd' => 'days',
		'h' => 'hours',
		'm' => 'min',
		's' => 'sec',
	);
	$html   = '<div class="oc-cd-count" aria-hidden="true">';
	foreach ( $values as $unit => $value ) {
		$hidden = 'd' === $unit && ! $show_days && ! $value ? ' hidden' : '';
		$text   = 'd' === $unit ? number_format( $value ) : sprintf( '%02d', $value );
		$html  .= '<span class="oc-cd-box"' . $hidden . '><b data-cd-u="' . esc_attr( $unit ) . '">' . esc_html( $text ) . '</b>' . esc_html( $units[ $unit ] ) . '</span>';
	}
	return $html . '</div>';
}

/**
 * A text field: label, input, one line of help and the (hidden) error line.
 *
 * @param string $id    Input id.
 * @param string $label Label text.
 * @param string $input The <input> or <select> markup (already escaped), without aria-describedby.
 * @param string $hint  Help text ('' for none).
 * @param string $class Extra class for the wrapper.
 * @return string
 */
function oc_tools_countdown_field( $id, $label, $input, $hint, $class = '' ) {
	$described = '' !== $hint ? ' aria-describedby="' . esc_attr( $id . '-hint' ) . '"' : '';
	$input     = preg_replace( '/^<(input|select)/', '<$1' . $described, $input );
	return '<div class="oc-cd-field' . ( $class ? ' ' . esc_attr( $class ) : '' ) . '">'
		. '<label class="oc-label" for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label>' . $input
		. ( '' !== $hint ? '<p class="oc-hint" id="' . esc_attr( $id . '-hint' ) . '">' . esc_html( $hint ) . '</p>' : '' )
		. '<p class="oc-cd-err" id="' . esc_attr( $id . '-err' ) . '" hidden></p></div>';
}

/**
 * An <input> tag.
 *
 * @param string $id    Id.
 * @param string $name  data-cd name (also its URL key).
 * @param string $type  Input type.
 * @param string $value Value.
 * @param string $extra Extra attributes (already escaped).
 * @return string
 */
function oc_tools_countdown_input( $id, $name, $type, $value, $extra = '' ) {
	return '<input class="oc-cd-in" type="' . esc_attr( $type ) . '" id="' . esc_attr( $id ) . '" data-cd="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" autocomplete="off"' . $extra . '>';
}

/**
 * Copy and Share buttons with their status line, under each answer.
 *
 * @param string $id Id prefix.
 * @return string
 */
function oc_tools_countdown_actions( $id ) {
	$html = '<div class="oc-cd-actions">';
	foreach ( array( 'copy' => 'Copy', 'share' => 'Share' ) as $act => $label ) {
		$html .= '<button type="button" class="oc-btn-outline" data-cd-act="' . esc_attr( $act ) . '">' . oc_tools_time_card_icon( $act ) . esc_html( $label ) . '</button>';
	}
	return $html . '<p class="oc-copy-status" role="status" data-cd="status"></p>'
		. '<div class="oc-copy-fallback" data-cd="fallback" hidden><label class="oc-label" for="' . esc_attr( $id . '-copy' ) . '">Copy this:</label>'
		. '<textarea class="oc-cd-in" id="' . esc_attr( $id . '-copy' ) . '" rows="3" readonly data-cd="copy"></textarea></div></div>';
}

/**
 * Time mode: inputs and answer for the next time the clock shows the target.
 *
 * @param string            $id  Id prefix.
 * @param array             $o   Options.
 * @param DateTimeImmutable $now Current time.
 * @return array( html, live sentence )
 */
function oc_tools_countdown_time_panel( $id, $o, $now ) {
	$hm     = isset( $o['target'] ) && 'time' === ( isset( $o['mode'] ) ? $o['mode'] : 'time' ) ? $o['target'] : '15:30';
	$hm     = array_map( 'intval', explode( ':', $hm ) );
	$target = $now->setTime( $hm[0], $hm[1] );
	$later  = $target < $now;
	if ( $later ) {
		$target = $target->modify( '+1 day' )->setTime( $hm[0], $hm[1] );
	}
	$left  = $target->getTimestamp() - $now->getTimestamp();
	$label = $now->setTime( $hm[0], $hm[1] )->format( 'g:i A' );
	$start = $now->setTime( 0, 0 );
	$pct   = (int) floor( ( $now->getTimestamp() - $start->getTimestamp() ) * 100 / ( $start->modify( '+1 day' )->getTimestamp() - $start->getTimestamp() ) ); // 23 or 25 hours on clock-change days.
	$value = sprintf( '%02d:%02d', $hm[0], $hm[1] );
	$picks = array( '09:00', '12:00', '15:00', '17:00', '18:00', '22:00' );

	$chips = '';
	foreach ( $picks as $pick ) {
		$text   = ( new DateTimeImmutable( '2000-01-01 ' . $pick ) )->format( 'g:i A' );
		$chips .= '<button type="button" class="oc-cd-chip" data-cd-act="pick" data-cd-pick="' . esc_attr( $pick ) . '">' . esc_html( $text ) . '</button>';
	}

	$html = '<div class="oc-card oc-cd-form">'
		. oc_tools_countdown_field( $id . '-t', 'Count down to', oc_tools_countdown_input( $id . '-t', 't', 'time', $value ), 'Pick a time, or tap one below.' )
		. '<div class="oc-cd-chips" role="group" aria-label="Quick picks">' . $chips . '</div></div>'
		. '<section class="oc-card oc-cd-ans" aria-labelledby="' . esc_attr( $id . '-head' ) . '" data-cd-ans>'
		. '<h2 class="oc-eyebrow" id="' . esc_attr( $id . '-head' ) . '" data-cd="head">' . esc_html( 'Time until ' . $label ) . '</h2>'
		. oc_tools_countdown_counter( $left, false )
		. '<p class="oc-cd-line" data-cd="at"><span data-cd="pre">That\'s at </span><strong data-cd="when">' . esc_html( $target->format( 'g:i A' ) . ( $later ? ' tomorrow' : ' today' ) ) . '</strong><span data-cd="post">' . esc_html( $later ? ', ' . $target->format( 'l, F j, Y' ) . '.' : '.' ) . '</span></p>'
		. '<div class="oc-cd-bar" aria-hidden="true"><span data-cd="bar" style="width:' . esc_attr( $pct ) . '%"></span></div>'
		. '<p class="oc-cd-sub" data-cd="pct">' . esc_html( $pct . '% of today is done' ) . '</p>'
		. oc_tools_countdown_actions( $id ) . '</section>';

	return array( $html, oc_tools_countdown_spoken( $left ) . ' until ' . $label );
}

/**
 * Date mode: inputs and answer for a countdown to the start of a date.
 *
 * @param string            $id  Id prefix.
 * @param array             $o   Options.
 * @param DateTimeImmutable $now Current time.
 * @return array( html, live sentence )
 */
function oc_tools_countdown_date_panel( $id, $o, $now ) {
	$tz      = $now->getTimezone();
	$is_date = isset( $o['mode'] ) && 'date' === $o['mode'];
	$holiday = isset( $o['holiday'] ) ? $o['holiday'] : ( $is_date && isset( $o['target'] ) ? '' : 'christmas' );
	$list    = oc_tools_countdown_holidays();
	$date    = $holiday ? oc_tools_countdown_next_holiday( $holiday, $now ) : oc_tools_countdown_parse_date( $o['target'], $tz );
	$name    = $is_date && isset( $o['label'] ) ? $o['label'] : ( $holiday ? $list[ $holiday ][0] : '' );
	$title   = '' !== $name ? $name : $date->format( 'M j, Y' );
	$days    = oc_tools_countdown_days( $now, $date );
	$left    = max( 0, $date->setTime( 0, 0 )->getTimestamp() - $now->getTimestamp() );
	$approx  = $holiday && oc_tools_countdown_is_approx( $holiday ) ? ' (approximately)' : '';

	if ( $days > 0 ) {
		$line = ' · that\'s ' . oc_tools_countdown_plural( $days, 'day' ) . ( $days >= 7 ? ', or ' . oc_tools_countdown_weeks( $days ) : '' );
		$live = oc_tools_countdown_spoken( $left ) . ' until ' . $title;
	} elseif ( 0 === $days ) {
		$line = ' · that\'s today!';
		$live = 'Today is ' . $title;
	} else {
		$line = ' · that was ' . oc_tools_countdown_plural( -$days, 'day' ) . ' ago';
		$live = $title . ' was ' . oc_tools_countdown_plural( -$days, 'day' ) . ' ago';
	}

	$options = '<option value="">Choose a holiday</option>';
	foreach ( $list as $key => $entry ) {
		$options .= '<option value="' . esc_attr( $key ) . '"' . ( $key === $holiday ? ' selected' : '' ) . '>' . esc_html( $entry[0] ) . '</option>';
	}

	$html = '<div class="oc-card oc-cd-form">'
		. oc_tools_countdown_field( $id . '-d', 'Count down to', oc_tools_countdown_input( $id . '-d', 'd', 'date', $date->format( 'Y-m-d' ) ), 'Pick a date, or a holiday.' )
		. oc_tools_countdown_field( $id . '-h', 'Holiday', '<select class="oc-cd-in" id="' . esc_attr( $id . '-h' ) . '" data-cd="h">' . $options . '</select>', '', 'oc-cd-select' )
		. oc_tools_countdown_field( $id . '-l', 'Name (optional)', oc_tools_countdown_input( $id . '-l', 'l', 'text', $name, ' maxlength="40" placeholder="Mom\'s birthday"' ), 'Shown in the headline.' )
		. '</div>'
		. '<section class="oc-card oc-cd-ans" aria-labelledby="' . esc_attr( $id . '-head' ) . '" data-cd-ans>'
		. '<h2 class="oc-eyebrow" id="' . esc_attr( $id . '-head' ) . '" data-cd="head">' . esc_html( ( $days < 0 ? 'Time since ' : 'Time until ' ) . $title ) . '</h2>'
		. oc_tools_countdown_counter( $days < 0 ? $now->getTimestamp() - $date->setTime( 0, 0 )->getTimestamp() : $left, true )
		. '<p class="oc-cd-line' . ( 0 === $days ? ' is-now' : '' ) . '"><strong data-cd="date">' . esc_html( $date->format( 'l, F j, Y' ) . $approx ) . '</strong><span data-cd="line">' . esc_html( $line ) . '</span></p>'
		. '<p class="oc-cd-sub" data-cd="doy">' . esc_html( 'Day ' . ( (int) $date->format( 'z' ) + 1 ) . ' of the year' ) . '</p>'
		. '<button type="button" class="oc-btn-outline oc-cd-next" data-cd-act="next" hidden></button>'
		. oc_tools_countdown_actions( $id ) . '</section>';

	return array( $html, $live );
}

/**
 * From mode: the date a number of days (or business days) from a start date.
 *
 * @param string            $id  Id prefix.
 * @param array             $o   Options.
 * @param DateTimeImmutable $now Current time.
 * @return array( html, live sentence )
 */
function oc_tools_countdown_from_panel( $id, $o, $now ) {
	$n     = isset( $o['days'] ) ? $o['days'] : 30;
	$a     = abs( $n );
	$fwd   = oc_tools_countdown_add_days( $now, $a );
	$back  = oc_tools_countdown_add_days( $now, -$a );
	$main  = $n < 0 ? $back : $fwd;
	$days  = oc_tools_countdown_plural( $a, 'day' );
	$ahead = $days . ' from today';
	$ago   = $days . ' ago';
	$first = ( $n < 0 ? $ago . ' was ' : $ahead . ' is ' ) . $main->format( 'M j, Y' ) . '.';
	$line  = $first . ( $a >= 7 ? ' That\'s ' . oc_tools_countdown_weeks( $a ) . '.' : '' );
	$other = $n < 0 ? $ahead . ' is ' . $fwd->format( 'l, F j, Y' ) . '.' : $ago . ' was ' . $back->format( 'l, F j, Y' ) . '.';

	$step = '<div class="oc-cd-step"><button type="button" class="oc-btn-outline" data-cd-act="minus" aria-label="1 day fewer">−</button>'
		. oc_tools_countdown_input( $id . '-n', 'n', 'text', (string) $n, ' inputmode="numeric"' )
		. '<button type="button" class="oc-btn-outline" data-cd-act="plus" aria-label="1 day more">+</button></div>';
	$step = preg_replace( '/<input/', '<input aria-describedby="' . esc_attr( $id . '-n-hint' ) . '"', $step );

	$html = '<div class="oc-card oc-cd-form">'
		. '<div class="oc-cd-field"><label class="oc-label" for="' . esc_attr( $id . '-n' ) . '">Number of days</label>' . $step
		. '<p class="oc-hint" id="' . esc_attr( $id . '-n-hint' ) . '">Up to 10,000. Use a minus sign for days ago.</p><p class="oc-cd-err" id="' . esc_attr( $id . '-n-err' ) . '" hidden></p></div>'
		. oc_tools_countdown_field( $id . '-from', 'From', oc_tools_countdown_input( $id . '-from', 'from', 'date', $now->format( 'Y-m-d' ), ' data-cd-def="today"' ), 'Today, unless you change it.' )
		. '<div class="oc-cd-field oc-cd-wide"><label class="oc-cd-check"><input type="checkbox" data-cd="biz" aria-describedby="' . esc_attr( $id . '-biz-hint' ) . '"> Business days only (skips weekends)</label>'
		. '<p class="oc-hint" id="' . esc_attr( $id . '-biz-hint' ) . '">Holidays are not skipped.</p></div>'
		. '</div>'
		. '<section class="oc-card oc-cd-ans" aria-labelledby="' . esc_attr( $id . '-head' ) . '" data-cd-ans>'
		. '<h2 class="oc-eyebrow" id="' . esc_attr( $id . '-head' ) . '" data-cd="head">' . esc_html( $n < 0 ? $ago : $ahead ) . '</h2>'
		. '<p class="oc-big" data-cd="big">' . esc_html( $main->format( 'l, F j, Y' ) ) . '</p>'
		. '<p class="oc-cd-line" data-cd="line">' . esc_html( $line ) . '</p>'
		. '<p class="oc-cd-line" data-cd="other">' . esc_html( $other ) . '</p>'
		. '<p class="oc-cd-sub" data-cd="small">' . esc_html( 'Week ' . (int) $main->format( 'W' ) . ' · Day ' . ( (int) $main->format( 'z' ) + 1 ) . ' of the year' ) . '</p>'
		. oc_tools_countdown_actions( $id ) . '</section>';

	return array( $html, $first );
}

/**
 * Between mode: days, weeks, months and hours between two dates.
 *
 * @param string            $id  Id prefix.
 * @param array             $o   Options.
 * @param DateTimeImmutable $now Current time.
 * @return array( html, live sentence )
 */
function oc_tools_countdown_between_panel( $id, $o, $now ) {
	$end   = $now->setDate( (int) $now->format( 'Y' ), 12, 31 );
	$r     = oc_tools_countdown_between( $now, $end, false );
	$span  = $now->format( 'M j, Y' ) . ' to ' . $end->format( 'M j, Y' );
	$parts = array( oc_tools_countdown_weeks( $r['days'] ) );
	if ( $r['months'] ) {
		$ymd = array();
		foreach ( array( 'year' => intdiv( $r['months'], 12 ), 'month' => $r['months'] % 12, 'day' => $r['rem'] ) as $word => $n ) {
			if ( $n ) {
				$ymd[] = oc_tools_countdown_plural( $n, $word );
			}
		}
		$parts[] = oc_tools_countdown_join( $ymd );
	}
	$parts[] = oc_tools_countdown_plural( $r['days'] * 24, 'hour' );
	$share   = $r['days'] < 365 ? round( $r['days'] / 365 * 100 ) . '% of a year' : 'about ' . oc_tools_countdown_plural( round( $r['days'] / 365.25, 1 ), 'year' );

	$html = '<div class="oc-card oc-cd-form">'
		. oc_tools_countdown_field( $id . '-start', 'Start date', oc_tools_countdown_input( $id . '-start', 'start', 'date', $now->format( 'Y-m-d' ), ' data-cd-def="today"' ), '' )
		. oc_tools_countdown_field( $id . '-end', 'End date', oc_tools_countdown_input( $id . '-end', 'end', 'date', $end->format( 'Y-m-d' ), ' data-cd-def="eoy"' ), '' )
		. '<div class="oc-cd-field oc-cd-wide"><label class="oc-cd-check"><input type="checkbox" data-cd="inc" aria-describedby="' . esc_attr( $id . '-inc-hint' ) . '"> Include the end date</label>'
		. '<p class="oc-hint" id="' . esc_attr( $id . '-inc-hint' ) . '">Counts both the first and the last day.</p></div>'
		. '</div>'
		. '<section class="oc-card oc-cd-ans" aria-labelledby="' . esc_attr( $id . '-head' ) . '" data-cd-ans>'
		. '<h2 class="oc-eyebrow" id="' . esc_attr( $id . '-head' ) . '" data-cd="head">' . esc_html( 'From ' . $span ) . '</h2>'
		. '<p class="oc-big" data-cd="big">' . esc_html( oc_tools_countdown_plural( $r['days'], 'day' ) ) . '</p>'
		. '<p class="oc-cd-line" data-cd="line">' . esc_html( implode( ' · ', $parts ) ) . '</p>'
		. '<p class="oc-cd-sub" data-cd="share">' . esc_html( 'That\'s ' . $share . '.' ) . '</p>'
		. '<p class="oc-cd-back" data-cd="back" hidden>End date is before the start date (counting backwards).</p>'
		. oc_tools_countdown_actions( $id ) . '</section>';

	return array( $html, oc_tools_countdown_plural( $r['days'], 'day' ) . ' from ' . $span );
}

/**
 * The tool's HTML: tabs (unless tabs="0"), one panel per mode with its answer, and on focused
 * pages a computed paragraph and links to the other modes.
 *
 * @param string $uid     The container's id; every id inside starts with it.
 * @param array  $options Cleaned shortcode options (see oc_tools_countdown_options()).
 * @return string
 */
function oc_tools_countdown_render( $uid, $options ) {
	$now   = new DateTimeImmutable( 'now', oc_tools_countdown_zone() );
	$now   = $now->setTime( (int) $now->format( 'G' ), (int) $now->format( 'i' ), (int) $now->format( 's' ) );
	$mode  = isset( $options['mode'] ) ? $options['mode'] : 'time';
	$tabs  = ! isset( $options['tabs'] ) || $options['tabs'];
	$names = array(
		'time'    => 'Time',
		'date'    => 'Date',
		'from'    => 'From today',
		'between' => 'Between',
	);
	$modes = $tabs ? array_keys( $names ) : array( $mode );

	// LiteSpeed Cache: keep the page no longer than until midnight Eastern, so "today" stays right.
	$midnight = $now->modify( '+1 day' )->setTime( 0, 0 );
	do_action( 'litespeed_control_set_ttl', max( 300, $midnight->getTimestamp() - $now->getTimestamp() ) );

	$html = '<div class="oc-cd">';
	if ( $tabs ) {
		$html .= '<div class="oc-cd-tabs" role="tablist" aria-label="Countdown and date tools">';
		foreach ( $names as $key => $name ) {
			$on    = $key === $mode;
			$html .= '<button type="button" role="tab" id="' . esc_attr( $uid . '-tab-' . $key ) . '" aria-controls="' . esc_attr( $uid . '-' . $key ) . '" aria-selected="' . ( $on ? 'true' : 'false' ) . '"' . ( $on ? '' : ' tabindex="-1"' ) . ' data-cd-act="tab" data-cd-tab="' . esc_attr( $key ) . '">' . esc_html( $name ) . '</button>';
		}
		$html .= '</div>';
	}

	$live = '';
	foreach ( $modes as $key ) {
		$id    = $uid . '-' . $key;
		$panel = call_user_func( 'oc_tools_countdown_' . $key . '_panel', $id, $options, $now );
		$attrs = $tabs ? ' role="tabpanel" aria-labelledby="' . esc_attr( $uid . '-tab-' . $key ) . '"' . ( $key === $mode ? '' : ' hidden' ) : '';
		$html .= '<div class="oc-cd-panel" id="' . esc_attr( $id ) . '" data-cd-panel="' . esc_attr( $key ) . '"' . $attrs . '>' . $panel[0] . '</div>';
		$live  = $key === $mode ? $panel[1] : $live;
	}

	$html .= '<p class="oc-sr-only" aria-live="polite" data-cd="live">' . esc_html( $live ) . '</p>';
	$html .= '<p class="oc-cd-tz" data-cd="tz">Shown in Eastern Time until your browser loads.</p>';
	$html .= '<noscript><p class="oc-app-error">Turn on JavaScript for a live countdown in your own time zone.</p></noscript>';

	if ( ! $tabs ) {
		$html .= oc_tools_countdown_focused_extras( $mode, $options, $now );
	}
	return $html . '</div>';
}

/**
 * Focused pages (tabs="0"): a computed paragraph (from and date modes) and links to the other modes.
 *
 * @param string            $mode    Mode.
 * @param array             $options Options.
 * @param DateTimeImmutable $now     Current time.
 * @return string
 */
function oc_tools_countdown_focused_extras( $mode, $options, $now ) {
	$html = '';
	if ( 'from' === $mode && isset( $options['days'] ) && $options['days'] > 0 ) {
		$html .= '<p class="oc-cd-intro" data-cd-intro="from" data-n="' . esc_attr( $options['days'] ) . '">' . oc_tools_countdown_from_intro( $options['days'], $now ) . '</p>'; // Escaped inside.
	} elseif ( 'date' === $mode ) {
		$holiday = isset( $options['holiday'] ) ? $options['holiday'] : ( isset( $options['target'] ) ? '' : 'christmas' );
		$list    = oc_tools_countdown_holidays();
		$date    = $holiday ? oc_tools_countdown_next_holiday( $holiday, $now ) : oc_tools_countdown_parse_date( $options['target'], $now->getTimezone() );
		$name    = isset( $options['label'] ) ? $options['label'] : ( $holiday ? $list[ $holiday ][0] : $date->format( 'F j, Y' ) );
		$html   .= '<p class="oc-cd-intro" data-cd-intro="date" data-h="' . esc_attr( $holiday ) . '" data-d="' . esc_attr( $date->format( 'Y-m-d' ) ) . '">' . oc_tools_countdown_date_intro( $name, $date, $now ) . '</p>'; // Escaped inside.
	}

	$links = array(
		'time'    => 'How long until a time',
		'date'    => 'Countdown to a date or holiday',
		'from'    => 'What date is X days from today',
		'between' => 'Days between two dates',
	);
	unset( $links[ $mode ] );
	$items = '';
	foreach ( $links as $key => $text ) {
		$items .= '<li><a href="' . esc_url( home_url( oc_tools_countdown_page_path() . '?mode=' . $key ) ) . '">' . esc_html( $text ) . '</a></li>';
	}
	return $html . '<nav class="oc-cd-more" aria-label="More date tools"><h2 class="oc-related-title">More date tools</h2><ul>' . $items . '</ul></nav>';
}

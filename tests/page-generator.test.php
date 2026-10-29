<?php
/**
 * Tests for includes/page-generator.php, the server-side date math in
 * tools/countdown/countdown.php and the related-tools links in orbitcorner-tools.php.
 * Runs without WordPress (tests/wp-stand-ins.php).
 *
 *   php tests/page-generator.test.php
 *
 * @package OrbitCorner_Tools
 */

require __DIR__ . '/wp-stand-ins.php';
require dirname( __DIR__ ) . '/orbitcorner-tools.php';

$passed = 0;
$failed = 0;

/**
 * Runs one test.
 *
 * @param string   $name Test name.
 * @param callable $fn   Test body; throws on failure.
 */
function test( $name, $fn ) {
	global $passed, $failed;
	try {
		$fn();
		++$passed;
		echo '  ok    ' . $name . "\n";
	} catch ( Exception $e ) {
		++$failed;
		echo '  FAIL  ' . $name . "\n        " . $e->getMessage() . "\n";
	}
}

/**
 * Throws unless $got === $want.
 *
 * @param mixed  $got  Actual.
 * @param mixed  $want Expected.
 * @param string $what Label.
 * @throws Exception When they differ.
 */
function same( $got, $want, $what = '' ) {
	if ( $got !== $want ) {
		throw new Exception( ( $what ? $what . ': ' : '' ) . var_export( $got, true ) . ' !== ' . var_export( $want, true ) );
	}
}

/**
 * Entries of a set with a fixed hub URL.
 *
 * @param string $set Set key.
 * @return array
 */
function entries( $set ) {
	$sets = oc_tools_page_sets();
	return call_user_func( $sets[ $set ]['entries'], 'https://orbitcorner.com/' . $set . '/' );
}

$tz = new DateTimeZone( 'America/New_York' );

test(
	'96 / 60 / 26 pages with unique slugs and keys',
	function () {
		foreach ( array(
			'how-long-until'  => 96,
			'days-from-today' => 60,
			'days-until'      => 26,
		) as $set => $count ) {
			$pages = entries( $set );
			same( count( $pages ), $count, $set );
			$slugs = array_column( $pages, 'slug' );
			same( count( array_unique( $slugs ) ), $count, $set . ' slugs' );
			foreach ( $slugs as $slug ) {
				if ( ! preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
					throw new Exception( 'Bad slug ' . $slug );
				}
			}
		}
	}
);

test(
	'How long until: slugs, titles, order and the computed sentence',
	function () {
		$pages = entries( 'how-long-until' );
		same( $pages['15:30']['slug'], '3-30-pm' );
		same( $pages['15:30']['title'], 'How Long Until 3:30 PM? Live Countdown' );
		same( $pages['00:00']['slug'], '12-00-am' );
		same( $pages['12:00']['slug'], '12-00-pm' );
		same( $pages['23:45']['slug'], '11-45-pm' );
		same( $pages['15:30']['order'], 930 );
		same( array_slice( array_keys( $pages ), 0, 3 ), array( '00:00', '01:00', '02:00' ), 'whole hours first' );
		same( array_keys( $pages )[24], '00:30', 'then half hours' );
		$content = $pages['15:30']['content'];
		same( false !== strpos( $content, '[orbit_tool name="countdown" mode="time" target="15:30" tabs="0"]' ), true, 'shortcode' );
		same( false !== strpos( $content, '3:30 PM is 15 hours and 30 minutes into the day: 930 minutes after midnight, 510 minutes before the day ends, and 15:30 in 24-hour time.' ), true, 'sentence' );
		same( false !== strpos( $content, 'https://orbitcorner.com/how-long-until/3-00-pm/' ) && false !== strpos( $content, 'https://orbitcorner.com/how-long-until/4-00-pm/' ), true, 'nearby' );
		same( false !== strpos( $pages['00:00']['content'], '/how-long-until/11-30-pm/' ), true, 'nearby wraps past midnight' );
		same( false !== strpos( $pages['00:00']['content'], '12:00 AM (midnight) is the very start of the day' ), true, 'midnight' );
		same( false !== strpos( $content, '/tools/time-card-calculator/' ), true, 'related' );
	}
);

test(
	'Days from today: counts, slugs, titles, nearby',
	function () {
		$pages = entries( 'days-from-today' );
		$keys  = array_map( 'intval', array_keys( $pages ) );
		same( array_slice( $keys, 0, 30 ), range( 1, 30 ) );
		foreach ( array( 45, 60, 75, 90, 100, 120, 150, 180, 200, 250, 270, 300, 365, 500, 1000 ) as $n ) {
			same( in_array( $n, $keys, true ), true, (string) $n );
		}
		same( $pages['75']['slug'], '75' );
		same( $pages['75']['title'], 'What Is 75 Days From Today? (Date Calculator)' );
		same( $pages['1']['title'], 'What Is 1 Day From Today? (Date Calculator)' );
		same( $pages['1000']['title'], 'What Is 1,000 Days From Today? (Date Calculator)' );
		same( false !== strpos( $pages['75']['content'], 'mode="from" days="75" tabs="0"' ), true );
		same( false !== strpos( $pages['75']['content'], 'the 75th day after today' ), true );
		foreach ( array( 70, 80, 60, 90 ) as $n ) {
			same( false !== strpos( $pages['75']['content'], '/days-from-today/' . $n . '/' ), true, 'nearby ' . $n );
		}
		same( preg_match_all( '#/days-from-today/\d+/#', $pages['1']['content'] ), 4, '4 nearby links for 1' );
	}
);

test(
	'Days until: titles without a year, notes, other countdowns',
	function () {
		$pages = entries( 'days-until' );
		same( $pages['christmas']['slug'], 'christmas' );
		same( $pages['christmas']['title'], 'How Many Days Until Christmas?' );
		same( $pages['4th-of-july']['title'], 'How Many Days Until the 4th of July?' );
		same( $pages['christmas']['label'], 'Christmas' );
		same( false !== strpos( $pages['christmas']['content'], 'mode="date" holiday="christmas" tabs="0"' ), true );
		same( preg_match_all( '#/days-until/[a-z0-9-]+/#', $pages['christmas']['content'] ), 6, 'six other countdowns' );
		same( false !== strpos( $pages['new-years-eve']['content'], '/days-until/new-years/' ), true, 'wraps to January' );
		foreach ( oc_tools_pages_holiday_notes() as $key => $note ) {
			same( isset( $pages[ $key ] ), true, $key );
		}
	}
);

test(
	'Block markup is well formed',
	function () {
		foreach ( array( 'how-long-until', 'days-from-today', 'days-until' ) as $set ) {
			foreach ( entries( $set ) as $page ) {
				same( substr_count( $page['content'], '<!-- wp:' ), substr_count( $page['content'], '<!-- /wp:' ), $page['slug'] );
			}
		}
	}
);

test(
	'Server holidays match the JavaScript list (2026-2030 spot checks)',
	function () use ( $tz ) {
		$want = array(
			'easter'                 => array( '2026-04-05', '2027-03-28' ),
			'thanksgiving'           => array( '2026-11-26', '2027-11-25' ),
			'black-friday'           => array( '2026-11-27', '2027-11-26' ),
			'memorial-day'           => array( '2026-05-25' ),
			'labor-day'              => array( '2026-09-07' ),
			'mlk-day'                => array( '2026-01-19' ),
			'mothers-day'            => array( '2026-05-10' ),
			'fathers-day'            => array( '2026-06-21' ),
			'daylight-saving-starts' => array( '2026-03-08' ),
			'daylight-saving-ends'   => array( '2026-11-01' ),
			'super-bowl'             => array( '2026-02-08', '2027-02-14' ),
		);
		foreach ( $want as $key => $dates ) {
			foreach ( $dates as $i => $date ) {
				same( oc_tools_countdown_holiday_date( $key, 2026 + $i, $tz )->format( 'Y-m-d' ), $date, $key );
			}
		}
		same( count( oc_tools_countdown_holidays() ), 26 );
	}
);

test(
	'Server date math: next holiday, days, business days, months',
	function () use ( $tz ) {
		$now = new DateTimeImmutable( '2026-12-26 10:00', $tz );
		same( oc_tools_countdown_next_holiday( 'christmas', $now )->format( 'Y-m-d' ), '2027-12-25' );
		$oct = new DateTimeImmutable( '2026-10-29 15:00', $tz );
		same( oc_tools_countdown_add_days( $oct, 75 )->format( 'Y-m-d' ), '2027-01-12' );
		same( oc_tools_countdown_add_days( $oct, -75 )->format( 'Y-m-d' ), '2026-08-15' );
		same( oc_tools_countdown_add_days( $oct, 30, true )->format( 'Y-m-d' ), '2026-12-10' );
		$jan31 = new DateTimeImmutable( '2026-01-31 12:00', $tz );
		$r     = oc_tools_countdown_between( $jan31, new DateTimeImmutable( '2026-03-01 12:00', $tz ), false );
		same( array( $r['days'], $r['months'], $r['rem'] ), array( 29, 1, 1 ) );
		$r = oc_tools_countdown_between( new DateTimeImmutable( '2024-02-29 12:00', $tz ), new DateTimeImmutable( '2026-02-28 12:00', $tz ), false );
		same( array( $r['months'], $r['rem'] ), array( 23, 30 ) );
		same( oc_tools_countdown_parse_time( '3:30 pm' ), array( 15, 30 ) );
		same( oc_tools_countdown_parse_time( '25:00' ), null );
	}
);

test(
	'Shortcode options are whitelisted',
	function () {
		same(
			oc_tools_countdown_options(
				array(
					'mode'    => 'from',
					'days'    => '75',
					'tabs'    => '0',
					'holiday' => 'nope',
					'target'  => '2026-12-25',
				)
			),
			array(
				'mode' => 'from',
				'days' => 75,
				'tabs' => 0,
			)
		);
		same( oc_tools_countdown_options( array( 'mode' => 'time', 'target' => '3:30 pm' ) ), array( 'mode' => 'time', 'target' => '15:30' ) );
		same( oc_tools_countdown_options( array( 'days' => '20000', 'tabs' => 'yes', 'mode' => 'evil' ) ), array( 'mode' => 'time' ) );
		same( oc_tools_countdown_options( array( 'label' => '<b>Mom</b>\'s birthday party with a very long name here' ) ), array( 'label' => 'Mom\'s birthday party with a very long na' ) );
	}
);

test(
	'Focused pages print the computed sentence with fillable spans',
	function () {
		$html = oc_tools_countdown_render( 'x', array( 'mode' => 'from', 'days' => 75, 'tabs' => 0 ) );
		same( 1, preg_match( '/data-cd-intro="from" data-n="75">75 days from today is <span data-cd-i="f">[A-Z][a-z]+ \d+, \d{4}<\/span> \(a <span data-cd-i="w">[A-Z][a-z]+day<\/span>\)\. 75 days ago was /', $html ) );
		same( false === strpos( $html, 'role="tablist"' ), true, 'no tabs' );
		$html = oc_tools_countdown_render( 'x', array( 'mode' => 'date', 'holiday' => 'christmas', 'tabs' => 0 ) );
		same( 1, preg_match( '/Christmas is on <span data-cd-i="d">[A-Z][a-z]+day, December 25, \d{4}<\/span>\. That\'s <span data-cd-i="n">/', $html ) );
	}
);

test(
	'Related tools link only to the real page slugs, and only once the page is published',
	function () {
		$real = array( '/tools/take-home-pay/', '/tools/time-card-calculator/', '/tools/countdown/' );
		foreach ( oc_tools_related_map() as $name => $links ) {
			foreach ( $links as $link ) {
				same( in_array( $link['path'], $real, true ), true, $name . ' -> ' . $link['path'] );
			}
		}
		$html = oc_tools_related_html( 'time-card' );
		same( false !== strpos( $html, 'href="https://orbitcorner.com/tools/take-home-pay/"' ), true, 'take-home link' );
		same( false === strpos( $html, 'freelancer-take-home-calculator' ), true, 'old 404 link' );
		same( false !== strpos( $html, '/tools/countdown/' ), true, 'countdown link' );

		$pages                    = $GLOBALS['oc_test_pages'];
		$GLOBALS['oc_test_pages'] = array( 'tools/time-card-calculator', 'tools/take-home-pay' );
		$html                     = oc_tools_related_html( 'time-card' );
		same( false === strpos( $html, '/tools/countdown/' ), true, 'no countdown link before its page is live' );
		same( oc_tools_related_html( 'take-home' ), '', 'empty list prints nothing' );
		$GLOBALS['oc_test_pages'] = $pages;
	}
);

echo "\n" . $passed . ' passed, ' . $failed . " failed\n";
exit( $failed ? 1 : 0 );

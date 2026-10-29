<?php
/**
 * Page generator: Tools → OrbitCorner Pages.
 *
 * Creates search pages for the Countdown & Date Tool, such as /how-long-until/3-30-pm/,
 * /days-from-today/75/ and /days-until/christmas/, under three hub pages. Pages are made as
 * drafts, 50 at a time; you publish them yourself. Each page's static parts (headings, links,
 * holiday notes) are in its content; the sentences that depend on today come from the shortcode,
 * so they are always current.
 *
 * Generated pages are marked with post meta: _oc_tools_page_set, _oc_tools_page_key and
 * _oc_tools_page_label (the short name shown on the hub page).
 *
 * @package OrbitCorner_Tools
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'OC_TOOLS_PAGES_OPTION', 'oc_tools_pages' ); // Hub page ids, the layout page and the last log.
define( 'OC_TOOLS_PAGES_BATCH', 50 );

/*
 * -------------------------------------------------------------------------
 * Page sets
 * -------------------------------------------------------------------------
 */

/**
 * The page sets. Add a set here (or with the oc_tools_page_sets filter): 'entries' is a function
 * that takes the hub's URL and returns the pages, in the order they are generated.
 *
 * @return array Set key => array( title, summary, hub => array( title, slug, intro ), entries ).
 */
function oc_tools_page_sets() {
	$sets = array(
		'how-long-until'  => array(
			'title'   => 'How Long Until',
			'summary' => 'One page per 15 minutes of the day, e.g. /how-long-until/3-30-pm/. Whole and half hours are generated first.',
			'hub'     => array(
				'title' => 'How Long Until',
				'slug'  => 'how-long-until',
				'intro' => 'Live countdowns to every quarter hour of the day, from 12:00 AM to 11:45 PM. Pick a time to see how many hours, minutes and seconds are left, in your own time zone.',
			),
			'entries' => 'oc_tools_pages_time_entries',
		),
		'days-from-today' => array(
			'title'   => 'Days From Today',
			'summary' => '60 pages such as /days-from-today/75/: 1 to 30 days and popular counts up to 1,000.',
			'hub'     => array(
				'title' => 'Days From Today',
				'slug'  => 'days-from-today',
				'intro' => 'What date will it be in 30, 90 or 1,000 days? Pick a number to see the date that many days from today, the date that many days ago, and the answer in business days.',
			),
			'entries' => 'oc_tools_pages_from_entries',
		),
		'days-until'      => array(
			'title'   => 'Days Until',
			'summary' => 'One page per US holiday or event, e.g. /days-until/christmas/. The year in the title updates by itself.',
			'hub'     => array(
				'title' => 'Days Until',
				'slug'  => 'days-until',
				'intro' => 'Live countdowns to US holidays and events, from New Year\'s Day to New Year\'s Eve. Each page shows the date and the days, hours and minutes left, and moves on to next year once the day has passed.',
			),
			'entries' => 'oc_tools_pages_until_entries',
		),
	);
	return apply_filters( 'oc_tools_page_sets', $sets );
}

/**
 * Other tool pages linked under "Related", as paths from the home URL.
 *
 * @return array Title => path.
 */
function oc_tools_pages_tool_links() {
	$links = array(
		'Countdown & Date Calculator' => oc_tools_countdown_page_path(),
		'Time Card Calculator'        => '/tools/time-card-calculator/',
	);
	if ( get_page_by_path( 'tools/hours-calculator' ) ) {
		$links['Hours Calculator'] = '/tools/hours-calculator/';
	}
	return $links;
}

/*
 * Block markup, so the pages open as normal blocks in the editor.
 */

/**
 * A paragraph block.
 *
 * @param string $html Escaped inline HTML.
 * @return string
 */
function oc_tools_pages_paragraph( $html ) {
	return "<!-- wp:paragraph -->\n<p>" . $html . "</p>\n<!-- /wp:paragraph -->";
}

/**
 * A heading block (h2).
 *
 * @param string $text Heading.
 * @return string
 */
function oc_tools_pages_heading( $text ) {
	return "<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">" . esc_html( $text ) . "</h2>\n<!-- /wp:heading -->";
}

/**
 * A list block of links.
 *
 * @param array $links URL => link text.
 * @return string
 */
function oc_tools_pages_links( $links ) {
	$items = '';
	foreach ( $links as $url => $text ) {
		$items .= "<!-- wp:list-item -->\n<li><a href=\"" . esc_url( $url ) . '">' . esc_html( $text ) . "</a></li>\n<!-- /wp:list-item -->";
	}
	return "<!-- wp:list -->\n<ul class=\"wp-block-list\">" . $items . "</ul>\n<!-- /wp:list -->";
}

/**
 * A shortcode block.
 *
 * @param string $code Shortcode.
 * @return string
 */
function oc_tools_pages_shortcode_block( $code ) {
	return "<!-- wp:shortcode -->\n" . $code . "\n<!-- /wp:shortcode -->";
}

/**
 * The "Related" heading and links: the hub and the other tools.
 *
 * @param string $hub_url   Hub URL.
 * @param string $hub_text  Link text for the hub.
 * @return string
 */
function oc_tools_pages_related( $hub_url, $hub_text ) {
	$links = array( $hub_url => $hub_text );
	foreach ( oc_tools_pages_tool_links() as $title => $path ) {
		$links[ home_url( $path ) ] = $title;
	}
	return oc_tools_pages_heading( 'Related' ) . "\n\n" . oc_tools_pages_links( $links );
}

/**
 * Joins blocks with blank lines.
 *
 * @param array $blocks Block markup.
 * @return string
 */
function oc_tools_pages_join( $blocks ) {
	return implode( "\n\n", $blocks );
}

/*
 * How Long Until: 96 pages, one per 15 minutes.
 */

/**
 * 930 -> "3:30 PM"
 *
 * @param int $minutes Minutes after midnight.
 * @return string
 */
function oc_tools_pages_clock( $minutes ) {
	return gmdate( 'g:i A', $minutes * 60 );
}

/**
 * "3:30 PM" -> "3-30-pm"
 *
 * @param string $clock 12-hour time.
 * @return string
 */
function oc_tools_pages_clock_slug( $clock ) {
	return strtolower( str_replace( array( ':', ' ' ), '-', $clock ) );
}

/**
 * The 96 "How long until" pages: whole hours first, then half hours, then quarter hours.
 *
 * @param string $hub_url Hub URL, with a trailing slash.
 * @return array Key ("15:30") => page.
 */
function oc_tools_pages_time_entries( $hub_url ) {
	$marks = array_merge( range( 0, 1425, 60 ), range( 30, 1425, 60 ), range( 15, 1425, 30 ) );
	$pages = array();
	foreach ( $marks as $minutes ) {
		$clock = oc_tools_pages_clock( $minutes );
		$h     = intdiv( $minutes, 60 );
		$m     = $minutes % 60;
		$name  = $clock . ( 0 === $minutes ? ' (midnight)' : ( 720 === $minutes ? ' (noon)' : '' ) );
		$parts = array_filter( array( $h ? oc_tools_countdown_plural( $h, 'hour' ) : '', $m ? oc_tools_countdown_plural( $m, 'minute' ) : '' ) );
		$intro = $minutes
			? $name . ' is ' . oc_tools_countdown_join( $parts ) . ' into the day: ' . number_format( $minutes ) . ' minutes after midnight, ' . number_format( 1440 - $minutes ) . ' minutes before the day ends, and ' . sprintf( '%02d:%02d', $h, $m ) . ' in 24-hour time.'
			: $name . ' is the very start of the day: 1,440 minutes before the day ends, and 00:00 in 24-hour time.';

		$nearby = array();
		foreach ( array( -30, -15, 15, 30 ) as $step ) {
			$near                                            = ( $minutes + $step + 1440 ) % 1440;
			$nearby[ $hub_url . oc_tools_pages_clock_slug( oc_tools_pages_clock( $near ) ) . '/' ] = 'How long until ' . oc_tools_pages_clock( $near ) . '?';
		}

		$key           = sprintf( '%02d:%02d', $h, $m );
		$pages[ $key ] = array(
			'slug'    => oc_tools_pages_clock_slug( $clock ),
			'title'   => 'How Long Until ' . $clock . '? Live Countdown',
			'label'   => $clock,
			'order'   => $minutes,
			'content' => oc_tools_pages_join(
				array(
					oc_tools_pages_shortcode_block( '[orbit_tool name="countdown" mode="time" target="' . $key . '" tabs="0"]' ),
					oc_tools_pages_paragraph( esc_html( $intro ) ),
					oc_tools_pages_heading( 'Nearby times' ),
					oc_tools_pages_links( $nearby ),
					oc_tools_pages_related( $hub_url, 'All "How long until" countdowns' ),
				)
			),
		);
	}
	return $pages;
}

/*
 * Days From Today: 60 pages.
 */

/**
 * The day counts, in the order they are generated (the brief's list, then fillers to reach 60).
 *
 * @return array
 */
function oc_tools_pages_day_counts() {
	$main   = array_merge( range( 1, 30 ), array( 45, 60, 75, 90, 100, 120, 150, 180, 200, 250, 270, 300, 365, 500, 1000 ) );
	$filler = array( 35, 40, 50, 70, 80, 110, 130, 140, 160, 170, 190, 210, 240, 280, 320, 330, 340, 350, 360, 400 );
	return array_slice( array_values( array_unique( array_merge( $main, $filler ) ) ), 0, 60 );
}

/**
 * The 60 "days from today" pages.
 *
 * @param string $hub_url Hub URL, with a trailing slash.
 * @return array Key ("75") => page.
 */
function oc_tools_pages_from_entries( $hub_url ) {
	$counts = oc_tools_pages_day_counts();
	$pages  = array();
	foreach ( $counts as $n ) {
		// Nearby: 5, 10 and 15 days either side when those pages exist, topped up with the closest ones.
		$near = array_values( array_intersect( array( $n - 5, $n + 5, $n - 10, $n + 10, $n - 15, $n + 15 ), $counts ) );
		$rest = array_diff( $counts, $near, array( $n ) );
		usort(
			$rest,
			function ( $a, $b ) use ( $n ) {
				return abs( $a - $n ) - abs( $b - $n ) ?: $a - $b;
			}
		);
		$near = array_merge( $near, array_slice( $rest, 0, max( 0, 4 - count( $near ) ) ) );
		sort( $near );

		$nearby = array();
		foreach ( $near as $m ) {
			$nearby[ $hub_url . $m . '/' ] = oc_tools_countdown_plural( $m, 'day' ) . ' from today';
		}

		$days                  = oc_tools_countdown_plural( $n, 'day' );
		$pages[ (string) $n ] = array(
			'slug'    => (string) $n,
			'title'   => 'What Is ' . ucwords( $days ) . ' From Today? (Date Calculator)',
			'label'   => $days,
			'order'   => $n,
			'content' => oc_tools_pages_join(
				array(
					oc_tools_pages_shortcode_block( '[orbit_tool name="countdown" mode="from" days="' . $n . '" tabs="0"]' ),
					oc_tools_pages_paragraph( esc_html( 'Day 1 is tomorrow, so ' . $days . ' from today is the ' . oc_tools_pages_ordinal( $n ) . ' day after today. Business days skip Saturdays and Sundays; holidays are not skipped.' ) ),
					oc_tools_pages_heading( 'Nearby' ),
					oc_tools_pages_links( $nearby ),
					oc_tools_pages_related( $hub_url, 'All "days from today" pages' ),
				)
			),
		);
	}
	return $pages;
}

/**
 * 1 -> "1st", 22 -> "22nd", 111 -> "111th"
 *
 * @param int $n Number.
 * @return string
 */
function oc_tools_pages_ordinal( $n ) {
	$suffix = array( 'th', 'st', 'nd', 'rd' );
	$last   = $n % 10;
	return number_format( $n ) . ( $last > 3 || 1 === intdiv( $n % 100, 10 ) ? 'th' : $suffix[ $last ] );
}

/*
 * Days Until: one page per holiday.
 */

/**
 * For each holiday: how titles name it, and a short note for its page.
 *
 * @return array Key => array( title name, note ).
 */
function oc_tools_pages_holiday_notes() {
	return array(
		'new-years'              => array( 'New Year\'s', 'New Year\'s Day is January 1, the first day of the year and a federal holiday in the United States. Banks, schools and government offices are usually closed.' ),
		'mlk-day'                => array( 'MLK Day', 'Martin Luther King Jr. Day honors the civil rights leader, who was born on January 15, 1929. It is a federal holiday on the third Monday of January.' ),
		'super-bowl'             => array( 'the Super Bowl', 'The Super Bowl is the NFL\'s championship game, played on the second Sunday of February since 2022. The NFL confirms the date each season, so this countdown uses that pattern.' ),
		'valentines-day'         => array( 'Valentine\'s Day', 'Valentine\'s Day is February 14, a day for cards, flowers and time with the people you love. It is not a public holiday, so businesses and schools stay open.' ),
		'presidents-day'         => array( 'Presidents\' Day', 'Presidents\' Day is the common name for the federal holiday officially called Washington\'s Birthday. It falls on the third Monday of February.' ),
		'daylight-saving-starts' => array( 'Daylight Saving Time', 'In most of the United States, Daylight Saving Time starts at 2:00 AM on the second Sunday of March, when clocks move forward one hour. Hawaii and most of Arizona do not change their clocks.' ),
		'st-patricks-day'        => array( 'St. Patrick\'s Day', 'St. Patrick\'s Day is March 17, the feast day of Ireland\'s patron saint. In the United States it is known for parades and wearing green; it is not a federal holiday.' ),
		'spring'                 => array( 'Spring', 'Spring begins at the March equinox, around March 20 in the Northern Hemisphere. The exact date moves by a day from year to year, so this countdown uses March 20.' ),
		'easter'                 => array( 'Easter', 'Western Easter is the first Sunday after the church\'s spring full moon, so it falls between March 22 and April 25. Orthodox Easter is often on a later date.' ),
		'tax-day'                => array( 'Tax Day', 'Tax Day is April 15, the usual deadline for filing federal income tax returns with the IRS. When April 15 falls on a weekend or a holiday, the deadline moves to the next business day.' ),
		'mothers-day'            => array( 'Mother\'s Day', 'Mother\'s Day in the United States is the second Sunday of May. It has been a national observance since 1914.' ),
		'memorial-day'           => array( 'Memorial Day', 'Memorial Day honors the members of the U.S. military who died in service. It is a federal holiday on the last Monday of May and is often seen as the start of summer.' ),
		'juneteenth'             => array( 'Juneteenth', 'Juneteenth, June 19, marks the day in 1865 when enslaved people in Galveston, Texas, learned they were free. It became a federal holiday in 2021.' ),
		'fathers-day'            => array( 'Father\'s Day', 'Father\'s Day in the United States is the third Sunday of June. It has been a permanent national observance since 1972.' ),
		'summer'                 => array( 'Summer', 'Summer begins at the June solstice, the longest day of the year in the Northern Hemisphere, on June 20 or 21. This countdown uses June 21.' ),
		'4th-of-july'            => array( 'the 4th of July', 'Independence Day, July 4, celebrates the adoption of the Declaration of Independence in 1776. It is a federal holiday known for fireworks, parades and cookouts.' ),
		'labor-day'              => array( 'Labor Day', 'Labor Day honors American workers and is a federal holiday on the first Monday of September. Many people treat it as the end of summer.' ),
		'fall'                   => array( 'Fall', 'Fall begins at the September equinox, on September 22 or 23 in the Northern Hemisphere. This countdown uses September 22.' ),
		'halloween'              => array( 'Halloween', 'Halloween is October 31, known for costumes, carved pumpkins and trick-or-treating. It is not a public holiday.' ),
		'daylight-saving-ends'   => array( 'the End of Daylight Saving Time', 'Daylight Saving Time ends at 2:00 AM on the first Sunday of November, when clocks move back one hour in most of the United States. Hawaii and most of Arizona do not change their clocks.' ),
		'thanksgiving'           => array( 'Thanksgiving', 'Thanksgiving is a federal holiday on the fourth Thursday of November. It is traditionally a day for family meals and giving thanks.' ),
		'black-friday'           => array( 'Black Friday', 'Black Friday is the day after Thanksgiving and one of the biggest shopping days of the year in the United States. It is not a federal holiday, though some employers give the day off.' ),
		'winter'                 => array( 'Winter', 'Winter begins at the December solstice, the shortest day of the year in the Northern Hemisphere, on December 21 or 22. This countdown uses December 21.' ),
		'christmas-eve'          => array( 'Christmas Eve', 'Christmas Eve is December 24, the evening before Christmas Day. It is not a federal holiday, but many businesses close early.' ),
		'christmas'              => array( 'Christmas', 'Christmas Day, December 25, celebrates the birth of Jesus and is a federal holiday in the United States. Most businesses, schools and government offices are closed.' ),
		'new-years-eve'          => array( 'New Year\'s Eve', 'New Year\'s Eve is December 31, the last day of the year. Celebrations build to midnight, when the new year begins.' ),
	);
}

/**
 * The 26 "days until" pages. Titles are saved without a year; oc_tools_pages_add_year() adds it.
 *
 * @param string $hub_url Hub URL, with a trailing slash.
 * @return array Key ("christmas") => page.
 */
function oc_tools_pages_until_entries( $hub_url ) {
	$notes = oc_tools_pages_holiday_notes();
	$keys  = array_keys( oc_tools_countdown_holidays() );
	$pages = array();
	foreach ( $keys as $i => $key ) {
		$others = array();
		for ( $j = 1; $j <= 6; $j++ ) {
			$other                                = $keys[ ( $i + $j ) % count( $keys ) ];
			$others[ $hub_url . $other . '/' ] = 'Days until ' . $notes[ $other ][0];
		}
		$pages[ $key ] = array(
			'slug'    => $key,
			'title'   => 'How Many Days Until ' . $notes[ $key ][0] . '?',
			'label'   => oc_tools_countdown_holidays()[ $key ][0],
			'order'   => $i,
			'content' => oc_tools_pages_join(
				array(
					oc_tools_pages_shortcode_block( '[orbit_tool name="countdown" mode="date" holiday="' . $key . '" tabs="0"]' ),
					oc_tools_pages_paragraph( esc_html( $notes[ $key ][1] ) ),
					oc_tools_pages_heading( 'Other countdowns' ),
					oc_tools_pages_links( $others ),
					oc_tools_pages_related( $hub_url, 'All holiday countdowns' ),
				)
			),
		);
	}
	return $pages;
}

/*
 * -------------------------------------------------------------------------
 * State, hubs and generated pages
 * -------------------------------------------------------------------------
 */

/**
 * Saved state: array( 'hubs' => set => page id, 'layout' => page id, 'log' => lines ).
 *
 * @return array
 */
function oc_tools_pages_state() {
	$state = get_option( OC_TOOLS_PAGES_OPTION, array() );
	return wp_parse_args(
		is_array( $state ) ? $state : array(),
		array(
			'hubs'   => array(),
			'layout' => 0,
			'log'    => array(),
		)
	);
}

/**
 * Saves the state.
 *
 * @param array $state State.
 */
function oc_tools_pages_save_state( $state ) {
	update_option( OC_TOOLS_PAGES_OPTION, $state, false );
}

/**
 * The hub page of a set, if it still exists (not in the trash).
 *
 * @param string $set   Set key.
 * @param array  $state State.
 * @return int Page id or 0.
 */
function oc_tools_pages_hub( $set, $state ) {
	$id = isset( $state['hubs'][ $set ] ) ? (int) $state['hubs'][ $set ] : 0;
	return $id && 'page' === get_post_type( $id ) && 'trash' !== get_post_status( $id ) ? $id : 0;
}

/**
 * The hub's URL with a trailing slash. Works for draft hubs too (get_permalink() would not).
 *
 * @param int $hub Hub page id.
 * @return string
 */
function oc_tools_pages_hub_url( $hub ) {
	return home_url( '/' . get_page_uri( $hub ) . '/' );
}

/**
 * Copies the layout page's template and Kadence page settings (meta keys starting with _kad).
 *
 * @param int   $id    Page to update.
 * @param array $state State.
 */
function oc_tools_pages_copy_layout( $id, $state ) {
	$from = (int) $state['layout'];
	if ( ! $from || 'page' !== get_post_type( $from ) ) {
		return;
	}
	foreach ( get_post_meta( $from ) as $key => $values ) {
		if ( '_wp_page_template' === $key || 0 === strpos( $key, '_kad' ) ) {
			update_post_meta( $id, $key, maybe_unserialize( $values[0] ) );
		}
	}
}

/**
 * Finds or creates (as a draft) a set's hub page and remembers it.
 *
 * @param string $set   Set key.
 * @param array  $state State, updated in place.
 * @param array  $log   Log lines, added to.
 * @return int Hub page id, or 0 if it could not be created.
 */
function oc_tools_pages_ensure_hub( $set, &$state, &$log ) {
	$hub = oc_tools_pages_hub( $set, $state );
	if ( $hub ) {
		return $hub;
	}
	$sets  = oc_tools_page_sets();
	$info  = $sets[ $set ]['hub'];
	$found = get_page_by_path( $info['slug'] );
	if ( $found && 'trash' !== $found->post_status ) {
		$hub = $found->ID;
		/* translators: 1: page title, 2: page id. */
		$log[] = sprintf( 'Using the existing page "%1$s" (#%2$d) as the hub.', $found->post_title, $hub );
	} else {
		$hub = wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'draft',
				'post_title'   => $info['title'],
				'post_name'    => $info['slug'],
				'post_content' => oc_tools_pages_join( array( oc_tools_pages_paragraph( esc_html( $info['intro'] ) ), oc_tools_pages_shortcode_block( '[orbit_hub_list]' ) ) ),
			),
			true
		);
		if ( is_wp_error( $hub ) ) {
			$log[] = 'Could not create the hub page: ' . $hub->get_error_message();
			return 0;
		}
		oc_tools_pages_copy_layout( $hub, $state );
		$log[] = sprintf( 'Created the hub page "%1$s" as a draft (#%2$d).', $info['title'], $hub );
	}
	$state['hubs'][ $set ] = $hub;
	return $hub;
}

/**
 * The set's generated pages that are not in the trash.
 *
 * @param string $set Set key.
 * @return array Key => WP_Post.
 */
function oc_tools_pages_existing( $set ) {
	$posts = get_posts(
		array(
			'post_type'   => 'page',
			'post_status' => array( 'publish', 'draft', 'pending', 'private', 'future' ),
			'numberposts' => -1,
			'meta_key'    => '_oc_tools_page_set', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Admin screen only.
			'meta_value'  => $set, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Admin screen only.
		)
	);
	$found = array();
	foreach ( $posts as $post ) {
		$found[ (string) get_post_meta( $post->ID, '_oc_tools_page_key', true ) ] = $post;
	}
	return $found;
}

/**
 * Creates up to OC_TOOLS_PAGES_BATCH missing pages of a set as drafts.
 *
 * @param string $set   Set key.
 * @param array  $state State, updated in place.
 * @param array  $log   Log lines.
 */
function oc_tools_pages_generate( $set, &$state, &$log ) {
	$hub = oc_tools_pages_ensure_hub( $set, $state, $log );
	if ( ! $hub ) {
		return;
	}
	oc_tools_pages_save_state( $state ); // The slug filter needs to know the hub.
	$sets     = oc_tools_page_sets();
	$entries  = call_user_func( $sets[ $set ]['entries'], oc_tools_pages_hub_url( $hub ) );
	$existing = oc_tools_pages_existing( $set );
	$made     = 0;
	$skipped  = 0;

	foreach ( $entries as $key => $page ) {
		if ( isset( $existing[ (string) $key ] ) ) {
			continue;
		}
		if ( $made >= OC_TOOLS_PAGES_BATCH ) {
			break;
		}
		$taken = get_page_by_path( get_page_uri( $hub ) . '/' . $page['slug'] );
		if ( $taken && 'trash' !== $taken->post_status ) {
			$log[] = sprintf( 'Skipped %1$s: page #%2$d already uses that address.', $page['slug'], $taken->ID );
			++$skipped;
			continue;
		}
		$id = wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'draft',
				'post_parent'  => $hub,
				'post_name'    => $page['slug'],
				'post_title'   => $page['title'],
				'post_content' => $page['content'],
				'menu_order'   => $page['order'],
				'meta_input'   => array(
					'_oc_tools_page_set'   => $set,
					'_oc_tools_page_key'   => (string) $key,
					'_oc_tools_page_label' => $page['label'],
				),
			),
			true
		);
		if ( is_wp_error( $id ) ) {
			$log[] = sprintf( 'Could not create %1$s: %2$s', $page['slug'], $id->get_error_message() );
			continue;
		}
		oc_tools_pages_copy_layout( $id, $state );
		++$made;
	}
	$left  = count( $entries ) - count( $existing ) - $made - $skipped;
	$log[] = sprintf( 'Created %1$d draft pages. %2$d still to create.', $made, max( 0, $left ) );
}

/**
 * Publishes the set's drafts, and its hub if that is still a draft.
 *
 * @param string $set   Set key.
 * @param array  $state State.
 * @param array  $log   Log lines.
 */
function oc_tools_pages_publish( $set, $state, &$log ) {
	$hub = oc_tools_pages_hub( $set, $state );
	if ( $hub && 'draft' === get_post_status( $hub ) ) {
		wp_update_post(
			array(
				'ID'          => $hub,
				'post_status' => 'publish',
			)
		);
		$log[] = 'Published the hub page.';
	}
	$count = 0;
	foreach ( oc_tools_pages_existing( $set ) as $post ) {
		if ( 'draft' === $post->post_status ) {
			wp_update_post(
				array(
					'ID'          => $post->ID,
					'post_status' => 'publish',
				)
			);
			++$count;
		}
	}
	$log[] = sprintf( 'Published %d pages.', $count );
}

/**
 * Rewrites the content (and hub label) of the set's existing pages; slugs, titles and status stay.
 *
 * @param string $set   Set key.
 * @param array  $state State.
 * @param array  $log   Log lines.
 */
function oc_tools_pages_regenerate( $set, $state, &$log ) {
	$hub = oc_tools_pages_hub( $set, $state );
	if ( ! $hub ) {
		$log[] = 'There is no hub page yet, so there is nothing to update.';
		return;
	}
	$sets    = oc_tools_page_sets();
	$entries = call_user_func( $sets[ $set ]['entries'], oc_tools_pages_hub_url( $hub ) );
	$count   = 0;
	foreach ( oc_tools_pages_existing( $set ) as $key => $post ) {
		if ( isset( $entries[ $key ] ) ) {
			wp_update_post(
				array(
					'ID'           => $post->ID,
					'post_content' => $entries[ $key ]['content'],
				)
			);
			update_post_meta( $post->ID, '_oc_tools_page_label', $entries[ $key ]['label'] );
			++$count;
		}
	}
	$log[] = sprintf( 'Updated the content of %d pages.', $count );
}

/*
 * -------------------------------------------------------------------------
 * Admin page: Tools → OrbitCorner Pages
 * -------------------------------------------------------------------------
 */

/**
 * Adds the admin page.
 */
function oc_tools_pages_menu() {
	add_management_page( 'OrbitCorner Pages', 'OrbitCorner Pages', 'manage_options', 'oc-tools-pages', 'oc_tools_pages_render_admin' );
}
add_action( 'admin_menu', 'oc_tools_pages_menu' );

/**
 * A submit button for the generator form.
 *
 * @param string $do      Action.
 * @param string $label   Button text.
 * @param string $class   Button class.
 * @param string $confirm Confirmation question, or ''.
 * @return string
 */
function oc_tools_pages_button( $do, $label, $class, $confirm = '' ) {
	$onclick = $confirm ? ' onclick="return confirm(\'' . esc_js( $confirm ) . '\');"' : '';
	return '<button type="submit" name="oc_do" value="' . esc_attr( $do ) . '" class="button ' . esc_attr( $class ) . '"' . $onclick . '>' . esc_html( $label ) . '</button> ';
}

/**
 * Prints the admin page.
 */
function oc_tools_pages_render_admin() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$state = oc_tools_pages_state();
	$sets  = oc_tools_page_sets();
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only shows a notice.
	$done = isset( $_GET['oc_done'] ) ? sanitize_key( wp_unslash( $_GET['oc_done'] ) ) : '';
	?>
	<div class="wrap">
		<h1>OrbitCorner Pages</h1>
		<p>Creates search pages for the Countdown &amp; Date Tool as <strong>drafts</strong>, <?php echo (int) OC_TOOLS_PAGES_BATCH; ?> at a time. Review a few, publish the batch, then wait for Search Console before the next one. Clear LiteSpeed Cache after publishing.</p>

		<?php if ( $done && $state['log'] ) : ?>
			<div class="notice notice-<?php echo 'error' === $done ? 'error' : 'success'; ?> is-dismissible">
				<?php foreach ( $state['log'] as $line ) : ?>
					<p><?php echo esc_html( $line ); ?></p>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="oc_tools_pages">
			<?php wp_nonce_field( 'oc_tools_pages' ); ?>
			<h2>Page settings</h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="oc-layout">Copy layout from</label></th>
					<td>
						<?php
						wp_dropdown_pages(
							array(
								'name'              => 'oc_layout',
								'id'                => 'oc-layout',
								'selected'          => (int) $state['layout'],
								'show_option_none'  => '— Theme default —',
								'option_none_value' => '0',
								'post_status'       => array( 'publish', 'draft', 'private' ),
							)
						);
						?>
						<p class="description">New pages get this page's template and Kadence page settings, e.g. your tool page with the normal content width.</p>
					</td>
				</tr>
			</table>
			<p><?php echo oc_tools_pages_button( 'settings', 'Save settings', 'button-secondary' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the function. ?>
			<?php echo oc_tools_pages_button( 'hubs', 'Create missing hub pages', 'button-secondary' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the function. ?></p>
		</form>

		<?php
		foreach ( $sets as $key => $set ) :
			$hub      = oc_tools_pages_hub( $key, $state );
			$existing = oc_tools_pages_existing( $key );
			$total    = count( call_user_func( $set['entries'], $hub ? oc_tools_pages_hub_url( $hub ) : home_url( '/' . $set['hub']['slug'] . '/' ) ) );
			$statuses = array_count_values( wp_list_pluck( $existing, 'post_status' ) );
			$drafts   = isset( $statuses['draft'] ) ? $statuses['draft'] : 0;
			$live     = isset( $statuses['publish'] ) ? $statuses['publish'] : 0;
			?>
			<hr>
			<h2><?php echo esc_html( $set['title'] ); ?></h2>
			<p><?php echo esc_html( $set['summary'] ); ?></p>
			<table class="widefat striped" style="max-width:640px">
				<thead><tr><th>Total</th><th>Created</th><th>Drafts</th><th>Published</th><th>Still to create</th></tr></thead>
				<tbody><tr><td><?php echo (int) $total; ?></td><td><?php echo count( $existing ); ?></td><td><?php echo (int) $drafts; ?></td><td><?php echo (int) $live; ?></td><td><?php echo (int) max( 0, $total - count( $existing ) ); ?></td></tr></tbody>
			</table>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="oc_tools_pages">
				<input type="hidden" name="oc_set" value="<?php echo esc_attr( $key ); ?>">
				<?php wp_nonce_field( 'oc_tools_pages' ); ?>
				<p>
					<label for="<?php echo esc_attr( 'oc-hub-' . $key ); ?>"><strong>Hub page</strong></label><br>
					<?php
					wp_dropdown_pages(
						array(
							'name'              => 'oc_hub',
							'id'                => 'oc-hub-' . $key,
							'selected'          => $hub,
							'show_option_none'  => '— Create "' . $set['hub']['title'] . '" (/' . $set['hub']['slug'] . '/) automatically —',
							'option_none_value' => '0',
							'post_status'       => array( 'publish', 'draft', 'private' ),
						)
					);
					?>
					<?php if ( $hub ) : ?>
						<a href="<?php echo esc_url( get_edit_post_link( $hub ) ); ?>">Edit hub</a> (<?php echo esc_html( get_post_status( $hub ) ); ?>)
					<?php endif; ?>
				</p>
				<p>
					<?php
					// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the function.
					echo oc_tools_pages_button( 'generate', 'Generate next ' . OC_TOOLS_PAGES_BATCH, 'button-primary' );
					echo oc_tools_pages_button( 'publish', 'Publish all drafts in this set', 'button-secondary', 'Publish all ' . $drafts . ' draft pages in "' . $set['title'] . '" (and the hub if it is a draft)?' );
					echo oc_tools_pages_button( 'regenerate', 'Regenerate content', 'button-secondary', 'Rewrite the content of every page in "' . $set['title'] . '" from the current template? Slugs, titles and status stay the same; edits you made to their content are replaced.' );
					// phpcs:enable
					?>
				</p>
			</form>
		<?php endforeach; ?>
	</div>
	<?php
}

/**
 * Handles the generator's buttons (admin-post.php?action=oc_tools_pages).
 */
function oc_tools_pages_handle() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to do this.', 'orbitcorner-tools' ), 403 );
	}
	check_admin_referer( 'oc_tools_pages' );

	$sets  = oc_tools_page_sets();
	$state = oc_tools_pages_state();
	$do    = isset( $_POST['oc_do'] ) ? sanitize_key( wp_unslash( $_POST['oc_do'] ) ) : '';
	$set   = isset( $_POST['oc_set'] ) ? sanitize_key( wp_unslash( $_POST['oc_set'] ) ) : '';
	$log   = array();
	$done  = 'ok';

	if ( 'settings' === $do ) {
		$layout          = isset( $_POST['oc_layout'] ) ? absint( wp_unslash( $_POST['oc_layout'] ) ) : 0;
		$state['layout'] = $layout && 'page' === get_post_type( $layout ) ? $layout : 0;
		$log[]           = $state['layout'] ? 'Saved. New pages copy the layout of "' . get_the_title( $state['layout'] ) . '".' : 'Saved. New pages use the theme default layout.';
	} elseif ( 'hubs' === $do ) {
		foreach ( array_keys( $sets ) as $key ) {
			if ( oc_tools_pages_hub( $key, $state ) ) {
				$log[] = $sets[ $key ]['title'] . ': hub page already set.';
			} else {
				oc_tools_pages_ensure_hub( $key, $state, $log );
			}
		}
	} elseif ( isset( $sets[ $set ] ) && in_array( $do, array( 'generate', 'publish', 'regenerate' ), true ) ) {
		$hub = isset( $_POST['oc_hub'] ) ? absint( wp_unslash( $_POST['oc_hub'] ) ) : 0;
		if ( $hub && 'page' === get_post_type( $hub ) ) {
			$state['hubs'][ $set ] = $hub;
		}
		$log[] = $sets[ $set ]['title'] . ':';
		if ( 'generate' === $do ) {
			oc_tools_pages_generate( $set, $state, $log );
		} elseif ( 'publish' === $do ) {
			oc_tools_pages_publish( $set, $state, $log );
		} else {
			oc_tools_pages_regenerate( $set, $state, $log );
		}
	} else {
		$log[] = 'Unknown action.';
		$done  = 'error';
	}

	$state['log'] = $log;
	oc_tools_pages_save_state( $state );
	wp_safe_redirect( add_query_arg( 'oc_done', $done, admin_url( 'tools.php?page=oc-tools-pages' ) ) );
	exit;
}
add_action( 'admin_post_oc_tools_pages', 'oc_tools_pages_handle' );

/*
 * -------------------------------------------------------------------------
 * Front end: hub list, titles, SEO, breadcrumbs, all-digit slugs
 * -------------------------------------------------------------------------
 */

/**
 * [orbit_hub_list]: the current page's published child pages as a grid of links.
 * parent="123" lists another page's children.
 *
 * @param array|string $atts Shortcode attributes.
 * @return string
 */
function oc_tools_hub_list_shortcode( $atts ) {
	$atts   = shortcode_atts( array( 'parent' => 0 ), $atts, 'orbit_hub_list' );
	$parent = absint( $atts['parent'] ) ? absint( $atts['parent'] ) : get_the_ID();
	$pages  = $parent ? get_pages(
		array(
			'parent'      => $parent,
			'sort_column' => 'menu_order,post_title',
		)
	) : array();
	if ( ! $pages ) {
		return current_user_can( 'edit_posts' ) ? '<p>' . esc_html__( 'OrbitCorner Tools: no published pages under this page yet. (Only editors see this message.)', 'orbitcorner-tools' ) . '</p>' : '';
	}
	wp_enqueue_style( 'oc-tools' );
	$items = '';
	foreach ( $pages as $page ) {
		$label  = get_post_meta( $page->ID, '_oc_tools_page_label', true );
		$items .= '<li><a href="' . esc_url( get_permalink( $page ) ) . '">' . esc_html( $label ? $label : get_the_title( $page ) ) . '</a></li>';
	}
	return '<div class="oc-app"><ul class="oc-hub">' . $items . '</ul></div>';
}
add_shortcode( 'orbit_hub_list', 'oc_tools_hub_list_shortcode' );

/**
 * The set and key of a generated page, or empty strings.
 *
 * @param int $post_id Post id.
 * @return array( set, key )
 */
function oc_tools_pages_meta( $post_id ) {
	return $post_id ? array( (string) get_post_meta( $post_id, '_oc_tools_page_set', true ), (string) get_post_meta( $post_id, '_oc_tools_page_key', true ) ) : array( '', '' );
}

/**
 * Days-until pages: "How Many Days Until Christmas?" -> "How Many Days Until Christmas 2026?",
 * with the year of the holiday's next date (Eastern Time). Titles that already have a year stay.
 *
 * @param string $title   Title.
 * @param int    $post_id Post id.
 * @return string
 */
function oc_tools_pages_add_year( $title, $post_id = 0 ) {
	list( $set, $key ) = oc_tools_pages_meta( $post_id );
	if ( 'days-until' !== $set || preg_match( '/\b(19|20)\d\d\b/', $title ) ) {
		return $title;
	}
	$date = oc_tools_countdown_next_holiday( $key, new DateTimeImmutable( 'now', oc_tools_countdown_zone() ) );
	if ( ! $date ) {
		return $title;
	}
	$year = $date->format( 'Y' );
	return '?' === substr( $title, -1 ) ? substr( $title, 0, -1 ) . ' ' . $year . '?' : $title . ' ' . $year;
}
add_filter( 'the_title', 'oc_tools_pages_add_year', 10, 2 );

/**
 * The SEO title and description of the current generated page, or null.
 *
 * @return array|null array( title, description )
 */
function oc_tools_pages_seo() {
	if ( ! is_singular( 'page' ) ) {
		return null;
	}
	$id                = get_queried_object_id();
	list( $set, $key ) = oc_tools_pages_meta( $id );
	$now               = new DateTimeImmutable( 'now', oc_tools_countdown_zone() );
	$title             = oc_tools_pages_add_year( get_post_field( 'post_title', $id ), $id ) . ' | ' . get_bloginfo( 'name' );
	if ( 'how-long-until' === $set ) {
		$clock = oc_tools_pages_clock( (int) substr( $key, 0, 2 ) * 60 + (int) substr( $key, 3, 2 ) );
		$desc  = 'See exactly how long until ' . $clock . ': a live countdown in hours, minutes and seconds, in your own time zone. Free, with no sign-up.';
	} elseif ( 'days-from-today' === $set ) {
		$days = oc_tools_countdown_plural( (int) $key, 'day' );
		$desc = $days . ' from today is ' . oc_tools_countdown_add_days( $now, (int) $key )->format( 'l, F j, Y' ) . '. See the date ' . $days . ' ago and ' . (int) $key . ' business days from today too.';
	} elseif ( 'days-until' === $set && oc_tools_countdown_next_holiday( $key, $now ) ) {
		$date = oc_tools_countdown_next_holiday( $key, $now );
		$name = oc_tools_countdown_holidays()[ $key ][0];
		$days = oc_tools_countdown_days( $now, $date );
		$desc = ( $days ? 'There are ' . oc_tools_countdown_plural( $days, 'day' ) . ' until ' : 'Today is ' ) . $name . ' ' . $date->format( 'Y' ) . ' (' . $date->format( 'l, F j' ) . '). Live countdown in days, hours, minutes and seconds.';
	} else {
		return null;
	}
	return array( $title, $desc );
}

/**
 * Whether All in One SEO has a custom value for this page's title or description.
 *
 * @param string $field 'title' or 'description'.
 * @return bool
 */
function oc_tools_pages_aioseo_custom( $field ) {
	if ( ! function_exists( 'aioseo' ) ) {
		return false;
	}
	$aioseo = aioseo();
	if ( ! isset( $aioseo->meta->metaData ) || ! method_exists( $aioseo->meta->metaData, 'getMetaData' ) ) {
		return false;
	}
	$meta = $aioseo->meta->metaData->getMetaData( get_queried_object_id() );
	return is_object( $meta ) && ! empty( $meta->$field );
}

/**
 * All in One SEO title for generated pages, unless you set one for the page in AIOSEO.
 *
 * @param string $title Title.
 * @return string
 */
function oc_tools_pages_aioseo_title( $title ) {
	$seo = oc_tools_pages_seo();
	return $seo && ! oc_tools_pages_aioseo_custom( 'title' ) ? $seo[0] : $title;
}
add_filter( 'aioseo_title', 'oc_tools_pages_aioseo_title' );

/**
 * All in One SEO description for generated pages, unless you set one for the page in AIOSEO.
 *
 * @param string $description Description.
 * @return string
 */
function oc_tools_pages_aioseo_description( $description ) {
	$seo = oc_tools_pages_seo();
	return $seo && ! oc_tools_pages_aioseo_custom( 'description' ) ? $seo[1] : $description;
}
add_filter( 'aioseo_description', 'oc_tools_pages_aioseo_description' );

/**
 * Without All in One SEO: the <title> of days-until pages gets the year too.
 *
 * @param array $parts Title parts.
 * @return array
 */
function oc_tools_pages_document_title( $parts ) {
	if ( is_singular( 'page' ) && isset( $parts['title'] ) ) {
		$parts['title'] = oc_tools_pages_add_year( $parts['title'], get_queried_object_id() );
	}
	return $parts;
}
add_filter( 'document_title_parts', 'oc_tools_pages_document_title' );

/**
 * BreadcrumbList JSON-LD (Home › Hub › Page) on generated pages, unless All in One SEO is active
 * (it adds its own breadcrumbs to its schema).
 */
function oc_tools_pages_breadcrumbs() {
	if ( function_exists( 'aioseo' ) || ! is_singular( 'page' ) ) {
		return;
	}
	$id         = get_queried_object_id();
	list( $set ) = oc_tools_pages_meta( $id );
	$hub        = wp_get_post_parent_id( $id );
	if ( ! $set || ! $hub ) {
		return;
	}
	$items = array();
	foreach ( array( array( get_bloginfo( 'name' ), home_url( '/' ) ), array( get_the_title( $hub ), get_permalink( $hub ) ), array( get_the_title( $id ), get_permalink( $id ) ) ) as $i => $crumb ) {
		$items[] = array(
			'@type'    => 'ListItem',
			'position' => $i + 1,
			'name'     => wp_strip_all_tags( $crumb[0] ),
			'item'     => $crumb[1],
		);
	}
	$data = array(
		'@context'        => 'https://schema.org',
		'@type'           => 'BreadcrumbList',
		'itemListElement' => $items,
	);
	echo '<script type="application/ld+json">' . wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "</script>\n";
}
add_action( 'wp_head', 'oc_tools_pages_breadcrumbs' );

/**
 * Hides list links to generated pages that aren't published yet (the next batch), so a
 * published page never links to a page that would be a 404.
 *
 * @param string $content Page content.
 * @return string
 */
function oc_tools_pages_hide_draft_links( $content ) {
	list( $set ) = oc_tools_pages_meta( get_the_ID() );
	$hub         = wp_get_post_parent_id( get_the_ID() );
	if ( ! $set || ! $hub || ! in_the_loop() ) {
		return $content;
	}
	$base = oc_tools_pages_hub_url( $hub );
	return preg_replace_callback(
		'#<li>\s*<a href="' . preg_quote( esc_url( $base ), '#' ) . '([^"/]+)/">.*?</a>\s*</li>#',
		function ( $match ) use ( $hub ) {
			$page = get_page_by_path( get_page_uri( $hub ) . '/' . $match[1] );
			return $page && 'publish' === $page->post_status ? $match[0] : '';
		},
		$content
	);
}
add_filter( 'the_content', 'oc_tools_pages_hide_draft_links', 20 );

/**
 * WordPress gives an all-digit page slug a "-2" (it could be read as a page number). Generated
 * pages keep theirs, e.g. /days-from-today/75/, unless another page under the hub uses it.
 *
 * @param string|null $override    Slug to use, or null to let WordPress decide.
 * @param string      $slug        Wanted slug.
 * @param int         $post_id     Post id.
 * @param string      $post_status Post status.
 * @param string      $post_type   Post type.
 * @param int         $post_parent Parent id.
 * @return string|null
 */
function oc_tools_pages_digit_slug( $override, $slug, $post_id, $post_status, $post_type, $post_parent ) {
	if ( null !== $override || 'page' !== $post_type || ! $post_parent || ! preg_match( '/^\d+$/', $slug ) || ! get_post_meta( $post_id, '_oc_tools_page_set', true ) ) {
		return $override;
	}
	$taken = get_posts(
		array(
			'post_type'    => 'page',
			'post_parent'  => $post_parent,
			'name'         => $slug,
			'post_status'  => 'any',
			'post__not_in' => array( $post_id ),
			'fields'       => 'ids',
			'numberposts'  => 1,
		)
	);
	return $taken ? $override : $slug;
}
add_filter( 'pre_wp_unique_post_slug', 'oc_tools_pages_digit_slug', 10, 6 );

/**
 * /days-from-today/75/ is matched as page 75 of the hub. Points it to the generated page instead.
 *
 * @param array $vars Query vars.
 * @return array
 */
function oc_tools_pages_request( $vars ) {
	if ( empty( $vars['pagename'] ) || empty( $vars['page'] ) ) {
		return $vars;
	}
	$path = trim( $vars['pagename'], '/' ) . '/' . trim( $vars['page'], '/' );
	$page = get_page_by_path( $path );
	if ( $page && get_post_meta( $page->ID, '_oc_tools_page_set', true ) ) {
		$vars['pagename'] = $path;
		unset( $vars['page'] );
	}
	return $vars;
}
add_filter( 'request', 'oc_tools_pages_request' );

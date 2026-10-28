<?php
/**
 * Plugin Name:       OrbitCorner Tools
 * Plugin URI:        https://orbitcorner.com/tools/
 * Description:       Free browser-based tools for OrbitCorner. Add a tool to any page or post with a shortcode, e.g. [orbit_tool name="time-card"].
 * Version:           1.2.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Orbit Innovation
 * License:           GPL-2.0-or-later
 * Text Domain:       orbitcorner-tools
 *
 * @package OrbitCorner_Tools
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'OC_TOOLS_VERSION', '1.2.0' );
define( 'OC_TOOLS_DIR', plugin_dir_path( __FILE__ ) );
define( 'OC_TOOLS_URL', plugin_dir_url( __FILE__ ) );
define( 'OC_TOOLS_OPTION', 'oc_tools_rates' );
define( 'OC_TOOLS_DRAFT', 'oc_tools_rates_draft' ); // Transient that keeps a rejected edit for 5 minutes.

require_once OC_TOOLS_DIR . 'tools/time-card/time-card.php';

/*
 * -------------------------------------------------------------------------
 * Tool registry
 * -------------------------------------------------------------------------
 */

/**
 * All tools the plugin can show.
 *
 * To add a tool: create tools/<folder>/ with its scripts and add one entry here.
 *
 * Optional keys:
 *   description One or two sentences for search engines; the shortcode then prints a
 *              SoftwareApplication JSON-LD block once per page.
 *   rates      true if the tool needs window.OCToolData (the rates.json data).
 *   render     Function( $uid, $options ) that returns the tool's HTML, printed inside the
 *              container. Without it the container shows "Loading…" until the script builds the tool.
 *   options    Function( $atts ) that returns the tool's cleaned shortcode attributes, passed to
 *              render and to the browser as data-oc-options.
 *   min_height array( 'phone' => px, 'desktop' => px ): reserves the tool's height so the page
 *              doesn't jump while it loads. Use the smallest height measured in each range
 *              (phone: up to 599px wide, desktop: 600px and up).
 *
 * @return array
 */
function oc_tools_registry() {
	return array(
		'take-home' => array(
			'title'   => 'Freelancer Take-Home Calculator',
			'folder'  => 'take-home',
			'scripts' => array( 'calc.js', 'app.js' ), // Load order matters.
			'rates'   => true,
		),
		'time-card' => array(
			'title'       => 'Time Card Calculator',
			'description' => 'Add up your weekly work hours with breaks, night shifts and overtime (weekly, daily or California rules), see your gross pay, then print or download your time card. Free, no sign-up.',
			'folder'      => 'time-card',
			'scripts'     => array( 'time-card-calc.js', 'app.js' ),
			'render'      => 'oc_tools_time_card_render',
			'options'     => 'oc_tools_time_card_options',
			'min_height'  => array( // Measured: 2319px at 599px wide, 1354px at 1280px (tests/preview-time-card.html).
				'phone'   => 2250,
				'desktop' => 1300,
			),
		),
	);
}

/**
 * Script handle for one of a tool's files, e.g. "oc-tool-take-home-calc".
 *
 * @param string $name Tool name (registry key).
 * @param string $file Script file name.
 * @return string
 */
function oc_tools_script_handle( $name, $file ) {
	return 'oc-tool-' . $name . '-' . sanitize_key( basename( $file, '.js' ) );
}

/**
 * Asset version based on the file's last change, so browsers fetch new files after each upload.
 *
 * @param string $relative_path Path inside the plugin folder.
 * @return string
 */
function oc_tools_asset_version( $relative_path ) {
	$path = OC_TOOLS_DIR . $relative_path;
	return file_exists( $path ) ? (string) filemtime( $path ) : OC_TOOLS_VERSION;
}

/*
 * -------------------------------------------------------------------------
 * Front-end assets
 * -------------------------------------------------------------------------
 */

/**
 * Registers (does not enqueue) the shared stylesheet and every tool's scripts.
 */
function oc_tools_register_assets() {
	$css = 'assets/oc-tools.css';
	wp_register_style( 'oc-tools', OC_TOOLS_URL . $css, array(), oc_tools_asset_version( $css ) );

	foreach ( oc_tools_registry() as $name => $tool ) {
		$deps = array();
		foreach ( $tool['scripts'] as $file ) {
			$rel    = 'tools/' . $tool['folder'] . '/' . $file;
			$handle = oc_tools_script_handle( $name, $file );
			wp_register_script( $handle, OC_TOOLS_URL . $rel, $deps, oc_tools_asset_version( $rel ), true );
			$deps = array( $handle );
		}
	}
}
add_action( 'wp_enqueue_scripts', 'oc_tools_register_assets', 5 );

/**
 * Loads the stylesheet in the <head> on posts and pages that use the shortcode,
 * so the tool doesn't flash unstyled before the footer.
 */
function oc_tools_enqueue_style_early() {
	if ( ! is_singular() ) {
		return;
	}
	$post = get_post();
	if ( $post && has_shortcode( $post->post_content, 'orbit_tool' ) ) {
		wp_enqueue_style( 'oc-tools' );
	}
}
add_action( 'wp_enqueue_scripts', 'oc_tools_enqueue_style_early', 20 );

/*
 * -------------------------------------------------------------------------
 * Shortcode: [orbit_tool name="take-home"], [orbit_tool name="time-card" rate="20" ot="daily" rounding="15"]
 * -------------------------------------------------------------------------
 */

/**
 * Outputs a tool's container and loads its files.
 *
 * @param array|string $atts Shortcode attributes.
 * @return string
 */
function oc_tools_shortcode( $atts ) {
	static $counts    = array();
	static $data_sent = false;

	// Tool settings; each tool's 'options' function decides which it accepts and cleans them.
	$atts     = shortcode_atts(
		array(
			'name'     => '',
			'rate'     => '',
			'ot'       => '',
			'rounding' => '',
		),
		$atts,
		'orbit_tool'
	);
	$name     = sanitize_key( $atts['name'] );
	$registry = oc_tools_registry();

	// Some page builders render shortcodes before wp_enqueue_scripts has run.
	if ( ! wp_style_is( 'oc-tools', 'registered' ) ) {
		oc_tools_register_assets();
	}

	if ( ! isset( $registry[ $name ] ) ) {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return '';
		}
		wp_enqueue_style( 'oc-tools' );
		$message = sprintf(
			/* translators: 1: tool name from the shortcode, 2: list of valid tool names. */
			__( 'OrbitCorner Tools: there is no tool called "%1$s". Available tools: %2$s. (Only editors see this message.)', 'orbitcorner-tools' ),
			$name,
			implode( ', ', array_keys( $registry ) )
		);
		return '<div class="oc-app"><p class="oc-app-error">' . esc_html( $message ) . '</p></div>';
	}

	$tool    = $registry[ $name ];
	$handles = array();
	foreach ( $tool['scripts'] as $file ) {
		$handles[] = oc_tools_script_handle( $name, $file );
	}

	wp_enqueue_style( 'oc-tools' );
	foreach ( $handles as $handle ) {
		wp_enqueue_script( $handle );
	}

	if ( ! $data_sent && $handles && ! empty( $tool['rates'] ) ) {
		// JSON_HEX_TAG turns < and > into < / > so the data can never close the <script> tag.
		$json = wp_json_encode( oc_tools_get_rates(), JSON_HEX_TAG | JSON_HEX_AMP );
		wp_add_inline_script( $handles[0], 'window.OCToolData = ' . $json . ';', 'before' );
		$data_sent = true;
	}

	$counts[ $name ] = isset( $counts[ $name ] ) ? $counts[ $name ] + 1 : 1;
	$uid             = 'oc-app-' . $name . '-' . $counts[ $name ];
	$options         = isset( $tool['options'] ) && is_callable( $tool['options'] ) ? (array) call_user_func( $tool['options'], $atts ) : array();

	$attributes = ' id="' . esc_attr( $uid ) . '" data-oc-tool="' . esc_attr( $name ) . '"';
	if ( $options ) {
		$attributes .= ' data-oc-options="' . esc_attr( wp_json_encode( $options ) ) . '"';
	}
	if ( ! empty( $tool['min_height'] ) ) {
		$attributes .= sprintf(
			' style="--oc-mh:%dpx;--oc-mh-sm:%dpx"',
			isset( $tool['min_height']['desktop'] ) ? (int) $tool['min_height']['desktop'] : 0,
			isset( $tool['min_height']['phone'] ) ? (int) $tool['min_height']['phone'] : 0
		);
	}

	if ( isset( $tool['render'] ) && is_callable( $tool['render'] ) ) {
		$inner = call_user_func( $tool['render'], $uid, $options ); // The render function escapes everything it prints.
	} else {
		$inner = sprintf(
			'<p class="oc-app-loading">%1$s</p><noscript><p class="oc-app-error">%2$s</p></noscript>',
			/* translators: %s: tool title. */
			esc_html( sprintf( __( 'Loading %s…', 'orbitcorner-tools' ), $tool['title'] ) ),
			esc_html__( 'This calculator needs JavaScript turned on in your browser.', 'orbitcorner-tools' )
		);
	}

	return '<div class="oc-app"' . $attributes . '>' . $inner . oc_tools_related_html( $name ) . '</div>' . oc_tools_schema( $name, $tool );
}
add_shortcode( 'orbit_tool', 'oc_tools_shortcode' );

/*
 * -------------------------------------------------------------------------
 * Related tools and structured data
 * -------------------------------------------------------------------------
 */

/**
 * Links shown under each tool. Paths are relative to the site's home URL.
 * Add an entry here when a tool's page goes live, e.g. the Hours Calculator.
 *
 * @return array Tool name => list of array( 'title', 'path', 'text' ).
 */
function oc_tools_related_map() {
	return array(
		'time-card' => array(
			array(
				'title' => 'Freelancer Take-Home Calculator',
				'path'  => '/tools/freelancer-take-home-calculator/',
				'text'  => 'See what reaches your bank after platform fees, exchange rates and tax.',
			),
		),
	);
}

/**
 * The "Related tools" list for a tool, or '' if it has none.
 *
 * @param string $name Tool name (registry key).
 * @return string
 */
function oc_tools_related_html( $name ) {
	$map = oc_tools_related_map();
	if ( empty( $map[ $name ] ) ) {
		return '';
	}
	$items = '';
	foreach ( $map[ $name ] as $link ) {
		$items .= '<li><a href="' . esc_url( home_url( $link['path'] ) ) . '">' . esc_html( $link['title'] ) . '</a> ' . esc_html( $link['text'] ) . '</li>';
	}
	return '<nav class="oc-related" aria-label="Related tools"><h2 class="oc-related-title">Related tools</h2><ul>' . $items . '</ul></nav>';
}

/**
 * One SoftwareApplication JSON-LD block per tool per page, for tools with a 'description'.
 *
 * @param string $name Tool name (registry key).
 * @param array  $tool Registry entry.
 * @return string
 */
function oc_tools_schema( $name, $tool ) {
	static $printed = array();
	if ( empty( $tool['description'] ) || isset( $printed[ $name ] ) ) {
		return '';
	}
	$printed[ $name ] = true;

	$data = array(
		'@context'            => 'https://schema.org',
		'@type'               => 'SoftwareApplication',
		'name'                => $tool['title'],
		'description'         => $tool['description'],
		'applicationCategory' => 'UtilitiesApplication',
		'operatingSystem'     => 'Web',
		'offers'              => array(
			'@type'         => 'Offer',
			'price'         => '0',
			'priceCurrency' => 'USD',
		),
	);
	$url = get_permalink();
	if ( $url ) {
		$data['url'] = $url;
	}
	// JSON_HEX_TAG keeps the text from ever closing the <script> tag.
	return '<script type="application/ld+json">' . wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>';
}

/*
 * -------------------------------------------------------------------------
 * Rates data
 * -------------------------------------------------------------------------
 */

/**
 * The default data shipped in data/rates.json.
 *
 * @return array
 */
function oc_tools_default_rates() {
	$path = OC_TOOLS_DIR . 'data/rates.json';
	$json = is_readable( $path ) ? file_get_contents( $path ) : false; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
	$data = is_string( $json ) ? json_decode( $json, true ) : null;
	return is_array( $data ) ? $data : array();
}

/**
 * The data saved on the settings page, or null if nothing valid is saved.
 *
 * @return array|null
 */
function oc_tools_saved_rates() {
	$saved = get_option( OC_TOOLS_OPTION, '' );
	if ( ! is_string( $saved ) || '' === $saved ) {
		return null;
	}
	$data = json_decode( $saved, true );
	return '' === oc_tools_rates_error( $data ) ? $data : null;
}

/**
 * The data the tools use: saved settings if valid, otherwise the plugin defaults.
 *
 * @return array
 */
function oc_tools_get_rates() {
	$saved = oc_tools_saved_rates();
	return null !== $saved ? $saved : oc_tools_default_rates();
}

/**
 * Checks decoded rates data.
 *
 * @param mixed $data Decoded JSON.
 * @return string Empty string if the data is usable, otherwise the reason it isn't.
 */
function oc_tools_rates_error( $data ) {
	if ( ! is_array( $data ) ) {
		return __( 'The JSON must be an object that starts with { and ends with }.', 'orbitcorner-tools' );
	}
	foreach ( array( 'market_rate', 'routes', 'platforms' ) as $key ) {
		if ( ! isset( $data[ $key ] ) || ! is_array( $data[ $key ] ) ) {
			/* translators: %s: JSON key name. */
			return sprintf( __( 'The JSON is missing the "%s" section.', 'orbitcorner-tools' ), $key );
		}
	}
	$rate = isset( $data['market_rate']['usd_to_pkr'] ) ? $data['market_rate']['usd_to_pkr'] : null;
	if ( ( ! is_int( $rate ) && ! is_float( $rate ) ) || $rate <= 0 ) {
		return __( 'market_rate → usd_to_pkr must be a number above 0.', 'orbitcorner-tools' );
	}
	return '';
}

/**
 * Cleans every value in the rates data: strips HTML from text and checks links.
 *
 * @param mixed  $value Value to clean.
 * @param string $key   Key the value is stored under.
 * @return mixed
 */
function oc_tools_sanitize_rates( $value, $key = '' ) {
	if ( is_array( $value ) ) {
		$clean = array();
		foreach ( $value as $k => $v ) {
			$clean[ $k ] = oc_tools_sanitize_rates( $v, (string) $k );
		}
		return $clean;
	}
	if ( is_string( $value ) ) {
		if ( '_url' === substr( $key, -4 ) ) {
			return esc_url_raw( $value, array( 'http', 'https' ) );
		}
		return wp_strip_all_tags( $value );
	}
	return $value; // Numbers, booleans and null.
}

/**
 * Turns the settings form into rates data ready to save.
 *
 * @param string $json Text from the JSON box.
 * @param string $rate Quick update: USD to PKR rate (empty = keep the JSON value).
 * @param string $date Quick update: last checked date, YYYY-MM-DD (empty = keep the JSON value).
 * @return array { @type array|null $data, @type string $error }
 */
function oc_tools_parse_settings( $json, $rate, $date ) {
	$json = trim( (string) $json );
	$rate = trim( (string) $rate );
	$date = trim( (string) $date );
	$fail = function ( $error ) {
		return array(
			'data'  => null,
			'error' => $error,
		);
	};

	if ( '' === $json ) {
		return $fail( __( 'The JSON box is empty. Use "Reset to defaults" to go back to the plugin\'s numbers.', 'orbitcorner-tools' ) );
	}
	$data = json_decode( $json, true );
	if ( JSON_ERROR_NONE !== json_last_error() ) {
		/* translators: %s: PHP's JSON error message. */
		return $fail( sprintf( __( 'The JSON has a mistake (%s). Look for a missing comma, quote or bracket.', 'orbitcorner-tools' ), json_last_error_msg() ) );
	}
	if ( '' !== $rate && ( ! is_numeric( $rate ) || (float) $rate <= 0 ) ) {
		return $fail( __( 'The USD → PKR market rate must be a number above 0.', 'orbitcorner-tools' ) );
	}
	if ( '' !== $date ) {
		$parts = explode( '-', $date );
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) || ! checkdate( (int) $parts[1], (int) $parts[2], (int) $parts[0] ) ) {
			return $fail( __( 'Last checked must be a real date.', 'orbitcorner-tools' ) );
		}
	}

	// The quick fields win over the same values in the JSON.
	if ( is_array( $data ) && isset( $data['market_rate'] ) && is_array( $data['market_rate'] ) ) {
		if ( '' !== $rate ) {
			$data['market_rate']['usd_to_pkr'] = round( (float) $rate, 4 );
		}
		if ( '' !== $date ) {
			$data['market_rate']['last_checked'] = $date;
		}
	}

	$error = oc_tools_rates_error( $data );
	if ( '' !== $error ) {
		return $fail( $error );
	}

	return array(
		'data'  => oc_tools_sanitize_rates( $data ),
		'error' => '',
	);
}

/*
 * -------------------------------------------------------------------------
 * Settings page: Settings → OrbitCorner Tools
 * -------------------------------------------------------------------------
 */

/**
 * Adds the settings page.
 */
function oc_tools_admin_menu() {
	add_options_page( 'OrbitCorner Tools', 'OrbitCorner Tools', 'manage_options', 'orbitcorner-tools', 'oc_tools_render_settings' );
}
add_action( 'admin_menu', 'oc_tools_admin_menu' );

/**
 * Adds a "Rates & fees" link to the plugin's row on the Plugins screen.
 *
 * @param array $links Existing links.
 * @return array
 */
function oc_tools_action_links( $links ) {
	$url = admin_url( 'options-general.php?page=orbitcorner-tools' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Rates & fees', 'orbitcorner-tools' ) . '</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'oc_tools_action_links' );

/**
 * Prints the settings page.
 */
function oc_tools_render_settings() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only picks which notice to show.
	$notice     = isset( $_GET['oc_tools_notice'] ) ? sanitize_key( wp_unslash( $_GET['oc_tools_notice'] ) ) : '';
	$has_option = '' !== get_option( OC_TOOLS_OPTION, '' );
	$saved      = oc_tools_saved_rates();
	$rates      = null !== $saved ? $saved : oc_tools_default_rates();
	$market     = isset( $rates['market_rate'] ) && is_array( $rates['market_rate'] ) ? $rates['market_rate'] : array();
	$json       = (string) wp_json_encode( $rates, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	$rate       = isset( $market['usd_to_pkr'] ) ? (string) $market['usd_to_pkr'] : '';
	$date       = isset( $market['last_checked'] ) ? (string) $market['last_checked'] : '';
	$source_url = isset( $market['source_url'] ) ? (string) $market['source_url'] : '';
	$error      = '';

	if ( 'error' === $notice ) {
		$draft = get_transient( OC_TOOLS_DRAFT );
		if ( is_array( $draft ) && isset( $draft['user'] ) && (int) $draft['user'] === get_current_user_id() ) {
			$json  = (string) $draft['json'];
			$rate  = (string) $draft['rate'];
			$date  = (string) $draft['date'];
			$error = (string) $draft['error'];
		}
		if ( '' === $error ) {
			$error = __( 'Check your changes and try again.', 'orbitcorner-tools' );
		}
	}
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'OrbitCorner Tools', 'orbitcorner-tools' ); ?></h1>

		<?php if ( 'saved' === $notice ) : ?>
			<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Saved. The tools use the new numbers right away (clear LiteSpeed Cache if a page still shows old numbers).', 'orbitcorner-tools' ); ?></p></div>
		<?php elseif ( 'reset' === $notice ) : ?>
			<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Reset. The tools now use the plugin defaults from data/rates.json (clear LiteSpeed Cache if a page still shows old numbers).', 'orbitcorner-tools' ); ?></p></div>
		<?php elseif ( 'error' === $notice ) : ?>
			<div class="notice notice-error"><p>
				<strong><?php esc_html_e( 'Not saved.', 'orbitcorner-tools' ); ?></strong>
				<?php echo esc_html( $error ); ?>
				<?php esc_html_e( 'Your edit is still in the box below so you can fix it.', 'orbitcorner-tools' ); ?>
			</p></div>
		<?php endif; ?>

		<p>
			<?php esc_html_e( 'Data in use:', 'orbitcorner-tools' ); ?>
			<strong>
				<?php
				if ( null !== $saved ) {
					esc_html_e( 'Saved settings', 'orbitcorner-tools' );
				} else {
					esc_html_e( 'Plugin defaults (data/rates.json)', 'orbitcorner-tools' );
				}
				?>
			</strong>
			<?php if ( $has_option && null === $saved ) : ?>
				<?php esc_html_e( '(the saved settings could not be read, so the defaults are used)', 'orbitcorner-tools' ); ?>
			<?php endif; ?>
		</p>

		<h2><?php esc_html_e( 'Shortcodes', 'orbitcorner-tools' ); ?></h2>
		<p><?php esc_html_e( 'Paste a shortcode into a Shortcode block on any page or post.', 'orbitcorner-tools' ); ?></p>
		<table class="form-table" role="presentation">
			<?php foreach ( oc_tools_registry() as $tool_name => $tool ) : ?>
				<?php $field_id = 'oc-shortcode-' . $tool_name; ?>
				<tr>
					<th scope="row"><label for="<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( $tool['title'] ); ?></label></th>
					<td><input type="text" id="<?php echo esc_attr( $field_id ); ?>" class="regular-text code" readonly onfocus="this.select();" value="<?php echo esc_attr( '[orbit_tool name="' . $tool_name . '"]' ); ?>"></td>
				</tr>
			<?php endforeach; ?>
		</table>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="oc_tools_save">
			<?php wp_nonce_field( 'oc_tools_save' ); ?>

			<h2><?php esc_html_e( 'Quick update', 'orbitcorner-tools' ); ?></h2>
			<p class="description"><?php esc_html_e( 'These two fields win over the same values in the JSON below.', 'orbitcorner-tools' ); ?></p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="oc-usd-to-pkr"><?php esc_html_e( 'USD → PKR market rate', 'orbitcorner-tools' ); ?></label></th>
					<td>
						<input type="number" id="oc-usd-to-pkr" name="oc_usd_to_pkr" step="0.01" min="0.01" class="regular-text" value="<?php echo esc_attr( $rate ); ?>">
						<?php if ( '' !== $source_url ) : ?>
							<p class="description">
								<?php esc_html_e( 'Check today\'s rate:', 'orbitcorner-tools' ); ?>
								<a href="<?php echo esc_url( $source_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $source_url ); ?></a>
							</p>
						<?php endif; ?>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="oc-last-checked"><?php esc_html_e( 'Last checked', 'orbitcorner-tools' ); ?></label></th>
					<td><input type="date" id="oc-last-checked" name="oc_last_checked" value="<?php echo esc_attr( $date ); ?>"></td>
				</tr>
			</table>

			<h2><?php esc_html_e( 'Advanced', 'orbitcorner-tools' ); ?></h2>
			<p class="description"><label for="oc-rates-json"><?php esc_html_e( 'All fees, tax rates and routes as JSON. Keep the quotes, commas and brackets exactly as they are.', 'orbitcorner-tools' ); ?></label></p>
			<textarea id="oc-rates-json" name="oc_rates_json" rows="30" class="large-text code" spellcheck="false" style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; tab-size: 4;"><?php echo esc_textarea( $json ); ?></textarea>

			<p class="submit">
				<button type="submit" name="oc_tools_action" value="save" class="button button-primary"><?php esc_html_e( 'Save changes', 'orbitcorner-tools' ); ?></button>
				<button type="submit" name="oc_tools_action" value="reset" class="button" onclick="return confirm('<?php echo esc_js( __( 'Reset all rates and fees to the plugin defaults? Your saved changes will be deleted.', 'orbitcorner-tools' ) ); ?>');"><?php esc_html_e( 'Reset to defaults', 'orbitcorner-tools' ); ?></button>
			</p>
		</form>
	</div>
	<?php
}

/**
 * Handles "Save changes" and "Reset to defaults" (admin-post.php?action=oc_tools_save).
 */
function oc_tools_handle_save() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to change these settings.', 'orbitcorner-tools' ), 403 );
	}
	check_admin_referer( 'oc_tools_save' );

	$page   = admin_url( 'options-general.php?page=orbitcorner-tools' );
	$action = isset( $_POST['oc_tools_action'] ) ? sanitize_key( wp_unslash( $_POST['oc_tools_action'] ) ) : 'save';

	if ( 'reset' === $action ) {
		delete_option( OC_TOOLS_OPTION );
		delete_transient( OC_TOOLS_DRAFT );
		wp_safe_redirect( add_query_arg( 'oc_tools_notice', 'reset', $page ) );
		exit;
	}

	// The JSON is validated and every value cleaned in oc_tools_parse_settings().
	$json   = isset( $_POST['oc_rates_json'] ) ? (string) wp_unslash( $_POST['oc_rates_json'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$rate   = isset( $_POST['oc_usd_to_pkr'] ) ? sanitize_text_field( wp_unslash( $_POST['oc_usd_to_pkr'] ) ) : '';
	$date   = isset( $_POST['oc_last_checked'] ) ? sanitize_text_field( wp_unslash( $_POST['oc_last_checked'] ) ) : '';
	$result = oc_tools_parse_settings( $json, $rate, $date );

	if ( '' !== $result['error'] ) {
		set_transient(
			OC_TOOLS_DRAFT,
			array(
				'user'  => get_current_user_id(),
				'json'  => $json,
				'rate'  => $rate,
				'date'  => $date,
				'error' => $result['error'],
			),
			5 * MINUTE_IN_SECONDS
		);
		wp_safe_redirect( add_query_arg( 'oc_tools_notice', 'error', $page ) );
		exit;
	}

	update_option( OC_TOOLS_OPTION, wp_json_encode( $result['data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ), false );
	delete_transient( OC_TOOLS_DRAFT );
	wp_safe_redirect( add_query_arg( 'oc_tools_notice', 'saved', $page ) );
	exit;
}
add_action( 'admin_post_oc_tools_save', 'oc_tools_handle_save' );

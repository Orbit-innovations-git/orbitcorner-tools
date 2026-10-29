<?php
/**
 * Stand-ins for the WordPress functions the plugin calls while printing a tool or building
 * generated pages, so tests/build-preview.php and the PHP tests run without WordPress.
 *
 * @package OrbitCorner_Tools
 */

define( 'ABSPATH', __DIR__ . '/' );

function esc_html( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
}
function esc_attr( $text ) {
	return esc_html( $text );
}
function esc_url( $url ) {
	return esc_html( $url );
}
function __( $text ) {
	return $text;
}
function esc_html__( $text ) {
	return esc_html( $text );
}
function wp_json_encode( $data, $flags = 0 ) {
	return json_encode( $data, $flags );
}
function sanitize_text_field( $text ) {
	return trim( preg_replace( '/[\r\n\t ]+/', ' ', strip_tags( (string) $text ) ) );
}
function do_action() {}
function wp_unslash( $value ) {
	return is_string( $value ) ? stripslashes( $value ) : $value;
}
function sanitize_key( $key ) {
	return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
}
function shortcode_atts( $pairs, $atts ) {
	$atts = (array) $atts;
	$out  = array();
	foreach ( $pairs as $name => $default ) {
		$out[ $name ] = array_key_exists( $name, $atts ) ? $atts[ $name ] : $default;
	}
	return $out;
}
function selected( $selected, $current ) {
	echo (string) $selected === (string) $current ? " selected='selected'" : '';
}
function home_url( $path = '' ) {
	return 'https://orbitcorner.com' . $path;
}
function get_permalink() {
	return isset( $GLOBALS['oc_preview_permalink'] ) ? $GLOBALS['oc_preview_permalink'] : 'https://orbitcorner.com/';
}
function wp_parse_url( $url, $component = -1 ) {
	return parse_url( $url, $component ); // phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url
}
function plugin_dir_path( $file ) {
	return dirname( $file ) . '/';
}
function plugin_dir_url( $file ) {
	return '../';
}
function plugin_basename( $file ) {
	return basename( dirname( $file ) ) . '/' . basename( $file );
}
function current_user_can() {
	return false;
}
function wp_style_is() {
	return true;
}
function add_action() {}
function add_filter() {}
function apply_filters( $hook, $value ) {
	return $value;
}
function add_shortcode() {}
function add_management_page() {}
function register_activation_hook() {}
function absint( $n ) {
	return abs( (int) $n );
}
function trailingslashit( $text ) {
	return rtrim( $text, '/\\' ) . '/';
}
function get_bloginfo() {
	return 'OrbitCorner';
}
// Published pages, as on orbitcorner.com. The Hours Calculator page doesn't exist yet.
$GLOBALS['oc_test_pages'] = array( 'tools/time-card-calculator', 'tools/take-home-pay', 'tools/countdown' );
function get_page_by_path( $path ) {
	return in_array( $path, $GLOBALS['oc_test_pages'], true ) ? (object) array( 'post_status' => 'publish' ) : null;
}
function get_post_status( $post ) {
	return $post->post_status;
}
function wp_enqueue_style() {}
function wp_enqueue_script() {}
function wp_add_inline_script() {}
